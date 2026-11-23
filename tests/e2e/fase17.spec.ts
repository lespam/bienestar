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

// Versión 2, sección 9: «Generar imagen» con tu propia clave de Gemini.
const CLAVE_G = 'AIzaSyD-pruebaDePrueba1234567890';
const PNG_G = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
type Enviado = { url: string; headers: Record<string, string>; body: string };
/** Responde a Gemini con lo que se pida y guarda lo que se envió. */
async function simularGemini(page: Page, estado: () => number = () => 200, enviados: Enviado[] = []) {
  await page.route('https://generativelanguage.googleapis.com/**', async (route) => {
    const req = route.request();
    enviados.push({ url: req.url(), headers: req.headers(), body: req.postData() ?? '' });
    const status = estado();
    const cuerpo = status === 200 ? { candidates: [{ content: { parts: [{ inlineData: { mimeType: 'image/png', data: PNG_G } }] }, finishReason: 'STOP' }] } : { error: { message: 'x', status: 'E' } };
    await route.fulfill({ status, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(cuerpo) });
  });
  return enviados;
}
const abrirReceta = async (page: Page, nombre: RegExp) => {
  await page.getByRole('button', { name: 'Comida', exact: true }).click();
  await page.getByRole('button', { name: 'Recetario' }).click();
  await page.getByRole('button', { name: nombre }).click();
};

