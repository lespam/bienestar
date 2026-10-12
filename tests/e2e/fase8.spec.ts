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
/** Prende la IA con una clave de prueba, como si ya la hubieras puesto en Ajustes. */
async function prenderIA(page: Page) {
  await sembrar(page, 'ajustes', [{ k: 'ia.on', v: true }, { k: 'ia.clave', v: CLAVE }]);
  await page.reload();
}
/** Responde a Anthropic con texto fijo y guarda lo que se envió. */
async function simular(page: Page, texto: string | (() => string), enviados: { headers: Record<string, string>; body: string }[] = []) {
  await page.route('https://api.anthropic.com/v1/messages', async (route: Route) => {
    const req = route.request();
    enviados.push({ headers: req.headers(), body: req.postData() ?? '' });
    await route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify({ content: [{ type: 'text', text: typeof texto === 'function' ? texto() : texto }] }) });
  });
  return enviados;
}
const abrirTinga = async (page: Page) => {
  await page.getByRole('button', { name: 'Comida', exact: true }).click();
  await page.getByRole('button', { name: 'Recetario' }).click();
  await page.getByRole('button', { name: /Tinga de pollo/ }).click();
};

test('Ajustes: la IA empieza apagada, pide tu clave y se puede quitar', async ({ page }) => {
  const errores = vigilarConsola(page);
  await entrarConContenido(page);
  await page.getByRole('button', { name: 'Ajustes' }).click();
  await expect(page.getByRole('switch', { name: 'Usar IA' })).toHaveAttribute('aria-checked', 'false');
  await expect(page.getByLabel('Tu clave de Anthropic')).toHaveCount(0);

  // Con la IA apagada, la ayuda lo explica y deja hacerlo a mano
  await page.getByRole('button', { name: 'Volver' }).click();
  await abrirTinga(page);
  await page.getByRole('button', { name: 'Tips para prepararla' }).click();
  await expect(page.locator('.ai-body').getByText('La IA está apagada. Puedes activarla en Ajustes con tu propia clave.')).toBeVisible();
  await revisarPantalla(page);
  await page.getByRole('button', { name: 'Ir a Ajustes' }).click();

  await page.getByRole('switch', { name: 'Usar IA' }).click();
  await expect(page.getByRole('switch', { name: 'Usar IA' })).toHaveAttribute('aria-checked', 'true');
  await page.getByLabel('Tu clave de Anthropic').fill('hola');
  await page.getByRole('button', { name: 'Guardar clave' }).click();
  await expect(page.getByText('La clave de Anthropic empieza con sk-ant-')).toBeVisible();
  await page.getByLabel('Tu clave de Anthropic').fill(CLAVE);
  await page.getByRole('button', { name: 'Guardar clave' }).click();
  await expect(page.getByText('····1234')).toBeVisible();
  await expect(page.getByRole('switch', { name: 'Leer recetas desde una foto' })).toHaveAttribute('aria-checked', 'true');
  await page.getByRole('switch', { name: 'Ordenar mi preparación' }).click();
  await expect(page.getByRole('switch', { name: 'Ordenar mi preparación' })).toHaveAttribute('aria-checked', 'false');
  await expect(page.getByText('Nunca se envía: tu peso, medidas, fotos de cuerpo, calorías ni tu registro de comidas.', { exact: false })).toBeVisible();
  await revisarPantalla(page);

  // La clave no se ve de nuevo y se puede quitar
  await page.waitForTimeout(300);
  await page.reload();
  await page.getByRole('button', { name: 'Ajustes' }).click();
  await expect(page.getByText('····1234')).toBeVisible();
  await expect(page.locator('body')).not.toContainText(CLAVE);
  await page.getByRole('button', { name: /^Quitar/ }).click();
  await expect(page.getByLabel('Tu clave de Anthropic')).toBeVisible();
  expect(errores).toEqual([]);
});

