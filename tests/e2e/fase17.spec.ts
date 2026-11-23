import { readFileSync } from 'node:fs';
import { test, expect, type Page } from '@playwright/test';
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
const perfil = (quien: 'les' | 'jeff', k: [number, number], por: number, mk: number, mp: number) =>
  ({ quien, src: 'nut', fecha: '2026-11-01', k, p: 90, c: 130, g: 45, mk, mp, por, gustos: [], no: [], niveles: {}, nota: '' });

async function tingaEnElMenu(page: Page) {
  await page.getByRole('button', { name: 'Comida', exact: true }).click();
  await page.getByRole('button', { name: 'Recetario' }).click();
  await page.getByRole('button', { name: /Tinga de pollo/ }).click();
  await page.getByRole('button', { name: 'Agregar al menú' }).click();
  await page.getByRole('dialog', { name: 'Agregar al menú' }).getByRole('button', { name: 'Agregar', exact: true }).click();
  await expect(page.getByText(/^Agregado al menú: /)).toBeVisible();
  await page.waitForTimeout(400);
  await page.getByRole('button', { name: 'Volver' }).click();
  await page.getByRole('button', { name: 'Volver' }).click();
}
async function abrirMenu(page: Page) {
  await page.getByRole('button', { name: 'Comida', exact: true }).click();
  await page.getByRole('button', { name: 'Menú', exact: true }).first().click();
  await expect(page.getByRole('heading', { name: 'Menú de la semana', level: 2 })).toBeVisible();
}

// Versión 2, sección 9: macros en el plan.
test('Macros: una barra por persona contra la referencia que escribieron, la semana y sin números', async ({ page }) => {
  const errores = vigilarConsola(page);
  await entrarConContenido(page);
  await sembrar(page, 'perfiles', [perfil('les', [1200, 1500], 1, 300, 25), perfil('jeff', [1800, 2200], 1.5, 450, 40)]);
  await page.reload();
  await page.getByRole('button', { name: 'Comida', exact: true }).click();
  await page.getByRole('button', { name: 'Ver números' }).click();
  await tingaEnElMenu(page);
  await abrirMenu(page);

  const tarjeta = page.getByRole('region', { name: 'Lo que suma este día' });
  await expect(tarjeta).toBeVisible();
  // Les come 1 porción de tinga (290 kcal) y Jeff 1½ (435)
  await expect(tarjeta.getByRole('img', { name: 'Les: planeado ~290 kcal, tu referencia 1,200–1,500 kcal' })).toBeVisible();
  await expect(tarjeta.getByRole('img', { name: 'Jeff: planeado ~440 kcal, tu referencia 1,800–2,200 kcal' })).toBeVisible();
  await expect(tarjeta.getByText('Proteína').first()).toBeVisible();
  await expect(tarjeta.getByText('La app no las calcula ni las juzga.')).toBeVisible();
  // Nada rojo ni palabras de aviso
  const cuerpo = await tarjeta.innerText();
  expect(cuerpo).not.toMatch(/te falta|faltan|te pasaste|de más|exceso/i);
  await revisarPantalla(page);

  // La semana: un día con menú y los demás vacíos, que no cuentan como poco
  await tarjeta.getByRole('button', { name: 'Ver la semana' }).click();
  const hoja = page.getByRole('dialog', { name: 'Macros de la semana' });
  await expect(hoja.getByText('Un día sin menú queda vacío: no cuenta como poco.')).toBeVisible();
  await expect(hoja.getByText('Sin menú').first()).toBeVisible();
  await expect(hoja.getByText(/^Promedio de su día planeado: ~290 kcal/)).toBeVisible();
  await revisarPantalla(page);
  await hoja.getByRole('button', { name: 'Cerrar' }).click();

  // Con «Ocultar números» no hay barras ni cifras, solo un aviso con «Mostrar»
  await page.getByRole('button', { name: 'Volver' }).click();
  await page.getByRole('button', { name: 'Ocultar números' }).click();
  await page.getByRole('button', { name: 'Menú', exact: true }).first().click();
  await expect(page.getByText('Calorías y macros ocultos.')).toBeVisible();
  await expect(page.getByRole('img', { name: /planeado/ })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Ver la semana' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Mostrar' }).click();
  await expect(page.getByRole('img', { name: /^Les: planeado/ })).toBeVisible();
  expect(errores).toEqual([]);
});

