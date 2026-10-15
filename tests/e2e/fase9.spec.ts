import { test, expect, type Page } from '@playwright/test';
import { entrarConContenido, revisarPantalla, vigilarConsola } from './ayuda';

// Pendientes del backlog (2026-10-15).

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
const receta = (id: string, n: string, cat = 'Comida', ing: unknown[] = []) => ({ id, n, cat, y: 2, t: '', src: '', u1: '', k: 300, p: 20, c: 30, g: 10, ing, steps: [] });

test('Recetario: saltar a una letra sin scroll eterno', async ({ page }) => {
  const errores = vigilarConsola(page);
  await entrarConContenido(page);
  const nombres = ['Arroz', 'Atole', 'Avena', 'Bowl', 'Burrito', 'Caldo', 'Ceviche', 'Chilaquiles', 'Crepas', 'Ensalada', 'Enchiladas', 'Fajitas', 'Flautas', 'Gorditas', 'Huevos', 'Jugo', 'Lentejas', 'Machaca', 'Molletes', 'Nopales', 'Omelette', 'Pozole', 'Quesadillas', 'Sopes', 'Tamales', 'Wrap', 'Yogur', 'Zanahorias'];
  await sembrar(page, 'recetas', nombres.map((n, i) => receta('t' + i, n)));
  await page.reload();
  await page.getByRole('button', { name: 'Comida', exact: true }).click();
  await page.getByRole('button', { name: 'Recetario' }).click();
  const abc = page.getByRole('navigation', { name: 'Ir a la letra' });
  await expect(abc.getByRole('button', { name: 'Recetas con Z' })).toBeVisible();
  await expect(abc.getByRole('button', { name: 'Recetas con X' })).toHaveCount(0);
  await revisarPantalla(page);
  await abc.getByRole('button', { name: 'Recetas con Y' }).click();
  await expect(page.getByRole('button', { name: /^Yogur/ })).toBeInViewport();
  await expect(page.getByRole('button', { name: /^Yogur/ })).toBeFocused();
  expect(errores).toEqual([]);
});

test('Menú: editar día por día sin pasar por las tarjetas', async ({ page }) => {
  const errores = vigilarConsola(page);
  await entrarConContenido(page);
  await page.getByRole('button', { name: 'Comida', exact: true }).click();
  await page.getByRole('button', { name: 'Menú', exact: true }).first().click();
  await page.getByRole('button', { name: 'Editar día por día' }).click();
  await expect(page.locator('#mn-dia')).toBeFocused();
  await page.getByRole('button', { name: 'Empezar a planear' }).click();
  await page.getByRole('button', { name: 'Editar día por día, sin tarjetas' }).click();
  await expect(page.getByRole('dialog', { name: 'Empezar a planear' })).toHaveCount(0);
  await expect(page.locator('#mn-dia')).toBeFocused();
  await revisarPantalla(page);
  // La comida de hoy se elige directo del recetario
  await page.locator('.ml', { hasText: 'Comida' }).getByRole('button', { name: 'Sí, lo mismo' }).click();
  await expect(page.getByRole('heading', { name: 'Recetario' })).toBeVisible();
  await page.getByRole('button', { name: /Tinga de pollo/ }).click();
  expect(errores).toEqual([]);
});

