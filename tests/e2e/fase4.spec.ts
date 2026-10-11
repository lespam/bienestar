import { test, expect, type Page } from '@playwright/test';
import { revisarPantalla, saltarBienvenida, vigilarConsola } from './ayuda';

// Una foto de prueba de 8 × 8 px.
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAgAAAAICAYAAADED76LAAAAFklEQVR4nGP8z8Dwn4EIwESMolGFVFMIAIzcAhFdpQHPAAAAAElFTkSuQmCC', 'base64');

/** Mete filas en una tabla de la base, como si las hubieras guardado otro día. */
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

test('Cuerpo: medidas ocultas, peso que se muestra, gráfica y zonas', async ({ page }) => {
  const errores = vigilarConsola(page);
  await saltarBienvenida(page);
  await sembrar(page, 'medidas', [
    { zona: 'Glúteo', fecha: '2026-08-20', cm: 100 }, { zona: 'Glúteo', fecha: '2026-09-03', cm: 100.5 }, { zona: 'Glúteo', fecha: '2026-09-17', cm: 101 }
  ]);
  await page.reload();
  await page.getByRole('button', { name: 'Cuerpo', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Cuerpo', level: 2 })).toBeFocused();

  // Con "Ocultar números" encendido, las medidas se ven tapadas
  await expect(page.getByText('Sin registro')).toBeVisible();
  await expect(page.getByText('101 cm')).toHaveCount(0);
  await revisarPantalla(page);
  await page.getByRole('button', { name: 'Mostrar', exact: true }).click();
  await expect(page.getByText('101 cm', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: '3 sep' }).click();
  await expect(page.getByText('3 sep: 100.5 cm')).toBeVisible();

  // Registrar medidas y peso de hoy, con Deshacer
  await page.getByRole('button', { name: 'Registrar medidas de hoy' }).click();
  const hoja = page.getByRole('dialog', { name: 'Medidas de hoy' });
  await expect(hoja.getByLabel('Glúteo (cm)')).toBeFocused();
  await hoja.getByLabel('Glúteo (cm)').fill('101,5');
  await hoja.getByLabel('Cintura (cm)').fill('77');
  await hoja.getByLabel(/Peso/).fill('158');
  await revisarPantalla(page);
  await hoja.getByRole('button', { name: 'Guardar' }).click();
  await expect(page.getByText('Guardado: 2 medidas y peso')).toBeVisible();
  await expect(page.getByText('Peso · ')).toBeVisible();
  await expect(page.getByText('158 lb')).toBeVisible();
  await expect(page.getByText('101.5 cm', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Deshacer' }).click();
  await expect(page.getByText('Sin registro')).toBeVisible();

  // Quitar una zona guarda su historial
  await page.getByRole('button', { name: '+ Agregar o quitar medidas' }).click();
  const zonas = page.getByRole('dialog', { name: 'Tus medidas' });
  await zonas.getByRole('switch', { name: 'Cintura' }).click();
  await zonas.getByLabel('Agregar otra').fill('espalda');
  await zonas.getByRole('button', { name: 'Agregar', exact: true }).click();
  await revisarPantalla(page);
  await page.getByRole('button', { name: 'Cerrar' }).click();
  await expect(page.getByRole('radio', { name: 'Espalda' })).toBeVisible();
  await expect(page.getByRole('radio', { name: 'Cintura' })).toHaveCount(0);
  expect(errores).toEqual([]);
});

test('Cuerpo: las fotos empiezan cubiertas, se comparan y se quitan', async ({ page }) => {
  const errores = vigilarConsola(page);
  await saltarBienvenida(page);
  await page.getByRole('button', { name: 'Cuerpo', exact: true }).click();
  await page.getByRole('tab', { name: 'Fotos' }).click();
  await expect(page.getByText('Aún no hay fotos.')).toBeVisible();
  await page.locator('#ph-file').setInputFiles({ name: 'a.png', mimeType: 'image/png', buffer: PNG });
  await expect(page.getByText('1 foto. La más reciente es del')).toBeVisible();
  await page.locator('#ph-file').setInputFiles({ name: 'b.png', mimeType: 'image/png', buffer: PNG });
  await expect(page.getByText('2 fotos. La más reciente es del')).toBeVisible();
  await revisarPantalla(page);

  await page.getByRole('button', { name: 'Mostrar fotos' }).click();
  const fotos = page.getByRole('button', { name: /^Foto del/ });
  await expect(fotos).toHaveCount(2);
  await fotos.nth(0).click();
  await expect(page.getByRole('button', { name: /^Quitar la foto del/ })).toBeVisible();
  await fotos.nth(1).click();
  await expect(page.getByText('Toca una de las dos para quitarla de la comparación.')).toBeVisible();
  await revisarPantalla(page);
  await fotos.nth(1).click();
  await page.getByRole('button', { name: /^Quitar la foto del/ }).click();
  await expect(page.getByRole('button', { name: /^Foto del/ })).toHaveCount(1);
  await page.getByRole('button', { name: 'Deshacer' }).click();
  await expect(page.getByRole('button', { name: /^Foto del/ })).toHaveCount(2);

  // Cambiar de pestaña las vuelve a cubrir
  await page.getByRole('tab', { name: 'Período' }).click();
  await page.getByRole('tab', { name: 'Fotos' }).click();
  await expect(page.getByText('Tus fotos están cubiertas')).toBeVisible();
  expect(errores).toEqual([]);
});

test('Cuerpo: Período marca días, guarda notas y no deja marcar el futuro', async ({ page }) => {
  const errores = vigilarConsola(page);
  await saltarBienvenida(page);
  await page.getByRole('button', { name: 'Cuerpo', exact: true }).click();
  await page.getByRole('tab', { name: 'Período' }).click();
  await expect(page.getByText('Aún no hay fechas.')).toBeVisible();
  await expect(page.locator('#dn-text')).toBeDisabled();
  await revisarPantalla(page);
  await page.getByRole('button', { name: 'Marcar día' }).click();
  await page.locator('#dn-text').fill('Más cansancio de lo normal.');
  await page.waitForTimeout(800);
  await page.reload();
  await page.getByRole('button', { name: 'Cuerpo', exact: true }).click();
  await page.getByRole('tab', { name: 'Período' }).click();
  await expect(page.getByText('Más cansancio de lo normal.')).toBeVisible();
  await expect(page.getByRole('button', { name: /marcado$/ })).toHaveCount(1);
  await page.getByRole('button', { name: 'Quitar día' }).click();
  await expect(page.getByText('Aún no hay fechas.')).toBeVisible();
  await page.getByRole('button', { name: 'Deshacer' }).click();
  await expect(page.getByText('Más cansancio de lo normal.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Mes siguiente' })).toBeDisabled();
  expect(errores).toEqual([]);
});
