import { test, expect } from '@playwright/test';
import { entrarConContenido, irACuerpo, revisarPantalla, vigilarConsola } from './ayuda';

// La barra de abajo cambió: Planeador (el planeador semanal de Alma) ocupa el lugar de Cuerpo.
// Cuerpo se abre desde Inicio, como Mente y Alma.
test('Barra de abajo: Inicio, Rutina, Comida y Planeador; Cuerpo se abre desde Inicio', async ({ page }) => {
  const errores = vigilarConsola(page);
  await entrarConContenido(page);
  const barra = page.getByRole('navigation', { name: 'Secciones' });
  await expect(barra.getByRole('button')).toHaveText(['Inicio', 'Rutina', 'Comida', 'Planeador']);
  await expect(barra.getByRole('button', { name: 'Cuerpo' })).toHaveCount(0);
  await revisarPantalla(page);

  // La pestaña Planeador es el planeador semanal de Alma, sin botón de volver
  await barra.getByRole('button', { name: 'Planeador', exact: true }).click();
  await expect(barra.getByRole('button', { name: 'Planeador', exact: true })).toHaveAttribute('aria-current', 'page');
  await expect(page.getByRole('heading', { name: 'Alma', level: 2 })).toBeFocused();
  await expect(page.getByRole('button', { name: 'Volver' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Editar semana' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Editar áreas' })).toBeVisible();
  await revisarPantalla(page);

  // Lo que escribes se guarda y se ve después de salir y volver
  await page.getByRole('button', { name: 'Editar semana' }).click();
  await page.getByLabel(/^Lunes/).fill('Terminar el plan de la semana');
  await page.waitForTimeout(500);
  await page.getByRole('button', { name: 'Listo' }).click();
  await barra.getByRole('button', { name: 'Comida', exact: true }).click();
  await barra.getByRole('button', { name: 'Planeador', exact: true }).click();
  await expect(page.getByText('Terminar el plan de la semana')).toBeVisible();

  // Comparar semanas abre una pantalla encima y regresa al planeador
  await page.getByRole('button', { name: 'Comparar semanas para ver tu progreso' }).click();
  await expect(barra.getByRole('button', { name: 'Planeador', exact: true })).toHaveAttribute('aria-current', 'page');
  await page.getByRole('button', { name: 'Volver' }).click();
  await expect(page.getByRole('heading', { name: 'Alma', level: 2 })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Volver' })).toHaveCount(0);

  // El gesto atrás desde la pestaña regresa a Inicio
  await page.goBack();
  await expect(barra.getByRole('button', { name: 'Inicio', exact: true })).toHaveAttribute('aria-current', 'page');

  // Cuerpo ya no está en la barra: se abre desde Inicio y tiene su botón de volver
  await irACuerpo(page);
  await expect(page.getByRole('tab', { name: 'Medidas' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Volver' })).toBeVisible();
  await revisarPantalla(page);
  await page.getByRole('button', { name: 'Volver' }).click();
  await expect(page.getByRole('heading', { level: 2 })).toContainText('Les');
  expect(errores).toEqual([]);
});

test('Planeador abierto desde Inicio sigue siendo una pantalla con su botón de volver', async ({ page }) => {
  const errores = vigilarConsola(page);
  await entrarConContenido(page);
  const barra = page.getByRole('navigation', { name: 'Secciones' });
  await page.getByRole('button', { name: /^Planeador semanal De lunes a viernes/ }).click();
  await expect(page.getByRole('heading', { name: 'Alma', level: 2 })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Volver' })).toBeVisible();
  await expect(barra.getByRole('button', { name: 'Inicio', exact: true })).toHaveAttribute('aria-current', 'page');
  await page.getByRole('button', { name: 'Volver' }).click();
  await expect(page.getByRole('heading', { level: 2 })).toContainText('Les');
  expect(errores).toEqual([]);
});
