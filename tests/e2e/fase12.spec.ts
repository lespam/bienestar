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
const iso = (d: Date) => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
/** El lunes de la semana de hace `k` semanas. */
const lunes = (k: number) => { const d = new Date(); d.setDate(d.getDate() - ((d.getDay() + 6) % 7) - 7 * k); return iso(d); };

// Versión 2, fase 5: qué se planeó y qué se comió, y «Mis fijos».
test('Mis fijos: la app lo propone con curiosidad, se agrega, se repite en la próxima semana y se quita', async ({ page }) => {
  const errores = vigilarConsola(page);
  await entrarConContenido(page);
  // La tinga estuvo en el menú el lunes de 3 de las últimas 4 semanas
  await sembrar(page, 'menu', [0, 1, 2].map((k) => ({ fecha: lunes(k), lugar: 'c', t: 'dos', n: 'Tinga de pollo', r: 'tinga' })));
  await page.reload();
  await page.getByRole('button', { name: 'Comida', exact: true }).click();
  await page.getByRole('button', { name: 'Menú', exact: true }).first().click();
  await page.getByRole('button', { name: 'Planear', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Acomoda la semana', level: 2 })).toBeVisible();

  const idea = page.getByRole('region', { name: 'Una idea' });
  await expect(idea.getByText('Tinga de pollo ha estado en tu menú 3 de 4 semanas. ¿Quieres dejarlo como fijo de la semana?')).toBeVisible();
  await revisarPantalla(page);

  // «No por ahora» la calla, también al volver
  await idea.getByRole('button', { name: 'No por ahora' }).click();
  await expect(page.getByRole('region', { name: 'Una idea' })).toHaveCount(0);
  await page.reload();
  await page.getByRole('button', { name: 'Comida', exact: true }).click();
  await page.getByRole('button', { name: 'Menú', exact: true }).first().click();
  await page.getByRole('button', { name: 'Planear', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Acomoda la semana', level: 2 })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Una idea' })).toHaveCount(0);

  // Desde la receta se ve cuántas semanas aparece y se agrega a mis fijos
  await page.getByRole('button', { name: 'Volver', exact: true }).click();
  await page.getByRole('button', { name: 'Volver', exact: true }).click();
  await page.getByRole('button', { name: 'Recetario' }).click();
  await page.getByRole('button', { name: /Tinga de pollo/ }).first().click();
  await expect(page.getByText('En tu menú 3 de las últimas 8 semanas. La registraste en 0.')).toBeVisible();
  await page.getByRole('button', { name: 'Agregar a mis fijos' }).click();
  await expect(page.getByText('Quedó en mis fijos')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Quitar de mis fijos' })).toHaveAttribute('aria-pressed', 'true');
  await revisarPantalla(page);
  await page.getByRole('button', { name: 'Volver', exact: true }).click();
  await page.getByRole('button', { name: 'Volver', exact: true }).click();

  // Repetir mis fijos en la próxima semana
  await page.getByRole('button', { name: 'Comida', exact: true }).click();
  await page.getByRole('button', { name: 'Menú', exact: true }).first().click();
  await page.getByRole('button', { name: 'Semana siguiente' }).click();
  await page.getByRole('button', { name: 'Planear', exact: true }).click();
  await page.getByRole('button', { name: /Mis fijos \(1\)/ }).click();
  await expect(page.getByRole('dialog', { name: 'Mis fijos' }).getByText('Tinga de pollo')).toBeVisible();
  await expect(page.getByText('Se pondría 1 fijo.')).toBeVisible();
  await revisarPantalla(page);
  await page.getByRole('button', { name: 'Poner mis fijos' }).click();
  await expect(page.getByText('Puse 1 fijo en la semana')).toBeVisible();
  await page.getByRole('button', { name: /Mis fijos \(1\)/ }).click();
  await expect(page.getByText('No hay lugares libres para ponerlos.')).toBeVisible();

  // Quitarlo de mis fijos, con Deshacer
  await page.getByRole('button', { name: 'Quitar de mis fijos: Tinga de pollo' }).click();
  await expect(page.getByText('«Tinga de pollo» salió de mis fijos')).toBeVisible();
  await expect(page.getByText('Aún no tienes fijos.')).toBeVisible();
  await page.getByRole('button', { name: 'Deshacer' }).click();
  await expect(page.getByRole('dialog', { name: 'Mis fijos' }).getByText('Tinga de pollo')).toBeVisible();
  expect(errores).toEqual([]);
});

test('Mis fijos: lo que planeas seguido y casi no registras se dice con curiosidad, sin juicio', async ({ page }) => {
  const errores = vigilarConsola(page);
  await entrarConContenido(page);
  await sembrar(page, 'menu', [0, 1, 2].map((k) => ({ fecha: lunes(k), lugar: 'c', t: 'dos', n: 'Tinga de pollo', r: 'tinga' })));
  await sembrar(page, 'comida', [{ k: 'fijos', v: [{ r: 'tinga', huecos: [{ dia: 0, l: 'c' }] }] }]);
  // Registras otras cosas en dos semanas distintas
  await sembrar(page, 'registro', [0, 1].map((k) => ({ fecha: lunes(k), comida: 1, n: 'Yogur', por: '1', k: 100, p: 5, c: 10, g: 2 })));
  await page.reload();
  await page.getByRole('button', { name: 'Comida', exact: true }).click();
  await page.getByRole('button', { name: 'Menú', exact: true }).first().click();
  await page.getByRole('button', { name: 'Planear', exact: true }).click();
  const idea = page.getByRole('region', { name: 'Una idea' });
  await expect(idea.getByText('Planeas «Tinga de pollo» seguido (3 de 4 semanas) y lo registras poco. ¿Lo cambiamos por algo parecido?')).toBeVisible();
  await expect(page.getByText(/atrasad|falla|debes|mal\b/i)).toHaveCount(0);
  await revisarPantalla(page);
  await idea.getByRole('button', { name: 'Ver recetas' }).click();
  await expect(page.getByRole('heading', { name: 'Recetario', level: 2 })).toBeVisible();
  expect(errores).toEqual([]);
});

test('Medir mi uso: apagado por defecto, cuenta solo pantallas, se exporta y se borra con Deshacer', async ({ page }) => {
  const errores = vigilarConsola(page);
  await entrarConContenido(page);
  await page.getByRole('button', { name: 'Ajustes' }).click();
  const sw = page.getByRole('switch', { name: 'Medir mi uso' });
  await expect(sw).toHaveAttribute('aria-checked', 'false');
  // Apagado, abrir pantallas no cuenta nada
  await page.getByRole('button', { name: /Volver/ }).click();
  await page.getByRole('button', { name: 'Comida', exact: true }).click();
  await page.getByRole('button', { name: 'Inicio', exact: true }).click();
  await page.getByRole('button', { name: 'Ajustes' }).click();
  await page.getByRole('button', { name: /Cómo uso la app/ }).click();
  await expect(page.getByText('Con el interruptor apagado no se cuenta nada.')).toBeVisible();

  // Encendido, cuenta lo que abres
  await page.getByRole('switch', { name: 'Medir mi uso' }).click();
  await expect(page.getByRole('switch', { name: 'Medir mi uso' })).toHaveAttribute('aria-checked', 'true');
  await page.getByRole('button', { name: /Volver/ }).click();
  await page.getByRole('button', { name: /Volver/ }).click();
  await page.getByRole('button', { name: 'Rutina', exact: true }).click();
  await page.getByRole('button', { name: 'Comida', exact: true }).click();
  await page.getByRole('button', { name: 'Comida', exact: true }).click();
  await page.getByRole('button', { name: 'Inicio', exact: true }).click();
  await page.getByRole('button', { name: 'Ajustes' }).click();
  await page.getByRole('button', { name: /Cómo uso la app/ }).click();
  await expect(page.getByText('Abriste: Comida (2), Rutina (1).')).toBeVisible();
  await expect(page.getByText(/falla|atrasad|perdiste/i)).toHaveCount(0);
  await revisarPantalla(page);

  // Exportar: un archivo pequeño, solo con números
  const descarga = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Exportar contadores (JSON)' }).click();
  const d = await descarga;
  expect(d.suggestedFilename()).toMatch(/^uso-bienestar-\d{4}-\d{2}-\d{2}\.json$/);
  const texto = await (await import('node:fs/promises')).readFile((await d.path())!, 'utf8');
  expect(JSON.parse(texto)).toMatchObject({ app: 'bienestar', tipo: 'contadores-de-uso', version: 1 });
  expect(texto).not.toMatch(/Tinga|Les|Jeff/);

  // Borrar y deshacer
  await page.getByRole('button', { name: 'Borrar mis contadores' }).click();
  await expect(page.getByText('Todavía no hay nada contado esta semana.')).toBeVisible();
  await page.getByRole('button', { name: 'Deshacer' }).click();
  await expect(page.getByText('Abriste: Comida (2), Rutina (1).')).toBeVisible();

  // Sigue encendido después de recargar
  await page.reload();
  await page.getByRole('button', { name: 'Ajustes' }).click();
  await expect(page.getByRole('switch', { name: 'Medir mi uso' })).toHaveAttribute('aria-checked', 'true');
  expect(errores).toEqual([]);
});
