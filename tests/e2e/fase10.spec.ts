import { test, expect } from '@playwright/test';
import { entrarConContenido, revisarPantalla, vigilarConsola } from './ayuda';

const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');

// Versión 2, fase 1: visor de imágenes, imagen en el descanso y tabla de la semana que se desplaza.
test('Visor: una imagen de tu colección se abre en grande y el gesto atrás la cierra; el descanso la muestra', async ({ page }) => {
  const errores = vigilarConsola(page);
  await entrarConContenido(page);

  // Sin imágenes, el descanso invita a agregar una.
  await page.getByRole('button', { name: 'Rutina', exact: true }).click();
  await page.getByRole('button', { name: 'Descanso', exact: true }).click();
  await page.getByRole('tab', { name: 'Imagen' }).click();
  await expect(page.getByText('Aún no tienes imágenes')).toBeVisible();
  await page.getByRole('button', { name: 'Agregar una imagen' }).click();
  await expect(page.getByRole('heading', { name: /Mente/ }).first()).toBeVisible();

  // Agrega una imagen a la colección.
  await page.getByRole('tab', { name: 'Colección' }).click();
  await page.getByRole('button', { name: '+ Agregar', exact: true }).click();
  await page.getByRole('radio', { name: 'Imagen' }).click();
  await page.locator('#me-img').setInputFiles({ name: 'b.png', mimeType: 'image/png', buffer: PNG });
  await page.getByLabel('Título').fill('Biblioteca');
  await page.getByRole('button', { name: 'Guardar', exact: true }).click();

  // Tocar la imagen la abre en grande; Editar abre la hoja de edición.
  await page.getByRole('button', { name: 'Ver en grande: Biblioteca' }).click();
  await expect(page.getByRole('dialog', { name: 'Imagen en grande' })).toBeVisible();
  await page.goBack();
  await expect(page.getByRole('dialog', { name: 'Imagen en grande' })).toBeHidden();
  await page.getByRole('button', { name: 'Editar: Biblioteca' }).click();
  await expect(page.getByRole('dialog', { name: /Editar|Biblioteca/ })).toBeVisible();
  await page.getByRole('button', { name: 'Cerrar' }).click();

  // El descanso muestra una imagen de tu colección, que también se abre en grande.
  await page.getByRole('button', { name: 'Rutina', exact: true }).click();
  await page.getByRole('button', { name: 'Descanso', exact: true }).click();
  await page.getByRole('tab', { name: 'Imagen' }).click();
  await revisarPantalla(page);
  await page.getByRole('button', { name: 'Ver en grande: Biblioteca' }).click();
  await expect(page.getByRole('dialog', { name: 'Imagen en grande' })).toBeVisible();
  await page.getByRole('button', { name: 'Cerrar' }).last().click();
  await expect(page.getByRole('dialog', { name: 'Imagen en grande' })).toBeHidden();
  expect(errores).toEqual([]);
});
