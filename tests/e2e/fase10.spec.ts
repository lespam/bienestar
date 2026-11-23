import { test, expect, type Page } from '@playwright/test';
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

test('Receta: cambiar un ingrediente reescala todo, sin guardar, y se puede guardar como mi versión', async ({ page }) => {
  const errores = vigilarConsola(page);
  await entrarConContenido(page);
  await page.getByRole('button', { name: 'Comida', exact: true }).click();
  await page.getByRole('button', { name: 'Recetario' }).click();
  await page.getByRole('button', { name: /Tinga de pollo/ }).click();
  await page.getByRole('button', { name: /Cambiar la cantidad de pechuga de pollo/ }).click();
  await page.getByLabel(/Cantidad/).fill('250');
  await expect(page.getByText('Todo quedaría al 50 %.')).toBeVisible();
  await page.getByRole('button', { name: 'Ajustar la receta' }).click();
  await expect(page.getByText(/Cantidades al 50 %\. Equivale a 2 porciones de las 4/)).toBeVisible();
  await expect(page.getByRole('button', { name: /Cambiar la cantidad de jitomate: 2 piezas/ })).toBeVisible();
  await page.getByRole('button', { name: 'Guardar como mi versión' }).click();
  await expect(page.getByText('Rinde 2 porciones')).toBeVisible();
  await expect(page.getByText('Tu versión', { exact: true })).toBeVisible();
  expect(errores).toEqual([]);
});

test('Elegir con tarjetas: buscar recetas por nombre', async ({ page }) => {
  const errores = vigilarConsola(page);
  await entrarConContenido(page);
  await page.getByRole('button', { name: 'Comida', exact: true }).click();
  await page.getByRole('button', { name: 'Recetario' }).click();
  await page.getByRole('button', { name: /Elegir con tarjetas/ }).click();
  await page.getByRole('searchbox', { name: 'Buscar receta por nombre' }).fill('champiñón');
  await expect(page.locator('.tj-card[data-pos="0"]')).toContainText('Tacos de champiñón');
  await expect(page.locator('.tj-card', { hasText: 'Tinga de pollo' })).toHaveCount(0);
  await page.getByRole('searchbox', { name: 'Buscar receta por nombre' }).fill('zzz');
  await expect(page.getByText(/No quedan tarjetas con «zzz»/)).toBeVisible();
  expect(errores).toEqual([]);
});

test('Acomoda la semana: elegir los días donde entra lo que eliges con tarjetas (#30)', async ({ page }) => {
  const errores = vigilarConsola(page);
  await entrarConContenido(page);
  await page.getByRole('button', { name: 'Comida', exact: true }).click();
  await page.getByRole('button', { name: 'Menú', exact: true }).first().click();
  await page.getByRole('button', { name: 'Semana siguiente' }).click();
  await page.getByRole('button', { name: 'Planear', exact: true }).click();
  const dias = page.getByRole('group', { name: '¿En qué días?' }).getByRole('button');
  await expect(dias).toHaveCount(7);
  await dias.nth(2).click();
  await expect(page.getByText('1 día elegido.')).toBeVisible();
  await dias.nth(2).click();
  await expect(page.getByText(/Sin elegir días/)).toBeVisible();
  // Colaciones: su propio bloque, plegado, con AM y PM
  const col = page.getByRole('group', { name: 'Colaciones' });
  await expect(col).toBeHidden();
  await page.getByRole('button', { name: /^Colaciones/ }).click();
  await col.getByRole('button', { name: 'Colación AM' }).click();
  await expect(page.getByRole('columnheader', { name: 'Colación AM' })).toBeVisible();
  expect(errores).toEqual([]);
});

