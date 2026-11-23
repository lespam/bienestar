import { test, expect, type Page, type Route } from '@playwright/test';
import { entrarConContenido, revisarPantalla, vigilarConsola } from './ayuda';

async function abrirCompras(page: Page) {
  await page.getByRole('button', { name: 'Comida', exact: true }).click();
  await page.getByRole('button', { name: 'Menú', exact: true }).first().click();
  await page.getByRole('button', { name: 'Lista de compras' }).click();
  await expect(page.getByRole('heading', { name: 'Lista de compras', level: 2 })).toBeVisible();
}
/** La tinga en el menú de hoy, para los dos: pollo (Proteínas), jitomate (Frutas y verduras) y aceite (Despensa). */
async function menuConTinga(page: Page) {
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
async function guardadoLugares(page: Page, texto: string) {
  await expect.poll(() => page.evaluate(() => new Promise<string>((ok) => {
    const abrir = indexedDB.open('bienestar');
    abrir.onsuccess = () => {
      const bd = abrir.result, pedir = bd.transaction('comida').objectStore('comida').get('lugares');
      pedir.onsuccess = () => { bd.close(); ok(JSON.stringify(pedir.result ?? {})); };
      pedir.onerror = () => { bd.close(); ok(''); };
    };
  }))).toContain(texto);
}

// Versión 2, fase 4.1: lugares de compra tuyos, reglas de reparto y filtros de la lista.
test('Lista de compras: agregar un lugar, reglas por ingrediente y por sección, y quitarlo', async ({ page }) => {
  const errores = vigilarConsola(page);
  await entrarConContenido(page);
  await menuConTinga(page);
  await abrirCompras(page);
  await expect(page.getByRole('radio', { name: 'Enfrente · 2' })).toBeVisible();
  await expect(page.getByRole('radio', { name: 'Walmart+ · 1' })).toBeVisible();

  // Mis lugares: agregar uno y cambiarle el color
  await page.getByRole('button', { name: 'Mis lugares y reglas' }).click();
  const hoja = page.getByRole('dialog', { name: 'Mis lugares y reglas' });
  await hoja.getByLabel('Agregar un lugar').fill('Mercado');
  await hoja.getByRole('button', { name: 'Agregar', exact: true }).click();
  await expect(hoja.getByLabel('Nombre del lugar 3')).toHaveValue('Mercado');
  await hoja.getByRole('radio', { name: 'Menta' }).last().click();
  await revisarPantalla(page);
  await page.getByRole('button', { name: 'Cerrar' }).last().click();
  await expect(page.getByRole('radio', { name: 'Mercado · 0' })).toBeVisible();

  // Con tres lugares, Mover pregunta a cuál; la casilla deja una regla por ingrediente
  await page.getByRole('radio', { name: /^Enfrente/ }).click();
  await page.getByRole('button', { name: 'Cambiar de lugar: Jitomate' }).click();
  const mover = page.getByRole('dialog', { name: '¿A dónde va Jitomate?' });
  await mover.getByRole('checkbox', { name: /siempre vaya/ }).check();
  await mover.getByRole('radio', { name: 'Mercado' }).click();
  await expect(page.getByText('Jitomate va siempre a Mercado')).toBeVisible();
  await expect(page.getByRole('radio', { name: 'Mercado · 1' })).toBeVisible();
  await guardadoLugares(page, 'jitomate');

  // Regla por sección: lo de Proteínas va a Mercado
  await page.getByRole('button', { name: 'Mis lugares y reglas' }).click();
  await hoja.getByLabel('Proteínas').selectOption({ label: 'Mercado' });
  await expect(hoja.getByText(/Jitomate → /)).toBeVisible();
  await page.getByRole('button', { name: 'Cerrar' }).last().click();
  await expect(page.getByRole('radio', { name: 'Mercado · 2' })).toBeVisible();
  await guardadoLugares(page, '"1":"l3"');

  // Se queda al recargar
  await page.reload();
  await abrirCompras(page);
  await expect(page.getByRole('radio', { name: 'Mercado · 2' })).toBeVisible();

  // Compartir ofrece los tres lugares
  await page.getByRole('button', { name: 'Compartir con Jeff' }).click();
  const compartir = page.getByRole('dialog', { name: 'Compartir con Jeff' });
  await expect(compartir.getByRole('radio', { name: 'Mercado' })).toBeVisible();
  await expect(compartir.getByRole('radio', { name: 'Todas' })).toBeVisible();
  await page.getByRole('button', { name: 'Cerrar' }).last().click();

  // Quitar el lugar: lo suyo vuelve al reparto de fábrica y las reglas se van
  await page.getByRole('button', { name: 'Mis lugares y reglas' }).click();
  await hoja.getByRole('button', { name: 'Quitar el lugar Mercado' }).click();
  await expect(page.getByText(/«Mercado» salió de tus lugares/)).toBeVisible();
  await page.getByRole('button', { name: 'Cerrar' }).last().click();
  await expect(page.getByRole('radio', { name: 'Mercado · 0' })).toHaveCount(0);
  await expect(page.getByRole('radio', { name: 'Enfrente · 2' })).toBeVisible();
  expect(errores).toEqual([]);
});

test('Lista de compras: moverlo dos veces al mismo lugar pregunta una vez si lo dejas así', async ({ page }) => {
  const errores = vigilarConsola(page);
  await entrarConContenido(page);
  await menuConTinga(page);
  // Ya moviste el aceite una vez a Enfrente en otra semana
  await page.evaluate(() => new Promise<void>((ok, mal) => {
    const abrir = indexedDB.open('bienestar');
    abrir.onerror = () => mal(abrir.error);
    abrir.onsuccess = () => {
      const bd = abrir.result, tx = bd.transaction('comida', 'readwrite');
      tx.objectStore('comida').put({ k: 'lugares', v: { lista: [{ id: 'enfrente', n: 'Súper de enfrente', color: '#c9b3f5' }, { id: 'walmart', n: 'Pedido Walmart+', color: '#f2b8c6' }], ing: {}, sec: {}, movs: { aceite: { a: 'enfrente', n: 1 } } } });
      tx.oncomplete = () => { bd.close(); ok(); };
      tx.onerror = () => mal(tx.error);
    };
  }));
  await page.reload();
  await abrirCompras(page);
  await page.getByRole('radio', { name: /^Walmart\+/ }).click();
  await page.getByRole('button', { name: 'Pasar Aceite a Enfrente' }).click();
  await expect(page.getByText('Pasaste Aceite a Enfrente dos veces. ¿Que siempre vaya ahí?')).toBeVisible();
  await page.getByRole('button', { name: 'Sí, siempre' }).click();
  await expect(page.getByText('Aceite irá siempre a Enfrente')).toBeVisible();
  await guardadoLugares(page, '"aceite":"enfrente"');
  await page.getByRole('button', { name: 'Mis lugares y reglas' }).click();
  await expect(page.getByRole('dialog', { name: 'Mis lugares y reglas' }).getByText(/Aceite → /)).toBeVisible();
  expect(errores).toEqual([]);
});

test('Lista de compras: filtrar por sección, persona, pesado y receta', async ({ page }) => {
  const errores = vigilarConsola(page);
  await entrarConContenido(page);
  await menuConTinga(page);
  await abrirCompras(page);
  await page.getByRole('radio', { name: /^Todo/ }).click();
  await expect(page.locator('.cp-row')).toHaveCount(3);
  await page.getByRole('button', { name: 'Filtrar la lista' }).click();
  const hoja = page.getByRole('dialog', { name: 'Filtrar la lista' });
  await hoja.getByRole('button', { name: 'Pesado' }).click();
  await page.getByRole('button', { name: 'Cerrar' }).last().click();
  await expect(page.locator('.cp-row')).toHaveCount(1);
  await expect(page.locator('.cp-row', { hasText: 'Aceite' })).toBeVisible();
  await expect(page.getByRole('button', { name: /Filtros: Pesado/ })).toBeVisible();
  await revisarPantalla(page);

  // Otro filtro: sección y persona (la tinga es para los dos)
  await page.getByRole('button', { name: /Filtros: Pesado/ }).click();
  await hoja.getByRole('button', { name: 'Pesado' }).click();
  await hoja.getByRole('radio', { name: 'Proteínas' }).click();
  await hoja.getByRole('radio', { name: 'Jeff', exact: true }).click();
  await hoja.getByLabel('Receta').selectOption('Tinga de pollo');
  await page.getByRole('button', { name: 'Cerrar' }).last().click();
  await expect(page.locator('.cp-row')).toHaveCount(1);
  await expect(page.locator('.cp-row', { hasText: 'Pechuga de pollo' })).toBeVisible();

  // Quitar filtros
  await page.getByRole('button', { name: 'Quitar filtros' }).first().click();
  await expect(page.locator('.cp-row')).toHaveCount(3);
  expect(errores).toEqual([]);
});

// Versión 2, fase 4.2: la lista se arma «para cuándo», con comidas elegidas y otras semanas.
test('Lista de compras: elegir comidas, conservarlas al cambiar de vista y mirar otra semana', async ({ page }) => {
  const errores = vigilarConsola(page);
  await entrarConContenido(page);
  await menuConTinga(page);
  await abrirCompras(page);
  await page.getByRole('radio', { name: /^Todo/ }).click();
  await expect(page.locator('.cp-row')).toHaveCount(3);
  await expect(page.getByRole('radiogroup', { name: 'Qué semana' }).getByRole('radio')).toHaveText(['Esta semana', 'Próxima semana', 'En 2 semanas']);

  // Elegir comidas: quitar la tinga deja la lista vacía
  await page.getByRole('radio', { name: 'Elegir comidas' }).click();
  const hoja = page.getByRole('dialog', { name: 'Elegir comidas' });
  const tinga = hoja.getByRole('checkbox', { name: /Tinga de pollo/ });
  await expect(tinga).toBeChecked();
  await revisarPantalla(page);
  await tinga.uncheck();
  await page.getByRole('button', { name: 'Cerrar' }).last().click();
  await expect(page.getByText('No elegiste ninguna comida.')).toBeVisible();
  await expect(page.locator('.cp-row')).toHaveCount(0);

  // Cambiar de vista y volver: la elección se conserva
  await page.getByRole('radio', { name: 'Toda la semana' }).click();
  await expect(page.locator('.cp-row')).toHaveCount(3);
  await page.getByRole('radio', { name: 'Elegir comidas' }).click();
  await expect(hoja.getByRole('checkbox', { name: /Tinga de pollo/ })).not.toBeChecked();
  await hoja.getByRole('button', { name: 'Todo el día' }).click();
  await expect(hoja.getByRole('checkbox', { name: /Tinga de pollo/ })).toBeChecked();
  await hoja.getByRole('button', { name: 'Ver la lista' }).click();
  await expect(page.locator('.cp-row')).toHaveCount(3);
  await expect(page.getByText('Con 1 comida del menú.')).toBeVisible();

  // Otra semana: sin menú y sin las vistas de hoy
  await page.getByRole('radio', { name: 'Próxima semana' }).click();
  await expect(page.getByText('Aún no hay comidas en el menú.')).toBeVisible();
  await expect(page.getByRole('radio', { name: 'Hoy y mañana' })).toHaveCount(0);
  await page.getByRole('radio', { name: 'Esta semana' }).click();
  await expect(page.locator('.cp-row')).toHaveCount(3);
  await page.getByRole('radio', { name: 'Hoy', exact: true }).click();
  await expect(page.locator('.cp-row')).toHaveCount(3);
  await revisarPantalla(page);
  expect(errores).toEqual([]);
});

// Versión 2, fase 4.3: compras de antes (a mano o con la foto de un ticket) para el historial.
async function leerTabla(page: Page, tabla: string) {
  return page.evaluate((tabla) => new Promise<Record<string, unknown>[]>((ok) => {
    const abrir = indexedDB.open('bienestar');
    abrir.onsuccess = () => {
      const bd = abrir.result, pedir = bd.transaction(tabla).objectStore(tabla).getAll();
      pedir.onsuccess = () => { bd.close(); ok(pedir.result); };
    };
  }), tabla);
}
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');

test('Compras de antes: se escriben a mano, se revisan antes de guardar y se unen por nombre', async ({ page }) => {
  const errores = vigilarConsola(page);
  await entrarConContenido(page);
  await abrirCompras(page);
  await page.getByRole('button', { name: 'Anotar compras de antes' }).click();
  const hoja = page.getByRole('dialog', { name: 'Compras de antes' });
  await hoja.getByLabel('Fecha de la compra').fill('2026-11-01');
  await hoja.getByRole('radio', { name: 'Walmart+' }).click();
  await hoja.getByLabel('Escríbelas, una por línea').fill('Tomato sauce 2 $48\nLeche 2 L $38.50\nKale chips');
  await hoja.getByRole('button', { name: 'Revisar lo que escribí' }).click();
  // Los nombres que ya se saben unir salen unidos; lo demás se puede corregir
  await expect(hoja.getByLabel('Nombre de Tomato sauce')).toHaveValue('Salsa de tomate');
  await expect(hoja.getByLabel('Cantidad de Tomato sauce')).toHaveValue('2');
  await expect(hoja.getByLabel('Precio de Tomato sauce')).toHaveValue('48');
  await expect(hoja.getByLabel('Nombre de Kale chips')).toHaveValue('Kale chips');
  await hoja.getByLabel('Nombre de Kale chips').fill('Chips de col rizada');
  await hoja.getByLabel('Guardar Leche').uncheck();
  await revisarPantalla(page);
  await hoja.getByRole('button', { name: 'Guardar 2 compras' }).click();
  await expect(page.getByText('Guardé 2 compras en tu historial')).toBeVisible();
  const hist = await leerTabla(page, 'historial');
  expect(hist.map((h) => h.art).sort()).toEqual(['chips de col rizada', 'salsa de tomate']);
  expect(hist.find((h) => h.art === 'salsa de tomate')).toMatchObject({ n: 'Salsa de tomate', fecha: '2026-11-01', lugar: 'walmart', q: '2', precio: 48 });
  // El nombre que corregiste se recuerda para la próxima
  expect((await leerTabla(page, 'comida')).find((f) => f.k === 'unidos')).toMatchObject({ v: { 'kale chips': 'Chips de col rizada' } });

  // Deshacer quita lo que se acaba de guardar
  await page.getByRole('button', { name: 'Deshacer' }).click();
  await expect.poll(async () => (await leerTabla(page, 'historial')).length).toBe(0);
  expect(errores).toEqual([]);
});

test('Compras de antes: la foto de un ticket se lee con IA, los nombres nuevos se unen una vez y tú revisas', async ({ page }) => {
  const errores = vigilarConsola(page);
  await entrarConContenido(page);
  await page.evaluate(() => new Promise<void>((ok, mal) => {
    const abrir = indexedDB.open('bienestar');
    abrir.onerror = () => mal(abrir.error);
    abrir.onsuccess = () => {
      const bd = abrir.result, tx = bd.transaction('ajustes', 'readwrite');
      tx.objectStore('ajustes').put({ k: 'ia.on', v: true });
      tx.objectStore('ajustes').put({ k: 'ia.clave', v: 'sk-ant-api03-prueba1234' });
      tx.oncomplete = () => { bd.close(); ok(); };
      tx.onerror = () => mal(tx.error);
    };
  }));
  await page.reload();
  const pedidos: string[] = [];
  await page.route('https://api.anthropic.com/v1/messages', async (route: Route) => {
    const cuerpo = route.request().postData() ?? '';
    pedidos.push(cuerpo);
    const texto = cuerpo.includes('ticket de compra')
      ? '{"fecha":"2026-11-10","lugar":"Walmart","items":[{"n":"Tomato sauce","q":"2","precio":48},{"n":"Oat milk","q":"1","precio":42.5}]}'
      : '{"nombres":{"Oat milk":"Leche de avena"}}';
    await route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify({ content: [{ type: 'text', text: texto }], usage: { input_tokens: 1500, output_tokens: 300 } }) });
  });
  await abrirCompras(page);
  await page.getByRole('button', { name: 'Anotar compras de antes' }).click();
  const hoja = page.getByRole('dialog', { name: 'Compras de antes' });
  await hoja.locator('.to-pick input').setInputFiles({ name: 'ticket.png', mimeType: 'image/png', buffer: PNG });
  await expect(hoja.getByRole('img', { name: 'Tu ticket o captura' })).toBeVisible();
  await hoja.getByRole('button', { name: 'Leer la foto con IA' }).click();
  await page.getByRole('button', { name: 'Enviar' }).click();
  await expect(page.getByText('Oat milk · 1 · $42.5').or(page.getByText('Leche de avena · 1 · $42.5'))).toBeVisible();
  await expect(page.getByText('Sugerido por IA').first()).toBeVisible();
  await page.getByRole('button', { name: 'Agregar todo' }).click();
  // Solo se preguntó el nombre que no se sabía unir: «Tomato sauce» ya se une sin IA
  expect(pedidos).toHaveLength(2);
  expect(pedidos[1]).toContain('- Oat milk');
  expect(pedidos[1]).not.toContain('- Tomato sauce');
  await expect(hoja.getByLabel('Nombre de Tomato sauce')).toHaveValue('Salsa de tomate');
  await expect(hoja.getByLabel('Nombre de Oat milk')).toHaveValue('Leche de avena');
  await expect(hoja.getByLabel('Fecha de la compra')).toHaveValue('2026-11-10');
  await hoja.getByRole('button', { name: 'Guardar 2 compras' }).click();
  await expect(page.getByText('Guardé 2 compras en tu historial')).toBeVisible();
  const hist = await leerTabla(page, 'historial');
  expect(hist.find((h) => h.art === 'leche de avena')).toMatchObject({ fecha: '2026-11-10', precio: 42.5 });
  expect(errores).toEqual([]);
});

