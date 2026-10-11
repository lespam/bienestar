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
const hace = (dias: number) => { const d = new Date(); d.setDate(d.getDate() - dias); return iso(d); };

test('Día flexible: contexto opcional, fase del ciclo desde Período, guardar y deshacer', async ({ page }) => {
  const errores = vigilarConsola(page);
  await entrarConContenido(page);
  // Un Período que empezó hace 17 días: hoy es el día 18, fase lútea
  await sembrar(page, 'periodo', [17, 16, 15, 14, 13].map((d) => ({ fecha: hace(d), nota: '' })));
  await page.reload();
  await page.getByRole('button', { name: 'Comida', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Marcar como día flexible' })).toBeVisible();
  await page.getByRole('button', { name: 'Marcar como día flexible' }).click();
  await expect(page.getByRole('heading', { name: 'Día flexible', level: 2 })).toBeVisible();
  await expect(page.getByText('Fase lútea · día 18 del ciclo')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Tarde', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await revisarPantalla(page);

  await page.getByRole('button', { name: 'Noche', exact: true }).click();
  await page.getByRole('button', { name: 'Cansancio', exact: true }).click();
  await page.getByRole('button', { name: 'Casa', exact: true }).click();
  await page.getByRole('button', { name: 'Cansancio', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Cansancio', exact: true })).toHaveAttribute('aria-pressed', 'false');
  await page.getByRole('button', { name: 'Menos de 6 h' }).click();
  await page.getByLabel('Qué comiste (opcional)').fill('Pizza con Jeff');
  await page.getByRole('button', { name: 'Guardar' }).click();
  await expect(page.getByText('Día flexible guardado')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Hoy es día flexible ✓' })).toBeVisible();
  await expect(page.getByText('Un día flexible es parte del plan. Mañana sigues como siempre.')).toBeVisible();
  await page.getByRole('button', { name: 'Deshacer' }).click();
  await expect(page.getByRole('button', { name: 'Marcar como día flexible' })).toBeVisible();

  // Se puede guardar sin llenar nada, y al volver a abrir queda lo que pusiste
  await page.getByRole('button', { name: 'Marcar como día flexible' }).click();
  await page.getByRole('button', { name: 'Noche', exact: true }).click();
  await page.getByRole('button', { name: 'Guardar' }).click();
  await expect(page.getByRole('button', { name: 'Hoy es día flexible ✓' })).toBeVisible();
  await page.waitForTimeout(400);
  await page.reload();
  await page.getByRole('button', { name: 'Comida', exact: true }).click();
  await page.getByRole('button', { name: 'Hoy es día flexible ✓' }).click();
  await expect(page.getByRole('button', { name: 'Noche', exact: true })).toHaveAttribute('aria-pressed', 'true');
  expect(errores).toEqual([]);
});

test('Patrones: flexibles, menús y takeouts describen sin juzgar', async ({ page }) => {
  const errores = vigilarConsola(page);
  await entrarConContenido(page);
  await page.getByRole('button', { name: /^Patrones/ }).click();
  await expect(page.getByRole('heading', { name: 'Patrones', level: 2 })).toBeVisible();
  await expect(page.getByText('Con 3 registros empiezan a verse patrones. Llevas 0.')).toBeVisible();
  await expect(page.getByText('Aquí aparecen los días flexibles que registres.')).toBeVisible();
  await expect(page.getByText('Aún no hay menús guardados', { exact: false })).toHaveCount(0);
  await revisarPantalla(page);

  // Datos de varias semanas
  await sembrar(page, 'flexibles', [7, 14, 21, 28].map((d) => ({ fecha: hace(d), hora: 'Noche', emo: 'Cansancio', lugar: 'Casa', sueno: '', estres: '', comi: d === 7 ? 'Tacos y refresco.' : '' })));
  await sembrar(page, 'menu', [
    { fecha: hace(14), lugar: 'c', t: 'dos', n: 'Tinga de pollo', r: 'tinga' },
    { fecha: hace(15), lugar: 'c', t: 'dos', n: 'Tinga de pollo', r: 'tinga' },
    { fecha: hace(16), lugar: 'c', t: 'dos', n: 'Tinga de pollo', r: 'tinga' },
    { fecha: hace(17), lugar: 'n', t: 'dos', n: 'Tacos de champiñón', r: 'tacos' },
    { fecha: hace(10), lugar: 'n', t: 'takeout', n: 'Pizza', costo: 380 },
    { fecha: hace(20), lugar: 'n', t: 'takeout', n: 'Sushi', costo: 500 }
  ]);
  await page.reload();
  await page.getByRole('button', { name: /^Patrones/ }).click();

  await expect(page.getByText('4 de 4 fueron')).toHaveCount(1);
  await page.getByRole('tab', { name: 'Hora' }).click();
  await expect(page.getByText('4 de 4 fueron en la noche. ¿Cómo llegas a esa hora del día?')).toBeVisible();
  await expect(page.getByText('Con 4 registros de las últimas 8 semanas.')).toBeVisible();
  await page.getByRole('tab', { name: 'Ciclo' }).click();
  await expect(page.getByText('Ninguno de tus 4 registros tiene este dato todavía. Marca tu Período en Cuerpo y aparece aquí.')).toBeVisible();
  await expect(page.getByText('Tacos y refresco.')).toBeVisible();
  await revisarPantalla(page);

  await page.getByRole('tab', { name: 'Menús' }).click();
  await expect(page.getByText('Tinga de pollo fue lo que más se repitió: 3 veces en 8 semanas. Solo para que lo notes.')).toBeVisible();
  await expect(page.getByText('Libre también es parte del plan.')).toBeVisible();
  await revisarPantalla(page);

  await page.getByRole('tab', { name: 'Takeouts' }).click();
  await expect(page.getByText('gastaron $880 en takeout, unos $110 por semana.')).toBeVisible();
  await expect(page.getByText('No hay una cantidad correcta.')).toBeVisible();
  await revisarPantalla(page);

  // Registrar un día flexible desde aquí
  await page.getByRole('tab', { name: 'Flexibles' }).click();
  await page.getByRole('button', { name: '+ Registrar un día flexible' }).click();
  await expect(page.getByRole('heading', { name: 'Día flexible', level: 2 })).toBeVisible();
  await page.getByRole('button', { name: 'Guardar' }).click();
  await page.getByRole('button', { name: 'Deshacer' }).dispatchEvent('click');
  await expect(page.getByRole('heading', { name: 'Patrones', level: 2 })).toBeVisible();
  expect(errores).toEqual([]);
});