test('Receta: tips y cambios con IA avisan qué se envía, se revisan y quedan marcados', async ({ page }) => {
  const errores = vigilarConsola(page);
  await entrarConContenido(page);
  await prenderIA(page);
  const enviados = await simular(page, '{"tips":["Deshebra el pollo caliente.","Licúa la salsa con el caldo.","Cocina doble y congela."]}');
  await abrirTinga(page);
  await page.getByRole('button', { name: 'Tips para prepararla' }).click();

  // La primera vez avisa exactamente qué se envía y nada sale hasta tocar Enviar
  await expect(page.getByText('Esto se envía a Anthropic:')).toBeVisible();
  await expect(page.getByText('el nombre y los ingredientes de la receta.', { exact: false }).first()).toBeVisible();
  await expect(page.getByText('Nunca se envía: tu peso, medidas, fotos de cuerpo, calorías ni tu registro de comidas.', { exact: false })).toBeVisible();
  expect(enviados).toHaveLength(0);
  await revisarPantalla(page);
  await page.getByRole('button', { name: 'Enviar' }).click();
  await expect(page.getByText('Tres ideas para preparar «Tinga de pollo».')).toBeVisible();
  expect(enviados).toHaveLength(1);
  expect(enviados[0].headers['x-api-key']).toBe(CLAVE);
  expect(enviados[0].body).toContain('Tinga de pollo');
  expect(enviados[0].body).toContain('pechuga de pollo');
  expect(enviados[0].body).not.toMatch(/kcal|calorías|medidas/i);
  await expect(page.getByText('Sugerido por IA')).toHaveCount(3);
  await revisarPantalla(page);

  // Guardar una, descartar otra: lo que guardas queda marcado
  await page.getByRole('button', { name: 'Guardar como tip' }).first().click();
  await page.getByRole('button', { name: 'Descartar' }).first().click();
  await page.getByRole('button', { name: 'Descartar' }).first().click();
  await expect(page.getByRole('dialog', { name: 'Ayuda con IA' })).toHaveCount(0);
  const notas = page.locator('.rc-nt');
  await expect(notas).toHaveCount(1);
  await expect(notas.first()).toContainText('Deshebra el pollo caliente.');
  await expect(notas.first()).toContainText('Sugerido por IA');

  // La segunda vez ya no repite el aviso
  await page.getByRole('button', { name: 'Tips para prepararla' }).click();
  await expect(page.getByText('Tres ideas para preparar «Tinga de pollo».')).toBeVisible();
  expect(enviados).toHaveLength(2);
  await page.getByRole('button', { name: 'Cerrar', exact: true }).first().click();

  // Si Anthropic no acepta la clave, lo dice sin perder nada
  await page.unroute('https://api.anthropic.com/v1/messages');
  await page.route('https://api.anthropic.com/v1/messages', (route) => route.fulfill({ status: 401, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: '{}' }));
  await page.getByRole('button', { name: 'Cambiar un ingrediente' }).click();
  await page.getByRole('button', { name: 'Enviar' }).click();
  await expect(page.locator('.ai-body').getByText('Anthropic no aceptó tu clave. Revisa que esté bien escrita en Ajustes.')).toBeVisible();
  await revisarPantalla(page);
  expect(errores.filter((e) => !/401|Failed to load resource/.test(e))).toEqual([]);
});

