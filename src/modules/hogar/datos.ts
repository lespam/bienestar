import { db, type DiaHogar, type TareaHogar } from '../../core/db';
import { CATALOGO } from './catalogo';
import { MAXIMO_HOY } from './reglas';

// Todo lo que Hogar guarda pasa por aquí. Las pantallas no tocan Dexie.

const CLAVE_SEMBRADO = 'hogar.sembrado';

/** Las tareas de partida se siembran una sola vez. Si las quitas, no vuelven. */
export async function sembrar(): Promise<void> {
  if ((await db.ajustes.get(CLAVE_SEMBRADO))?.v) return;
  await db.transaction('rw', db.hogar, db.ajustes, async () => {
    if ((await db.ajustes.get(CLAVE_SEMBRADO))?.v) return;
    if ((await db.hogar.count()) === 0) await db.hogar.bulkAdd(CATALOGO.map((t) => ({ ...t })));
    await db.ajustes.put({ k: CLAVE_SEMBRADO, v: true });
  });
}
export async function listarTareas(): Promise<TareaHogar[]> {
  await sembrar();
  return db.hogar.toArray();
}
export const guardarTarea = (t: TareaHogar) => db.hogar.put(t);
export const agregarTarea = (t: Omit<TareaHogar, 'id'>) => db.hogar.add(t as TareaHogar);
export async function quitarTarea(id: number): Promise<void> {
  await db.transaction('rw', db.hogar, db.hogarDia, async () => {
    await db.hogar.delete(id);
    // Si estaba elegida o hecha hoy, también sale de ahí.
    for (const d of await db.hogarDia.toArray()) {
      const n: DiaHogar = { ...d, hoy: d.hoy.filter((x) => x !== id), hechas: d.hechas.filter((x) => x !== id), despues: d.despues.filter((x) => x !== id) };
      if (n.hoy.length !== d.hoy.length || n.hechas.length !== d.hechas.length || n.despues.length !== d.despues.length) await db.hogarDia.put(n);
    }
  });
}

export const diaVacio = (fecha: string): DiaHogar => ({ fecha, hoy: [], hechas: [], despues: [] });
export async function leerDia(fecha: string): Promise<DiaHogar> {
  return (await db.hogarDia.get(fecha)) ?? diaVacio(fecha);
}
export const guardarDia = (d: DiaHogar) => db.hogarDia.put({ ...d, hoy: d.hoy.slice(0, MAXIMO_HOY) });
/** Cuántas cosas hiciste hoy en Hogar (para Inicio). */
export async function hechasDeHoy(fecha: string): Promise<number> {
  return (await db.hogarDia.get(fecha))?.hechas.length ?? 0;
}
