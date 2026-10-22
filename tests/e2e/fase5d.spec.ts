import { test, expect, type Page } from '@playwright/test';
import { entrarConContenido, revisarPantalla, vigilarConsola } from './ayuda';

async function abrirCompras(page: Page) {
  await page.getByRole('button', { name: 'Comida', exact: true }).click();
  await page.getByRole('button', { name: 'Menú', exact: true }).first().click();
  await page.getByRole('button', { name: 'Lista de compras' }).click();
  await expect(page.getByRole('heading', { name: 'Lista de compras', level: 2 })).toBeVisible();
}

test('Lista de compras: se arma del menú, va a la tienda correcta, se marca y se comparte', async ({ page }) => {
  const errores = vigilarConsola(page);
  await entrarConContenido(page);

  // Sin menú, la lista está vacía
  await abrirCompras(page);
  await expect(page.getByText('Aún no hay comidas en el menú.')).toBeVisible();
  await expect(page.getByText('Tu lista está vacía')).toBeVisible();
  await revisarPantalla(page);

  // Poner la tinga en el menú de hoy, para los dos
  await page.getByRole('button', { name: 'Volver' }).click();
  await page.getByRole('button', { name: 'Volver' }).click();
  await page.getByRole('button', { name: 'Recetario' }).click();
  await page.getByRole('button', { name: /Tinga de pollo/ }).click();
  await page.getByRole('button', { name: 'Agregar al menú' }).click();
  await page.getByRole('dialog', { name: 'Agregar al menú' }).getByRole('button', { name: 'Agregar', exact: true }).click();
  await expect(page.getByText(/^Agregado al menú: /)).toBeVisible();
  await page.waitForTimeout(400);
  await page.getByRole('button', { name: 'Volver' }).click();
  await page.getByRole('button', { name: 'Volver' }).click();

  await abrirCompras(page);
  await expect(page.getByRole('radio', { name: 'Enfrente · 2' })).toBeChecked();
  await expect(page.getByRole('radio', { name: 'Walmart+ · 1' })).toBeVisible();
  await expect(page.getByRole('radio', { name: 'Todo · 3' })).toBeVisible();
  // 500 g cocidos son 650 g crudos
  const pollo = page.locator('.cp-row', { hasText: 'Pechuga de pollo' });
  await expect(pollo.getByText('650 g')).toBeVisible();
  await expect(pollo.getByText('Para: Tinga de pollo · en crudo')).toBeVisible();
  await expect(page.locator('.cp-row', { hasText: 'Jitomate' }).getByText('4 piezas')).toBeVisible();
  await expect(page.getByText('Aceite')).toHaveCount(0);
  await revisarPantalla(page);

  // Marcar y que se quede
  await pollo.getByRole('checkbox').check();
  await expect(page.getByText('Llevas 1 de 3')).toBeVisible();
  await page.waitForTimeout(400);
  await page.reload();
  await abrirCompras(page);
  await expect(page.getByText('Llevas 1 de 3')).toBeVisible();

  // Walmart+ y mover
  await page.getByRole('radio', { name: /^Walmart\+/ }).click();
  const aceite = page.locator('.cp-row', { hasText: 'Aceite' });
  await expect(aceite.getByText('2 cdas')).toBeVisible();
  await aceite.getByRole('button', { name: 'Pasar Aceite a Enfrente' }).click();
  await expect(page.getByText('Aceite pasó a Enfrente')).toBeVisible();
  await expect(page.getByText('No hay nada para Walmart+ por ahora.')).toBeVisible();
  await page.getByRole('button', { name: 'Deshacer' }).click();
  await expect(page.locator('.cp-row', { hasText: 'Aceite' })).toBeVisible();

  // Falta o se acaba: sugerencias de tu plantilla; solo una cosa pesada va enfrente
  await page.getByRole('radio', { name: /^Enfrente/ }).click();
  await page.getByRole('textbox', { name: 'Falta o se acaba' }).fill('paper');
  await page.getByRole('button', { name: 'Paper Towels' }).click();
  await page.getByRole('textbox', { name: 'Falta o se acaba' }).fill('laundry');
  await page.getByRole('button', { name: 'Laundry Detergent' }).click();
  await expect(page.locator('.cp-row', { hasText: 'Paper Towels' }).getByText('Ya falta')).toBeVisible();
  await expect(page.getByText('Jeff carga poco: pasé Laundry Detergent a Walmart+. Puedes cambiarlo.')).toBeVisible();
  await page.getByRole('textbox', { name: 'Falta o se acaba' }).fill('Café');
  await page.getByRole('radio', { name: 'Se acaba pronto' }).click();
  await page.getByRole('button', { name: 'Agregar', exact: true }).first().click();
  await page.getByRole('radio', { name: /^Todo/ }).click();
  await expect(page.locator('.cp-row', { hasText: 'Café' }).getByText('Walmart+ · Se acaba pronto')).toBeVisible();
  await revisarPantalla(page);

  // Agregar algo más
  await page.getByRole('button', { name: '+ Agregar algo más' }).click();
  const hoja = page.getByRole('dialog', { name: 'Agregar a la lista' });
  await hoja.getByLabel('Qué falta').fill('Sal de mar');
  await hoja.getByLabel('Cantidad (opcional)').fill('1 bolsa');
  await hoja.getByRole('radio', { name: 'Despensa' }).click();
  await hoja.getByRole('button', { name: 'Agregar', exact: true }).dispatchEvent('click');
  await expect(page.locator('.cp-row', { hasText: 'Sal de mar' }).getByText('1 bolsa')).toBeVisible();

  // Compartir: solo lo que falta, sin lo ya marcado
  await page.getByRole('button', { name: 'Compartir con Jeff' }).click();
  const comp = page.getByRole('dialog', { name: 'Compartir con Jeff' });
  await comp.getByRole('radio', { name: 'Las dos' }).click();
  const previa = comp.locator('pre');
  await expect(previa).toContainText('Súper de enfrente');
  await expect(previa).toContainText('Pedido Walmart+');
  await expect(previa).toContainText('• Jitomate (4 piezas)');
  await expect(previa).not.toContainText('Pechuga');
  await comp.getByRole('radio', { name: 'Toda la lista' }).click();
  await expect(previa).toContainText('• Pechuga de pollo (650 g)');
  await revisarPantalla(page);
  expect(errores).toEqual([]);
});

