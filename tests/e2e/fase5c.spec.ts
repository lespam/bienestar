import { test, expect, type Page } from '@playwright/test';
import { entrarConContenido, revisarPantalla, vigilarConsola } from './ayuda';

const DIA = /(lunes|martes|miércoles|jueves|viernes|sábado|domingo)/;

/** Mete filas en una tabla de la base, como si las hubieras guardado otro día. */
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
const iso = (d: Date) => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
const hace = (dias: number) => { const d = new Date(); d.setDate(d.getDate() - dias); return iso(d); };

async function abrirMenu(page: Page) {
  await page.getByRole('button', { name: 'Comida', exact: true }).click();
  await page.getByRole('button', { name: 'Menú', exact: true }).first().click();
  await expect(page.getByRole('heading', { name: 'Menú de la semana', level: 2 })).toBeFocused();
}

test('Menú: elegir recetas para los dos y cada quien, por decidir, colaciones y takeout', async ({ page }) => {
  const errores = vigilarConsola(page);
  await entrarConContenido(page);
  await abrirMenu(page);
  await expect(page.getByText('Esta semana', { exact: true })).toBeVisible();
  await expect(page.getByRole('img', { name: /desayuno: Libre/ }).first()).toBeVisible();
  await revisarPantalla(page);

  // Cena para los dos, desde el Recetario
  const cena = page.locator('section.ml', { hasText: 'Cena' });
  await expect(cena.getByText('Libre')).toBeVisible();
  await expect(page.getByText('¿Comen lo mismo?')).toHaveCount(0);
  await cena.getByRole('button', { name: 'Agregar a cena' }).click();
  await expect(page.getByText(/^Para los dos · cena del /)).toBeVisible();
  await expect(page.getByText('Ahora está libre')).toBeVisible();
  await revisarPantalla(page);
  await page.getByRole('button', { name: /Tacos de champiñón/ }).click();
  await page.getByRole('button', { name: 'Elegir para los dos' }).click();
  await expect(page.getByRole('heading', { name: 'Menú de la semana', level: 2 })).toBeVisible();
  await expect(page.getByText(DIA).filter({ hasText: /^(Agregado|Cambiado): cena del/ })).toBeVisible();
  const cena2 = page.locator('section.ml', { hasText: 'Cena' });
  await expect(cena2.getByRole('button', { name: /Tacos de champiñón/ })).toBeVisible();
  await expect(cena2.locator('.tag.s')).toHaveCount(0);

  // Comida: cada quien
  // Con el plato elegido aparece «¿Comen lo mismo?»
  await expect(cena2.getByRole('button', { name: 'Sí, lo mismo' })).toHaveAttribute('aria-pressed', 'true');
  const comida = page.locator('section.ml', { hasText: 'Comida' }).first();
  await comida.getByRole('button', { name: 'Agregar a comida' }).click();
  await page.getByRole('button', { name: /Tinga de pollo/ }).click();
  await page.getByRole('button', { name: 'Elegir para los dos' }).click();
  await page.locator('section.ml', { hasText: 'Comida' }).first().getByRole('button', { name: 'No, cada quien' }).click();
  await expect(page.getByText(/^Para ti · comida del /)).toBeVisible();
  await page.getByRole('button', { name: /Tinga de pollo/ }).click();
  await page.getByRole('button', { name: 'Elegir para mí' }).click();
  await expect(page.getByText('Listo tu plato. Ahora elige el de Jeff')).toBeVisible();
  await expect(page.getByText('Tú: Tinga de pollo. Ahora elige la de Jeff.')).toBeVisible();
  // La lista ya viene en el tipo de comida de ese lugar; para elegir otra cosa se toca "Todas"
  await expect(page.getByRole('button', { name: /Tacos de champiñón/ })).toHaveCount(0);
  await page.getByRole('button', { name: /^Todas · 2/ }).click();
  await page.getByRole('button', { name: /Tacos de champiñón/ }).click();
  await page.getByRole('button', { name: 'Elegir para Jeff' }).click();
  await expect(page.getByRole('button', { name: /Tinga de pollo \/ Tacos de champiñón/ })).toBeVisible();
  await page.getByRole('button', { name: 'Deshacer' }).click();
  await expect(page.locator('section.ml', { hasText: 'Comida' }).first().getByRole('button', { name: /Tinga de pollo/ }).first()).toBeVisible();

  // Colación AM: armar, juntar con el desayuno, separar y quitar
  await page.getByRole('button', { name: 'Agregar a colación am' }).click();
  const sh = page.getByRole('dialog', { name: /Colación AM/ });
  await expect(sh.getByText('Elige una base para empezar.')).toBeVisible();
  await expect(sh.getByRole('button', { name: 'Guardar colación' })).toBeDisabled();
  await sh.getByRole('radio', { name: 'Yogur natural' }).click();
  await sh.getByRole('radio', { name: 'Manzana' }).click();
  await sh.getByRole('radio', { name: 'Granola o avena' }).click();
  await sh.getByRole('radio', { name: 'Granola o avena' }).click();
  await expect(sh.getByText('Quedaría: Yogur natural + manzana')).toBeVisible();
  await revisarPantalla(page);
  await sh.getByRole('button', { name: 'Guardar colación' }).click();
  const col = page.locator('section.ml', { hasText: 'Colación AM' });
  await expect(col.getByRole('button', { name: /Yogur natural \+ manzana/ })).toBeVisible();
  await col.getByRole('button', { name: 'Juntar con una comida' }).click();
  await col.getByRole('button', { name: 'Comida', exact: true }).click();
  await expect(col.locator('.tag', { hasText: 'Con la comida' })).toBeVisible();
  await col.getByRole('button', { name: 'Separar' }).click();
  await expect(col.locator('.tag', { hasText: 'Colación' })).toBeVisible();
  await col.getByRole('button', { name: 'Quitar' }).click();
  await expect(page.getByRole('button', { name: 'Agregar a colación am' })).toBeVisible();

  // Takeout con ticket
  await page.getByRole('button', { name: '+ Ticket' }).click();
  const tk = page.getByRole('dialog', { name: 'Registrar takeout' });
  await tk.getByRole('button', { name: 'Guardar' }).click();
  await expect(page.getByText('Escribe el lugar')).toBeVisible();
  await tk.getByLabel('Lugar').fill('Tacos El Güero');
  await tk.getByLabel('Total').fill('380');
  await tk.getByRole('radio', { name: 'Comida', exact: true }).click();
  await revisarPantalla(page);
  await tk.getByRole('button', { name: 'Guardar' }).click();
  await expect(page.getByText('1 vez · $380')).toBeVisible();
  await expect(page.getByRole('button', { name: /Comida Tacos El Güero/ })).toBeVisible();
  await page.getByRole('button', { name: 'Deshacer' }).click();
  await expect(page.getByText('Ninguno')).toBeVisible();

  // Todo queda guardado
  await page.waitForTimeout(500);
  await page.reload();
  await abrirMenu(page);
  await expect(page.locator('section.ml', { hasText: 'Cena' }).getByRole('button', { name: /Tacos de champiñón/ })).toBeVisible();
  expect(errores).toEqual([]);
});

