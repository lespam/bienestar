import { test, expect } from '@playwright/test';
import { entrarConContenido, irACuerpo, vigilarConsola } from './ayuda';

test('Cuerpo: el peso se anota directo desde su tarjeta y avisa si no se entiende', async ({ page }) => {
  const errores = vigilarConsola(page);
  await entrarConContenido(page);
  await irACuerpo(page);
  await page.getByRole('button', { name: 'Anotar', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Peso de hoy' })).toBeVisible();
  await page.getByLabel(/^Peso \(/).fill('abc');
  await page.getByRole('button', { name: 'Guardar' }).click();
  await expect(page.getByText(/Revisa el peso/)).toBeVisible();
  await page.getByLabel(/^Peso \(/).fill('62,5');
  await page.getByRole('button', { name: 'Guardar' }).click();
  await expect(page.getByText('Guardado: peso')).toBeVisible();
  await expect(page.getByRole('dialog', { name: 'Peso de hoy' })).toBeHidden();
  // Otra vez el mismo día: reemplaza, y también desde «Registrar medidas de hoy».
  await page.getByRole('button', { name: 'Registrar medidas de hoy' }).click();
  await page.getByLabel(/Peso \(opcional/).fill('62');
  await page.getByRole('button', { name: 'Guardar' }).click();
  await expect(page.getByText('Guardado: peso')).toBeVisible();
  await page.getByRole('button', { name: 'Mostrar', exact: true }).click();
  await expect(page.locator('.weight b')).toContainText('62');
  expect(errores).toEqual([]);
});