test('Receta desde una foto: se lee con IA, se revisa y se guarda marcada', async ({ page }) => {
  const errores = vigilarConsola(page);
  await entrarConContenido(page);
  await prenderIA(page);
  const enviados = await simular(page, 'Aquí está: {"n":"Enfrijoladas","cat":"Comida","y":4,"t":"35 min","ing":["400 g de pechuga de pollo","12 tortillas de maíz"],"steps":["Licúa los frijoles.","Rellena las tortillas."]}');
  await page.getByRole('button', { name: 'Comida', exact: true }).click();
  await page.getByRole('button', { name: 'Recetario' }).click();
  await page.getByRole('button', { name: '+ Agregar', exact: true }).first().click();
  await page.getByRole('tab', { name: 'Foto' }).click();
  await expect(page.getByRole('button', { name: 'Leer la receta' })).toBeDisabled();
  const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
  await page.locator('.to-pick input').nth(1).setInputFiles({ name: 'receta.png', mimeType: 'image/png', buffer: PNG });
  await expect(page.getByRole('img', { name: 'Foto de tu receta' })).toBeVisible();
  await revisarPantalla(page);
  await page.getByRole('button', { name: 'Leer la receta' }).click();
  await expect(page.getByText('la imagen de la receta', { exact: false }).first()).toBeVisible();
  await page.getByRole('button', { name: 'Enviar' }).click();
  await expect(page.getByLabel('Nombre')).toHaveValue('Enfrijoladas');
  await expect(page.getByText('Leída con IA. Revisa cada parte y cambia lo que haga falta.')).toBeVisible();
  await expect(page.getByLabel('Ingredientes, uno por línea')).toHaveValue('400 g de pechuga de pollo\n12 tortillas de maíz');
  expect(JSON.parse(enviados[0].body).messages[0].content[0].type).toBe('image');
  await revisarPantalla(page);
  await page.getByRole('button', { name: 'Guardar receta' }).click();
  await expect(page.getByRole('heading', { name: 'Enfrijoladas' })).toBeVisible();
  await expect(page.getByText('Leída con IA de una foto · revísala').first()).toBeVisible();
  expect(errores).toEqual([]);
});

