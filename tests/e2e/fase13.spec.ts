import { test, expect, type Page, type Route } from '@playwright/test';
import { entrarConContenido, revisarPantalla, vigilarConsola } from './ayuda';

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
const CLAVE = 'sk-ant-api03-prueba1234';
async function prenderIA(page: Page) {
  await sembrar(page, 'ajustes', [{ k: 'ia.on', v: true }, { k: 'ia.clave', v: CLAVE }]);
  await page.reload();
}
async function simular(page: Page, texto: string, enviados: { body: string }[] = []) {
  await page.route('https://api.anthropic.com/v1/messages', async (route: Route) => {
    enviados.push({ body: route.request().postData() ?? '' });
    await route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify({ content: [{ type: 'text', text: texto }], usage: { input_tokens: 2000, output_tokens: 400 } }) });
  });
  return enviados;
}
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');

async function abrirAcomodar(page: Page) {
  await page.getByRole('button', { name: 'Comida', exact: true }).click();
  await page.getByRole('button', { name: 'Menú', exact: true }).first().click();
  await page.getByRole('button', { name: 'Planear', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Acomoda la semana', level: 2 })).toBeVisible();
}

// Versión 2, fase 6: «Sugerir menú» y «Con lo que tengo».
test('Sugerir menú: un borrador por reglas que cambias, quitas y usas con Deshacer', async ({ page }) => {
  const errores = vigilarConsola(page);
  await entrarConContenido(page);
  await abrirAcomodar(page);

  await page.getByRole('button', { name: 'Sugerir menú', exact: true }).click();
  const hoja = page.getByRole('dialog');
  await expect(hoja.getByText('Es un borrador: nada cambia en tu menú hasta que lo uses.')).toBeVisible();
  const filas = hoja.locator('.bd-it');
  await expect(filas.first()).toBeVisible();
  await expect(hoja.getByText('Tinga de pollo').first()).toBeVisible();
  await expect(hoja.getByText('Tacos de champiñón').first()).toBeVisible();
  await expect(hoja.getByText('Sugerido por IA')).toHaveCount(0);
  await revisarPantalla(page);

  // Quitar una fila, con Deshacer
  const antes = await filas.count();
  await filas.first().getByRole('button', { name: /^Quitar/ }).click();
  await expect(filas).toHaveCount(antes - 1);
  await page.getByRole('button', { name: 'Deshacer' }).click();
  await expect(filas).toHaveCount(antes);

  // «Rápido» (hasta 30 min) deja solo lo que cabe: la tinga dura 40 min
  await hoja.getByRole('button', { name: /^Rápido/ }).click();
  await expect(hoja.getByText('Tinga de pollo')).toHaveCount(0);
  await expect(hoja.getByText('Tacos de champiñón').first()).toBeVisible();
  await hoja.getByRole('button', { name: /^Rápido/ }).click();
  await expect(hoja.getByText('Tinga de pollo').first()).toBeVisible();

  // Usarlo llena la semana; Deshacer la deja libre otra vez
  await hoja.getByRole('button', { name: 'Usar este borrador' }).click();
  await expect(page.getByText(/comidas? puestas? en el menú/)).toBeVisible();
  await expect(page.locator('.tj-tabla').getByText('Tinga de pollo').first()).toBeVisible();
  await page.getByRole('button', { name: 'Deshacer' }).click();
  await expect(page.locator('.tj-tabla').getByText('Tinga de pollo')).toHaveCount(0);
  expect(errores).toEqual([]);
});

test('Con lo que tengo: texto, plan por reglas, lista de compras y lo que ya tienes', async ({ page }) => {
  const errores = vigilarConsola(page);
  await entrarConContenido(page);
  await page.getByRole('button', { name: /Con lo que tengo/ }).click();
  await expect(page.getByRole('heading', { name: 'Con lo que tengo', level: 2 })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Armar un plan con lo que tengo' })).toBeDisabled();

  await page.getByLabel('Escribe lo que hay').fill('tengo pollo, 3 jitomates, medio aguacate');
  await page.getByRole('button', { name: 'Agregar a la lista', exact: true }).click();
  await expect(page.getByRole('button', { name: /Cambiar: Pollo/ })).toBeVisible();
  await expect(page.getByRole('button', { name: /Cambiar: Jitomates · 3/ })).toBeVisible();
  await page.getByRole('button', { name: 'Usar pronto: Pollo' }).click();
  await expect(page.getByRole('button', { name: 'Usar pronto: Pollo' })).toHaveAttribute('aria-pressed', 'true');
  await revisarPantalla(page);

  // Cambiar una cantidad
  await page.getByRole('button', { name: /Cambiar: Aguacate/ }).click();
  await page.getByLabel('Cantidad (opcional)').fill('1 pieza');
  await page.getByRole('button', { name: 'Guardar', exact: true }).click();
  await expect(page.getByRole('button', { name: /Cambiar: Aguacate · 1 pieza/ })).toBeVisible();

  // El plan usa lo que hay y dice qué falta
  await page.getByRole('button', { name: 'Armar un plan con lo que tengo' }).click();
  const plan = page.getByRole('region', { name: /Tu plan de 3 días/ }).or(page.locator('section[aria-labelledby="nv-plan-t"]'));
  await expect(plan.getByText('Tinga de pollo').first()).toBeVisible();
  await expect(plan.getByText('Usa: Pechuga de pollo, Jitomate').first()).toBeVisible();
  await expect(plan.getByText('Usa lo que tienes').first()).toBeVisible();
  await revisarPantalla(page);

  // Lo que falta pasa a la lista de compras con un toque
  await plan.getByRole('button', { name: /^Agregar a la lista lo que falta \(\d+\)$/ }).click();
  await expect(page.getByText(/Agregué \d+ cosas? a tu lista de compras/)).toBeVisible();

  // Usar el plan lo deja en el menú
  await plan.getByRole('button', { name: 'Usar este plan' }).click();
  await expect(page.getByText(/Listo: puse \d+ comidas? en tu menú/)).toBeVisible();

  // La lista de compras no pide dos veces lo que ya tienes
  await page.getByRole('button', { name: 'Ver mi lista de compras' }).click();
  await expect(page.getByRole('heading', { name: 'Lista de compras', level: 2 })).toBeVisible();
  const tengo = page.getByRole('button', { name: /Ya tienes en casa \(\d+\)/ });
  await expect(tengo).toBeVisible();
  await tengo.click();
  await expect(page.locator('#cp-tengo').getByText('Pechuga de pollo')).toBeVisible();
  await page.getByRole('button', { name: 'Lo necesito: Pechuga de pollo' }).click();
  await expect(page.getByText('Pechuga de pollo').first()).toBeVisible();
  expect(errores).toEqual([]);
});

test('Con lo que tengo: las fotos se leen con IA y tú revisas la lista', async ({ page }) => {
  const errores = vigilarConsola(page);
  await entrarConContenido(page);
  await prenderIA(page);
  const enviados = await simular(page, '{"items":[{"n":"Huevos","q":"6 piezas","urgente":true},{"n":"Espinaca","q":"1 bolsa","urgente":false}]}');
  await page.getByRole('button', { name: /Con lo que tengo/ }).click();
  await page.locator('.to-pick input').nth(1).setInputFiles({ name: 'refri.png', mimeType: 'image/png', buffer: PNG });
  await expect(page.getByRole('img', { name: 'Foto 1' })).toBeVisible();
  await page.getByRole('button', { name: 'Leer las fotos con IA' }).click();
  await expect(page.getByText('la foto reducida y lo que escribiste', { exact: false }).first()).toBeVisible();
  await page.getByRole('button', { name: 'Enviar' }).click();
  await expect(page.getByText('Huevos · 6 piezas')).toBeVisible();
  await expect(page.getByText('Sugerido por IA').first()).toBeVisible();
  await revisarPantalla(page);
  await page.getByRole('button', { name: 'Agregar todo' }).click();
  await expect(page.getByRole('button', { name: /Cambiar: Huevos · 6 piezas · usar pronto/ })).toBeVisible();
  await expect(page.getByRole('button', { name: /Cambiar: Espinaca/ })).toBeVisible();
  expect(JSON.parse(enviados[0].body).messages[0].content[0].type).toBe('image');

  // Sin IA la foto no se lee, pero escribir sigue funcionando
  expect(errores).toEqual([]);
});

// Versión 2, fase 6: el cuadro único de Inicio.
const cuadro = (page: Page) => page.getByLabel('¿Qué quieres hacer?');

test('Cuadro único: entiende sin IA, siempre confirma y se puede corregir', async ({ page }) => {
  const errores = vigilarConsola(page);
  await entrarConContenido(page);
  await expect(cuadro(page)).toBeVisible();

  // La lista de compras
  await cuadro(page).fill('agrega leche y huevos a la lista');
  await page.getByRole('button', { name: 'Enviar', exact: true }).click();
  await expect(page.getByText('Agregar a tu lista de compras: Leche y Huevos.')).toBeVisible();
  await revisarPantalla(page);
  // Corregir no guarda nada y deja la frase
  await page.getByRole('button', { name: 'Corregir' }).click();
  await expect(page.getByText('Entendí:')).toHaveCount(0);
  await expect(cuadro(page)).toBeFocused();
  await expect(cuadro(page)).toHaveValue('agrega leche y huevos a la lista');
  await page.getByRole('button', { name: 'Enviar', exact: true }).click();
  await page.getByRole('button', { name: 'Confirmar' }).click();
  await expect(page.getByText('Agregué a tu lista: Leche y Huevos')).toBeVisible();
  await expect(cuadro(page)).toHaveValue('');
  await page.getByRole('button', { name: 'Deshacer' }).click();

  // Dos ideas en una frase
  await cuadro(page).fill('Hoy comí yogur y la próxima semana quiero algo diferente');
  await cuadro(page).press('Enter');
  await expect(page.getByText('Anotar en tu registro de comida (hoy, comida): Yogur. Solo el nombre, sin números.')).toBeVisible();
  await expect(page.getByText('Armar un borrador de menú para la próxima semana. Lo verás antes de guardar nada.')).toBeVisible();
  await page.getByRole('button', { name: 'Confirmar' }).click();
  await expect(page.getByRole('heading', { name: 'Acomoda la semana', level: 2 })).toBeVisible();
  await expect(page.getByRole('dialog').getByText('Es un borrador: nada cambia en tu menú hasta que lo uses.')).toBeVisible();
  await page.getByRole('dialog').getByText('Cerrar', { exact: true }).click();
  await page.getByRole('button', { name: 'Volver', exact: true }).click();

  // La rutina de hoy
  await cuadro(page).fill('hoy hago la rutina B');
  await cuadro(page).press('Enter');
  await expect(page.getByText('Hoy: Rutina B.')).toBeVisible();
  await page.getByRole('button', { name: 'Confirmar' }).click();
  await expect(page.getByText('Hoy toca la Rutina B')).toBeVisible();

  // Lo que no entiende, no lo inventa
  await page.getByRole('button', { name: 'Inicio', exact: true }).click();
  // Al llegar a una pantalla el foco va a su título; se espera a eso antes de escribir.
  await expect(page.getByRole('heading', { level: 2 })).toBeFocused();
  await cuadro(page).fill('qué lindo día');
  await cuadro(page).press('Enter');
  await expect(page.getByText('No entendí esa frase con mis reglas.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Pedir ayuda a la IA' })).toHaveCount(0);
  await revisarPantalla(page);
  expect(errores).toEqual([]);
});

test('Cuadro único: con IA y tu clave, una sola llamada con la frase y siempre se confirma', async ({ page }) => {
  const errores = vigilarConsola(page);
  await entrarConContenido(page);
  await prenderIA(page);
  const enviados = await simular(page, '{"intencion":"compras","datos":{"articulos":["pan"]}}');
  await cuadro(page).fill('creo que ya casi no queda pan en la casa');
  await cuadro(page).press('Enter');
  await page.getByRole('button', { name: 'Pedir ayuda a la IA' }).click();
  await expect(page.getByText('solo la frase que escribiste y la lista de acciones de la app')).toBeVisible();
  await page.getByRole('button', { name: 'Enviar', exact: true }).last().click();
  await expect(page.getByText('Agregar a tu lista de compras: Pan.')).toBeVisible();
  await expect(page.getByText('Sugerido por IA').first()).toBeVisible();
  expect(enviados).toHaveLength(1);
  const cuerpo = JSON.parse(enviados[0].body);
  expect(cuerpo.messages[0].content[0].text).toContain('Frase: «creo que ya casi no queda pan en la casa»');
  await page.getByRole('button', { name: 'Confirmar' }).last().click();
  await expect(page.getByText('Agregué a tu lista: Pan')).toBeVisible();
  expect(errores).toEqual([]);
});

test('Cuadro único: con voz, lo dicho entra al cuadro y se confirma', async ({ page }) => {
  await page.addInitScript(() => {
    class Falso {
      lang = ''; interimResults = false; maxAlternatives = 1; continuous = false;
      onresult: ((e: unknown) => void) | null = null; onerror: ((e: unknown) => void) | null = null; onend: (() => void) | null = null;
      start() { setTimeout(() => { const r = [{ 0: { transcript: 'agrega pan a la lista' }, isFinal: true, length: 1 }]; this.onresult?.({ results: r }); this.onend?.(); }, 30); }
      stop() { this.onend?.(); }
    }
    const w = window as unknown as { SpeechRecognition: unknown; webkitSpeechRecognition: unknown };
    w.SpeechRecognition = Falso;
    w.webkitSpeechRecognition = Falso;
  });
  await entrarConContenido(page);
  await expect(page.getByRole('button', { name: 'Hablar', exact: true })).toHaveAccessibleDescription(/El navegador procesa el audio \(en Chrome de Android, Google\)/);
  await page.getByRole('button', { name: 'Hablar', exact: true }).click();
  await expect(page.getByText('Agregar a tu lista de compras: Pan.')).toBeVisible();
  await expect(cuadro(page)).toHaveValue('agrega pan a la lista');
});