test('Gemini: empieza apagado, pide tu clave de Google y no sale en el respaldo', async ({ page }) => {
  const errores = vigilarConsola(page);
  await entrarConContenido(page);
  await abrirReceta(page, /Tinga de pollo/);
  await expect(page.getByRole('button', { name: 'Generar imagen' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Volver' }).click();
  await page.getByRole('button', { name: 'Volver' }).click();
  await page.getByRole('button', { name: 'Inicio', exact: true }).click();
  await page.getByRole('button', { name: 'Ajustes' }).click();
  const interruptor = page.getByRole('switch', { name: 'Generar imágenes con Gemini' });
  await expect(interruptor).toHaveAttribute('aria-checked', 'false');
  await expect(page.getByLabel('Tu clave de Gemini')).toHaveCount(0);
  await interruptor.click();
  await page.getByLabel('Tu clave de Gemini').fill('hola');
  await page.getByRole('button', { name: 'Guardar clave de Gemini' }).click();
  await expect(page.getByText('La clave de Gemini empieza con AIza')).toBeVisible();
  await page.getByLabel('Tu clave de Gemini').fill(CLAVE_G);
  await page.getByRole('button', { name: 'Guardar clave de Gemini' }).click();
  await expect(page.getByText('····7890')).toBeVisible();
  await expect(page.getByText(/Al generar una imagen se envía a Google: el nombre y los ingredientes de la receta\./)).toBeVisible();
  await revisarPantalla(page);

  // La clave se queda en el teléfono: no entra al paquete de respaldo
  const descarga = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Exportar respaldo (ZIP)' }).click();
  const zip = readFileSync(await (await descarga).path());
  expect(zip.includes(Buffer.from(CLAVE_G))).toBe(false);
  expect(errores).toEqual([]);
});

test('Gemini: avisa qué se envía, deja revisar la imagen y la guarda como ilustración', async ({ page }) => {
  const errores = vigilarConsola(page);
  await entrarConContenido(page);
  await sembrar(page, 'ajustes', [{ k: 'gem.on', v: true }, { k: 'gem.clave', v: CLAVE_G }]);
  await page.reload();
  const enviados = await simularGemini(page);
  await abrirReceta(page, /Tinga de pollo/);
  await expect(page.getByRole('heading', { name: 'Foto del platillo', level: 4 })).toBeVisible();
  await page.getByRole('button', { name: 'Generar imagen' }).click();
  const hoja = page.getByRole('dialog', { name: 'Generar imagen' });
  await expect(hoja.getByText('Esto se envía a Google (Gemini): el nombre y los ingredientes de la receta.')).toBeVisible();
  await expect(hoja.getByText(/Nunca se envía: tu peso/)).toBeVisible();
  expect(enviados).toHaveLength(0);
  await revisarPantalla(page);
  await hoja.getByRole('button', { name: 'Enviar' }).click();
  const prev = hoja.getByRole('img', { name: /^Ilustración de Tinga de pollo, hecha con IA/ });
  await expect(prev).toBeVisible();
  await expect(hoja.getByText('Es una ilustración, no una foto real')).toBeVisible();
  // Solo salió el nombre y los ingredientes, con la clave en el encabezado y no en la dirección
  expect(enviados).toHaveLength(1);
  expect(enviados[0].headers['x-goog-api-key']).toBe(CLAVE_G);
  expect(enviados[0].url).not.toContain('AIza');
  expect(enviados[0].url).toContain('generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image:generateContent');
  expect(enviados[0].body).toContain('Tinga de pollo');
  expect(enviados[0].body).toContain('Pechuga de pollo');
  expect(enviados[0].body).not.toMatch(/kcal|290|Reto de prueba|Cuece el pollo/);
  await revisarPantalla(page);
  // Nada se guarda hasta que tú lo decides
  await hoja.getByRole('button', { name: 'Descartar' }).click();
  await expect(page.getByRole('heading', { name: 'Foto del platillo', level: 4 })).toBeVisible();
  await expect(page.getByText('Aún no tiene. Se ve en las tarjetas')).toBeVisible();

  await page.getByRole('button', { name: 'Generar imagen' }).click();
  // Ya vio el aviso: ahora pide la imagen directo
  await expect(hoja.getByRole('img', { name: /^Ilustración de Tinga de pollo/ })).toBeVisible();
  expect(enviados).toHaveLength(2);
  await hoja.getByRole('button', { name: 'Guardar como ilustración' }).click();
  await expect(page.getByText('Ilustración guardada')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Ilustración hecha con IA', level: 4 })).toBeVisible();
  await expect(page.getByRole('img', { name: 'Ilustración hecha con IA' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Generar otra imagen' })).toBeVisible();
  const tipo = await page.evaluate(() => new Promise<string | undefined>((ok, mal) => {
    const a = indexedDB.open('bienestar');
    a.onerror = () => mal(a.error);
    a.onsuccess = () => { const g = a.result.transaction('recetas').objectStore('recetas').get('tinga'); g.onsuccess = () => { a.result.close(); ok(g.result?.img_tipo); }; };
  }));
  expect(tipo).toBe('generada');
  await revisarPantalla(page);

  // Una foto tuya reemplaza la ilustración y ya no se llama ilustración
  await page.getByLabel('Elegir la foto del platillo').setInputFiles({ name: 'mia.png', mimeType: 'image/png', buffer: Buffer.from(PNG_G, 'base64') });
  await expect(page.getByRole('heading', { name: 'Foto del platillo', level: 4 })).toBeVisible();
  await expect(page.getByRole('button', { name: /Generar (otra )?imagen/ })).toHaveCount(0);
  expect(errores).toEqual([]);
});

test('Gemini: si falla, explica por qué y no guarda nada', async ({ page }) => {
  const errores = vigilarConsola(page);
  await entrarConContenido(page);
  await sembrar(page, 'ajustes', [{ k: 'gem.on', v: true }, { k: 'gem.clave', v: CLAVE_G }, { k: 'gem.vista', v: true }]);
  await page.reload();
  let estado = 429;
  await simularGemini(page, () => estado);
  await abrirReceta(page, /Tacos de champiñón/);
  await page.getByRole('button', { name: 'Generar imagen' }).click();
  const hoja = page.getByRole('dialog', { name: 'Generar imagen' });
  await expect(hoja.locator('p', { hasText: /Google pide esperar un momento/ })).toBeVisible();
  await expect(hoja.getByRole('button', { name: 'Agregar mi foto' })).toBeVisible();
  estado = 403;
  await hoja.getByRole('button', { name: 'Intentar otra vez' }).click();
  await expect(hoja.locator('p', { hasText: /Google no aceptó tu clave de Gemini/ })).toBeVisible();
  estado = 404;
  await hoja.getByRole('button', { name: 'Intentar otra vez' }).click();
  await expect(hoja.locator('p', { hasText: /no encontró el modelo de imagen/ })).toBeVisible();
  await revisarPantalla(page);
  await hoja.getByRole('button', { name: 'Cerrar' }).first().click();
  await expect(page.getByRole('heading', { name: 'Foto del platillo', level: 4 })).toBeVisible();
  await expect(page.getByText('Aún no tiene. Se ve en las tarjetas')).toBeVisible();
  await expect(errores.filter((e) => !/status of (4\d\d|5\d\d)|Failed to load resource/.test(e))).toEqual([]);
});
