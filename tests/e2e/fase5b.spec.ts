import { test, expect } from '@playwright/test';
import { entrarConContenido, revisarPantalla, vigilarConsola } from './ayuda';

test('Comida: registrar, ver números, editar, quitar, copiar y moverse entre días', async ({ page }) => {
  const errores = vigilarConsola(page);
  await entrarConContenido(page);
  await page.getByRole('button', { name: 'Comida', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Comida', level: 2 })).toBeFocused();
  await expect(page.getByText(/^Hoy · /)).toBeVisible();
  await expect(page.getByText('0 de 4 comidas registradas')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Día siguiente' })).toBeDisabled();
  await revisarPantalla(page);

  // Escribir un alimento en la cena
  await page.locator('.meal', { hasText: 'Cena' }).getByRole('button', { name: '+ Agregar' }).click();
  const hoja = page.getByRole('dialog', { name: 'Agregar a Cena' });
  await hoja.getByRole('tab', { name: 'Escribir' }).click();
  await hoja.getByRole('button', { name: 'Agregar', exact: true }).click();
  await expect(page.getByText('Escribe el nombre del alimento')).toBeVisible();
  await hoja.getByLabel('Alimento').fill('Quesadilla de champiñones');
  await hoja.getByLabel('Porción').fill('2 piezas');
  await hoja.getByLabel('kcal').fill('320');
  await hoja.getByLabel('Prot g').fill('16');
  await revisarPantalla(page);
  await hoja.getByRole('button', { name: 'Agregar', exact: true }).click();
  await expect(page.getByText('Agregado a Cena')).toBeVisible();
  await expect(page.getByText('1 de 4 comidas registradas')).toBeVisible();
  // Con los números ocultos, el alimento aparece sin cifras
  const fila = page.getByRole('button', { name: 'Editar o quitar Quesadilla de champiñones' });
  await expect(fila).toBeVisible();
  await expect(fila.locator('.fk')).toBeHidden();

  // Ver números
  await page.getByRole('button', { name: 'Ver números' }).click();
  await expect(page.getByText('kcal aprox. hoy')).toBeVisible();
  await expect(fila.locator('.fk')).toHaveText('320');
  await expect(page.locator('.macros')).toBeHidden();
  await page.getByRole('button', { name: 'Ver macros' }).click();
  await expect(page.getByText('Proteína')).toBeVisible();
  await expect(page.getByText('16 g')).toBeVisible();
  await revisarPantalla(page);

  // Recientes y recetas
  await page.locator('.meal', { hasText: 'Desayuno' }).getByRole('button', { name: '+ Agregar' }).click();
  const h2 = page.getByRole('dialog', { name: 'Agregar a Desayuno' });
  await expect(h2.getByRole('button', { name: /Quesadilla de champiñones/ })).toBeVisible();
  await h2.getByRole('tab', { name: 'Recetas' }).click();
  await expect(h2.getByRole('button', { name: /Tinga de pollo/ })).toContainText('290 kcal aprox.');
  await h2.getByRole('button', { name: /Tinga de pollo/ }).click();
  await expect(page.getByText('Agregado a Desayuno')).toBeVisible();
  await expect(page.locator('.meal', { hasText: 'Desayuno' }).getByText('Tinga de pollo')).toBeVisible();
  await expect(page.getByText('2 de 4 comidas registradas')).toHaveCount(0); // los números ya se ven
  await expect(page.getByText('Ya registraste')).toHaveCount(0);

  // Editar: moverla a Comida, con Deshacer
  await page.getByRole('button', { name: 'Editar o quitar Tinga de pollo' }).click();
  const ed = page.getByRole('dialog', { name: 'Editar alimento' });
  await expect(ed.getByLabel('Alimento')).toHaveValue('Tinga de pollo');
  await ed.getByRole('radio', { name: 'Comida', exact: true }).click();
  await ed.getByLabel('kcal').fill('300');
  await revisarPantalla(page);
  await ed.getByRole('button', { name: 'Guardar cambios' }).click();
  await expect(page.getByText('Movido a Comida')).toBeVisible();
  await expect(page.locator('.meal', { hasText: 'Desayuno' }).getByText('Aún no registras nada aquí.')).toBeVisible();
  await expect(page.locator('.meal', { hasText: 'Comida' }).filter({ hasText: 'Tinga de pollo' }).locator('.fk')).toHaveText('300');
  await page.getByRole('button', { name: 'Deshacer' }).click();
  await expect(page.locator('.meal', { hasText: 'Desayuno' }).getByText('Tinga de pollo')).toBeVisible();

  // Quitar y recuperar
  await page.getByRole('button', { name: 'Editar o quitar Tinga de pollo' }).click();
  await page.getByRole('dialog', { name: 'Editar alimento' }).getByRole('button', { name: 'Quitar de mi registro' }).click();
  await expect(page.getByRole('button', { name: 'Editar o quitar Tinga de pollo' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Deshacer' }).click();
  await expect(page.getByRole('button', { name: 'Editar o quitar Tinga de pollo' })).toBeVisible();

  // Copiar la cena a ayer y a antier
  await page.getByRole('button', { name: 'Copiar Cena a otro día' }).click();
  const cp = page.getByRole('dialog', { name: 'Copiar cena a otro día' });
  await expect(cp.getByRole('button', { name: 'Copiar', exact: true })).toBeDisabled();
  await cp.getByRole('button', { name: 'Ayer' }).click();
  await expect(cp.getByRole('button', { name: 'Copiar a 1 día' })).toBeVisible();
  await revisarPantalla(page);
  await cp.getByRole('button', { name: 'Copiar a 1 día' }).click();
  await expect(page.getByText('Copiado a 1 día')).toBeVisible();
  await page.waitForTimeout(400);

  // Ir a ayer: está la cena copiada y los números siguen la misma preferencia
  await page.getByRole('button', { name: 'Día anterior' }).click();
  await expect(page.getByText(/^Ayer · /)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Editar o quitar Quesadilla de champiñones' })).toBeVisible();
  await expect(page.getByText('Registro de ese día.')).toBeVisible();
  await expect(page.getByText('kcal aprox. ese día')).toBeVisible();
  await page.getByRole('button', { name: 'Día siguiente' }).click();

  // En hoy: quitar la cena y traerla otra vez "del día anterior"
  await page.getByRole('button', { name: 'Editar o quitar Quesadilla de champiñones' }).click();
  await page.getByRole('dialog', { name: 'Editar alimento' }).getByRole('button', { name: 'Quitar de mi registro' }).click();
  await page.waitForTimeout(300);
  await page.getByRole('button', { name: 'Copiar Cena del día anterior' }).click();
  await expect(page.getByRole('button', { name: 'Editar o quitar Quesadilla de champiñones' })).toBeVisible();

  // Todo queda guardado
  await page.waitForTimeout(400);
  await page.reload();
  await page.getByRole('button', { name: 'Comida', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Editar o quitar Quesadilla de champiñones' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Editar o quitar Tinga de pollo' })).toBeVisible();
  expect(errores).toEqual([]);
});

test('Comida: la preferencia de números se comparte con Recetario y Perfiles', async ({ page }) => {
  const errores = vigilarConsola(page);
  await entrarConContenido(page);
  await page.getByRole('button', { name: 'Comida', exact: true }).click();
  await page.getByRole('button', { name: 'Ver números' }).click();
  await page.getByRole('button', { name: 'Perfiles' }).click();
  await expect(page.getByText('Los números están ocultos.')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Editar' })).toBeVisible();
  await page.getByRole('button', { name: 'Volver' }).click();
  await page.getByRole('button', { name: 'Ocultar números' }).click();
  await expect(page.getByText('Los números están ocultos. Siguen guardados para tus patrones.')).toBeVisible();
  expect(errores).toEqual([]);
});
