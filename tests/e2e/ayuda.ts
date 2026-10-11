import { expect, type Page } from '@playwright/test';
import { strToU8, zipSync } from 'fflate';
import AxeBuilder from '@axe-core/playwright';

/** Un archivo de contenido personal de prueba (el real nunca está en el repositorio). */
export function contenidoDePrueba(): Buffer {
  const partes = {
    programa: {
      alcance: 'calentamientos y semanas 1-2',
      semanas: [{ desde: 1, hasta: 2, rutinas: ['A', 'B', 'C'] }],
      rutinas: { A: { pagina: 1, grupos: [{ tipo: 'superserie', ejercicios: [{ codigo: 'A1', clave: 'a', series: 3, rango: '10-20' }, { codigo: 'A2', clave: 'b', series: 3, rango: '8-12' }] }, { tipo: 'suelto', ejercicios: [{ codigo: '', clave: 'c', series: 1, rango: '10' }] }] }, B: { pagina: 5, grupos: [{ tipo: 'suelto', ejercicios: [{ codigo: '', clave: 'c', series: 1, rango: '10' }] }] } },
      ejercicios: { a: { nombre: 'Ejercicio A', pagina: 1, registro: ['peso', 'reps'], gym: false, anim: 'a-glute-bridge' }, b: { nombre: 'Ejercicio B', pagina: 2, registro: ['peso', 'repsIzq', 'repsDer'], gym: true, anim: 'b-front-lat-pulldown' }, c: { nombre: 'Ejercicio C', pagina: 3, registro: ['seg'], gym: false, anim: 'a-front-plank' } },
      calentamientos: [{ para: ['A'], paginas: '80-81', bloques: [{ nombre: 'Bloque uno', elementos: [{ nombre: 'Elemento 1', pagina: 10 }, { nombre: 'Elemento 2', pagina: 11 }] }, { nombre: 'Bloque dos', elementos: [{ nombre: 'Elemento 3', pagina: 12 }] }] }]
    },
    recetas: { recetas: [
      { id: 'tinga', n: 'Tinga de pollo', cat: 'Comida', y: 4, t: '40 min', src: 'Reto de prueba', u1: '1 taza', k: 290, p: 28, c: 12, g: 14, ing: [[500, 'g', 'Pechuga de pollo', 'P'], [4, 'pieza', 'Jitomate', 'V'], [2, 'cda', 'Aceite', 'G']], steps: ['Cuece el pollo.', 'Licúa el jitomate.'], sw: [{ dir: 'k-', t: 'Usa 1 cda de aceite en vez de 2', d: { k: -30, g: -3.5 }, set: ['Aceite', 1] }] },
      { id: 'tacos', n: 'Tacos de champiñón', cat: 'Cena', y: 2, t: '20 min', src: '', u1: '3 tacos', k: 330, p: 12, c: 45, g: 11, ing: [[400, 'g', 'Champiñones', 'V'], [6, 'pieza', 'Tortilla de maíz', 'C']], steps: ['Saltea los champiñones.'] }
    ] },
    intercambios: {},
    marcas: {},
    fresh: {},
    letras: [{ texto: 'Letra de prueba', artista: 'Artista', mensaje: 'Para ti' }]
  };
  return Buffer.from(zipSync({ 'contenido.json': strToU8(JSON.stringify({ app: 'bienestar', tipo: 'contenido-personal', version: 1, fecha: '2026-10-11', partes })) }));
}

/** Errores de consola de la página. */
export function vigilarConsola(page: Page): string[] {
  const errores: string[] = [];
  page.on('console', (m) => { if (m.type() === 'error') errores.push(m.text()); });
  page.on('pageerror', (e) => errores.push(e.message));
  return errores;
}

/** Pasa la bienvenida sin cargar contenido. */
export async function saltarBienvenida(page: Page) {
  await page.goto('/');
  await page.getByRole('button', { name: 'Continuar' }).click();
  await page.getByRole('button', { name: 'Lo hago después' }).click();
  await expect(page.getByRole('heading', { level: 2 })).toContainText('Les');
}

/** Sin desbordes, toques de al menos 44 px, texto de al menos 12 px y sin fallas graves de accesibilidad. */
export async function revisarPantalla(page: Page) {
  const r = await page.evaluate(() => {
    const vis = (e: Element) => { const b = e.getBoundingClientRect(); return b.width > 0 && b.height > 0 && getComputedStyle(e).visibility !== 'hidden'; };
    const anchos = [document.documentElement, ...document.querySelectorAll('.screen')].filter((e) => e.scrollWidth > e.clientWidth + 1).map((e) => e.className || e.tagName);
    const chicos = [...document.querySelectorAll('button, a[href], [role="switch"], input')].filter(vis).filter((e) => {
      // Una casilla se toca por su fila completa (la etiqueta), así que se mide la etiqueta.
      const hit = e instanceof HTMLInputElement && (e.type === 'checkbox' || e.type === 'radio') ? e.closest('label') ?? e : e;
      const b = hit.getBoundingClientRect(); return b.height < 44 || b.width < 44;
    }).map((e) => (e.textContent || e.getAttribute('aria-label') || e.tagName).trim().slice(0, 30));
    const letra = [...document.querySelectorAll('body *')].filter(vis).filter((e) => [...e.childNodes].some((n) => n.nodeType === 3 && n.textContent!.trim()))
      .filter((e) => !e.closest('.sr') && parseFloat(getComputedStyle(e).fontSize) < 12).map((e) => e.textContent!.trim().slice(0, 30));
    return { anchos, chicos, letra };
  });
  expect(r.anchos, 'desborde horizontal').toEqual([]);
  expect(r.chicos, 'toques menores a 44 px').toEqual([]);
  expect(r.letra, 'texto menor a 12 px').toEqual([]);
  const axe = await new AxeBuilder({ page: page as never }).analyze();
  const graves = axe.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
  expect(graves.map((v) => v.id + ': ' + v.nodes.map((n) => n.target.join(' ')).join(', ')), 'accesibilidad').toEqual([]);
}

/** Carga el contenido de prueba desde la bienvenida y llega a Inicio. */
export async function entrarConContenido(page: Page) {
  await page.goto('/');
  await page.getByRole('button', { name: 'Continuar' }).click();
  const elegir = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: 'Elegir archivo' }).click();
  await (await elegir).setFiles({ name: 'contenido.zip', mimeType: 'application/zip', buffer: contenidoDePrueba() });
  await expect(page.getByText('Listo. Ya está en tu teléfono:')).toBeVisible();
  await page.getByRole('button', { name: 'Ir a Inicio' }).click();
  await expect(page.getByRole('heading', { name: 'Rutina A' })).toBeVisible();
}
