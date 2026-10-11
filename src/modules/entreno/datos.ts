import { db, type FichaPropia, type Serie, type Sesion, type Sustituto } from '../../core/db';
import { iso } from '../../core/fechas';
import { prefs, registroNuevo } from '../ajustes';
import type { Modo, SesionConSeries } from './calculos';
import { DIAS_INICIALES } from './semana';
import type { Letra } from './programa';

// Entreno es el único que escribe sesiones, series, descansos, sustitutos, fichas y Calentar.
// Las series se guardan en cuanto las marcas; la sesión sigue abierta hasta que la termines.

export interface Cuando { dias: boolean[]; hora: string; lugar: string }
export interface AjustesEntreno { modo: Modo; primero: 'gym' | 'casa'; cuando: Cuando }
const INICIALES: AjustesEntreno = { modo: 'mixto', primero: 'gym', cuando: { dias: DIAS_INICIALES, hora: '19:00', lugar: 'en la sala' } };

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
