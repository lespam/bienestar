import { armarLista } from './compras';
import { fechaDe } from './calculos';
import { leerCompras, leerHistorial, leerPerfiles, leerPrep, leerSilenciadas, listarRecetas, menuDe } from './datos';
import { yaToca, type YaToca } from './frecuencia';
import { porDiaYUrgencia } from './preparacion';
import { fechasDeSemana } from './semana';

// Lo que Inicio muestra en «Hoy toca»: lo siguiente por preparar y lo que ya toca comprar. Máximo 3 filas en total.

export const MAX_HOY_TOCA = 3;
export interface ResumenHoyToca {
  /** Lo siguiente por preparar, si hay algo para hoy o atrasado (sin culpa: solo es lo que sigue). */
  prep: { t: string; m?: number } | null;
  /** Cuántas cosas más hay por preparar después de esa. */
  masPrep: number;
  ya: YaToca[];
}

/** Lo que ya está en la lista de esta semana: lo del menú y lo que agregaste a mano. */
async function nombresEnLista(hoy: string): Promise<string[]> {
  const dias = fechasDeSemana(0, new Date(+hoy.slice(0, 4), +hoy.slice(5, 7) - 1, +hoy.slice(8, 10)));
  const [items, recetas, perfiles, estado] = await Promise.all([menuDe(dias), listarRecetas(), leerPerfiles(), leerCompras(dias[0])]);
  return [...armarLista(items, recetas, perfiles).map((f) => f.n), ...estado.extras.map((e) => e.n)];
}

export async function resumenHoyToca(hoy = fechaDe(0)): Promise<ResumenHoyToca> {
  const [tandas, hist, silencio] = await Promise.all([leerPrep(), leerHistorial(), leerSilenciadas()]);
  const pendientes = [...tandas].filter((t) => t.fecha <= hoy).sort(porDiaYUrgencia).flatMap((t) => t.items.filter((i) => !i.ok));
  const prep = pendientes[0] ? { t: pendientes[0].t, ...(pendientes[0].m ? { m: pendientes[0].m } : {}) } : null;
  const lugar = MAX_HOY_TOCA - (prep ? 1 : 0);
  // Solo si hay algo que sugerir se revisa la lista de la semana (cuesta leer el menú y las recetas).
  let ya = yaToca(hist, hoy, [], silencio, lugar);
  if (ya.length) ya = yaToca(hist, hoy, await nombresEnLista(hoy), silencio, lugar);
  return { prep, masPrep: Math.max(0, pendientes.length - 1), ya };
}
