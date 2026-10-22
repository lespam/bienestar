import { test, expect, type Page } from '@playwright/test';
import { entrarConContenido, revisarPantalla, vigilarConsola } from './ayuda';

// Pendientes del backlog (2026-10-15).

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
const receta = (id: string, n: string, cat = 'Comida', ing: unknown[] = []) => ({ id, n, cat, y: 2, t: '', src: '', u1: '', k: 300, p: 20, c: 30, g: 10, ing, steps: [] });

test('Recetario: saltar a una letra sin scroll eterno', async ({ page }) => {
  const errores = vigilarConsola(page);
  await entrarConContenido(page);
  const nombres = ['Arroz', 'Atole', 'Avena', 'Bowl', 'Burrito', 'Caldo', 'Ceviche', 'Chilaquiles', 'Crepas', 'Ensalada', 'Enchiladas', 'Fajitas', 'Flautas', 'Gorditas', 'Huevos', 'Jugo', 'Lentejas', 'Machaca', 'Molletes', 'Nopales', 'Omelette', 'Pozole', 'Quesadillas', 'Sopes', 'Tamales', 'Wrap', 'Yogur', 'Zanahorias'];
  await sembrar(page, 'recetas', nombres.map((n, i) => receta('t' + i, n)));
  await page.reload();
  await page.getByRole('button', { name: 'Comida', exact: true }).click();
  await page.getByRole('button', { name: 'Recetario' }).click();
  const abc = page.getByRole('navigation', { name: 'Ir a la letra' });
  await expect(abc.getByRole('button', { name: 'Recetas con Z' })).toBeVisible();
  await expect(abc.getByRole('button', { name: 'Recetas con X' })).toHaveCount(0);
  await revisarPantalla(page);
  await abc.getByRole('button', { name: 'Recetas con Y' }).click();
  await expect(page.getByRole('button', { name: /^Yogur/ })).toBeInViewport();
  await expect(page.getByRole('button', { name: /^Yogur/ })).toBeFocused();
  expect(errores).toEqual([]);
});

test('Menú: tarjetas también para la próxima semana, sin «Editar día por día»', async ({ page }) => {
  const errores = vigilarConsola(page);
  await entrarConContenido(page);
  await page.getByRole('button', { name: 'Comida', exact: true }).click();
  await page.getByRole('button', { name: 'Menú', exact: true }).first().click();
  await expect(page.getByRole('button', { name: /Editar día por día/ })).toHaveCount(0);
  await page.getByRole('button', { name: 'Empezar a planear' }).click();
  await page.getByRole('radio', { name: 'Próxima semana' }).click();
  await revisarPantalla(page);
  await page.getByRole('button', { name: 'Elegir con tarjetas' }).click();
  await expect(page.getByRole('heading', { name: 'Elegir con tarjetas', level: 2 })).toBeVisible();
  await page.getByRole('button', { name: 'Sí', exact: true }).click();
  await page.getByRole('button', { name: 'Acomodar mis elegidas (1)' }).click();
  await expect(page.getByRole('radio', { name: 'Próxima semana' })).toHaveAttribute('aria-checked', 'true');
  expect(errores).toEqual([]);
});