test('Menú: próxima semana, repetir la semana pasada y semanas pasadas', async ({ page }) => {
  const errores = vigilarConsola(page);
  await entrarConContenido(page);
  // Una comida de la semana pasada, del mismo día de la semana que hoy
  await sembrar(page, 'menu', [{ fecha: hace(7), lugar: 'c', t: 'dos', n: 'Tinga de pollo', r: 'tinga' }, { fecha: hace(6), lugar: 'n', t: 'dos', n: 'Tacos de champiñón', r: 'tacos' }]);
  await page.reload();
  await abrirMenu(page);

  // «Planear» lleva a Acomoda la semana; repetir está arriba
  await page.getByRole('button', { name: 'Planear', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Acomoda la semana', level: 2 })).toBeVisible();
  await page.getByRole('button', { name: 'Repetir semana pasada' }).click();
  const rp = page.getByRole('dialog', { name: 'Repetir semana pasada' });
  await expect(rp.getByText(/^Se llenaría 1 comida\.|^Se llenarían 2 comidas\./)).toBeVisible();
  await revisarPantalla(page);
  await rp.getByRole('button', { name: 'Copiar menú' }).click();
  await expect(page.getByText(/^Se copiaron \d comidas? de la semana pasada/)).toBeVisible();
  await expect(page.locator('.tj-cell', { hasText: 'Tinga de pollo' })).toBeVisible();
  await page.getByRole('button', { name: 'Deshacer' }).click();
  await expect(page.locator('.tj-cell', { hasText: 'Tinga de pollo' })).toHaveCount(0);

  // Próxima semana: lo libre por decidir, y ver ese menú
  await page.getByRole('radio', { name: 'Próxima semana' }).click();
  await expect(page.getByRole('button', { name: 'Repetir esta semana' })).toBeVisible();
  await page.getByRole('button', { name: 'Dejar lo libre por decidir' }).click();
  await expect(page.getByText('21 comidas quedan por decidir')).toBeVisible();
  await page.getByRole('button', { name: 'Ver el menú de la próxima semana' }).click();
  await expect(page.getByText('Próxima semana', { exact: true })).toBeVisible();
  await expect(page.getByText('21 comidas por decidir.')).toBeVisible();
  await revisarPantalla(page);
  // Elegir una comida concreta de esa semana
  await page.getByRole('button', { name: /Desayuno Por decidir/ }).click();
  const np = page.getByRole('dialog', { name: /desayuno/ });
  await np.getByLabel('Por decidir (nota opcional)').fill('algo con pollo');
  await np.getByRole('button', { name: 'Dejar por decidir' }).click();
  await expect(page.getByRole('button', { name: /Desayuno Por decidir · algo con pollo/ })).toBeVisible();
  await page.getByRole('button', { name: /Cena Por decidir/ }).click();
  await page.getByRole('dialog', { name: /cena/ }).getByRole('button', { name: /Tacos de champiñón/ }).click();
  await expect(page.getByRole('button', { name: /Cena Tacos de champiñón/ })).toBeVisible();

  // Semanas pasadas: solo para ver
  await page.getByRole('button', { name: 'Semana anterior' }).click();
  await expect(page.getByText('Esta semana', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Semana anterior' }).click();
  await expect(page.getByText('Semana pasada', { exact: true })).toBeVisible();
  await expect(page.getByText('Es una semana pasada, solo para ver.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Planear', exact: true })).toHaveCount(0);
  await expect(page.getByText('Ninguno')).toBeVisible();
  await page.getByRole('button', { name: 'Volver a esta semana' }).click();
  await expect(page.getByRole('button', { name: 'Planear', exact: true })).toBeVisible();
  expect(errores).toEqual([]);
});

test('Menú y Comida: agregar desde la receta y registrar lo planeado de hoy', async ({ page }) => {
  const errores = vigilarConsola(page);
  await entrarConContenido(page);
  await page.getByRole('button', { name: 'Comida', exact: true }).click();
  await expect(page.getByText('Hoy en tu menú')).toBeVisible();
  await expect(page.getByText('Aún no hay nada planeado.')).toBeVisible();

  // Agregar al menú desde el detalle de una receta
  await page.getByRole('button', { name: 'Recetario' }).click();
  await page.getByRole('button', { name: /Tinga de pollo/ }).click();
  await page.getByRole('button', { name: 'Agregar al menú' }).click();
  const am = page.getByRole('dialog', { name: 'Agregar al menú' });
  await expect(am.getByText('Ese lugar está libre.')).toBeVisible();
  await expect(am.getByText('Porciones: tú 1, Jeff 1.')).toBeVisible();
  await revisarPantalla(page);
  await am.getByRole('button', { name: 'Agregar', exact: true }).click();
  await expect(page.getByText(/^Agregado al menú: /)).toBeVisible();
  await page.waitForTimeout(400);

  // Hoy en tu menú: sale en Comida con "Registrar"
  await page.getByRole('button', { name: 'Volver' }).click();
  await page.getByRole('button', { name: 'Volver' }).click();
  await page.getByRole('button', { name: 'Comida', exact: true }).click();
  const hoy = page.locator('.pt');
  await expect(hoy.getByText('Tinga de pollo', { exact: true })).toBeVisible();
  await expect(hoy.getByText('Tú: 1 porción · Jeff: 1 porción')).toBeVisible();
  await revisarPantalla(page);
  await hoy.getByRole('button', { name: /^Registrar comida: Tinga de pollo/ }).click();
  await expect(page.getByText('Agregado a Comida')).toBeVisible();
  await expect(hoy.getByText('Registrado')).toBeVisible();
  await expect(page.locator('.meal', { hasText: 'Comida' }).getByText('Tinga de pollo')).toBeVisible();

  // Mañana: solo lo planeado
  await page.getByRole('button', { name: 'Día siguiente' }).click();
  await expect(page.getByText(/^Mañana · /)).toBeVisible();
  await expect(page.getByText('Mañana en tu menú')).toBeVisible();
  await expect(page.getByText('Resumen del día')).toHaveCount(0);
  await expect(page.locator('.meals')).toHaveCount(0);
  await page.getByRole('button', { name: 'Día anterior', exact: true }).click();
  await page.getByRole('button', { name: 'Día anterior', exact: true }).click();
  await expect(page.getByText('Lo que tenías planeado')).toBeVisible();
  await page.getByRole('button', { name: 'Ver', exact: true }).click();
  await expect(page.getByText('No había nada planeado ese día.')).toBeVisible();
  expect(errores).toEqual([]);
});
