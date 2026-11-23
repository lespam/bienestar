import { test, expect, type Page } from '@playwright/test';
import { entrarConContenido, revisarPantalla, vigilarConsola } from './ayuda';

async function ponerImagenPropia(page: Page, clave: string) {
  await page.evaluate((clave) => new Promise<void>((ok, mal) => {
    const abrir = indexedDB.open('bienestar');
    abrir.onerror = () => mal(abrir.error);
    abrir.onsuccess = () => {
      const bd = abrir.result, tx = bd.transaction('fichas', 'readwrite');
      const png = Uint8Array.from(atob('iVBORw0KGgoAAAANSUhEUgAAAAgAAAAICAYAAADED76LAAAAFklEQVR4nGP8z8Dwn4EIwESMolGFVFMIAIzcAhFdpQHPAAAAAElFTkSuQmCC'), (c) => c.charCodeAt(0));
      tx.objectStore('fichas').put({ clave, animacion: new Blob([png], { type: 'image/png' }) });
      tx.oncomplete = () => { bd.close(); ok(); };
      tx.onerror = () => mal(tx.error);
    };
  }), clave);
}

// Versión 2, #25: imágenes de los ejercicios en la vista previa de Rutina, que se abren en el visor.
test('Rutina: la vista previa muestra una imagen por ejercicio y se abre en grande', async ({ page }) => {
  const errores = vigilarConsola(page);
  await entrarConContenido(page);
  await page.getByRole('button', { name: 'Rutina', exact: true }).click();
  await expect(page.getByRole('heading', { level: 2 })).toContainText('Les');
  const tira = page.getByRole('region', { name: /Ejercicios de la Rutina/ });
  await expect(tira.getByRole('heading', { name: 'Los ejercicios de la sesión' })).toBeVisible();
  // La Rutina de prueba tiene tres ejercicios: sin imagen propia sale el cuadro quieto de la animación
  await expect(tira.getByRole('button')).toHaveCount(3);
  await revisarPantalla(page);

  await tira.getByRole('button', { name: 'Ver en grande: Ejercicio B' }).click();
  const visor = page.getByRole('dialog', { name: 'Imagen en grande' });
  await expect(visor).toBeVisible();
  await expect(visor.getByText('2 de 3')).toBeVisible();
  await expect(visor.getByRole('img', { name: 'Animación de Ejercicio B' })).toBeVisible();
  await visor.getByRole('button', { name: 'Siguiente' }).click();
  await expect(visor.getByRole('img', { name: 'Animación de Ejercicio C' })).toBeVisible();
  await visor.getByRole('button', { name: 'Cerrar' }).click();
  await expect(visor).toBeHidden();
  expect(errores).toEqual([]);
});

test('Rutina: si pusiste tu propia imagen en la ficha, sale esa en la vista previa', async ({ page }) => {
  const errores = vigilarConsola(page);
  await entrarConContenido(page);
  await ponerImagenPropia(page, 'a');
  await page.reload();
  await page.getByRole('button', { name: 'Rutina', exact: true }).click();
  await expect(page.getByRole('heading', { level: 2 })).toContainText('Les');
  const tira = page.getByRole('region', { name: /Ejercicios de la Rutina/ });
  await expect(tira.locator('img')).toHaveCount(1);
  await tira.getByRole('button', { name: 'Ver en grande: Ejercicio A' }).click();
  const visor = page.getByRole('dialog', { name: 'Imagen en grande' });
  await expect(visor.getByRole('img', { name: 'Tu animación de Ejercicio A' })).toBeVisible();
  // Atrás cierra el visor y vuelve a Rutina
  await page.goBack();
  await expect(visor).toBeHidden();
  await expect(tira).toBeVisible();
  expect(errores).toEqual([]);
});

test('Tarjetas: la foto de la receta de arriba se abre en grande sin mover la carta', async ({ page }) => {
  const errores = vigilarConsola(page);
  await entrarConContenido(page);
  // Las recetas de prueba se siembran al abrir el Recetario; luego le pongo foto a «Tinga de pollo»
  await page.getByRole('button', { name: 'Comida', exact: true }).click();
  await page.getByRole('button', { name: 'Recetario' }).click();
  await expect(page.getByText('Tinga de pollo').first()).toBeVisible();
  await page.evaluate(() => new Promise<void>((ok, mal) => {
    const abrir = indexedDB.open('bienestar');
    abrir.onerror = () => mal(abrir.error);
    abrir.onsuccess = () => {
      const bd = abrir.result, tx = bd.transaction('recetas', 'readwrite'), st = tx.objectStore('recetas');
      const png = Uint8Array.from(atob('iVBORw0KGgoAAAANSUhEUgAAAAgAAAAICAYAAADED76LAAAAFklEQVR4nGP8z8Dwn4EIwESMolGFVFMIAIzcAhFdpQHPAAAAAElFTkSuQmCC'), (c) => c.charCodeAt(0));
      const pedir = st.get('tinga');
      pedir.onsuccess = () => st.put({ ...pedir.result, img: new Blob([png], { type: 'image/png' }) });
      tx.oncomplete = () => { bd.close(); ok(); };
      tx.onerror = () => mal(tx.error);
      tx.onabort = () => mal(tx.error);
    };
  }));
  await page.reload();
  await page.getByRole('button', { name: 'Comida', exact: true }).click();
  await page.getByRole('button', { name: 'Recetario' }).click();
  await page.getByRole('button', { name: /Elegir con tarjetas/ }).click();
  await expect(page.getByRole('heading', { name: 'Elegir con tarjetas', level: 2 })).toBeVisible();
  const boton = page.getByRole('button', { name: 'Ver la foto en grande: Tinga de pollo' });
  if (!(await boton.isVisible())) await page.getByRole('button', { name: 'No', exact: true }).click();
  await expect(boton).toBeVisible();
  await revisarPantalla(page);
  const cuenta = await page.locator('.tj-count').innerText();
  await boton.click();
  const visor = page.getByRole('dialog', { name: 'Imagen en grande' });
  await expect(visor.getByRole('img', { name: 'Foto de Tinga de pollo' })).toBeVisible();
  await page.goBack();
  await expect(visor).toBeHidden();
  // La carta sigue ahí: abrir la foto no es decidir
  await expect(page.locator('.tj-card[data-pos="0"]')).toContainText('Tinga de pollo');
  await expect(page.locator('.tj-count')).toHaveText(cuenta);
  expect(errores).toEqual([]);
});
