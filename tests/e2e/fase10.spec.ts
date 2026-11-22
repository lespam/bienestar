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

test('Recetario: guardar recetas por origen, buscarlas por nombre y deshacer', async ({ page }) => {
  const errores = vigilarConsola(page);
  await entrarConContenido(page);
  await page.getByRole('button', { name: 'Comida', exact: true }).click();
  await page.getByRole('button', { name: 'Recetario' }).click();
  await expect(page.getByText(/Mostrando 2 de 2/)).toBeVisible();
  await page.getByRole('button', { name: 'Ordenar recetas por origen' }).click();
  await page.getByRole('dialog').getByRole('switch').first().click();
  await page.getByRole('button', { name: 'Aplicar' }).click();
  await expect(page.getByText(/Mostrando 0 de 2/)).toBeVisible();
  // Buscarla por nombre la muestra aunque esté guardada
  await page.getByRole('searchbox', { name: 'Buscar receta o ingrediente' }).fill('Tinga');
  await expect(page.getByRole('button', { name: /Tinga de pollo/ })).toBeVisible();
  await page.getByRole('searchbox', { name: 'Buscar receta o ingrediente' }).fill('');
  await page.getByRole('switch', { name: 'Ver también las guardadas' }).click();
  await expect(page.getByText(/Mostrando 2 de 2/)).toBeVisible();
  await page.getByRole('button', { name: 'Quitar filtros' }).click();
  await expect(page.getByText(/Mostrando 0 de 2/)).toBeVisible();
  expect(errores).toEqual([]);
});

test('Etiquetas: se ponen en la receta y se filtran en el Recetario', async ({ page }) => {
  const errores = vigilarConsola(page);
  await entrarConContenido(page);
  await page.getByRole('button', { name: 'Comida', exact: true }).click();
  await page.getByRole('button', { name: 'Recetario' }).click();
  await page.getByRole('button', { name: /Tinga de pollo/ }).click();
  await page.getByLabel('Nueva etiqueta').fill('para recibir');
  await page.getByLabel('Nueva etiqueta').press('Enter');
  await expect(page.getByRole('button', { name: 'Quitar etiqueta Para recibir' })).toBeVisible();
  await page.getByRole('button', { name: 'Volver' }).click();
  await page.getByLabel('Etiqueta').selectOption('Para recibir');
  await expect(page.getByText(/Mostrando 1 de 2/)).toBeVisible();
  await page.getByRole('button', { name: 'Quitar filtro: Etiqueta: Para recibir' }).click();
  await expect(page.getByText(/Mostrando 2 de 2/)).toBeVisible();
  expect(errores).toEqual([]);
});
