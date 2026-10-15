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
