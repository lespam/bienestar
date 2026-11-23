import { test, expect } from '@playwright/test';
import { entrarConContenido, revisarPantalla, vigilarConsola } from './ayuda';

// Versión 2, fase 7: Hogar. Tareas que caben en tu tiempo y energía, sin culpa.
test('Hogar: eliges tu capacidad, deslizas o tocas, máximo 3, cierras el día sin culpa', async ({ page }) => {
  const errores = vigilarConsola(page);
  await entrarConContenido(page);
  await page.getByRole('button', { name: /Tareas de la casa/ }).click();
  await expect(page.getByRole('heading', { name: 'Hogar', level: 2 })).toBeVisible();
  await expect(page.getByText('Elige tu energía y tu tiempo')).toBeVisible();
  await revisarPantalla(page);

  await page.getByRole('radio', { name: 'Media' }).click();
  await page.getByRole('radio', { name: '15 min' }).click();
  await expect(page.locator('.hg-nom')).toHaveText('Lavar los platos');
  await expect(page.getByText('Aún no anotas la primera vez.')).toBeVisible();
  await revisarPantalla(page);

  // Hoy con el botón; la siguiente con un deslizamiento a la derecha.
  await page.getByRole('button', { name: 'Hoy', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Mi cosa de hoy' })).toBeVisible();
  const carta = page.locator('.hg-carta');
  const caja = (await carta.boundingBox())!;
  await page.mouse.move(caja.x + caja.width / 2, caja.y + 40);
  await page.mouse.down();
  await page.mouse.move(caja.x + caja.width / 2 + 120, caja.y + 44, { steps: 6 });
  await page.mouse.up();
  await expect(page.getByRole('heading', { name: 'Mis 2 cosas de hoy' })).toBeVisible();
  await page.getByRole('button', { name: 'Hoy', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Mis 3 cosas de hoy' })).toBeVisible();
  // Con 3 elegidas, «Hoy» queda quieto y lo dice con calma.
  await expect(page.getByRole('button', { name: 'Hoy', exact: true })).toBeDisabled();
  await expect(page.getByText('Ya tienes 3 para hoy.')).toBeVisible();
  await revisarPantalla(page);

  // Ya la hice: suma y se puede deshacer.
  await page.getByRole('button', { name: 'Ya hice: Lavar los platos' }).click();
  await expect(page.getByText('Hoy hiciste 1 cosa.')).toBeVisible();
  await page.getByRole('button', { name: 'Deshacer' }).click();
  await expect(page.getByText('Hoy hiciste 1 cosa.')).toBeHidden();
  await page.getByRole('button', { name: 'Ya hice: Lavar los platos' }).click();
  await expect(page.getByText('Hoy hiciste 1 cosa.')).toBeVisible();

  // Cerrar el día: lo que quedó pasa a después, sin marcas de falla.
  await page.getByRole('button', { name: 'Cerrar el día' }).click();
  await expect(page.getByText('Lo que quedó pasa a después. Hoy hiciste 1 cosa.')).toBeVisible();
  await expect(page.getByText(/Mis \d cosas de hoy|Mi cosa de hoy/)).toBeHidden();
  await expect(page.getByText(/atrasad|falla|te faltan/i)).toHaveCount(0);

  // Tu capacidad se recuerda para hoy.
  await page.reload();
  await page.getByRole('button', { name: /Tareas de la casa/ }).click();
  await expect(page.getByRole('radio', { name: 'Media' })).toHaveAttribute('aria-checked', 'true');
  await expect(page.getByRole('radio', { name: '15 min' })).toHaveAttribute('aria-checked', 'true');
  await expect(page.getByText('Hoy hiciste 1 cosa.')).toBeVisible();
  expect(errores).toEqual([]);
});

test('Hogar: escribes una frase, la app entiende con reglas y siempre confirma', async ({ page }) => {
  const errores = vigilarConsola(page);
  await entrarConContenido(page);
  await page.getByRole('button', { name: /Tareas de la casa/ }).click();

  await page.getByLabel('Escribe lo que hiciste o lo que quieres agregar').fill('tengo 20 min y poca energía');
  await page.getByRole('button', { name: 'Entender' }).click();
  await expect(page.getByText('Entendí: Hoy: 15 min y energía poca.')).toBeVisible();
  await page.getByRole('button', { name: 'Confirmar' }).click();
  await expect(page.getByRole('radio', { name: 'Poca' })).toHaveAttribute('aria-checked', 'true');
  await expect(page.getByRole('radio', { name: '15 min' })).toHaveAttribute('aria-checked', 'true');

  // Dos tareas se parecen: pregunta cuál.
  await page.getByLabel('Escribe lo que hiciste o lo que quieres agregar').fill('ya limpié el baño');
  await page.getByRole('button', { name: 'Entender' }).click();
  await page.getByRole('button', { name: 'Limpiar el lavabo del baño' }).click();
  await expect(page.getByText('Hoy hiciste 1 cosa.')).toBeVisible();

  // Agregar con una línea y verla en «Mis tareas».
  await page.getByLabel('Escribe lo que hiciste o lo que quieres agregar').fill('agrega zurcir los calcetines cada 10 días 20 min');
  await page.getByRole('button', { name: 'Entender' }).click();
  await expect(page.getByText('Entendí: Agregar la tarea «Zurcir los calcetines», cada 10 días, 20 min.')).toBeVisible();
  await page.getByRole('button', { name: 'Corregir' }).click();
  await expect(page.getByText(/Entendí:/)).toBeHidden();
  await page.getByRole('button', { name: 'Entender' }).click();
  await page.getByRole('button', { name: 'Confirmar' }).click();
  await page.getByRole('button', { name: /Mis tareas \(16\)/ }).click();
  await expect(page.getByRole('button', { name: 'Editar: Zurcir los calcetines' })).toBeVisible();
  await revisarPantalla(page);

  // Editar: versión mínima y quitar con deshacer.
  await page.getByRole('button', { name: 'Editar: Zurcir los calcetines' }).click();
  await page.getByLabel('Versión mínima (opcional)').fill('Solo un calcetín, 5 min');
  await page.getByRole('button', { name: 'Guardar', exact: true }).click();
  await page.getByRole('button', { name: 'Editar: Zurcir los calcetines' }).click();
  await expect(page.getByLabel('Versión mínima (opcional)')).toHaveValue('Solo un calcetín, 5 min');
  await revisarPantalla(page);
  await page.getByRole('button', { name: 'Quitar esta tarea' }).click();
  await expect(page.getByText('Quité «Zurcir los calcetines»')).toBeVisible();
  // Al quitarla, la lista sigue abierta y la tarea ya no está; Deshacer la devuelve.
  await expect(page.getByRole('button', { name: 'Editar: Zurcir los calcetines' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Deshacer' }).click();
  await expect(page.getByRole('button', { name: 'Editar: Zurcir los calcetines' })).toBeVisible();
  expect(errores).toEqual([]);
});
