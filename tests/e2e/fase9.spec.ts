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

test('Menú: tarjetas también para la próxima semana, sin «Editar día por día»', async ({ page }) => {
  const errores = vigilarConsola(page);
  await entrarConContenido(page);
  await page.getByRole('button', { name: 'Comida', exact: true }).click();
  await page.getByRole('button', { name: 'Menú', exact: true }).first().click();
  await expect(page.getByRole('button', { name: /Editar día por día/ })).toHaveCount(0);
  await page.getByRole('button', { name: 'Empezar a planear' }).click();
  await page.getByRole('radio', { name: 'Próxima semana' }).click();
  await revisarPantalla(page);
  await page.getByRole('button', { name: 'Elegir con tarjetas' }).click();
  await expect(page.getByRole('heading', { name: 'Elegir con tarjetas', level: 2 })).toBeVisible();
  await page.getByRole('button', { name: 'Sí', exact: true }).click();
  await page.getByRole('button', { name: 'Acomodar mis elegidas (1)' }).click();
  await expect(page.getByRole('radio', { name: 'Próxima semana' })).toHaveAttribute('aria-checked', 'true');
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
  await expect(page.getByRole('heading', { name: 'Cardio', level: 3 })).toBeVisible();
  await page.getByRole('button', { name: 'Registrar cardio' }).click();
  await expect(page.getByRole('button', { name: 'Guardar cardio' })).toBeVisible();
  expect(errores).toEqual([]);
});

test('Recetario: cuántas veces usaste cada receta y filtro de nunca usadas', async ({ page }) => {
  const errores = vigilarConsola(page);
  await entrarConContenido(page);
  await sembrar(page, 'recetas', [receta('u1', 'Pollo usado'), receta('u2', 'Pozole nuevo')]);
  await sembrar(page, 'menu', [{ fecha: '2026-01-05', lugar: 'c', t: 'dos', n: 'Pollo usado', r: 'u1' }, { fecha: '2026-01-06', lugar: 'c', t: 'dos', n: 'Pollo usado', r: 'u1' }]);
  await sembrar(page, 'registro', [{ fecha: '2026-01-05', comida: 1, n: 'Pollo usado', por: '1', k: 300, p: 1, c: 1, g: 1, receta: 'u1' }]);
  await page.reload();
  await page.getByRole('button', { name: 'Comida', exact: true }).click();
  await page.getByRole('button', { name: 'Recetario' }).click();
  await expect(page.getByRole('button', { name: /^Pollo usado.*En el menú 2 veces · Registrada 1 vez/ })).toBeVisible();
  await expect(page.getByRole('button', { name: /^Pozole nuevo.*Aún no la usas/ })).toBeVisible();
  await page.getByLabel('Uso').selectOption('nunca');
  await expect(page.getByRole('button', { name: /^Pollo usado/ })).toHaveCount(0);
  await expect(page.getByRole('button', { name: /^Pozole nuevo/ })).toBeVisible();
  await revisarPantalla(page);
  expect(errores).toEqual([]);
});

test('Rutina: Cardio en "Hacer hoy" y registrar el cardio de ayer', async ({ page }) => {
  const errores = vigilarConsola(page);
  await entrarConContenido(page);
  await page.getByRole('button', { name: 'Rutina', exact: true }).click();
  await page.locator('.mini').getByRole('button', { name: 'Cardio' }).click();
  // Queda planeado como una rutina: se ve en la semana y en «Hoy»
  await expect(page.getByRole('heading', { name: 'Cardio', level: 3 })).toBeVisible();
  await expect(page.locator('.day.today .sr')).toHaveText('hoy, cardio');
  await expect(page.locator('.mini').getByRole('button', { name: 'Cardio' })).toHaveAttribute('aria-pressed', 'true');
  await revisarPantalla(page);
  await page.getByRole('button', { name: 'Rutina A, la que toca' }).click();
  await expect(page.getByRole('heading', { name: 'Rutina A', level: 3 })).toBeVisible();
  await page.locator('.mini').getByRole('button', { name: 'Cardio' }).click();
  await page.getByRole('button', { name: 'Registrar cardio' }).click();
  await page.getByRole('radio', { name: 'Ayer' }).click();
  await page.getByLabel('Minutos').fill('30');
  await revisarPantalla(page);
  await page.getByRole('button', { name: 'Guardar cardio' }).click();
  const ayer = new Date(); ayer.setDate(ayer.getDate() - 1);
  const dia = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'][ayer.getDay()];
  await expect(page.locator('.cardio-lista')).toContainText(dia + ' ' + ayer.getDate());
  expect(errores).toEqual([]);
});

test('Tarjetas: un solo filtro de uso, sin foto, con Bases y para la próxima semana', async ({ page }) => {
  const errores = vigilarConsola(page);
  await entrarConContenido(page);
  await sembrar(page, 'recetas', [receta('b1', 'Salsa base', 'Base')]);
  await sembrar(page, 'perfiles', [{ quien: 'les', no: ['Cilantro'] }, { quien: 'jeff', no: ['Huevo'] }]);
  await page.reload();
  await page.getByRole('button', { name: 'Comida', exact: true }).click();
  await page.getByRole('button', { name: 'Recetario' }).click();
  await expect(page.locator('.rc-fuente > span').getByText('Uso', { exact: true })).toHaveCount(1);
  await expect(page.locator('.rc-fuente > span').getByText('Foto', { exact: true })).toHaveCount(1);
  await page.getByRole('button', { name: /Elegir con tarjetas/ }).click();
  await expect(page.locator('.rc-fuente > span').getByText('Uso', { exact: true })).toHaveCount(1);
  await expect(page.locator('.rc-fuente > span').getByText('Foto', { exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Bases', exact: true }).click();
  await expect(page.locator('.tj-card[data-pos="0"]')).toContainText('Salsa base');
  await page.getByRole('button', { name: 'Sí', exact: true }).click();
  await page.getByRole('button', { name: 'Acomodar mis elegidas (1)' }).click();
  await page.getByRole('radio', { name: 'Próxima semana' }).click();
  const lunes = new Date(); lunes.setDate(lunes.getDate() - ((lunes.getDay() + 6) % 7) + 7);
  await expect(page.locator('.tj-dh').first()).toContainText(String(lunes.getDate()));
  await expect(page.locator('.tj-cell').first()).toBeEnabled();
  await revisarPantalla(page);
  expect(errores).toEqual([]);
});
