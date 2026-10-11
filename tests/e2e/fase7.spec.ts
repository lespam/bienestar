import { test, expect } from '@playwright/test';
import { entrarConContenido, revisarPantalla, vigilarConsola } from './ayuda';

const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
const hoyDia = () => (new Date().getDay() + 6) % 7; // 0 lunes … 6 domingo

test('Mente: mensaje del día, colección con filtros, agregar, editar, quitar y deshacer', async ({ page }) => {
  const errores = vigilarConsola(page);
  await entrarConContenido(page);
  await page.getByRole('button', { name: 'Ver tu colección ›' }).click();
  await expect(page.getByRole('heading', { name: 'Mente', level: 2 })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Mensaje del día' })).toBeVisible();
  await revisarPantalla(page);

  // La letra de la prueba llegó del contenido personal y es una canción
  await page.getByRole('button', { name: /^Canciones · 1$/ }).click();
  await expect(page.getByText('Letra de prueba')).toBeVisible();
  await page.getByRole('button', { name: /^Todo · /, }).click();

  // Otra frase: cambia o se queda en una frase de tu colección
  await page.getByRole('button', { name: 'Mostrar otra frase ›' }).click();
  await expect(page.getByRole('region', { name: 'Mensaje del día' }).locator('.in-quote')).toBeVisible();

  // Agregar una frase
  await page.getByRole('button', { name: '+ Agregar', exact: true }).click();
  await page.getByRole('button', { name: 'Guardar', exact: true }).click();
  await expect(page.getByText('Escribe la frase primero')).toBeVisible();
  await page.getByLabel('Frase', { exact: true }).fill('Respiro y sigo.');
  await page.getByLabel('De quién es (opcional)').fill('de mi diario');
  await revisarPantalla(page);
  await page.getByRole('button', { name: 'Guardar', exact: true }).click();
  await expect(page.getByText('“Respiro y sigo.”', { exact: true })).toBeVisible();
  await expect(page.getByText('Frase · de mi diario')).toBeVisible();

  // Agregar un video con link, y una dirección que no es web no se acepta
  await page.getByRole('button', { name: '+ Agregar', exact: true }).click();
  await page.getByRole('radio', { name: 'Video' }).click();
  await page.getByLabel('Link de YouTube').fill('javascript:alert(1)');
  await page.getByRole('button', { name: 'Guardar', exact: true }).click();
  await expect(page.getByText('Ese link no parece válido')).toBeVisible();
  await page.getByLabel('Link de YouTube').fill('youtube.com/watch?v=abc');
  await page.getByLabel('Título').fill('Video para empezar el día');
  await page.getByRole('button', { name: 'Guardar', exact: true }).click();
  const abrir = page.getByRole('link', { name: 'Abrir: Video para empezar el día' });
  await expect(abrir).toHaveAttribute('href', 'https://youtube.com/watch?v=abc');
  await expect(abrir).toHaveAttribute('target', '_blank');

  // Una imagen de tu teléfono
  await page.getByRole('button', { name: '+ Agregar', exact: true }).click();
  await page.getByRole('radio', { name: 'Imagen' }).click();
  await page.getByRole('button', { name: 'Guardar', exact: true }).click();
  await expect(page.getByText('Elige una imagen primero')).toBeVisible();
  await page.locator('#me-img').setInputFiles({ name: 'b.png', mimeType: 'image/png', buffer: PNG });
  await page.getByLabel('Título').fill('Biblioteca');
  await page.getByRole('button', { name: 'Guardar', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Editar: Biblioteca' })).toBeVisible();
  await page.getByRole('button', { name: /^Imágenes · 1$/ }).click();
  await expect(page.getByText('Imagen · también en descansos')).toBeVisible();
  await page.getByRole('button', { name: /^Todo · /, }).click();

  // Editar el video y volver
  await page.getByRole('button', { name: 'Editar: Video para empezar el día' }).click();
  await page.getByLabel('Título').fill('Charla sobre constancia');
  await page.getByRole('button', { name: 'Guardar', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Editar: Charla sobre constancia' })).toBeVisible();

  // Quitar y deshacer
  await page.getByRole('button', { name: 'Editar: Respiro y sigo.' }).click();
  await page.getByRole('button', { name: 'Quitar de mi colección' }).click();
  await expect(page.getByText('“Respiro y sigo.”', { exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Deshacer' }).click();
  await expect(page.getByText('“Respiro y sigo.”', { exact: true })).toBeVisible();

  // Lo agregado sigue ahí al reabrir
  await page.waitForTimeout(400);
  await page.reload();
  await page.getByRole('button', { name: 'Ver tu colección ›' }).click();
  await expect(page.getByRole('button', { name: 'Editar: Charla sobre constancia' })).toBeVisible();
  await revisarPantalla(page);
  expect(errores).toEqual([]);
});

test('Tablero de visión: una meta con sus cuatro pasos, se guarda sola y aparece en Inicio', async ({ page }) => {
  const errores = vigilarConsola(page);
  await entrarConContenido(page);
  await page.getByRole('button', { name: /Tablero de visión/ }).click();
  await page.getByRole('button', { name: '+ Agregar meta', exact: true }).first().click();
  await page.getByRole('button', { name: 'Guardar meta' }).click();
  await expect(page.getByText('Escribe tu deseo primero')).toBeVisible();
  await page.getByLabel('1. Deseo').fill('Fundar una beca');
  await page.getByLabel('4. Plan: si pasa eso, ¿qué haces?').fill('Si llego cansada, 15 minutos en vez de 30');
  await revisarPantalla(page);
  await page.getByRole('button', { name: 'Guardar meta' }).click();
  await expect(page.getByRole('button', { name: 'Fundar una beca' })).toBeVisible();

  // Se guarda mientras escribes
  await page.getByRole('button', { name: 'Fundar una beca' }).click();
  await page.getByLabel('3. Obstáculo: lo que más te puede frenar').fill('Las dudas');
  await page.waitForTimeout(300);
  await page.getByRole('button', { name: 'Cerrar' }).click();
  await page.reload();
  await page.getByRole('button', { name: /Tablero de visión/ }).click();
  await expect(page.getByRole('button', { name: 'Fundar una beca' })).toBeVisible();
  await page.getByRole('button', { name: 'Fundar una beca' }).click();
  await expect(page.getByLabel('3. Obstáculo: lo que más te puede frenar')).toHaveValue('Las dudas');
  await expect(page.getByLabel('4. Plan: si pasa eso, ¿qué haces?')).toHaveValue('Si llego cansada, 15 minutos en vez de 30');

  // Ver en el planeador abre Alma
  await page.getByRole('button', { name: 'Ver en tu planeador ›' }).click();
  await expect(page.getByRole('heading', { name: 'Alma', level: 2 })).toBeVisible();
  await page.getByRole('button', { name: 'Volver', exact: true }).click();

  // Quitar y deshacer
  await page.getByRole('button', { name: 'Fundar una beca' }).click();
  await page.getByRole('button', { name: 'Quitar de mi tablero' }).click();
  await expect(page.getByRole('button', { name: 'Fundar una beca' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Deshacer' }).click();
  await expect(page.getByRole('button', { name: 'Fundar una beca' })).toBeVisible();

  // Inicio muestra la meta
  await page.getByRole('button', { name: 'Volver a Inicio' }).click();
  await expect(page.getByText('1 meta')).toBeVisible();
  await expect(page.locator('.in-vt .cap', { hasText: 'Fundar una beca' })).toBeVisible();
  expect(errores).toEqual([]);
});

test('Alma: escribir de lejos o en detalle, cambiar de semana, copiar áreas, editar áreas y comparar', async ({ page }) => {
  const errores = vigilarConsola(page);
  await entrarConContenido(page);

  // Inicio: tu día en el planeador
  const hoy = hoyDia();
  if (hoy >= 5) {
    await expect(page.getByText('Tu planeador es de lunes a viernes. Hoy no hay nada que escribir.')).toBeVisible();
    await page.getByRole('button', { name: 'Planear la próxima semana' }).click();
    await expect(page.getByText('Próxima semana')).toBeVisible();
    await page.getByRole('button', { name: 'Volver', exact: true }).click();
  } else {
    await expect(page.getByText('Aún no escribes nada para hoy. Es opcional.')).toBeVisible();
    await page.getByRole('button', { name: 'Escribir mi día' }).click();
    await page.getByRole('textbox', { name: /^(Lunes|Martes|Miércoles|Jueves|Viernes) \d+/ }).fill('Vocabulario del GRE');
    await page.waitForTimeout(300);
    await page.getByRole('button', { name: 'Cerrar' }).click();
    await page.getByRole('button', { name: 'Volver', exact: true }).click();
    await expect(page.locator('.in-day')).toHaveText('Vocabulario del GRE');
  }

  await page.getByRole('button', { name: /Planeador semanal/ }).click();
  await expect(page.getByRole('heading', { name: 'Alma', level: 2 })).toBeVisible();
  await expect(page.getByText('Esta semana', { exact: true })).toBeVisible();
  await revisarPantalla(page);

  // De lejos: tocar un recuadro de área y escribir
  await page.getByRole('button', { name: 'Movimiento y salud' }).click();
  await page.getByRole('textbox', { name: 'Movimiento y salud' }).fill('Rutina A y B, y salir a caminar.');
  await expect(page.getByText('Guardado en tu teléfono.')).toBeVisible();
  await revisarPantalla(page);
  await page.getByRole('button', { name: 'Cerrar' }).click();
  await expect(page.getByRole('button', { name: 'Movimiento y salud' })).toContainText('Rutina A y B');

  // Editar semana: textos grandes, se guarda sola
  await page.getByRole('button', { name: 'Editar semana' }).click();
  await expect(page.getByRole('button', { name: 'Listo' })).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('textbox', { name: 'Reflexión y notas' }).fill('Anotar cómo me sentí.');
  await revisarPantalla(page);
  await page.getByRole('button', { name: 'Listo' }).click();
  await page.waitForTimeout(300);
  await page.reload();
  await page.getByRole('button', { name: /Planeador semanal/ }).click();
  await expect(page.getByRole('button', { name: 'Reflexión y notas' })).toContainText('Anotar cómo me sentí.');

  // La próxima semana está en blanco y ofrece copiar las áreas de esta
  await page.getByRole('button', { name: 'Semana siguiente' }).click();
  await expect(page.getByText('Próxima semana')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Semana siguiente' })).toBeDisabled();
  await expect(page.getByText('Semana en blanco.')).toBeVisible();
  await page.getByRole('button', { name: 'Copiar las áreas de la semana pasada' }).click();
  await expect(page.getByRole('button', { name: 'Movimiento y salud' })).toContainText('Rutina A y B');
  await page.getByRole('button', { name: 'Deshacer' }).click();
  await expect(page.getByRole('button', { name: 'Movimiento y salud' })).not.toContainText('Rutina A y B');
  await page.getByRole('button', { name: 'Copiar las áreas de la semana pasada' }).click();
  await expect(page.getByRole('button', { name: 'Movimiento y salud' })).toContainText('Rutina A y B');

  // Editar áreas: renombrar, agregar y quitar. Lo escrito en semanas pasadas no se borra
  await page.getByRole('button', { name: 'Editar áreas' }).click();
  await page.getByLabel('Nombre', { exact: true }).nth(2).fill('Movimiento y calma');
  await page.getByRole('button', { name: '+ Agregar área' }).click();
  await page.getByLabel('Nombre', { exact: true }).nth(4).fill('Aprender a dibujar');
  await revisarPantalla(page);
  await page.getByRole('button', { name: /Quitar.*área 4/ }).dispatchEvent('click');
  await page.getByRole('button', { name: 'Guardar', exact: true }).dispatchEvent('click');
  await expect(page.getByRole('button', { name: 'Movimiento y calma' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Aprender a dibujar' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Reflexión y notas' })).toHaveCount(0);

  // Comparar semanas
  await page.getByRole('button', { name: 'Semana anterior' }).click();
  await page.getByRole('button', { name: /Comparar semanas/ }).click();
  await expect(page.getByRole('heading', { name: 'Comparar semanas', level: 2 })).toBeVisible();
  await expect(page.getByText('Rutina A y B, y salir a caminar.').first()).toBeVisible();
  await expect(page.getByText('Sin nada escrito').first()).toBeVisible();
  await page.getByRole('tab', { name: 'Días' }).click();
  await expect(page.getByText('Lunes', { exact: true })).toBeVisible();
  await revisarPantalla(page);
  const mismas = page.getByRole('radiogroup', { name: 'Segunda semana' }).getByRole('radio').first();
  await mismas.click();
  await page.getByRole('radiogroup', { name: 'Primera semana' }).getByRole('radio').first().click();
  await expect(page.getByText('Elegiste la misma semana dos veces.')).toBeVisible();
  expect(errores).toEqual([]);
});

test('Inicio: tu día en el planeador en un día de entre semana', async ({ page }) => {
  await page.clock.setFixedTime(new Date(2026, 9, 7, 12, 0)); // miércoles
  await entrarConContenido(page);
  await expect(page.getByText('Aún no escribes nada para hoy. Es opcional.')).toBeVisible();
  await page.getByRole('button', { name: 'Escribir mi día' }).click();
  await expect(page.getByRole('dialog', { name: 'Miércoles 7 oct' })).toBeVisible();
  await page.getByRole('textbox', { name: 'Miércoles 7 oct' }).fill('Pedir consejo a una persona.');
  await page.waitForTimeout(300);
  await page.getByRole('button', { name: 'Cerrar' }).click();
  await expect(page.getByRole('button', { name: 'Miércoles 7 oct, hoy' })).toContainText('Pedir consejo');
  await page.getByRole('button', { name: 'Volver', exact: true }).click();
  await expect(page.locator('.in-day')).toHaveText('Pedir consejo a una persona.');
  await expect(page.getByRole('button', { name: 'Ver o editar' })).toBeVisible();
});
