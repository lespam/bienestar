import { db, type Descanso, type FichaPropia, type Serie, type Sesion, type Sustituto } from '../../core/db';
import { iso } from '../../core/fechas';
import { prefs, registroNuevo } from '../ajustes';
import type { Modo, SesionConSeries } from './calculos';
import { DIAS_INICIALES } from './semana';
import type { Letra } from './programa';

// Entreno es el único que escribe sesiones, series, descansos, sustitutos, fichas y Calentar.
// Las series se guardan en cuanto las marcas; la sesión sigue abierta hasta que la termines.

/** `cardio`: días de cardio en vez de rutina (lunes primero). */
export interface Cuando { dias: boolean[]; cardio?: boolean[]; hora: string; lugar: string }
/** La rutina que elegiste para un día, distinta a la que toca por el ciclo. Solo vale ese día. */
export interface RutinaElegida { letra: Letra; fecha: string }
export interface AjustesEntreno { modo: Modo; primero: 'gym' | 'casa'; cuando: Cuando; elegida: RutinaElegida | null }
const INICIALES: AjustesEntreno = { modo: 'mixto', primero: 'gym', elegida: null, cuando: { dias: DIAS_INICIALES, hora: '19:00', lugar: 'en la sala' } };

export async function leerAjustes(): Promise<AjustesEntreno> {
  const filas = await db.entreno.toArray();
  const a = structuredClone(INICIALES) as unknown as Record<string, unknown>;
  for (const f of filas) if (f.k in a) a[f.k] = f.v;
  return a as unknown as AjustesEntreno;
}
export async function guardarAjuste<K extends keyof AjustesEntreno>(k: K, v: AjustesEntreno[K]) {
  await db.entreno.put({ k, v: structuredClone(v) });
}

// ---------- Sesiones ----------
export async function sesionesConSeries(): Promise<SesionConSeries[]> {
  const sesiones = await db.sesiones.toArray();
  const series = await db.series.toArray();
  const por = new Map<number, Serie[]>();
  for (const s of series) { const l = por.get(s.sesion); if (l) l.push(s); else por.set(s.sesion, [s]); }
  return sesiones.map((sesion) => ({ sesion, series: por.get(sesion.id!) ?? [] })).sort((a, b) => a.sesion.inicio - b.sesion.inicio);
}

export async function sesionAbierta(): Promise<Sesion | undefined> {
  return (await db.sesiones.where('abierta').equals(1).toArray()).sort((a, b) => b.inicio - a.inicio)[0];
}

/** Empieza la sesión; si ya hay una abierta, sigue con esa. */
export async function iniciarSesion(letra: Letra, modo: Modo, primero: 'gym' | 'casa', ahora = new Date()): Promise<Sesion> {
  const abierta = await sesionAbierta();
  if (abierta) return abierta;
  const s: Sesion = { fecha: iso(ahora), tipo: 'rutina', rutina: letra, modo, primero, abierta: 1, inicio: ahora.getTime(), nota: '' };
  s.id = await db.sesiones.add(s);
  await registroNuevo();
  return s;
}

export async function cambiarModoSesion(id: number, modo: Modo, primero: 'gym' | 'casa') {
  await db.sesiones.update(id, { modo, primero });
}

export async function terminarSesion(id: number, ahora = Date.now()) {
  await db.sesiones.update(id, { abierta: 0, fin: ahora });
}
export async function reabrirSesion(id: number) {
  await db.sesiones.where('abierta').equals(1).modify({ abierta: 0, fin: Date.now() });
  await db.sesiones.update(id, { abierta: 1, fin: undefined });
}
export async function ponerNota(id: number, nota: string) { await db.sesiones.update(id, { nota }); }
export async function sentirse(id: number, sintio: Sesion['sintio']) { await db.sesiones.update(id, { sintio }); }

// ---------- Series ----------
export async function guardarSerie(sesion: number, clave: string, n: number, v: Serie['v'], sust?: string): Promise<number> {
  const previa = await db.series.where('[sesion+clave+n]').equals([sesion, clave, n]).first();
  const fila: Serie = { id: previa?.id, sesion, clave, n, v, sust, unidad: prefs.unidad, hora: Date.now() };
  if (previa?.id == null) delete fila.id;
  return db.series.put(fila);
}
export async function borrarSerie(sesion: number, clave: string, n: number) {
  await db.series.where('[sesion+clave+n]').equals([sesion, clave, n]).delete();
}

// ---------- Descansos ----------
export async function registrarDescanso(sesion: number | undefined, despues: string | undefined, seg: number) {
  if (seg < 1) return;
  await db.descansos.add({ sesion, despues, seg: Math.round(seg), hora: Date.now() });
}
export async function segundosDeDescanso(sesion: number): Promise<number> {
  return (await db.descansos.where('sesion').equals(sesion).toArray()).reduce((a, d) => a + d.seg, 0);
}