test('Acomoda la semana: zoom de mes a semana y a un día', async ({ page }) => {
  const errores = vigilarConsola(page);
  await entrarConContenido(page);
  await page.getByRole('button', { name: 'Comida', exact: true }).click();
  await page.getByRole('button', { name: 'Menú', exact: true }).first().click();
  await page.getByRole('button', { name: 'Planear', exact: true }).click();
  await page.getByRole('radio', { name: 'Mes' }).click();
  await expect(page.getByRole('grid')).toBeVisible();
  await revisarPantalla(page);
  const hoy = page.locator('.tj-mes-d.hoy');
  await expect(hoy).toHaveAttribute('aria-label', /libre/);
  await hoy.click();
  await expect(page.getByRole('radio', { name: 'Un día' })).toHaveAttribute('aria-checked', 'true');
  await page.getByRole('button', { name: 'Alejar' }).click();
  await expect(page.getByRole('radio', { name: 'Toda la semana' })).toHaveAttribute('aria-checked', 'true');
  await page.getByRole('button', { name: 'Alejar' }).click();
  await expect(page.getByRole('grid')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Alejar' })).toBeDisabled();
  expect(errores).toEqual([]);
});

test('Hoy toca: una cosa a la vez, con Hecho y Después', async ({ page }) => {
  const errores = vigilarConsola(page);
  await entrarConContenido(page);
  await page.getByRole('button', { name: 'Comida', exact: true }).click();
  await page.getByRole('button', { name: 'Recetario' }).click();
  await page.getByRole('button', { name: /Tinga de pollo/ }).click();
  await page.getByRole('button', { name: 'Agregar al menú' }).click();
  await page.getByRole('dialog', { name: 'Agregar al menú' }).getByRole('button', { name: 'Agregar', exact: true }).click();
  await expect(page.getByText(/^Agregado al menú: /)).toBeVisible();
  await page.waitForTimeout(400);
  await page.getByRole('button', { name: 'Volver' }).click();
  await page.getByRole('button', { name: 'Volver' }).click();
  await page.getByRole('button', { name: 'Menú', exact: true }).first().click();
  await page.getByRole('button', { name: 'Preparación', exact: false }).first().click();
  await page.getByRole('button', { name: 'Hoy toca' }).click();
  await expect(page.getByRole('heading', { name: 'Hoy toca', level: 2 })).toBeVisible();
  await expect(page.getByText(/Preparar tinga de pollo/)).toBeVisible();
  await revisarPantalla(page);
  // Hecho pasa a la siguiente cosa: el consejo de sacar el pollo del congelador
  await page.getByRole('button', { name: 'Hecho', exact: true }).click();
  await expect(page.getByText('Saca del congelador pechuga de pollo')).toBeVisible();
  // Después la pasa a mañana, sin marca de falla, y se puede deshacer
  await page.getByRole('button', { name: 'Después' }).click();
  await expect(page.getByText('Nada por preparar ahora')).toBeVisible();
  await page.getByRole('button', { name: 'Deshacer' }).click();
  await expect(page.getByText('Saca del congelador pechuga de pollo', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Hecho', exact: true }).click();
  await expect(page.getByText('Nada por preparar ahora')).toBeVisible();
  await expect(page.getByText(/Hoy llevas 2 cosas listas/)).toBeVisible();
  expect(errores).toEqual([]);
});

async function sembrarTabla(page: Page, tabla: string, filas: object[]) {
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
const haceDias = (n: number) => { const d = new Date(Date.now() - n * 86_400_000); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };

test('Compras: «Ya toca» por frecuencia, agregar a la lista y no me interesa', async ({ page }) => {
  const errores = vigilarConsola(page);
  await entrarConContenido(page);
  // Comida de Timi cada ~30 días, la última hace 29; leche cada 7 días, la última hace 2 (todavía no toca)
  await sembrarTabla(page, 'historial', [
    ...[89, 59, 29].map((d) => ({ art: 'comida de timi', n: 'Comida de Timi', fecha: haceDias(d) })),
    ...[16, 9, 2].map((d) => ({ art: 'leche', n: 'Leche', fecha: haceDias(d) }))
  ]);
  await page.reload();
  await page.getByRole('button', { name: 'Comida', exact: true }).click();
  await page.getByRole('button', { name: 'Menú', exact: true }).first().click();
  await page.getByRole('button', { name: 'Lista de compras' }).click();
  const toca = page.getByRole('region', { name: 'Ya toca' });
  await expect(toca.getByText(/Hace 29 días compraste comida de timi\. Lo compras cada mes\./)).toBeVisible();
  await expect(toca.getByText(/leche/i)).toHaveCount(0);
  await revisarPantalla(page);
  await toca.getByRole('button', { name: 'Agregar Comida de Timi a la lista' }).click();
  await expect(page.getByRole('region', { name: 'Ya toca' })).toHaveCount(0);
  await expect(page.locator('.cp-row', { hasText: 'Comida de Timi' })).toBeVisible();
  expect(errores).toEqual([]);
});