test('Macros: «Acerca a mis referencias» solo ordena las tarjetas y no esconde ninguna', async ({ page }) => {
  const errores = vigilarConsola(page);
  await entrarConContenido(page);
  await page.getByRole('button', { name: 'Comida', exact: true }).click();
  await page.getByRole('button', { name: 'Recetario' }).click();
  await page.getByRole('button', { name: /Elegir con tarjetas/ }).click();
  await expect(page.getByRole('heading', { name: 'Elegir con tarjetas', level: 2 })).toBeVisible();
  // Sin referencia por comida en los perfiles, la opción ni aparece
  await expect(page.getByRole('switch', { name: 'Acerca a mis referencias' })).toHaveCount(0);
  const primera = () => page.locator('.tj-card[data-pos="0"]').getAttribute('aria-label');
  // Orden de siempre: alfabético, así que los tacos van antes que la tinga
  await expect.poll(primera).toContain('Tacos de champiñón');

  await page.getByRole('button', { name: 'Volver' }).click();
  await page.getByRole('button', { name: 'Volver' }).click();
  await sembrar(page, 'perfiles', [perfil('les', [1200, 1500], 1, 290, 28), perfil('jeff', [1800, 2200], 1, 290, 28)]);
  await page.reload();
  await page.getByRole('button', { name: 'Comida', exact: true }).click();
  await page.getByRole('button', { name: 'Recetario' }).click();
  await page.getByRole('button', { name: /Elegir con tarjetas/ }).click();
  const opcion = page.getByRole('switch', { name: 'Acerca a mis referencias' });
  await expect(opcion).toBeVisible();
  await expect(page.getByText('Solo cambia el orden: no esconde ninguna.')).toBeVisible();
  await opcion.click();
  // Ahora la tinga (290 kcal, 28 g) está más cerca de la referencia por comida
  await expect.poll(primera).toContain('Tinga de pollo');
  await expect(page.locator('.tj-count')).toContainText('de 2');
  await revisarPantalla(page);
  await opcion.click();
  await expect.poll(primera).toContain('Tacos de champiñón');
  expect(errores).toEqual([]);
});

// Versión 2, sección 9: continuidad entre el teléfono y la computadora.
test('Continuidad: el paquete de un aparato entra en otro, avisa qué se reemplaza y se puede deshacer', async ({ page, browser }) => {
  const errores = vigilarConsola(page);
  await entrarConContenido(page);
  await tingaEnElMenu(page);
  await page.getByRole('button', { name: 'Inicio', exact: true }).click();
  await page.getByRole('button', { name: 'Ajustes' }).click();
  const descarga = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Exportar respaldo (ZIP)' }).click();
  const zip = readFileSync(await (await descarga).path());

  // Otro aparato: entra sin nada y recibe el paquete
  const otro = await browser.newContext({ viewport: page.viewportSize(), baseURL: test.info().project.use.baseURL });
  const b = await otro.newPage();
  const erroresB = vigilarConsola(b);
  await entrarConContenido(b);
  await b.getByRole('button', { name: 'Ajustes' }).click();
  await b.getByRole('button', { name: 'Importar respaldo' }).click();
  const elegir = b.waitForEvent('filechooser');
  await b.getByRole('button', { name: 'Elegir archivo ZIP' }).click();
  await (await elegir).setFiles({ name: 'paquete.zip', mimeType: 'application/zip', buffer: zip });
  await expect(b.getByRole('dialog', { name: 'Qué trae este paquete' })).toBeVisible();
  await expect(b.getByText(/^Se creó hoy .* en /)).toBeVisible();
  const comida = b.getByRole('region', { name: 'Comida y menú' });
  await expect(comida).toBeVisible();
  await expect(comida.getByRole('radio', { checked: true })).toHaveCount(1);
  // Lo que no cambió no se toca: Cuerpo no trae nada
  await expect(b.getByRole('region', { name: 'Cuerpo' })).toHaveCount(0);
  await revisarPantalla(b);
  await b.getByRole('button', { name: 'Aplicar lo que elegí' }).click();
  await expect(b.getByText(/^Respaldo importado/)).toBeVisible();
  await b.getByRole('button', { name: 'Inicio', exact: true }).click();
  await b.getByRole('button', { name: 'Comida', exact: true }).click();
  await b.getByRole('button', { name: 'Menú', exact: true }).first().click();
  await expect(b.getByText('Tinga de pollo').first()).toBeVisible();

  // Deshacer vuelve al menú vacío de antes
  await b.getByRole('button', { name: 'Volver' }).click();
  await b.getByRole('button', { name: 'Deshacer' }).click();
  await b.getByRole('button', { name: 'Menú', exact: true }).first().click();
  await expect(b.getByText('Tinga de pollo')).toHaveCount(0);
  expect(errores).toEqual([]);
  expect(erroresB).toEqual([]);
  await otro.close();
});

// En la computadora, la misma app usa el ancho para planear: la tabla de la semana se ve completa y grande.
test.describe('en la computadora', () => {
  test.use({ viewport: { width: 1280, height: 900 } });
  test('Acomoda la semana: la tabla de la semana usa todo el ancho', async ({ page }) => {
    const errores = vigilarConsola(page);
    await entrarConContenido(page);
    await page.getByRole('button', { name: 'Comida', exact: true }).click();
    await page.getByRole('button', { name: 'Menú', exact: true }).first().click();
    await page.getByRole('button', { name: 'Planear', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Acomoda la semana', level: 2 })).toBeVisible();
    const tabla = await page.locator('.tj-tabla').boundingBox();
    expect(tabla!.width).toBeGreaterThan(1000);
    const celda = await page.locator('.tj-tabla .tj-tc').first().boundingBox();
    expect(celda!.height).toBeGreaterThanOrEqual(80);
    // Los controles no se estiran a todo el ancho
    expect((await page.locator('.tj-plan').boundingBox())!.width).toBeLessThanOrEqual(760);
    await revisarPantalla(page);
    expect(errores).toEqual([]);
  });
});