test('Compras y preparación: solo lo de hoy y mañana, para cargar lo mínimo', async ({ page }) => {
  const errores = vigilarConsola(page);
  await entrarConContenido(page);
  const f = (d: number) => { const x = new Date(); x.setDate(x.getDate() + d); return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`; };
  await sembrar(page, 'recetas', [receta('hoy1', 'Sopa de hoy', 'Comida', [[2, 'pieza', 'Calabacita']]), receta('lejos', 'Guiso lejano', 'Comida', [[1, 'pieza', 'Berenjena']])]);
  await sembrar(page, 'menu', [{ fecha: f(0), lugar: 'n', t: 'dos', n: 'Sopa de hoy', r: 'hoy1' }, { fecha: f(5), lugar: 'n', t: 'dos', n: 'Guiso lejano', r: 'lejos' }]);
  await page.reload();
  await page.getByRole('button', { name: 'Comida', exact: true }).click();
  await page.getByRole('button', { name: 'Menú', exact: true }).first().click();
  await page.getByRole('button', { name: 'Lista de compras' }).click();
  await page.getByRole('radio', { name: /^Todo/ }).click();
  const semanaTiene = await page.locator('.cp-row', { hasText: 'Berenjena' }).count();
  await page.getByRole('radio', { name: 'Hoy y mañana' }).click();
  await expect(page.locator('.cp-row', { hasText: 'Calabacita' })).toBeVisible();
  await expect(page.locator('.cp-row', { hasText: 'Berenjena' })).toHaveCount(0);
  await revisarPantalla(page);
  await page.getByRole('radio', { name: 'Toda la semana' }).click();
  await expect(page.locator('.cp-row', { hasText: 'Berenjena' })).toHaveCount(semanaTiene);
  expect(errores).toEqual([]);
});

test('Recetas: filtrar por fuente y quitar lo que no le gusta a Jeff, en el Recetario y en las tarjetas', async ({ page }) => {
  const errores = vigilarConsola(page);
  await entrarConContenido(page);
  await sembrar(page, 'recetas', [
    { ...receta('f1', 'Tacos de huevo', 'Desayuno', [[2, 'pieza', 'Huevo']]), origen: 'Familia' },
    { ...receta('f2', 'Crepas de avena', 'Desayuno', [[1, 'pieza', 'Huevo']]), origen: 'Familia' },
    { ...receta('f3', 'Sopa de lentejas'), origen: 'Tastemade' }
  ]);
  await sembrar(page, 'perfiles', [{ quien: 'jeff', no: ['Huevo'] }]);
  await page.reload();
  await page.getByRole('button', { name: 'Comida', exact: true }).click();
  await page.getByRole('button', { name: 'Recetario' }).click();
  await page.getByLabel('Fuente').selectOption('Familia');
  await expect(page.getByRole('button', { name: /^Tacos de huevo/ })).toBeVisible();
  await expect(page.getByRole('button', { name: /^Sopa de lentejas/ })).toHaveCount(0);
  await page.getByRole('button', { name: 'Sin lo que no le gusta a Jeff' }).click();
  await expect(page.getByRole('button', { name: /^Tacos de huevo/ })).toHaveCount(0);
  await expect(page.getByRole('button', { name: /^Crepas de avena/ })).toBeVisible();
  await revisarPantalla(page);
  await page.getByRole('button', { name: /Elegir con tarjetas/ }).click();
  await expect(page.getByLabel('Fuente')).toHaveValue('Familia');
  await expect(page.locator('.tj-card', { hasText: 'Crepas de avena' })).toHaveCount(1);
  await expect(page.locator('.tj-card', { hasText: 'Tacos de huevo' })).toHaveCount(0);
  await revisarPantalla(page);
  expect(errores).toEqual([]);
});

test('Rutina: marcar un día de cardio y que la rutina pase al siguiente día', async ({ page }) => {
  const errores = vigilarConsola(page);
  await entrarConContenido(page);
  await page.getByRole('button', { name: 'Rutina', exact: true }).click();
  const dia = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'][new Date().getDay()];
  await page.getByRole('button', { name: 'Cambiar' }).click();
  const hoja = page.getByRole('dialog', { name: 'Cuándo y dónde' });
  await hoja.getByRole('button', { name: 'Cardio el ' + dia }).click();
  await expect(hoja.getByRole('button', { name: 'Rutina el ' + dia })).toHaveAttribute('aria-pressed', 'false');
  await revisarPantalla(page);
  await hoja.getByRole('button', { name: 'Guardar' }).click();
  await expect(page.getByText('Hoy toca cardio')).toBeVisible();
  await expect(page.locator('.day.today .sr')).toHaveText('hoy, cardio');
  await page.getByRole('button', { name: 'Registrar el cardio de hoy' }).click();
  await expect(page.getByRole('button', { name: 'Guardar cardio' })).toBeVisible();
  expect(errores).toEqual([]);
});
