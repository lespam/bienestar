import { db, type AreaAlma, type ItemColeccion, type Meta, type SemanaAlma } from '../../core/db';
import { iso } from '../../core/fechas';
import { AREAS_INICIALES, normalizar, semanaVacia } from './semanas';
import { sembrar } from './mensaje';

// Todo lo que Mente y Alma guardan pasa por aquí. Las pantallas no tocan Dexie.

// ---------- Colección ----------
export type TipoColeccion = 'frase' | 'imagen' | 'video' | 'cancion';
export const TIPOS: [TipoColeccion | 'todo', string][] = [['todo', 'Todo'], ['frase', 'Frases'], ['imagen', 'Imágenes'], ['video', 'Videos'], ['cancion', 'Canciones']];

export async function listarColeccion(): Promise<ItemColeccion[]> {
  await sembrar();
  // Lo más nuevo primero: lo que agregas aparece arriba.
  return (await db.coleccion.toArray()).sort((a, b) => (b.id ?? 0) - (a.id ?? 0));
}
/** Solo se abren links web. Algo como «javascript:...» nunca se guarda. */
export function urlSegura(v: string): string | null {
  const t = v.trim();
  if (!t) return '';
  try {
    const u = new URL(/^[a-z][a-z0-9+.-]*:/i.test(t) ? t : 'https://' + t);
    return u.protocol === 'https:' || u.protocol === 'http:' ? u.href : null;
  } catch { return null; }
}
export const agregarItem = (it: Omit<ItemColeccion, 'id'>) => db.coleccion.add(it as ItemColeccion);
export const guardarItem = (it: ItemColeccion) => db.coleccion.put(it);
/** Quita un item. Si venía de fábrica o del contenido, se anota para que no vuelva a aparecer. */
export async function quitarItem(it: ItemColeccion) {
  if (it.id == null) return;
  await db.transaction('rw', db.coleccion, db.mente, async () => {
    await db.coleccion.delete(it.id!);
    if (it.semilla) await db.mente.put({ k: 'quitadas', v: [...new Set([...(await quitadas()), it.semilla])] });
  });
}
/** Lo contrario de quitar: lo deja como estaba, con el mismo número. */
export async function devolverItem(it: ItemColeccion) {
  await db.transaction('rw', db.coleccion, db.mente, async () => {
    await db.coleccion.put(it);
    if (it.semilla) await db.mente.put({ k: 'quitadas', v: (await quitadas()).filter((s) => s !== it.semilla) });
  });
}
export async function quitadas(): Promise<string[]> {
  return ((await db.mente.get('quitadas'))?.v as string[] | undefined) ?? [];
}

// ---------- Mensaje del día ----------
/** Cambia el mensaje de hoy por otra frase tuya distinta de la que se ve. */
export async function otraFrase(actual: number | undefined, hoy = new Date()): Promise<ItemColeccion | null> {
  const frases = (await db.coleccion.toArray()).filter((x) => x.tipo === 'frase' && x.texto);
  if (!frases.length) return null;
  const otras = frases.length > 1 ? frases.filter((x) => x.id !== actual) : frases;
  const it = otras[Math.floor(Math.random() * otras.length)];
  await db.mensajes.put({ fecha: iso(hoy), item: it.id! });
  return it;
}

// ---------- Tablero de visión ----------
export const ICONOS_META = ['vision', 'chart', 'rutina', 'libro', 'monte'];
export const listarMetas = () => db.metas.toArray();
export const agregarMeta = (m: Omit<Meta, 'id'>) => db.metas.add(m as Meta);
export const guardarMeta = (m: Meta) => db.metas.put(m);
export const quitarMeta = (id: number) => db.metas.delete(id);
export const devolverMeta = (m: Meta) => db.metas.put(m);

// ---------- Alma ----------
/** Las áreas de tu planeador. La primera vez se crean las cuatro de tu papel. */
export async function leerAreas(): Promise<AreaAlma[]> {
  if (!(await db.areas.count())) await db.areas.bulkAdd(AREAS_INICIALES.map((a) => ({ ...a })));
  return (await db.areas.toArray()).sort((a, b) => a.id! - b.id!);
}
/** Deja las áreas como las editaste. Lo escrito en semanas pasadas no se borra aunque quites un área. */
export async function guardarAreas(areas: AreaAlma[]) {
  await db.transaction('rw', db.areas, async () => {
    const ids = new Set(areas.filter((a) => a.id != null).map((a) => a.id!));
    for (const a of await db.areas.toArray()) if (!ids.has(a.id!)) await db.areas.delete(a.id!);
    for (const a of areas) await db.areas.put(a);
  });
}
export async function leerSemana(lunes: string): Promise<SemanaAlma> {
  return normalizar(await db.semanas.get(lunes), lunes);
}
export async function leerSemanas(lunes: string[]): Promise<SemanaAlma[]> {
  const filas = await db.semanas.bulkGet(lunes);
  return lunes.map((l, i) => normalizar(filas[i], l));
}
export const guardarSemana = (s: SemanaAlma) => db.semanas.put({ lunes: s.lunes, dias: [...s.dias], areas: { ...s.areas } });
export const semanaEnBlanco = semanaVacia;

/** Lo que escribiste para hoy en el planeador, para Inicio. */
export async function planDeHoy(lunes: string, dia: number): Promise<string> {
  if (dia < 0 || dia > 4) return '';
  return ((await db.semanas.get(lunes))?.dias?.[dia] ?? '').trim();
}