test('Compras y preparación: solo lo de hoy y mañana, para cargar lo mínimo', async ({ page }) => {
  const errores = vigilarConsola(page);
  await entrarConContenido(page);
  const f = (d: number) => { const x = new Date(); x.setDate(x.getDate() + d); return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`; };
  await sembrar(page, 'recetas', [receta('hoy1', 'Sopa de hoy', 'Comida', [[2, 'pieza', 'Calabacita']]), receta('lejos', 'Guiso lejano', 'Comida', [[1, 'pieza', 'Berenjena']])]);
  await sembrar(page, 'menu', [{ fecha: f(0), lugar: 'n', t: 'dos', n: 'Sopa de hoy', r: 'hoy1' }, { fecha: f(5), lugar: 'n', t: 'dos', n: 'Guiso lejano', r: 'lejos' }]);
  await page.reload();
  await page.getByRole('button', { name: 'Comida', exact: true }).click();
  await page.getByRole('button', { name: 'Menú', exact: true }).first().click();
  await page.getByRole('button', { name: 'Lista de compras' }).click();
  await page.getByRole('radio', { name: /^Todo/ }).click();
  const semanaTiene = await page.locator('.cp-row', { hasText: 'Berenjena' }).count();
  await page.getByRole('radio', { name: 'Hoy y mañana' }).click();
  await expect(page.locator('.cp-row', { hasText: 'Calabacita' })).toBeVisible();
  await expect(page.locator('.cp-row', { hasText: 'Berenjena' })).toHaveCount(0);
  await revisarPantalla(page);
  await page.getByRole('radio', { name: 'Toda la semana' }).click();
  await expect(page.locator('.cp-row', { hasText: 'Berenjena' })).toHaveCount(semanaTiene);
  expect(errores).toEqual([]);
});

test('Recetas: filtrar por fuente y quitar lo que no le gusta a Jeff, en el Recetario y en las tarjetas', async ({ page }) => {
  const errores = vigilarConsola(page);
  await entrarConContenido(page);
  await sembrar(page, 'recetas', [
    { ...receta('f1', 'Tacos de huevo', 'Desayuno', [[2, 'pieza', 'Huevo']]), origen: 'Familia' },
    { ...receta('f2', 'Crepas de avena', 'Desayuno', [[1, 'pieza', 'Huevo']]), origen: 'Familia' },
    { ...receta('f3', 'Sopa de lentejas'), origen: 'Tastemade' }
  ]);
  await sembrar(page, 'perfiles', [{ quien: 'jeff', no: ['Huevo'] }]);
  await page.reload();
  await page.getByRole('button', { name: 'Comida', exact: true }).click();
  await page.getByRole('button', { name: 'Recetario' }).click();
  await page.getByLabel('Fuente').selectOption('Familia');
  await expect(page.getByRole('button', { name: /^Tacos de huevo/ })).toBeVisible();
  await expect(page.getByRole('button', { name: /^Sopa de lentejas/ })).toHaveCount(0);
  await page.getByRole('button', { name: 'Sin lo que no le gusta a Jeff' }).click();
  await expect(page.getByRole('button', { name: /^Tacos de huevo/ })).toHaveCount(0);
  await expect(page.getByRole('button', { name: /^Crepas de avena/ })).toBeVisible();
  await revisarPantalla(page);
  await page.getByRole('button', { name: /Elegir con tarjetas/ }).click();
  await expect(page.getByLabel('Fuente')).toHaveValue('Familia');
  await expect(page.locator('.tj-card', { hasText: 'Crepas de avena' })).toHaveCount(1);
  await expect(page.locator('.tj-card', { hasText: 'Tacos de huevo' })).toHaveCount(0);
  await revisarPantalla(page);
  expect(errores).toEqual([]);
});

test('Rutina: marcar un día de cardio y que la rutina pase al siguiente día', async ({ page }) => {
  const errores = vigilarConsola(page);
  await entrarConContenido(page);
  await page.getByRole('button', { name: 'Rutina', exact: true }).click();
  const dia = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'][new Date().getDay()];
  await page.getByRole('button', { name: 'Cambiar' }).click();
  const hoja = page.getByRole('dialog', { name: 'Cuándo y dónde' });
  await hoja.getByRole('button', { name: 'Cardio el ' + dia }).click();
  await expect(hoja.getByRole('button', { name: 'Rutina el ' + dia })).toHaveAttribute('aria-pressed', 'false');
  await revisarPantalla(page);
  await hoja.getByRole('button', { name: 'Guardar' }).click();
  await expect(page.getByText('Hoy toca cardio')).toBeVisible();
  await expect(page.locator('.day.today .sr')).toHaveText('hoy, cardio');
  await expect(page.getByRole('heading', { name: 'Cardio', level: 3 })).toBeVisible();
  await page.getByRole('button', { name: 'Registrar cardio' }).click();
  await expect(page.getByRole('button', { name: 'Guardar cardio' })).toBeVisible();
  expect(errores).toEqual([]);
});

test('Recetario: cuántas veces usaste cada receta y filtro de nunca usadas', async ({ page }) => {
  const errores = vigilarConsola(page);
  await entrarConContenido(page);
  await sembrar(page, 'recetas', [receta('u1', 'Pollo usado'), receta('u2', 'Pozole nuevo')]);
  await sembrar(page, 'menu', [{ fecha: '2026-01-05', lugar: 'c', t: 'dos', n: 'Pollo usado', r: 'u1' }, { fecha: '2026-01-06', lugar: 'c', t: 'dos', n: 'Pollo usado', r: 'u1' }]);
  await sembrar(page, 'registro', [{ fecha: '2026-01-05', comida: 1, n: 'Pollo usado', por: '1', k: 300, p: 1, c: 1, g: 1, receta: 'u1' }]);
  await page.reload();
  await page.getByRole('button', { name: 'Comida', exact: true }).click();
  await page.getByRole('button', { name: 'Recetario' }).click();
  await expect(page.getByRole('button', { name: /^Pollo usado.*En el menú 2 veces · Registrada 1 vez/ })).toBeVisible();
  await expect(page.getByRole('button', { name: /^Pozole nuevo.*Aún no la usas/ })).toBeVisible();
  await page.getByLabel('Uso').selectOption('nunca');
  await expect(page.getByRole('button', { name: /^Pollo usado/ })).toHaveCount(0);
  await expect(page.getByRole('button', { name: /^Pozole nuevo/ })).toBeVisible();
  await revisarPantalla(page);
  expect(errores).toEqual([]);
});

test('Rutina: Cardio en "Hacer hoy" y registrar el cardio de ayer', async ({ page }) => {
  const errores = vigilarConsola(page);
  await entrarConContenido(page);
  await page.getByRole('button', { name: 'Rutina', exact: true }).click();
  await page.locator('.mini').getByRole('button', { name: 'Cardio' }).click();
  // Queda planeado como una rutina: se ve en la semana y en «Hoy»
  await expect(page.getByRole('heading', { name: 'Cardio', level: 3 })).toBeVisible();
  await expect(page.locator('.day.today .sr')).toHaveText('hoy, cardio');
  await expect(page.locator('.mini').getByRole('button', { name: 'Cardio' })).toHaveAttribute('aria-pressed', 'true');
  await revisarPantalla(page);
  await page.getByRole('button', { name: 'Rutina A, la que toca' }).click();
  await expect(page.getByRole('heading', { name: 'Rutina A', level: 3 })).toBeVisible();
  await page.locator('.mini').getByRole('button', { name: 'Cardio' }).click();
  await page.getByRole('button', { name: 'Registrar cardio' }).click();
  await page.getByRole('radio', { name: 'Ayer' }).click();
  await page.getByLabel('Minutos').fill('30');
  await revisarPantalla(page);
  await page.getByRole('button', { name: 'Guardar cardio' }).click();
  const ayer = new Date(); ayer.setDate(ayer.getDate() - 1);
  const dia = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'][ayer.getDay()];
  await expect(page.locator('.cardio-lista')).toContainText(dia + ' ' + ayer.getDate());
  expect(errores).toEqual([]);
});

test('Tarjetas: un solo filtro de uso, sin foto, con Bases y para la próxima semana', async ({ page }) => {
  const errores = vigilarConsola(page);
  await entrarConContenido(page);
  await sembrar(page, 'recetas', [receta('b1', 'Salsa base', 'Base')]);
  await sembrar(page, 'perfiles', [{ quien: 'les', no: ['Cilantro'] }, { quien: 'jeff', no: ['Huevo'] }]);
  await page.reload();
  await page.getByRole('button', { name: 'Comida', exact: true }).click();
  await page.getByRole('button', { name: 'Recetario' }).click();
  await expect(page.locator('.rc-fuente > span').getByText('Uso', { exact: true })).toHaveCount(1);
  await expect(page.locator('.rc-fuente > span').getByText('Foto', { exact: true })).toHaveCount(1);
  await page.getByRole('button', { name: /Elegir con tarjetas/ }).click();
  await expect(page.locator('.rc-fuente > span').getByText('Uso', { exact: true })).toHaveCount(1);
  await expect(page.locator('.rc-fuente > span').getByText('Foto', { exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Bases', exact: true }).click();
  await expect(page.locator('.tj-card[data-pos="0"]')).toContainText('Salsa base');
  await page.getByRole('button', { name: 'Sí', exact: true }).click();
  await page.getByRole('button', { name: 'Acomodar mis elegidas (1)' }).click();
  await page.getByRole('radio', { name: 'Próxima semana' }).click();
  const lunes = new Date(); lunes.setDate(lunes.getDate() - ((lunes.getDay() + 6) % 7) + 7);
  await expect(page.locator('.tj-dia').first()).toContainText(String(lunes.getDate()));
  await expect(page.locator('.tj-cell').first()).toBeEnabled();
  await revisarPantalla(page);
  expect(errores).toEqual([]);
});

test('Acomoda la semana: por tiempos de comida, Agregar con tarjetas, mover y volver a planear un día', async ({ page }) => {
  const errores = vigilarConsola(page);
  await entrarConContenido(page);
  await sembrar(page, 'recetas', [receta('c1', 'Caldo uno', 'Comida'), receta('c2', 'Caldo dos', 'Comida')]);
  await page.reload();
  await page.getByRole('button', { name: 'Comida', exact: true }).click();
  await page.getByRole('button', { name: 'Recetario' }).click();
  await page.getByRole('button', { name: /Elegir con tarjetas/ }).click();
  await page.getByRole('button', { name: 'Acomodar mis elegidas', exact: true }).click();
  // La próxima semana: todos los días se pueden planear
  await page.getByRole('radio', { name: 'Próxima semana' }).click();
  const lunes = page.locator('.tj-dia').first();
  await lunes.click();
  await expect(page.locator('.tj-slot .tj-lug')).toHaveText(['Desayuno', 'Comida', 'Cena']);
  await revisarPantalla(page);
  await page.getByRole('button', { name: 'Agregar a comida con tarjetas' }).click();
  await expect(page.getByText(/Comida · desde el lunes/)).toBeVisible();
  await page.getByRole('button', { name: 'Sí', exact: true }).click();
  await expect(page.getByText(/ · Sí 1$/)).toBeVisible();
  await page.getByRole('button', { name: 'Sí', exact: true }).click();
  await expect(page.getByText(/ · Sí 2$/)).toBeVisible();
  await page.getByRole('button', { name: 'Poner en comida (2)' }).click();
  await expect(page.getByRole('heading', { name: 'Acomoda la semana', level: 2 })).toBeVisible();
  const comidaLunes = page.locator('.tj-cell[data-l="c"]');
  await expect(comidaLunes).toHaveAttribute('aria-label', /^Lunes \d+, comida: .+/);
  // El martes también quedó con comida
  await page.locator('.tj-dia').nth(1).click();
  await expect(page.locator('.tj-cell[data-l="c"]')).not.toHaveAttribute('aria-label', /libre$/);
  // Mover la comida del martes a la cena del martes, con toques
  await page.locator('.tj-cell[data-l="c"]').click();
  await page.locator('.tj-cell[data-l="n"]').click();
  await expect(page.locator('.tj-cell[data-l="c"]')).toHaveAttribute('aria-label', /comida: libre$/);
  await expect(page.locator('.tj-cell[data-l="n"]')).not.toHaveAttribute('aria-label', /libre$/);
  // Arrastrar la cena del martes al miércoles (por la asa, sobre el día)
  await page.locator('.tj-dias').evaluate((e) => e.scrollIntoView({ block: 'start' }));
  const asa = page.locator('.tj-asa[data-ml="n"]');
  const miercoles = page.locator('.tj-dia').nth(2);
  const a1 = (await asa.boundingBox())!, a2 = (await miercoles.boundingBox())!;
  await page.mouse.move(a1.x + a1.width / 2, a1.y + a1.height / 2);
  await page.mouse.down();
  await page.mouse.move(a2.x + a2.width / 2, a2.y + a2.height / 2, { steps: 10 });
  await page.mouse.up();
  await expect(page.locator('.tj-cell[data-l="n"]')).toHaveAttribute('aria-label', /cena: libre$/);
  await miercoles.click();
  await expect(page.locator('.tj-cell[data-l="n"]')).not.toHaveAttribute('aria-label', /libre$/);
  // Volver a planear el miércoles
  await page.getByRole('button', { name: 'Volver a planear el miércoles' }).click();
  await expect(page.locator('.tj-cell[data-l="n"]')).toHaveAttribute('aria-label', /cena: libre$/);
  await revisarPantalla(page);
  expect(errores).toEqual([]);
});

for (const [id, nombre] of [['bosque', 'Bosque'], ['oceano', 'Océano'], ['atardecer', 'Atardecer']]) {
  test(`Ajustes: paleta ${nombre} con buen contraste y que se queda al volver a abrir`, async ({ page }) => {
    const errores = vigilarConsola(page);
    await entrarConContenido(page);
    await page.getByRole('button', { name: 'Ajustes' }).click();
    await page.getByRole('radio', { name: nombre }).click();
    await expect(page.locator('html')).toHaveAttribute('data-paleta', id);
    await revisarPantalla(page);
    await page.reload();
    await expect(page.locator('html')).toHaveAttribute('data-paleta', id);
    for (const tab of ['Inicio', 'Rutina', 'Comida', 'Cuerpo']) {
      await page.getByRole('button', { name: tab, exact: true }).click();
      await revisarPantalla(page);
    }
    await page.getByRole('button', { name: 'Inicio', exact: true }).click();
    await page.getByRole('button', { name: 'Ajustes' }).click();
    await page.getByRole('radio', { name: 'Calma' }).click();
    await expect(page.locator('html')).not.toHaveAttribute('data-paleta', /./);
    expect(errores).toEqual([]);
  });
}

test('IA apagada: no se ven botones «con IA» en Rutina, Ficha, Comida ni Menú', async ({ page }) => {
  const errores = vigilarConsola(page);
  await entrarConContenido(page);
  const sinIA = async () => expect(page.getByRole('button', { name: /con IA/ })).toHaveCount(0);
  await page.getByRole('button', { name: 'Rutina', exact: true }).click();
  await sinIA();
  await page.getByRole('button', { name: 'Ver ficha' }).first().click();
  await sinIA();
  await page.getByRole('button', { name: 'Volver', exact: true }).click();
  await page.getByRole('button', { name: 'Comida', exact: true }).click();
  await page.locator('.meal', { hasText: 'Cena' }).getByRole('button', { name: '+ Agregar' }).click();
  await expect(page.getByRole('tab', { name: 'Describir' })).toHaveCount(0);
  await expect(page.getByRole('tab', { name: 'Escanear' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Cerrar', exact: true }).first().click();
  await page.getByRole('button', { name: 'Menú', exact: true }).first().click();
  await sinIA();
  expect(errores).toEqual([]);
});

test('Rutina: «Empezar Rutina» queda arriba, antes del video', async ({ page }) => {
  await entrarConContenido(page);
  await page.getByRole('button', { name: 'Rutina', exact: true }).click();
  const empezar = page.locator('.r-acts .start');
  await expect(empezar).toHaveText(/^Empezar Rutina /);
  await expect(empezar).toBeInViewport();
  const yBoton = (await empezar.boundingBox())!.y;
  const yVideo = (await page.getByRole('button', { name: /Vista previa de la sesión/ }).boundingBox())!.y;
  expect(yBoton).toBeLessThan(yVideo);
});

test('Fin: una sesión sin series pregunta si la hiciste sin anotar o se descarta', async ({ page }) => {
  const errores = vigilarConsola(page);
  await entrarConContenido(page);
  await page.getByRole('button', { name: 'Rutina', exact: true }).click();
  await page.getByRole('button', { name: 'Empezar Rutina A' }).first().click();
  await page.getByRole('button', { name: 'Terminar sesión' }).click();
  await expect(page.getByRole('heading', { name: 'Rutina A terminada' })).toBeVisible();
  await expect(page.getByText(/Hiciste 0/)).toHaveCount(0);
  await revisarPantalla(page);
  // Descartar: vuelve a Rutina y se puede deshacer
  await page.getByRole('button', { name: 'Descartar' }).click();
  await expect(page.getByText('Sesión descartada')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Empezar Rutina A' }).first()).toBeVisible();
  await page.getByRole('button', { name: 'Deshacer' }).click();
  // Otra vez, ahora «La hice sin anotar»
  await page.getByRole('button', { name: 'Inicio', exact: true }).click();
  await page.getByRole('button', { name: 'Rutina', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Ver resumen de hoy' }).first()).toBeVisible();
  await page.getByRole('button', { name: 'Ver resumen de hoy' }).first().click();
  await page.getByRole('button', { name: 'La hice sin anotar' }).click();
  await expect(page.getByRole('heading', { name: 'Rutina A guardada' })).toBeVisible();
  await expect(page.getByText('La hiciste sin anotar series. Cuenta como sesión.')).toBeVisible();
  expect(errores).toEqual([]);
});

test('Tarjetas: rondas cortas de 10 con «Otra ronda»', async ({ page }) => {
  const errores = vigilarConsola(page);
  await entrarConContenido(page);
  await sembrar(page, 'recetas', Array.from({ length: 14 }, (_, i) => receta('r' + i, 'Platillo ' + i)));
  await page.reload();
  await page.getByRole('button', { name: 'Comida', exact: true }).click();
  await page.getByRole('button', { name: 'Recetario' }).click();
  await page.getByRole('button', { name: /Elegir con tarjetas/ }).click();
  await expect(page.getByText('0 de 10 · Sí 0')).toBeVisible();
  for (let i = 0; i < 10; i++) {
    await page.getByRole('button', { name: i % 2 ? 'No' : 'Sí', exact: true }).click();
    await expect(page.getByText((i + 1) + ' de 10 · Sí ' + Math.ceil((i + 1) / 2))).toBeVisible();
  }
  await expect(page.getByText('Ronda lista. Elegiste 5.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Sí', exact: true })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Acomodar mis elegidas (5)' })).toBeVisible();
  await revisarPantalla(page);
  await page.getByRole('button', { name: 'Otra ronda' }).click();
  await expect(page.getByText(/^0 de \d+ · Sí 0$/)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Sí', exact: true })).toBeEnabled();
  expect(errores).toEqual([]);
});

test('Menú: lo libre es una línea «Agregar»; después de elegir vuelve al mismo día con «¿Comen lo mismo?»', async ({ page }) => {
  const errores = vigilarConsola(page);
  await entrarConContenido(page);
  await page.getByRole('button', { name: 'Comida', exact: true }).click();
  await page.getByRole('button', { name: 'Menú', exact: true }).first().click();
  const dias = page.locator('.wk-day');
  const otro = (await dias.count()) - 1;
  const hoyEs = await dias.nth(otro).getAttribute('aria-pressed');
  const destino = hoyEs === 'true' ? dias.nth(0) : dias.nth(otro);
  const etiqueta = (await destino.getAttribute('aria-label'))!;
  await destino.click();
  const cena = page.locator('section.ml', { hasText: 'Cena' });
  const agregar = cena.getByRole('button', { name: 'Agregar a cena' });
  if (!(await agregar.count())) return; // ese día ya pasó
  await expect(page.getByText('¿Comen lo mismo?')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Dejar por decidir' })).toHaveCount(0);
  await revisarPantalla(page);
  await agregar.click();
  await page.getByRole('button', { name: /Tacos de champiñón/ }).click();
  await page.getByRole('button', { name: 'Elegir para los dos' }).click();
  await expect(page.getByRole('button', { name: etiqueta })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('section.ml', { hasText: 'Cena' }).getByText('¿Comen lo mismo?')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Sí, lo mismo' })).toHaveAttribute('aria-pressed', 'true');
  expect(errores).toEqual([]);
});
