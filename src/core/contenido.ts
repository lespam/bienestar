import { unzipSync, strFromU8 } from 'fflate';
import { db } from './db';

// Contenido personal: el archivo privado con el libro, el Reto 25, Fresh y tus letras (plan, punto 2a).
// No vive en el sitio público. Se carga una vez y queda en tus datos y en tus respaldos.
// Cargar uno nuevo solo cambia sus propias partes; nunca toca tus registros.

export const PARTES = ['programa', 'recetas', 'intercambios', 'marcas', 'fresh', 'letras'] as const;
export type Parte = (typeof PARTES)[number];

export interface MetaContenido { version: number; fecha: string; cargado: number }
interface Archivo { app: 'bienestar'; tipo: 'contenido-personal'; version: number; fecha: string; partes: Partial<Record<Parte, unknown>> }

export function leerContenido(bytes: Uint8Array): Archivo | null {
  try {
    const f = unzipSync(bytes)['contenido.json'];
    if (!f) return null;
    const a = JSON.parse(strFromU8(f)) as Archivo;
    if (a?.app !== 'bienestar' || a.tipo !== 'contenido-personal' || typeof a.partes !== 'object') return null;
    if (!PARTES.some((p) => p in a.partes)) return null;
    return a;
  } catch {
    return null;
  }
}

/** Qué se cargó, en palabras, para la bienvenida y Ajustes. */
export function resumen(partes: Partial<Record<Parte, unknown>>): string[] {
  const r: string[] = [];
  const prog = partes.programa as { alcance?: string } | undefined;
  if (prog) r.push('Rutina: ' + (prog.alcance ?? 'tu programa'));
  const rec = partes.recetas as { recetas?: unknown[] } | unknown[] | undefined;
  const n = Array.isArray(rec) ? rec.length : rec?.recetas?.length;
  if (n) r.push(n + ' recetas' + (partes.intercambios ? ' y la guía de intercambios' : ''));
  else if (partes.intercambios) r.push('La guía de intercambios');
  if (partes.marcas && partes.fresh) r.push('Marcas y plantilla Fresh');
  else if (partes.marcas) r.push('Marcas');
  else if (partes.fresh) r.push('Plantilla Fresh');
  if (partes.letras) r.push('Letras de tus frases');
  return r;
}

export type ResultadoCarga = { ok: true; resumen: string[] } | { ok: false };

export async function cargarContenido(bytes: Uint8Array, ahora = Date.now()): Promise<ResultadoCarga> {
  const a = leerContenido(bytes);
  if (!a) return { ok: false };
  const filas = PARTES.filter((p) => p in a.partes).map((p) => ({ parte: p, datos: a.partes[p] }));
  const meta: MetaContenido = { version: a.version, fecha: a.fecha, cargado: ahora };
  await db.transaction('rw', db.contenido, async () => {
    await db.contenido.bulkPut(filas);
    await db.contenido.put({ parte: 'meta', datos: meta });
  });
  return { ok: true, resumen: resumen(a.partes) };
}

export async function metaContenido(): Promise<MetaContenido | null> {
  return ((await db.contenido.get('meta'))?.datos as MetaContenido) ?? null;
}

export async function parte<T>(p: Parte): Promise<T | null> {
  return ((await db.contenido.get(p))?.datos as T) ?? null;
}

export async function resumenCargado(): Promise<string[]> {
  const filas = await db.contenido.toArray();
  const partes: Partial<Record<Parte, unknown>> = {};
  for (const f of filas) if (f.parte !== 'meta') partes[f.parte as Parte] = f.datos;
  return resumen(partes);
}