test('Menú, preparación y tips: ideas y orden con IA, con Deshacer', async ({ page }) => {
  const errores = vigilarConsola(page);
  await entrarConContenido(page);
  await prenderIA(page);

  // Preparación: una tanda con dos cosas para ordenar
  const hoy = new Date();
  const iso = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}-${String(hoy.getDate()).padStart(2, '0')}`;
  await sembrar(page, 'comida', [{ k: 'prep', v: [{ id: 't1', fecha: iso, hora: '20:00', items: [{ t: 'Lavar la lechuga', f: '', m: 5, ok: false }, { t: 'Cocer el pollo', f: '', m: 40, ok: false }] }] }]);
  await page.reload();
  await simular(page, '{"orden":[1,0]}');
  await page.getByRole('button', { name: 'Comida', exact: true }).click();
  await page.locator('.pt').getByRole('button', { name: 'Ver', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Plan de preparación', level: 2 })).toBeVisible();
  await page.getByRole('button', { name: 'Ordenar mi preparación con IA' }).click();
  await page.getByRole('button', { name: 'Enviar' }).click();
  await expect(page.getByText('1. Cocer el pollo (40 min)  2. Lavar la lechuga (5 min)')).toBeVisible();
  await revisarPantalla(page);
  await page.getByRole('button', { name: 'Usar este orden' }).click();
  await expect(page.locator('.pp-it b').first()).toHaveText('Cocer el pollo');
  await page.getByRole('button', { name: 'Deshacer' }).click();
  await expect(page.locator('.pp-it b').first()).toHaveText('Lavar la lechuga');
  await page.getByRole('button', { name: 'Volver' }).click();

  // Menú: ideas para una comida libre, solo de tus recetas
  await simular(page, '{"ids":["tacos","inventada"]}');
  await page.getByRole('button', { name: 'Menú', exact: true }).first().click();
  const cena = page.locator('section.ml', { hasText: 'Cena' });
  await cena.getByRole('button', { name: 'Ideas con IA para cena' }).click();
  await page.getByRole('button', { name: 'Enviar' }).click();
  await expect(page.getByText('Tacos de champiñón', { exact: true })).toBeVisible();
  await expect(page.getByText('inventada')).toHaveCount(0);
  await page.getByRole('button', { name: 'Agregar al menú' }).click();
  await expect(cena.getByRole('button', { name: /Tacos de champiñón/ })).toBeVisible();
  await page.getByRole('button', { name: 'Volver' }).click();

  // Tips: una idea general no manda nada tuyo
  const enviados = await simular(page, '{"tips":["Pica todo antes de prender la estufa."]}');
  await page.getByRole('button', { name: 'Tips', exact: true }).click();
  await page.getByRole('button', { name: 'Pedir un tip con IA' }).click();
  await expect(page.getByText('no se envía nada tuyo', { exact: false })).toBeVisible();
  await page.getByRole('button', { name: 'Enviar' }).click();
  await page.getByRole('button', { name: 'Guardar como mi tip' }).click();
  await expect(page.getByText('Pica todo antes de prender la estufa.')).toBeVisible();
  await expect(page.getByText('Sugerido por IA')).toBeVisible();
  expect(enviados[0].body).not.toContain('Tinga');
  expect(errores).toEqual([]);
});

test('Comida: describir lo que comiste con IA, revisar y agregar', async ({ page }) => {
  const errores = vigilarConsola(page);
  await entrarConContenido(page);
  await prenderIA(page);
  const enviados = await simular(page, '{"items":[{"n":"Quesadilla de champiñón","por":"2 piezas","k":420,"p":18,"c":40,"g":20},{"n":"Yogur con fruta","por":"1 taza","k":180,"p":10,"c":25,"g":4}]}');
  await page.getByRole('button', { name: 'Comida', exact: true }).click();
  await page.getByRole('button', { name: '+ Agregar', exact: true }).last().click();
  await page.getByRole('tab', { name: 'Describir' }).click();
  await page.getByRole('button', { name: 'Estimar con IA' }).click();
  await expect(page.getByText('Cuéntame primero qué comiste')).toBeVisible();
  await page.getByLabel('¿Qué comiste?').fill('dos quesadillas de champiñón y un yogur con fruta');
  await revisarPantalla(page);
  await page.getByRole('button', { name: 'Estimar con IA' }).click();
  await expect(page.getByText('solo el texto que escribiste sobre lo que comiste', { exact: false }).first()).toBeVisible();
  expect(enviados).toHaveLength(0);
  await page.getByRole('button', { name: 'Enviar' }).click();
  await expect(page.getByText('Esto entendí.', { exact: false })).toBeVisible();
  // Con los números ocultos, la revisión no los muestra
  await expect(page.locator('.ai-it').first()).not.toContainText('kcal');
  expect(enviados[0].body).toContain('dos quesadillas de champiñón');
  expect(enviados[0].body).not.toContain('Tinga');
  await revisarPantalla(page);
  await page.getByRole('button', { name: /^Agregar todo a/ }).click();
  await expect(page.getByText('Quesadilla de champiñón')).toBeVisible();
  await expect(page.getByText('Yogur con fruta')).toBeVisible();
  expect(errores).toEqual([]);
});

test('Comida: escanear un plato con contexto, revisar y agregar', async ({ page }) => {
  const errores = vigilarConsola(page);
  await entrarConContenido(page);
  await prenderIA(page);
  const enviados = await simular(page, '{"items":[{"n":"Barra de granola","por":"media barra","k":90,"p":2,"c":14,"g":3}]}');
  await page.getByRole('button', { name: 'Comida', exact: true }).click();
  await page.getByRole('button', { name: '+ Agregar', exact: true }).last().click();
  await page.getByRole('tab', { name: 'Escanear' }).click();
  await expect(page.getByRole('button', { name: 'Estimar con IA' })).toBeDisabled();
  const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
  await page.locator('.to-pick input').nth(1).setInputFiles({ name: 'plato.png', mimeType: 'image/png', buffer: PNG });
  await page.getByLabel('Contexto (opcional)').fill('media porción');
  await revisarPantalla(page);
  await page.getByRole('button', { name: 'Estimar con IA' }).click();
  await expect(page.getByText('la foto del plato o la etiqueta', { exact: false }).first()).toBeVisible();
  expect(enviados).toHaveLength(0);
  await page.getByRole('button', { name: 'Enviar' }).click();
  await expect(page.getByText('Esto entendí.', { exact: false })).toBeVisible();
  expect(enviados[0].body).toContain('"type":"image"');
  expect(enviados[0].body).toContain('media porción');
  expect(enviados[0].body).not.toContain('Tinga');
  await page.getByRole('button', { name: /^Agregar a/ }).click();
  await expect(page.getByText('Barra de granola')).toBeVisible();
  expect(errores).toEqual([]);
});