// Versión 2, fase 4.4: «Hoy toca» en Inicio (máximo 3) y recordatorios al calendario (.ics).
const haceDias = (n: number) => { const d = new Date(Date.now() - n * 86_400_000); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
async function sembrarFilas(page: Page, tabla: string, filas: object[]) {
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
const cadaMes = (art: string, n: string) => [89, 59, 29].map((d) => ({ art, n, fecha: haceDias(d) }));

test('Inicio: «Hoy toca» junta lo que sigue y lo que ya toca comprar, máximo 3, con calendario', async ({ page }) => {
  const errores = vigilarConsola(page);
  await entrarConContenido(page);
  await expect(page.getByRole('region', { name: 'Hoy toca' })).toHaveCount(0);
  // Cuatro artículos a punto de tocar y una cosa por preparar hoy: entran 3 filas en total (1 + 2)
  await sembrarFilas(page, 'historial', [...cadaMes('comida de timi', 'Comida de Timi'), ...cadaMes('papel de cocina', 'Papel de cocina'), ...cadaMes('croquetas', 'Croquetas'), ...cadaMes('cafe', 'Café')]);
  const hoy = haceDias(0);
  await sembrarFilas(page, 'comida', [{ k: 'prep', v: [{ id: 't1', fecha: hoy, hora: '19:00', items: [{ t: 'Sacar el pollo del congelador', f: '', m: 5, ok: false }, { t: 'Cortar fresas', f: '', m: 5, ok: false }] }] }]);
  await page.reload();
  await page.getByRole('button', { name: 'Inicio', exact: true }).click();
  const toca = page.getByRole('region', { name: 'Hoy toca' });
  await expect(toca.getByText('Sacar el pollo del congelador')).toBeVisible();
  await expect(toca.getByText('Y 1 cosa más')).toBeVisible();
  await expect(toca.getByRole('button', { name: /^Agregar .* a la lista$/ })).toHaveCount(2);
  await revisarPantalla(page);

  // Al calendario: baja un .ics con el recordatorio de mañana
  const descarga = page.waitForEvent('download');
  await toca.getByRole('button', { name: /^Recordarme .* en el calendario$/ }).first().click();
  const archivo = await descarga;
  expect(archivo.suggestedFilename()).toMatch(/^ya-toca-.*\.ics$/);
  const texto = await (await import('node:fs/promises')).readFile((await archivo.path())!, 'utf8');
  expect(texto).toContain('BEGIN:VCALENDAR');
  expect(texto).toMatch(/SUMMARY:Comprar /);
  expect(texto).toContain('DTSTART;VALUE=DATE:');

  // Agregar a la lista: sale de «Hoy toca» y entra otra
  const antes = await toca.getByRole('button', { name: /^Agregar .* a la lista$/ }).first().getAttribute('aria-label');
  await toca.getByRole('button', { name: /^Agregar .* a la lista$/ }).first().click();
  await expect(page.getByText(/ va a tu lista de compras/)).toBeVisible();
  await expect(toca.getByRole('button', { name: antes! })).toHaveCount(0);
  await expect(toca.getByRole('button', { name: /^Agregar .* a la lista$/ })).toHaveCount(2);

  // «No me interesa» la silencia
  const otro = await toca.getByRole('button', { name: /^No me interesa: / }).first().getAttribute('aria-label');
  await toca.getByRole('button', { name: otro! }).click();
  await expect(toca.getByRole('button', { name: otro! })).toHaveCount(0);
  expect(errores).toEqual([]);
});

// Versión 2, fase 4.5: una idea de ahorro por visita, sin cifras si no hay precio.
test('Lista de compras: una idea para ahorrar, con tu precio y «No me interesa»', async ({ page }) => {
  const errores = vigilarConsola(page);
  await entrarConContenido(page);
  await sembrarFilas(page, 'historial', [3, 10, 17, 24, 31].map((d) => ({ art: 'salsa de tomate', n: 'Salsa de tomate', fecha: haceDias(d) })));
  await page.reload();
  await abrirCompras(page);
  // Si no está en la lista, no hay idea
  await expect(page.getByRole('region', { name: 'Una idea para ahorrar' })).toHaveCount(0);
  await page.locator('#cq-n').fill('salsa de tomate');
  await page.locator('.cq-row').first().getByRole('button', { name: 'Agregar' }).click();
  const idea = page.getByRole('region', { name: 'Una idea para ahorrar' });
  await expect(idea.getByText('Compras salsa de tomate casi cada semana: en 5 de las últimas 7. Un paquete de 4 podría ahorrarte dinero y viajes.')).toBeVisible();
  await revisarPantalla(page);

  // Tu precio vuelve la idea concreta
  await idea.getByLabel(/Cuánto cuesta salsa de tomate/).fill('48');
  await idea.getByRole('button', { name: 'Anotar precio' }).click();
  await expect(idea.getByText(/unos \$48 cada vez, un paquete de 4 que cueste menos de \$192 te sale mejor/)).toBeVisible();
  await expect(idea.getByLabel(/Cuánto cuesta/)).toHaveCount(0);

  // No me interesa: se va y no vuelve
  await idea.getByRole('button', { name: /No me interesa: ahorrar en Salsa de tomate/ }).click();
  await expect(page.getByRole('region', { name: 'Una idea para ahorrar' })).toHaveCount(0);
  await page.waitForTimeout(300);
  await page.reload();
  await abrirCompras(page);
  await expect(page.locator('.cp-row', { hasText: 'Salsa de tomate' })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Una idea para ahorrar' })).toHaveCount(0);
  expect(errores).toEqual([]);
});

// Versión 2, fase 4.6: un día de preparación muy cargado se propone repartir en dos, sin que lo pidas.
test('Plan de preparación: un día cargado se reparte en dos, se deshace y «Así está bien» lo deja', async ({ page }) => {
  test.skip(new Date().getDay() === 0, 'Los domingos mañana cae en la semana siguiente');
  const errores = vigilarConsola(page);
  await entrarConContenido(page);
  const manana = haceDias(-1);
  const it = (t: string, fm: string, m = 20) => ({ t, f: 'Para ' + fm, m, ok: false, fm });
  const pasado = haceDias(-2);
  await sembrarFilas(page, 'comida', [{ k: 'prep', v: [{ id: 'g', fecha: manana, hora: '20:00', auto: true, items: [
    it('Preparar crema de elote', pasado + ':d'), it('Preparar tinga', pasado + ':c'), it('Preparar arroz', pasado + ':c'),
    it('Preparar ensalada', pasado + ':n'), it('Preparar sopa', pasado + ':n'), { t: 'Lavar la lechuga', f: '', m: 15, ok: false }
  ] }] }]);
  await page.reload();
  await page.getByRole('button', { name: 'Comida', exact: true }).click();
  await page.getByRole('button', { name: 'Menú', exact: true }).first().click();
  await page.getByRole('button', { name: 'Plan de preparación' }).click();
  const tarjeta = page.getByRole('region', { name: 'Repartir la preparación' });
  await expect(tarjeta.getByText(/se ve cargado/)).toBeVisible();
  await expect(tarjeta.getByText(/Tiene unos 115 min de preparación\. Puedo pasar 2 cosas al/)).toBeVisible();
  await revisarPantalla(page);
  await tarjeta.getByRole('button', { name: 'Repartir en dos días' }).click();
  await expect(page.getByText('Repartí la preparación en dos días')).toBeVisible();
  await expect(page.getByRole('region', { name: 'Repartir la preparación' })).toHaveCount(0);
  await expect(page.getByText('Preparar sopa')).toBeVisible();
  await expect(page.locator('.pp-t')).toHaveCount(2);

  // Deshacer vuelve a una sola tanda y la propuesta regresa
  await page.getByRole('button', { name: 'Deshacer' }).click();
  await expect(page.locator('.pp-t')).toHaveCount(1);
  await expect(page.getByRole('region', { name: 'Repartir la preparación' })).toBeVisible();

  // «Así está bien»: no vuelve a proponerlo, ni al recargar
  await page.getByRole('button', { name: 'Así está bien' }).click();
  await expect(page.getByRole('region', { name: 'Repartir la preparación' })).toHaveCount(0);
  await page.waitForTimeout(300);
  await page.reload();
  await page.getByRole('button', { name: 'Comida', exact: true }).click();
  await page.getByRole('button', { name: 'Menú', exact: true }).first().click();
  await page.getByRole('button', { name: 'Plan de preparación' }).click();
  await expect(page.getByRole('heading', { name: 'Plan de preparación', level: 2 })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Repartir la preparación' })).toHaveCount(0);
  expect(errores).toEqual([]);
});
