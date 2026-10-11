import { expect, type Page } from '@playwright/test';
import { strToU8, zipSync } from 'fflate';
import AxeBuilder from '@axe-core/playwright';

/** Un archivo de contenido personal de prueba (el real nunca está en el repositorio). */
export function contenidoDePrueba(): Buffer {
  const partes = {
    programa: {
      alcance: 'calentamientos y semanas 1-2',
      semanas: [{ desde: 1, hasta: 2, rutinas: ['A', 'B', 'C'] }],
      rutinas: { A: { pagina: 1, grupos: [{ tipo: 'superserie', ejercicios: [{ codigo: 'A1', clave: 'a', series: 3, rango: '10-20' }, { codigo: 'A2', clave: 'b', series: 3, rango: '8-12' }] }, { tipo: 'suelto', ejercicios: [{ codigo: '', clave: 'c', series: 1, rango: '10' }] }] } },
      ejercicios: { a: { nombre: 'Ejercicio A', pagina: 1, registro: ['reps'], gym: false }, b: { nombre: 'Ejercicio B', pagina: 2, registro: ['reps'], gym: true }, c: { nombre: 'Ejercicio C', pagina: 3, registro: ['seg'], gym: false } }
    },
    recetas: { recetas: [{ id: 'r1' }, { id: 'r2' }] },
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
      const b = e.getBoundingClientRect(); return b.height < 44 || b.width < 44;
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