// ---------- Sustitutos y fichas ----------
export const todosLosSustitutos = () => db.sustitutos.toArray();
export async function guardarSustituto(s: Sustituto) { await db.sustitutos.put(s); }
export async function quitarSustituto(clave: string) { await db.sustitutos.delete(clave); }

export async function leerFicha(clave: string): Promise<FichaPropia> { return (await db.fichas.get(clave)) ?? { clave }; }
export async function guardarFicha(f: FichaPropia) { await db.fichas.put(f); }

// ---------- Calentar ----------
export async function calentadosDe(fecha: string): Promise<Set<string>> {
  return new Set((await db.calentados.where('fecha').equals(fecha).toArray()).map((c) => c.item));
}
export async function marcarCalentado(fecha: string, item: string, puesto: boolean) {
  if (puesto) await db.calentados.put({ fecha, item });
  else await db.calentados.delete([fecha, item]);
}
export async function marcarVarios(fecha: string, items: string[], puesto: boolean) {
  if (puesto) await db.calentados.bulkPut(items.map((item) => ({ fecha, item })));
  else await db.calentados.bulkDelete(items.map((item) => [fecha, item] as [string, string]));
}

// ---------- Ejercicios saltados ----------
// Se guardan junto a los ajustes de Entreno, uno por sesión. Las series que sí hiciste no se tocan.
const claveSaltados = (sesion: number) => 'saltados:' + sesion;
export async function saltadosDe(sesion: number): Promise<string[]> {
  const f = await db.entreno.get(claveSaltados(sesion));
  return Array.isArray(f?.v) ? (f!.v as string[]) : [];
}
export async function ponerSaltado(sesion: number, clave: string, saltado: boolean) {
  const ahora = new Set(await saltadosDe(sesion));
  if (saltado) ahora.add(clave); else ahora.delete(clave);
  if (ahora.size) await db.entreno.put({ k: claveSaltados(sesion), v: [...ahora] });
  else await db.entreno.delete(claveSaltados(sesion));
}

// ---------- Borrar una sesión ----------
export interface SesionBorrada { sesion: Sesion; series: Serie[]; descansos: Descanso[]; saltados: string[] }
/** Quita la sesión con sus series, descansos y ejercicios saltados. Devuelve lo que quitó, para Deshacer. */
export async function borrarSesion(id: number): Promise<SesionBorrada | null> {
  return db.transaction('rw', [db.sesiones, db.series, db.descansos, db.entreno], async () => {
    const sesion = await db.sesiones.get(id);
    if (!sesion) return null;
    const series = await db.series.where('sesion').equals(id).toArray();
    const descansos = await db.descansos.where('sesion').equals(id).toArray();
    const saltados = await saltadosDe(id);
    await db.series.where('sesion').equals(id).delete();
    await db.descansos.where('sesion').equals(id).delete();
    await db.entreno.delete(claveSaltados(id));
    await db.sesiones.delete(id);
    return { sesion, series, descansos, saltados };
  });
}
export async function reponerSesion(b: SesionBorrada) {
  await db.transaction('rw', [db.sesiones, db.series, db.descansos, db.entreno], async () => {
    await db.sesiones.put(b.sesion);
    await db.series.bulkPut(b.series);
    await db.descansos.bulkPut(b.descansos);
    if (b.saltados.length) await db.entreno.put({ k: claveSaltados(b.sesion.id!), v: b.saltados });
  });
}

// ---------- Cardio ----------
export interface Cardio { sesion: number; fecha: string; nombre: string; min: number; nota: string }
/** Cardio terminado: una sesión de tipo cardio con una sola serie (los minutos). No usa el reloj de Rutina. */
export async function guardarCardio(nombre: string, min: number, nota: string, ahora = new Date()): Promise<number> {
  const fin = ahora.getTime();
  const id = await db.sesiones.add({ fecha: iso(ahora), tipo: 'cardio', modo: 'libro', primero: 'casa', abierta: 0, inicio: fin - min * 60000, fin, nota });
  await db.series.add({ sesion: id, clave: 'cardio', sust: nombre, n: 0, v: { min }, unidad: prefs.unidad, hora: fin });
  await registroNuevo();
  return id;
}
export async function borrarCardio(sesion: number) {
  await db.transaction('rw', [db.sesiones, db.series], async () => {
    await db.series.where('sesion').equals(sesion).delete();
    await db.sesiones.delete(sesion);
  });
}
export async function cardiosRecientes(n = 10): Promise<Cardio[]> {
  const ss = (await db.sesiones.toArray()).filter((s) => s.tipo === 'cardio').sort((a, b) => b.inicio - a.inicio).slice(0, n);
  const out: Cardio[] = [];
  for (const s of ss) {
    const serie = await db.series.where('sesion').equals(s.id!).first();
    out.push({ sesion: s.id!, fecha: s.fecha, nombre: serie?.sust ?? 'Cardio', min: Number(serie?.v.min ?? 0), nota: s.nota });
  }
  return out;
}