test('Plan de preparación: sale del menú, se marca, se agrega y se cambia la hora', async ({ page }) => {
  const errores = vigilarConsola(page);
  await entrarConContenido(page);

  // La tinga para hoy pide una tanda de preparación hoy
  await page.getByRole('button', { name: 'Comida', exact: true }).click();
  await page.getByRole('button', { name: 'Recetario' }).click();
  await page.getByRole('button', { name: /Tinga de pollo/ }).click();
  await page.getByRole('button', { name: 'Agregar al menú' }).click();
  await page.getByRole('dialog', { name: 'Agregar al menú' }).getByRole('button', { name: 'Agregar', exact: true }).click();
  await expect(page.getByText(/^Agregado al menú: /)).toBeVisible();
  await page.waitForTimeout(500);
  await page.getByRole('button', { name: 'Volver' }).click();
  await page.getByRole('button', { name: 'Volver' }).click();

  const hoy = page.locator('.pt');
  await expect(hoy.getByText('Preparación · 8 pm')).toBeVisible();
  await expect(hoy.getByText('Preparar tinga de pollo')).toBeVisible();
  await revisarPantalla(page);
  await hoy.getByRole('button', { name: 'Ver', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Plan de preparación', level: 2 })).toBeVisible();
  await expect(page.getByText('Para la comida del', { exact: false })).toBeVisible();
  await expect(page.getByText('0 de 1 listas · unos 20 min')).toBeVisible();
  await expect(page.getByText('Hoy a las 8 pm')).toBeVisible();
  await revisarPantalla(page);

  // Marcar
  await page.getByRole('checkbox', { name: /Preparar tinga de pollo/ }).check();
  await expect(page.getByText('Esta semana ya preparaste 1 cosa.')).toBeVisible();
  await expect(page.locator('.pp-t .tag.f')).toHaveText('Lista');
  await page.waitForTimeout(400);

  // Agregar algo a la tanda
  await page.getByRole('button', { name: '+ Agregar algo' }).click();
  await page.getByRole('textbox', { name: 'Agregar algo a esta tanda' }).fill('lavar la lechuga');
  await page.getByRole('button', { name: 'Agregar', exact: true }).click();
  await expect(page.getByText('Lavar la lechuga')).toBeVisible();
  await expect(page.getByText('1 de 2 listas · unos')).toHaveCount(0);

  // Cambiar la hora (la tinga ya está hecha y lo que queda es tuyo, así que otros días sirven)
  await page.getByRole('button', { name: 'Cambiar cuándo preparas esta tanda' }).click();
  const hoja = page.getByRole('dialog', { name: 'Cuándo preparas' });
  await expect(hoja.getByText('La app no puede avisarte a una hora exacta.')).toBeVisible();
  await expect(hoja.getByRole('radio', { checked: true })).toBeEnabled();
  await expect(hoja.getByRole('radio').nth(1)).toBeEnabled();
  await hoja.getByLabel('Hora').fill('18:30');
  await revisarPantalla(page);
  await hoja.getByRole('button', { name: 'Guardar' }).dispatchEvent('click');
  await expect(page.getByText('Hoy a las 6:30 pm').first()).toBeVisible();

  // Se queda al volver a abrir
  await page.waitForTimeout(400);
  await page.reload();
  await page.getByRole('button', { name: 'Comida', exact: true }).click();
  await expect(page.locator('.pt').getByText('Preparación · 6:30 pm')).toBeVisible();
  await expect(page.locator('.pt').getByText('Lavar la lechuga')).toBeVisible();
  expect(errores).toEqual([]);
});

test('Tips y combinaciones: marcar, agregar uno tuyo y ver recetas que ya usan la combinación', async ({ page }) => {
  const errores = vigilarConsola(page);
  await entrarConContenido(page);
  await page.getByRole('button', { name: 'Comida', exact: true }).click();
  await page.getByRole('button', { name: 'Tips', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Tips y combinaciones', level: 2 })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Por probar · 6' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Ya los practicas · 0' })).toBeVisible();
  await expect(page.getByText('Aquí aparecen los que marques.')).toBeVisible();
  await revisarPantalla(page);

  await page.getByRole('checkbox', { name: /Deja agua a la vista/ }).check();
  await expect(page.getByRole('heading', { name: 'Por probar · 5' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Ya los practicas · 1' })).toBeVisible();
  await expect(page.getByText('Movido a «Ya los practicas»')).toBeVisible();
  await page.getByRole('button', { name: 'Deshacer' }).click();
  await expect(page.getByRole('heading', { name: 'Por probar · 6' })).toBeVisible();
  await page.getByRole('checkbox', { name: /Deja agua a la vista/ }).check();

  await page.getByRole('button', { name: '+ Agregar un tip' }).click();
  await page.getByRole('textbox', { name: 'Escribe tu tip' }).fill('lavar la fruta al llegar');
  await page.getByRole('button', { name: 'Agregar', exact: true }).click();
  await expect(page.getByText('Lavar la fruta al llegar')).toBeVisible();
  await expect(page.locator('.tag.t', { hasText: 'Tuyo' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Por probar · 6' })).toBeVisible();
  await page.waitForTimeout(400);
  await page.reload();
  await page.getByRole('button', { name: 'Comida', exact: true }).click();
  await page.getByRole('button', { name: 'Tips', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Ya los practicas · 1' })).toBeVisible();
  await expect(page.getByText('Lavar la fruta al llegar')).toBeVisible();

  // Combinaciones: la tinga lleva jitomate y aceite
  await page.getByRole('tab', { name: 'Combinaciones' }).click();
  await expect(page.getByRole('heading', { name: 'Verduras + un poco de aceite' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Arroz + frijoles' })).toBeVisible();
  const card = page.locator('.cb-card', { hasText: 'Verduras + un poco de aceite' });
  await expect(card.getByText('En tu menú esta semana')).toHaveCount(0);
  await revisarPantalla(page);
  await card.getByRole('button', { name: /Tinga de pollo/ }).click();
  await expect(page.getByRole('heading', { name: 'Tinga de pollo' }).first()).toBeVisible();
  await page.getByRole('button', { name: 'Volver' }).click();
  await expect(page.getByRole('heading', { name: 'Tips y combinaciones', level: 2 })).toBeVisible();
  expect(errores).toEqual([]);
});

test('Tarjetas: deslizar, botones, deshacer y acomodar en la semana', async ({ page }) => {
  const errores = vigilarConsola(page);
  await entrarConContenido(page);
  await page.getByRole('button', { name: 'Comida', exact: true }).click();
  await page.getByRole('button', { name: 'Recetario' }).click();
  await page.getByRole('button', { name: /Elegir con tarjetas/ }).click();
  await expect(page.getByRole('heading', { name: 'Elegir con tarjetas', level: 2 })).toBeVisible();
  await expect(page.getByText('0 de 2 · Sí 0')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Acomodar mis elegidas', exact: true })).toBeEnabled();
  await revisarPantalla(page);

  // Botón Sí en la primera, deslizar a la izquierda la segunda
  await page.getByRole('button', { name: 'Sí', exact: true }).click();
  await expect(page.getByText('1 de 2 · Sí 1')).toBeVisible();
  const arriba = page.locator('.tj-card[data-pos="0"]');
  await expect(arriba).toContainText('Tinga de pollo');
  const caja = (await arriba.boundingBox())!;
  await page.mouse.move(caja.x + caja.width / 2, caja.y + 120);
  await page.mouse.down();
  await page.mouse.move(caja.x + caja.width / 2 - 160, caja.y + 120, { steps: 8 });
  await page.mouse.up();
  await expect(page.getByText('2 de 2 · Sí 1')).toBeVisible();
  await expect(page.getByText('No quedan tarjetas.')).toBeVisible();

  // Deshacer vuelve la última; con el teclado: flecha derecha es sí
  await page.getByRole('button', { name: 'Deshacer' }).click();
  await expect(page.getByText('1 de 2 · Sí 1')).toBeVisible();
  await page.locator('.tj-card[tabindex]').focus();
  await page.keyboard.press('ArrowRight');
  await expect(page.getByText('2 de 2 · Sí 2')).toBeVisible();
  await revisarPantalla(page);

  // Acomodar
  await page.getByRole('button', { name: 'Acomodar mis elegidas (2)' }).click();
  await expect(page.getByRole('heading', { name: 'Acomoda la semana', level: 2 })).toBeVisible();
  const hoy = await page.evaluate(() => { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); });
  const cena = page.locator(`.tj-cell[data-f="${hoy}"][data-l="n"]`);
  const comida = page.locator(`.tj-cell[data-f="${hoy}"][data-l="c"]`);
  await expect(cena).toHaveAttribute('aria-label', /cena: libre$/);
  await cena.click();
  await expect(page.getByText('Toca «Agregar» o primero una de tus elegidas')).toBeVisible();
  await page.getByRole('button', { name: /Tacos de champiñón/ }).click();
  await expect(page.getByText('Toca el lugar para «Tacos de champiñón».')).toBeVisible();
  await cena.click();
  await expect(page.getByText(/^Tacos de champiñón: .+, cena$/)).toBeVisible();
  await expect(cena).toHaveAttribute('aria-label', /cena: .*Tacos de champiñón/);
  await revisarPantalla(page);

  // Arrastrar la otra tarjeta a la comida de hoy
  const chip = page.getByRole('button', { name: /Tinga de pollo/ });
  await page.locator('.tj-pool').evaluate((e) => e.scrollIntoView({ block: 'end' }));
  const c1 = (await chip.boundingBox())!, c2 = (await comida.boundingBox())!;
  await page.mouse.move(c1.x + c1.width / 2, c1.y + c1.height / 2);
  await page.mouse.down();
  await page.mouse.move(c2.x + c2.width / 2, c2.y + c2.height / 2, { steps: 10 });
  await page.mouse.up();
  await expect(comida).toHaveAttribute('aria-label', /comida: .*Tinga de pollo/);
  await page.waitForTimeout(500);

  // Volver al mazo con "Volver", y de ahí al Recetario
  await page.getByRole('button', { name: 'Volver', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Elegir con tarjetas', level: 2 })).toBeVisible();
  await page.getByRole('button', { name: 'Acomodar mis elegidas (2)' }).click();
  await page.getByRole('button', { name: 'Ver el menú de la semana' }).click();
  await expect(page.getByRole('heading', { name: 'Menú de la semana', level: 2 })).toBeVisible();
  await expect(page.getByRole('img', { name: /comida: Los dos|comida: Tinga/ }).first()).toBeVisible();
  expect(errores).toEqual([]);
});

test('Menú: Inspiración se abre y se cierra, y los accesos de después de planear van solo donde sirven', async ({ page }) => {
  const errores = vigilarConsola(page);
  await entrarConContenido(page);
  await page.getByRole('button', { name: 'Comida', exact: true }).click();
  await page.getByRole('button', { name: 'Menú', exact: true }).first().click();
  const tg = page.getByRole('button', { name: /^Inspiración/ });
  await expect(tg).toHaveAttribute('aria-expanded', 'false');
  await expect(page.getByText('Arroz + frijoles: proteína completa')).toBeHidden();
  await tg.click();
  await expect(tg).toHaveAttribute('aria-expanded', 'true');
  await expect(page.getByText('Arroz + frijoles: proteína completa')).toBeVisible();
  await revisarPantalla(page);
  await tg.click();
  await expect(page.getByText('Prep del domingo: 3 bases para la semana')).toBeHidden();

  // Próxima semana: sin Inspiración, con lista y preparación
  await page.getByRole('button', { name: 'Semana siguiente' }).click();
  await expect(page.getByRole('button', { name: /^Inspiración/ })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Lista de compras' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Plan de preparación' })).toBeVisible();
  // Semana pasada: solo para ver
  await page.getByRole('button', { name: 'Semana anterior' }).click();
  await page.getByRole('button', { name: 'Semana anterior' }).click();
  await expect(page.getByText('Es una semana pasada, solo para ver.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Lista de compras' })).toHaveCount(0);
  expect(errores).toEqual([]);
});

test('Lista de compras: un alimento en varias recetas con distintas unidades sale una sola vez y lo agregado a mano se ve', async ({ page }) => {
  const errores = vigilarConsola(page);
  await entrarConContenido(page);
  const hoy = new Date();
  const f = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}-${String(hoy.getDate()).padStart(2, '0')}`;
  const rec = (id: string, n: string, ing: unknown[]) => ({ id, n, cat: 'Comida', y: 4, t: '', src: '', u1: '', k: null, p: null, c: null, g: null, ing, steps: [] });
  await page.evaluate(({ f, filas, menu }) => new Promise<void>((ok, mal) => {
    const abrir = indexedDB.open('bienestar');
    abrir.onerror = () => mal(abrir.error);
    abrir.onsuccess = () => {
      const bd = abrir.result, tx = bd.transaction(['recetas', 'menu'], 'readwrite');
      for (const r of filas) tx.objectStore('recetas').put(r);
      for (const m of menu) tx.objectStore('menu').put({ ...m, fecha: f });
      tx.oncomplete = () => { bd.close(); ok(); };
      tx.onerror = () => mal(tx.error);
    };
  }), {
    f,
    filas: [rec('x1', 'Sopa uno', [[1, 'cdita', 'Aceite'], [2, 'pieza', 'Jitomate']]), rec('x2', 'Sopa dos', [[2, 'cda', 'Aceite']]), rec('x3', 'Sopa tres', [[1, 'taza', 'Aceite']])],
    menu: [{ lugar: 'd', t: 'dos', n: 'Sopa uno', r: 'x1' }, { lugar: 'c', t: 'dos', n: 'Sopa dos', r: 'x2' }, { lugar: 'n', t: 'dos', n: 'Sopa tres', r: 'x3' }]
  });
  await page.reload();
  await abrirCompras(page);
  await page.getByRole('radio', { name: /^Todo/ }).click();
  await page.locator('#cq-n').fill('Dog Treats');
  await page.getByRole('button', { name: 'Agregar', exact: true }).first().click();
  const aceite = page.locator('.cp-row', { hasText: 'Aceite' });
  await expect(aceite).toHaveCount(1);
  const treats = page.locator('.cp-row', { hasText: 'Dog Treats' });
  await expect(treats.getByRole('checkbox')).toBeVisible();
  expect(errores).toEqual([]);
});
