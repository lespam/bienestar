import { test, expect, type Page, type Route } from '@playwright/test';
import { entrarConContenido, revisarPantalla, vigilarConsola } from './ayuda';

async function sembrar(page: Page, tabla: string, filas: object[]) {
  await page.evaluate(({ tabla, filas }) => new Promise<void>((ok, mal) => {
    const abrir = indexedDB.open('bienestar');
    abrir.onerror = () => mal(abrir.error);
    abrir.onsuccess = () => {
      const bd = abrir.result, tx = bd.transaction(tabla, 'readwrite');
      for (const f of filas) tx.objectStore(tabla).put(f);
      tx.oncomplete = () => { bd.close(); ok(); };
      tx.onerror = () => mal(tx.error);
    };
  }), { tabla, filas });
}
const CLAVE = 'sk-ant-api03-prueba1234';
async function prenderIA(page: Page) {
  await sembrar(page, 'ajustes', [{ k: 'ia.on', v: true }, { k: 'ia.clave', v: CLAVE }]);
  await page.reload();
}
async function simular(page: Page, texto: string, enviados: { body: string }[] = []) {
  await page.route('https://api.anthropic.com/v1/messages', async (route: Route) => {
    enviados.push({ body: route.request().postData() ?? '' });
    await route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify({ content: [{ type: 'text', text: texto }], usage: { input_tokens: 2000, output_tokens: 400 } }) });
  });
  return enviados;
}
const jeff = (no: string[], nivel: string) => ({ quien: 'jeff', src: null, fecha: null, k: null, p: null, c: null, g: null, mk: null, mp: null, por: 1, gustos: [], no, niveles: Object.fromEntries(no.map((x) => [x, nivel])), nota: '' });
async function abrirTips(page: Page) {
  await page.getByRole('button', { name: 'Comida', exact: true }).click();
  await page.getByRole('button', { name: 'Tips', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Tips y combinaciones', level: 2 })).toBeVisible();
}

// Versión 2, fase 6: combinaciones acordes a lo que no comen, y «Mis usuales».
test('Combinaciones: lo que Jeff no come no aparece y la IA pasa por el mismo seguro', async ({ page }) => {
  const errores = vigilarConsola(page);
  await entrarConContenido(page);
  await prenderIA(page);
  await sembrar(page, 'perfiles', [jeff(['huevo'], 'nogusta')]);
  await page.reload();
  const enviados = await simular(page, JSON.stringify({ combos: [
    { b: 'Para probar', t: 'Pollo + limón', x: 'El limón realza el sabor del pollo.', partes: ['pollo', 'limón'] },
    { b: 'Para probar', t: 'Huevo + espinaca', x: 'Se complementan.', partes: ['huevo', 'espinaca'] },
    { b: 'Para probar', t: 'Jitomate + albahaca', x: 'Una pareja clásica de sabor.', partes: ['jitomate', 'albahaca'] }
  ] }));
  await abrirTips(page);
  await page.getByRole('tab', { name: 'Combinaciones' }).click();
  await expect(page.getByRole('heading', { name: 'Arroz + frijoles' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Huevo + verduras' })).toHaveCount(0);
  await expect(page.getByText('No se muestra 1 combinación que incluye algo que alguno de los dos no come.')).toBeVisible();
  await revisarPantalla(page);

  // Pedir más: solo pasan las que respetan lo que no comen
  await page.getByRole('button', { name: 'Pedir más combinaciones' }).click();
  await expect(page.getByText('tus exclusiones, los ingredientes de tu menú de la semana y las combinaciones que ya conoces')).toBeVisible();
  await page.getByRole('button', { name: 'Enviar', exact: true }).click();
  await expect(page.getByText('Pollo + limón')).toBeVisible();
  await expect(page.getByText('Jitomate + albahaca')).toBeVisible();
  await expect(page.getByText('Huevo + espinaca')).toHaveCount(0);
  const cuerpo = JSON.parse(enviados[0].body).messages[0].content[0].text as string;
  expect(cuerpo).toContain('«no me gusta»');
  expect(cuerpo).toContain('Huevo');
  await revisarPantalla(page);
  await page.getByRole('button', { name: 'Guardar todas' }).click();
  await expect(page.getByRole('heading', { name: 'Pollo + limón' })).toBeVisible();
  await expect(page.getByText('Sugerido por IA').first()).toBeVisible();

  // Quedan guardadas: espero a que el guardado termine antes de recargar, y al volver no se piden otra vez
  await expect.poll(() => page.evaluate(() => new Promise<string>((ok) => {
    const abrir = indexedDB.open('bienestar');
    abrir.onsuccess = () => {
      const bd = abrir.result, pedir = bd.transaction('comida').objectStore('comida').get('tips');
      pedir.onsuccess = () => { bd.close(); ok(JSON.stringify(pedir.result ?? {})); };
      pedir.onerror = () => { bd.close(); ok(''); };
    };
  }))).toContain('Jitomate + albahaca');
  await page.reload();
  await abrirTips(page);
  await page.getByRole('tab', { name: 'Combinaciones' }).click();
  await expect(page.getByRole('heading', { name: 'Jitomate + albahaca' })).toBeVisible();
  await page.getByRole('button', { name: 'Quitar la combinación Jitomate + albahaca' }).click();
  await expect(page.getByRole('heading', { name: 'Jitomate + albahaca' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Deshacer' }).click();
  await expect(page.getByRole('heading', { name: 'Jitomate + albahaca' })).toBeVisible();
  expect(enviados).toHaveLength(1);
  expect(errores).toEqual([]);
});

test('Mis usuales: agregar, una idea a la vez sin IA, ahora no y no me interesa', async ({ page }) => {
  const errores = vigilarConsola(page);
  await entrarConContenido(page);
  await abrirTips(page);
  await page.getByRole('tab', { name: 'Mis usuales' }).click();
  await expect(page.getByText('Aún no hay ninguno.')).toBeVisible();
  await page.getByLabel('Agregar un ingrediente usual').fill('limones');
  await page.getByRole('button', { name: 'Agregar', exact: true }).click();
  await expect(page.getByText('Limones', { exact: true })).toBeVisible();
  await revisarPantalla(page);

  // Sin IA: una idea del catálogo, con su siguiente paso
  await expect(page.getByRole('button', { name: 'Pedir una idea nueva con IA' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Pedir una idea', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Tomillo' })).toBeVisible();
  await expect(page.getByText('Siguiente paso: Agrega tomillo a la lista de compras.')).toBeVisible();
  await revisarPantalla(page);
  // «No me interesa»: no vuelve
  await page.getByRole('button', { name: 'No me interesa' }).click();
  await page.getByRole('button', { name: 'Pedir una idea', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Coles de Bruselas' })).toBeVisible();
  // «Ahora no» tampoco la repite pronto
  await page.getByRole('button', { name: 'Ahora no' }).click();
  await page.getByRole('button', { name: 'Pedir una idea', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Jengibre' })).toBeVisible();
  // Agregar a usuales
  await page.getByRole('button', { name: 'Agregar a usuales' }).click();
  await expect(page.getByText('Jengibre', { exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Mis usuales · 2' })).toBeVisible();

  // Se queda al volver: espero a que el guardado termine antes de recargar
  await expect.poll(() => page.evaluate(() => new Promise<string>((ok) => {
    const abrir = indexedDB.open('bienestar');
    abrir.onsuccess = () => {
      const bd = abrir.result, pedir = bd.transaction('comida').objectStore('comida').get('usuales');
      pedir.onsuccess = () => { bd.close(); ok(JSON.stringify(pedir.result ?? {})); };
      pedir.onerror = () => { bd.close(); ok(''); };
    };
  }))).toContain('Jengibre');
  await page.reload();
  await abrirTips(page);
  await page.getByRole('tab', { name: 'Mis usuales' }).click();
  await expect(page.getByText('Jengibre', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Quitar de mis usuales: Limones' }).click();
  await expect(page.getByRole('heading', { name: 'Mis usuales · 1' })).toBeVisible();
  await page.getByRole('button', { name: 'Deshacer' }).click();
  await expect(page.getByRole('heading', { name: 'Mis usuales · 2' })).toBeVisible();
  expect(errores).toEqual([]);
});

test('Mis usuales: una idea con IA respeta lo que no comen y pasa a la lista de compras', async ({ page }) => {
  const errores = vigilarConsola(page);
  await entrarConContenido(page);
  await prenderIA(page);
  await sembrar(page, 'perfiles', [jeff(['tomillo'], 'odio')]);
  await page.reload();
  const enviados = await simular(page, JSON.stringify({ ingrediente: 'Coles de Bruselas', por_que: 'Cambiar de verduras suma variedad.', receta_ids: ['tinga'], adaptacion: null, paso: 'Agrega coles de Bruselas a la lista de compras.' }));
  await abrirTips(page);
  await page.getByRole('tab', { name: 'Mis usuales' }).click();
  // El catálogo salta el tomillo (Jeff no lo come)
  await page.getByRole('button', { name: 'Pedir una idea', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Tomillo' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Ahora no' }).click();

  await page.getByRole('button', { name: 'Pedir una idea nueva con IA' }).click();
  await expect(page.getByText('tus ingredientes usuales, tus exclusiones, lo que ya rechazaste y los nombres de hasta 15 recetas')).toBeVisible();
  await page.getByRole('button', { name: 'Enviar', exact: true }).click();
  await page.getByRole('button', { name: 'Verla en Mis usuales' }).click();
  await expect(page.getByRole('heading', { name: 'Coles de Bruselas' })).toBeVisible();
  await expect(page.getByText('Sugerido por IA').first()).toBeVisible();
  await expect(page.getByRole('button', { name: /Tinga de pollo/ })).toBeVisible();
  const cuerpo = JSON.parse(enviados[0].body).messages[0].content[0].text as string;
  expect(cuerpo).toContain('tomillo');
  await revisarPantalla(page);
  await page.getByRole('button', { name: 'Agregar coles de bruselas a la lista de compras' }).click();
  await expect(page.getByText('«Coles de Bruselas» está en tu lista de compras')).toBeVisible();
  expect(errores).toEqual([]);
});
