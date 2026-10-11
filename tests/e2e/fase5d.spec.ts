import { test, expect, type Page } from '@playwright/test';
import { entrarConContenido, revisarPantalla, vigilarConsola } from './ayuda';

async function abrirCompras(page: Page) {
  await page.getByRole('button', { name: 'Comida', exact: true }).click();
  await page.getByRole('button', { name: 'Menú', exact: true }).first().click();
  await page.getByRole('button', { name: 'Lista de compras' }).click();
  await expect(page.getByRole('heading', { name: 'Lista de compras', level: 2 })).toBeVisible();
}

test('Lista de compras: se arma del menú, va a la tienda correcta, se marca y se comparte', async ({ page }) => {
  const errores = vigilarConsola(page);
  await entrarConContenido(page);

  // Sin menú, la lista está vacía
  await abrirCompras(page);
  await expect(page.getByText('Aún no hay comidas en el menú.')).toBeVisible();
  await expect(page.getByText('Tu lista está vacía')).toBeVisible();
  await revisarPantalla(page);

  // Poner la tinga en el menú de hoy, para los dos
  await page.getByRole('button', { name: 'Volver' }).click();
  await page.getByRole('button', { name: 'Volver' }).click();
  await page.getByRole('button', { name: 'Recetario' }).click();
  await page.getByRole('button', { name: /Tinga de pollo/ }).click();
  await page.getByRole('button', { name: 'Agregar al menú' }).click();
  await page.getByRole('dialog', { name: 'Agregar al menú' }).getByRole('button', { name: 'Agregar', exact: true }).click();
  await expect(page.getByText(/^Agregado al menú: /)).toBeVisible();
  await page.waitForTimeout(400);
  await page.getByRole('button', { name: 'Volver' }).click();
  await page.getByRole('button', { name: 'Volver' }).click();

  await abrirCompras(page);
  await expect(page.getByRole('radio', { name: 'Enfrente · 2' })).toBeChecked();
  await expect(page.getByRole('radio', { name: 'Walmart+ · 1' })).toBeVisible();
  await expect(page.getByRole('radio', { name: 'Todo · 3' })).toBeVisible();
  // 500 g cocidos son 650 g crudos
  const pollo = page.locator('.cp-row', { hasText: 'Pechuga de pollo' });
  await expect(pollo.getByText('650 g')).toBeVisible();
  await expect(pollo.getByText('Para: Tinga de pollo · en crudo')).toBeVisible();
  await expect(page.locator('.cp-row', { hasText: 'Jitomate' }).getByText('4 piezas')).toBeVisible();
  await expect(page.getByText('Aceite')).toHaveCount(0);
  await revisarPantalla(page);

  // Marcar y que se quede
  await pollo.getByRole('checkbox').check();
  await expect(page.getByText('Llevas 1 de 3')).toBeVisible();
  await page.waitForTimeout(400);
  await page.reload();
  await abrirCompras(page);
  await expect(page.getByText('Llevas 1 de 3')).toBeVisible();

  // Walmart+ y mover
  await page.getByRole('radio', { name: /^Walmart\+/ }).click();
  const aceite = page.locator('.cp-row', { hasText: 'Aceite' });
  await expect(aceite.getByText('2 cdas')).toBeVisible();
  await aceite.getByRole('button', { name: 'Pasar Aceite a Enfrente' }).click();
  await expect(page.getByText('Aceite pasó a Enfrente')).toBeVisible();
  await expect(page.getByText('No hay nada para Walmart+ por ahora.')).toBeVisible();
  await page.getByRole('button', { name: 'Deshacer' }).click();
  await expect(page.locator('.cp-row', { hasText: 'Aceite' })).toBeVisible();

  // Falta o se acaba: sugerencias de tu plantilla; solo una cosa pesada va enfrente
  await page.getByRole('radio', { name: /^Enfrente/ }).click();
  await page.getByRole('textbox', { name: 'Falta o se acaba' }).fill('paper');
  await page.getByRole('button', { name: 'Paper Towels' }).click();
  await page.getByRole('textbox', { name: 'Falta o se acaba' }).fill('laundry');
  await page.getByRole('button', { name: 'Laundry Detergent' }).click();
  await expect(page.locator('.cp-row', { hasText: 'Paper Towels' }).getByText('Ya falta')).toBeVisible();
  await expect(page.getByText('Jeff carga poco: pasé Laundry Detergent a Walmart+. Puedes cambiarlo.')).toBeVisible();
  await page.getByRole('textbox', { name: 'Falta o se acaba' }).fill('Café');
  await page.getByRole('radio', { name: 'Se acaba pronto' }).click();
  await page.getByRole('button', { name: 'Agregar', exact: true }).first().click();
  await page.getByRole('radio', { name: /^Todo/ }).click();
  await expect(page.locator('.cp-row', { hasText: 'Café' }).getByText('Walmart+ · Se acaba pronto')).toBeVisible();
  await revisarPantalla(page);

  // Agregar algo más
  await page.getByRole('button', { name: '+ Agregar algo más' }).click();
  const hoja = page.getByRole('dialog', { name: 'Agregar a la lista' });
  await hoja.getByLabel('Qué falta').fill('Sal de mar');
  await hoja.getByLabel('Cantidad (opcional)').fill('1 bolsa');
  await hoja.getByRole('radio', { name: 'Despensa' }).click();
  await hoja.getByRole('button', { name: 'Agregar', exact: true }).dispatchEvent('click');
  await expect(page.locator('.cp-row', { hasText: 'Sal de mar' }).getByText('1 bolsa')).toBeVisible();

  // Compartir: solo lo que falta, sin lo ya marcado
  await page.getByRole('button', { name: 'Compartir con Jeff' }).click();
  const comp = page.getByRole('dialog', { name: 'Compartir con Jeff' });
  await comp.getByRole('radio', { name: 'Las dos' }).click();
  const previa = comp.locator('pre');
  await expect(previa).toContainText('Súper de enfrente');
  await expect(previa).toContainText('Pedido Walmart+');
  await expect(previa).toContainText('• Jitomate (4 piezas)');
  await expect(previa).not.toContainText('Pechuga');
  await comp.getByRole('radio', { name: 'Toda la lista' }).click();
  await expect(previa).toContainText('• Pechuga de pollo (650 g)');
  await revisarPantalla(page);
  expect(errores).toEqual([]);
});
