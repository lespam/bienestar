import { test, expect } from '@playwright/test';
import { entrarConContenido, revisarPantalla, saltarBienvenida, vigilarConsola } from './ayuda';

test('Herramientas: cronómetro que sigue tras recargar, temporizador libre y moneda', async ({ page }) => {
  const errores = vigilarConsola(page);
  await saltarBienvenida(page);
  await page.getByRole('button', { name: 'Cronómetro' }).click();
  await expect(page.getByRole('heading', { name: 'Herramientas', level: 2 })).toBeFocused();
  await revisarPantalla(page);

  // Cronómetro: corre, se pausa y guarda vueltas
  await page.getByRole('button', { name: 'Iniciar', exact: true }).click();
  await page.waitForTimeout(1300);
  await page.getByRole('button', { name: 'Vuelta' }).click();
  await page.getByRole('button', { name: 'Pausar', exact: true }).click();
  const t = await page.getByRole('timer', { name: 'Cronómetro' }).innerText();
  expect(t).not.toBe('0:00.0');
  await expect(page.getByText('Vuelta 1')).toBeVisible();
  // Corriendo y recargando: sigue contando desde la hora real
  await page.getByRole('button', { name: 'Seguir', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Pausar', exact: true })).toBeVisible();
  await page.waitForTimeout(300);
  await page.reload();
  await page.getByRole('button', { name: 'Cronómetro' }).click();
  await expect(page.getByText('corriendo', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Reiniciar', exact: true }).click();
  await expect(page.getByRole('timer', { name: 'Cronómetro' })).toHaveText('0:00.0');

  // Temporizador libre de 2 segundos
  await page.getByRole('tab', { name: 'Temporizador' }).click();
  await page.getByRole('radio', { name: 'Libre' }).click();
  await page.getByLabel('Min').fill('0');
  await page.getByLabel('Seg').fill('2');
  await expect(page.getByRole('timer', { name: 'Temporizador' })).toContainText('0:02');
  await revisarPantalla(page);
  await page.getByRole('button', { name: 'Iniciar', exact: true }).click();
  await expect(page.getByText('corriendo', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Otra vez' })).toBeVisible({ timeout: 6000 });
  await expect(page.getByText('terminado', { exact: true })).toBeVisible();

  // Moneda
  await page.getByRole('tab', { name: 'Moneda' }).click();
  await revisarPantalla(page);
  await page.getByRole('button', { name: 'Lanzar la moneda' }).click();
  await expect(page.getByText(/^(Cara|Cruz): /)).toBeVisible({ timeout: 4000 });
  expect(errores).toEqual([]);
});

test('Descanso recuerda la duración que elegiste', async ({ page }) => {
  const errores = vigilarConsola(page);
  await entrarConContenido(page);
  await page.getByRole('button', { name: 'Rutina', exact: true }).click();
  await page.getByRole('button', { name: 'Descanso', exact: true }).click();
  await page.getByRole('radio', { name: '5 min' }).click();
  await expect(page.getByRole('timer', { name: 'Tiempo de descanso' })).toContainText('5:00');
  await page.waitForTimeout(500);
  await page.reload();
  await page.getByRole('button', { name: 'Rutina', exact: true }).click();
  await page.getByRole('button', { name: 'Descanso', exact: true }).click();
  await expect(page.getByRole('radio', { name: '5 min' })).toBeChecked();
  expect(errores).toEqual([]);
});

test('Cronómetro y Temporizador de Rutina abren Herramientas', async ({ page }) => {
  await entrarConContenido(page);
  await page.getByRole('button', { name: 'Rutina', exact: true }).click();
  await page.getByRole('button', { name: 'Temporizador' }).click();
  await expect(page.getByRole('tab', { name: 'Temporizador', selected: true })).toBeVisible();
});

test('Descanso: si el teléfono se duerme, solo cuenta lo que duró el descanso', async ({ page }) => {
  const errores = vigilarConsola(page);
  await page.clock.install();
  await entrarConContenido(page);
  await page.getByRole('button', { name: 'Rutina', exact: true }).click();
  await page.getByRole('button', { name: 'Descanso', exact: true }).click();
  await page.getByRole('radio', { name: '1 min' }).click();
  await page.getByRole('button', { name: 'Iniciar', exact: true }).click();
  await page.clock.fastForward('02:00:00'); // dos horas con la pantalla apagada
  await expect(page.getByText('listo', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Volver' }).click();
  await page.waitForTimeout(300);
  const segs = await page.evaluate(() => new Promise<number[]>((ok, mal) => {
    const a = indexedDB.open('bienestar');
    a.onerror = () => mal(a.error);
    a.onsuccess = () => {
      const r = a.result.transaction('descansos').objectStore('descansos').getAll();
      r.onsuccess = () => { a.result.close(); ok((r.result as { seg: number }[]).map((x) => x.seg)); };
    };
  }));
  expect(segs.length).toBe(1);
  expect(segs[0]).toBeLessThanOrEqual(61);
  expect(errores).toEqual([]);
});
