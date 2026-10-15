import { test, expect } from '@playwright/test';
import { entrarConContenido, revisarPantalla, vigilarConsola } from './ayuda';

test('Rutina: semana, plan por modo, ejercicio abierto y vista previa', async ({ page }) => {
  const errores = vigilarConsola(page);
  await entrarConContenido(page);
  await page.getByRole('button', { name: 'Rutina', exact: true }).click();
  await expect(page.getByRole('heading', { level: 2 })).toContainText('Les');
  await expect(page.getByText('Esta semana')).toBeVisible();
  await expect(page.getByText('3 ejercicios · 1 superserie (p. 1)')).toBeVisible();
  await expect(page.getByText('Hoy a las 7 pm, en la sala').or(page.getByText('Hoy no tienes hora planeada'))).toBeVisible();
  // El primer ejercicio llega abierto, con su animación
  await expect(page.getByRole('img', { name: 'Animación de Ejercicio A' })).toBeVisible();
  await revisarPantalla(page);

  // Modos: la Rutina de prueba tiene un ejercicio de gym
  await page.getByRole('radio', { name: 'Solo casa' }).click();
  await expect(page.getByText('Sustituto en casa')).toBeVisible();
  await page.getByRole('radio', { name: 'Orden libro' }).click();
  await expect(page.locator('.chip', { hasText: 'Gym' })).toBeVisible();
  await page.getByRole('radio', { name: 'Casa + gym' }).click();
  await expect(page.getByText('Gym del edificio')).toBeVisible();
  await expect(page.locator('.move')).toBeVisible();
  await revisarPantalla(page);

  // Cuándo y dónde
  await page.getByRole('button', { name: 'Cambiar' }).click();
  const hoja = page.getByRole('dialog', { name: 'Cuándo y dónde' });
  await expect(hoja).toBeVisible();
  await hoja.getByLabel('Dónde').fill('en el gym');
  await revisarPantalla(page);
  await hoja.getByRole('button', { name: 'Guardar' }).click();
  await expect(hoja).toBeHidden();

  // Vista previa: la cinemática se abre al tocarla
  await page.getByRole('button', { name: /Vista previa de la sesión/ }).click();
  await expect(page.getByRole('region', { name: 'Cinemática de tu sesión' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Pausa' })).toBeVisible();
  await page.getByRole('radio', { name: 'Con series' }).click();
  await page.getByRole('button', { name: 'Bloque ›' }).click();
  await revisarPantalla(page);
  expect(errores).toEqual([]);
});

test('sesión completa: guardar series, descanso, retomar, ficha, fin, PR', async ({ page }) => {
  const errores = vigilarConsola(page);
  await entrarConContenido(page);
  await page.getByRole('button', { name: 'Empezar Rutina A' }).click();
  await expect(page.getByRole('heading', { name: 'Superserie A' })).toBeFocused();
  await expect(page.getByText('Ronda 1 de 3')).toBeVisible();
  await revisarPantalla(page);

  // A1 serie 1
  const campos = page.locator('.card.now tr.cur input');
  await campos.nth(0).fill('0');
  await campos.nth(1).fill('20');
  await page.getByRole('button', { name: 'Guardar y pasar a A2' }).click();
  await expect(page.getByText('Serie guardada')).toBeVisible();
  // A2 serie 1: sin escribir nada guarda lo mismo que la vez pasada (aquí no hay, queda vacío)
  await expect(page.locator('.card.now .code')).toHaveText('A2');
  const a2 = page.locator('.card.now tr.cur input');
  await a2.nth(0).fill('15'); await a2.nth(1).fill('10'); await a2.nth(2).fill('11');
  await page.getByRole('button', { name: 'Guardar y descansar' }).click();

  // Descanso: corre solo, avisa qué sigue y se puede cambiar el largo
  await expect(page.getByRole('heading', { name: 'Descanso' })).toBeFocused();
  await expect(page.getByText('Sigue: A1 · serie 2')).toBeVisible();
  await expect(page.getByText('descansando')).toBeVisible();
  await page.getByRole('radio', { name: '2 min' }).click();
  await page.getByRole('tab', { name: 'Frase' }).click();
  await expect(page.locator('.dis-quote')).toBeVisible();
  await revisarPantalla(page);
  await page.getByRole('button', { name: 'Terminar descanso' }).click();
  await expect(page.getByText('Ronda 2 de 3')).toBeVisible();

  // Cerrar a la mitad: la sesión sigue abierta y lo guardado ahí está
  await page.reload();
  await expect(page.getByText('Sesión abierta')).toBeVisible();
  await expect(page.getByText('Llevas 2 de 3 ejercicios. Lo que hiciste ya está guardado.')).toBeVisible();
  await revisarPantalla(page);
  await page.getByRole('button', { name: 'Seguir', exact: true }).click();
  await expect(page.getByText('Ronda 2 de 3')).toBeVisible();
  await expect(page.locator('.card').first().locator('input').nth(1)).toHaveValue('20');

  // Ficha desde la sesión, con músculos, y de regreso (el gesto atrás vuelve a la sesión)
  await page.getByRole('button', { name: 'Ver ficha' }).first().click();
  await expect(page.getByRole('heading', { name: 'Ejercicio A' })).toBeFocused();
  await page.getByRole('button', { name: 'Glúteo mayor' }).click();
  await expect(page.getByRole('region', { name: 'Glúteo mayor' })).toBeVisible();
  await revisarPantalla(page);
  await page.getByRole('button', { name: 'Editar' }).click();
  const hoja = page.getByRole('dialog', { name: 'Editar ficha' });
  await hoja.getByLabel('Tips (uno por línea)').fill('Mira al techo\nHaz una pausa arriba');
  await hoja.getByLabel('Link de tu canción').fill('music.apple.com/mi-cancion');
  await hoja.getByRole('button', { name: 'Guardar' }).click();
  await expect(page.getByText('Haz una pausa arriba')).toBeVisible();
  await expect(hoja).toBeHidden();
  await page.goBack();
  await expect(page.getByText('Ronda 2 de 3')).toBeVisible();

  // Terminar la sesión desde el botón
  await page.getByLabel('Notas de la sesión').fill('Me sentí bien');
  await page.getByRole('button', { name: 'Terminar sesión' }).click();
  await expect(page.getByRole('heading', { name: 'Rutina A guardada' })).toBeFocused();
  await expect(page.getByText('Hiciste 2 ejercicios. Cuenta como sesión.')).toBeVisible();
  await expect(page.getByText('Llevas 1 sesión desde que empezaste.')).toBeVisible();
  await page.getByRole('radio', { name: 'Mejor' }).click();
  await expect(page.getByText('Anotado. Lo verás antes de tu próxima sesión.')).toBeVisible();
  await revisarPantalla(page);

  // Registro de PR
  await page.getByRole('button', { name: 'Ver en Registro de PR' }).click();
  await expect(page.getByRole('heading', { name: 'Registro de PR' })).toBeFocused();
  await expect(page.getByText('Primera marca').first()).toBeVisible();
  await page.getByRole('button', { name: /A1 · Ejercicio A/ }).click();
  await expect(page.getByRole('cell', { name: 'Hoy' })).toBeVisible();
  await revisarPantalla(page);
  await page.getByRole('tab', { name: 'Sesiones' }).click();
  await expect(page.getByText('Terminada')).toBeVisible();
  await page.getByRole('button', { name: /Rutina A/ }).click();
  await expect(page.getByText('“Me sentí bien”')).toBeVisible();
  await revisarPantalla(page);

  // Editar una sesión terminada: no se reabre ni abre el descanso, y sigue terminada
  await page.getByRole('button', { name: 'Editar series y PR' }).click();
  await expect(page.getByText('Estás editando una sesión que ya terminó.', { exact: false })).toBeVisible();
  const rev = page.locator('.card.now tr.cur input');
  await rev.nth(0).fill('0');
  await rev.nth(1).fill('25');
  await page.getByRole('button', { name: 'Guardar y pasar a A2' }).click();
  await expect(page.getByText('Serie guardada')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Descanso' })).toHaveCount(0);
  await page.getByRole('button', { name: /Volver a Rutina/ }).click();
  await page.getByRole('tab', { name: 'Sesiones' }).click();
  await expect(page.getByText('Terminada')).toBeVisible();
  await expect(page.getByText('Abierta', { exact: true })).toHaveCount(0);
  // Borrar la sesión y Deshacer
  await page.getByRole('button', { name: /Rutina A/ }).click();
  await page.getByRole('button', { name: 'Borrar esta sesión' }).click();
  await expect(page.getByText('Todavía no hay sesiones.')).toBeVisible();
  await page.getByRole('button', { name: 'Deshacer' }).click();
  await expect(page.getByText('Terminada')).toBeVisible();

  // Inicio ya muestra la sesión de hoy guardada
  await page.getByRole('button', { name: 'Volver' }).click();
  await page.getByRole('button', { name: 'Inicio' }).click();
  await expect(page.getByRole('heading', { name: 'Rutina A guardada' })).toBeVisible();
  expect(errores).toEqual([]);
});

test('Calentar: marcar un bloque y que se quede guardado', async ({ page }) => {
  const errores = vigilarConsola(page);
  await entrarConContenido(page);
  await page.getByRole('button', { name: 'Rutina', exact: true }).click();
  await page.getByRole('button', { name: 'Calentar' }).click();
  await expect(page.getByRole('heading', { name: 'Calentamiento' })).toBeFocused();
  await expect(page.getByText('0 de 3')).toBeVisible();
  await revisarPantalla(page);
  await page.getByRole('button', { name: 'Marcar bloque completo' }).click();
  await expect(page.getByText('2 de 3')).toBeVisible();
  await page.getByRole('button', { name: 'Volver' }).click();
  await page.getByRole('button', { name: 'Calentar' }).click();
  await expect(page.getByText('2 de 3')).toBeVisible();
  expect(errores).toEqual([]);
});

test('Solo casa pide el sustituto y la sesión lo usa', async ({ page }) => {
  const errores = vigilarConsola(page);
  await entrarConContenido(page);
  await page.getByRole('button', { name: 'Rutina', exact: true }).click();
  await page.getByRole('radio', { name: 'Solo casa' }).click();
  await page.getByRole('button', { name: /Sustituto en casa/ }).click();
  await page.getByRole('button', { name: 'Elegir sustituto' }).click();
  const hoja = page.getByRole('dialog', { name: 'Sustituto en casa' });
  await hoja.getByLabel('Ejercicio').fill('Pullover con mancuerna');
  await revisarPantalla(page);
  await hoja.getByRole('button', { name: 'Guardar' }).click();
  await expect(page.getByText('Pullover con mancuerna')).toBeVisible();
  await page.getByRole('button', { name: 'Empezar Rutina A' }).first().click();
  await expect(page.getByText('Pullover con mancuerna')).toBeVisible();
  expect(errores).toEqual([]);
});

test('Elegir otra rutina, saltar un ejercicio, variación más difícil y cardio', async ({ page }) => {
  const errores = vigilarConsola(page);
  await entrarConContenido(page);
  await page.getByRole('button', { name: 'Rutina', exact: true }).click();

  // Elegir otra rutina solo cambia hoy y se puede volver a la que toca
  await page.getByRole('button', { name: 'Rutina B' }).click();
  await expect(page.getByRole('heading', { name: 'Rutina B', level: 3 })).toBeVisible();
  await revisarPantalla(page);
  await page.getByRole('button', { name: 'Rutina A, la que toca' }).click();
  await expect(page.getByRole('heading', { name: 'Rutina A', level: 3 })).toBeVisible();

  // Más difícil, en la ficha
  await page.getByRole('button', { name: 'Ver ficha' }).first().click();
  await page.getByRole('button', { name: 'Agregar variación más difícil' }).click();
  const hoja = page.getByRole('dialog', { name: 'Variación más difícil' });
  await hoja.getByLabel('Ejercicio').fill('Glute bridge con una pierna');
  await hoja.getByRole('button', { name: 'Agregar' }).click();
  await expect(page.getByText('Glute bridge con una pierna')).toBeVisible();
  await page.getByRole('button', { name: 'Volver', exact: true }).click();

  // Saltar un ejercicio de la superserie
  await page.getByRole('button', { name: 'Empezar Rutina A' }).first().click();
  await expect(page.getByRole('button', { name: 'Guardar y pasar a A2' })).toBeVisible();
  await page.getByRole('button', { name: 'Saltar este ejercicio' }).last().click();
  await expect(page.getByText('Saltado', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Guardar y descansar' })).toBeVisible();
  await revisarPantalla(page);
  await page.getByRole('button', { name: 'Incluirlo de nuevo' }).click();
  await expect(page.getByRole('button', { name: 'Guardar y pasar a A2' })).toBeVisible();
  await page.getByRole('button', { name: 'Saltar este ejercicio' }).last().click();
  await expect(page.getByText('Saltado', { exact: true })).toBeVisible();
  await page.reload();
  await page.getByRole('button', { name: 'Seguir', exact: true }).click();
  await expect(page.getByText('Saltado', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Volver a Rutina A' }).click();

  // Cardio
  await page.getByRole('button', { name: /Cardio/ }).click();
  await expect(page.getByRole('heading', { name: 'Cardio', level: 2 })).toBeVisible();
  await page.getByLabel('Minutos').fill('30');
  await revisarPantalla(page);
  await page.getByRole('button', { name: 'Guardar cardio' }).click();
  await expect(page.getByText('Caminata · 30 min')).toBeVisible();
  expect(errores).toEqual([]);
});
