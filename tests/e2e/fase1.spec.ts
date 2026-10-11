import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { contenidoDePrueba, vigilarConsola, saltarBienvenida, revisarPantalla } from './ayuda';

test('bienvenida: números, contenido personal e Inicio', async ({ page }) => {
  const errores = vigilarConsola(page);
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Hola, Les. Antes de empezar, dos cosas.' })).toBeVisible();
  await revisarPantalla(page);
  const comida = page.getByRole('switch', { name: 'Comida y cuerpo' });
  await expect(comida).toHaveAttribute('aria-checked', 'true');
  await page.getByRole('switch', { name: 'Entrenamiento' }).click();
  await page.getByRole('button', { name: 'Continuar' }).click();
  await expect(page.getByRole('heading', { name: 'Carga tu contenido personal' })).toBeFocused();
  await revisarPantalla(page);

  // Archivo equivocado
  let elegir = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: 'Elegir archivo' }).click();
  await (await elegir).setFiles({ name: 'otro.zip', mimeType: 'application/zip', buffer: Buffer.from('nada') });
  await expect(page.getByText('Este archivo no es tu contenido personal. No cambié nada.')).toBeVisible();

  elegir = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: 'Elegir otro archivo' }).click();
  await (await elegir).setFiles({ name: 'contenido.zip', mimeType: 'application/zip', buffer: contenidoDePrueba() });
  await expect(page.getByText('Listo. Ya está en tu teléfono:')).toBeVisible();
  await expect(page.getByText('2 recetas y la guía de intercambios')).toBeVisible();
  await page.getByRole('button', { name: 'Ir a Inicio' }).click();

  await expect(page.getByRole('heading', { name: 'Rutina A' })).toBeVisible();
  await expect(page.getByText('3 ejercicios · 1 en el gym')).toBeVisible();
  await expect(page.locator('.in-quote')).not.toBeEmpty();
  await revisarPantalla(page);

  // Se ve una sola vez
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Rutina A' })).toBeVisible();
  await page.getByRole('button', { name: 'Ajustes' }).click();
  await expect(page.getByRole('switch', { name: 'Entrenamiento' })).toHaveAttribute('aria-checked', 'true');
  expect(errores).toEqual([]);
});

test('Ajustes: revisión de pantalla y enlace de Obsidian', async ({ page }) => {
  const errores = vigilarConsola(page);
  await saltarBienvenida(page);
  await page.getByRole('button', { name: 'Ajustes' }).click();
  await expect(page.getByRole('heading', { name: 'Ajustes' })).toBeFocused();
  await revisarPantalla(page);
  await page.getByRole('button', { name: 'Editar' }).nth(2).click();
  const dialogo = page.getByRole('dialog', { name: 'Obsidian' });
  await expect(dialogo).toBeVisible();
  await expect(page.getByLabel('Nombre de tu bóveda')).toBeFocused();
  await revisarPantalla(page);
  await page.getByLabel('Nombre de tu bóveda').fill('Mi bóveda');
  await page.getByRole('button', { name: 'Guardar' }).click();
  await expect(dialogo).toBeHidden();
  await expect(page.getByText('Bóveda: Mi bóveda')).toBeVisible();
  await page.getByRole('button', { name: '‹ Volver' }).click();
  await expect(page.getByRole('link', { name: 'Obsidian' })).toHaveAttribute('href', 'obsidian://open?vault=Mi%20b%C3%B3veda');
  expect(errores).toEqual([]);
});

test('gesto atrás: cierra la hoja, la pantalla y avisa antes de salir', async ({ page }) => {
  await saltarBienvenida(page);
  await page.getByRole('button', { name: 'Ajustes' }).click();
  await page.getByRole('button', { name: 'Importar respaldo' }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.goBack();
  await expect(page.getByRole('dialog')).toBeHidden();
  await expect(page.getByRole('heading', { name: 'Ajustes' })).toBeVisible();
  await page.goBack();
  await expect(page.locator('.in-main, .in-msg').first()).toBeVisible();
  await page.getByRole('button', { name: 'Comida' }).last().click();
  await page.goBack();
  await expect(page.getByRole('button', { name: 'Inicio' })).toHaveAttribute('aria-current', 'page');
  await page.goBack();
  await expect(page.getByText('Desliza otra vez para salir')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Ajustes' })).toBeVisible();
});

test('respaldo: exportar, importar y deshacer', async ({ page }) => {
  await saltarBienvenida(page);
  await page.getByRole('button', { name: 'Ajustes' }).click();
  const descarga = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Exportar respaldo (ZIP)' }).click();
  const d = await descarga;
  expect(d.suggestedFilename()).toMatch(/^bienestar-\d{4}-\d{2}-\d{2}\.zip$/);
  await expect(page.getByText('Último respaldo: hoy')).toBeVisible();
  const zip = readFileSync(await d.path());

  await page.getByRole('radio', { name: 'Kilos (kg)' }).click();
  await page.getByRole('button', { name: 'Importar respaldo' }).click();
  const elegir = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: 'Elegir archivo ZIP' }).click();
  await (await elegir).setFiles({ name: 'r.zip', mimeType: 'application/zip', buffer: zip });
  await expect(page.getByRole('radio', { name: 'Libras (lb)' })).toHaveAttribute('aria-checked', 'true');
  await expect(page.getByText('Respaldo importado')).toBeVisible();
  await page.getByRole('button', { name: 'Deshacer' }).click();
  await expect(page.getByRole('radio', { name: 'Kilos (kg)' })).toHaveAttribute('aria-checked', 'true');
  await expect(page.getByRole('button', { name: 'Volver a mis datos anteriores' })).toBeVisible();
});

test.describe('sin internet', () => {
  test.use({ serviceWorkers: 'allow' });
  test('abre sin internet después de la primera vez', async ({ page, context }) => {
    await page.goto('/');
    await page.evaluate(() => navigator.serviceWorker.ready);
    await page.reload();
    await page.evaluate(() => navigator.serviceWorker.ready);
    await context.setOffline(true);
    await page.reload();
    await expect(page.getByRole('heading', { name: 'Hola, Les. Antes de empezar, dos cosas.' })).toBeVisible();
  });
});
