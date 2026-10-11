import type { ItemMenu, LugarMenu, Receta } from '../../core/db';
import { fechaDe } from './calculos';

// Calendario de la semana (de lunes a domingo) y cómo se ve cada lugar del menú. Todo se calcula: no se guarda nada.

export const COMIDAS_MENU: { l: LugarMenu; n: string }[] = [{ l: 'd', n: 'Desayuno' }, { l: 'c', n: 'Comida' }, { l: 'n', n: 'Cena' }];
export const NOMBRE_LUGAR: Record<LugarMenu, string> = { d: 'Desayuno', c: 'Comida', n: 'Cena', a: 'Colación AM', p: 'Colación PM' };
export const LETRA_DIA = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];
const DIAS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
export const SEMANAS_ATRAS = 8;

const aFecha = (f: string) => new Date(+f.slice(0, 4), +f.slice(5, 7) - 1, +f.slice(8, 10));

/** Los 7 días (AAAA-MM-DD) de la semana `k` semanas atrás (0 = esta, -1 = la próxima). La semana empieza el lunes. */
export function fechasDeSemana(k: number, hoy = new Date()): string[] {
  const desdeLunes = (hoy.getDay() + 6) % 7;
  return Array.from({ length: 7 }, (_, i) => fechaDe(-desdeLunes - 7 * k + i, hoy));
}
/** "Jueves 1 oct". */
export function etiquetaFecha(f: string): string {
  const d = aFecha(f);
  return DIAS[d.getDay()] + ' ' + d.getDate() + ' ' + MESES[d.getMonth()];
}
export const nombreDia = (f: string) => DIAS[aFecha(f).getDay()];
export const numeroDia = (f: string) => +f.slice(8, 10);
/** "28 sep – 4 oct" (si es el mismo mes: "5 – 11 oct"). */
export function rangoSemana(dias: string[]): string {
  const a = aFecha(dias[0]), b = aFecha(dias[6]);
  return a.getDate() + (a.getMonth() !== b.getMonth() ? ' ' + MESES[a.getMonth()] : '') + ' – ' + b.getDate() + ' ' + MESES[b.getMonth()];
}
export const tituloSemana = (k: number) => (k === -1 ? 'Próxima semana' : k === 0 ? 'Esta semana' : k === 1 ? 'Semana pasada' : 'Hace ' + k + ' semanas');
export const dinero = (n: number) => '$' + Math.round(n).toLocaleString('es-MX');

export type Punto = 'f' | 's' | 't' | 'p' | '';
/** Cómo se pinta un lugar en la semana de un vistazo. */
export const puntoDe = (m?: ItemMenu): Punto => (!m ? '' : m.t === 'takeout' ? 't' : m.t === 'cada' ? 's' : m.t === 'decidir' ? 'p' : 'f');
export const tipoTxt = (m?: ItemMenu) => (!m ? 'Libre' : m.t === 'takeout' ? 'Takeout' : m.t === 'cada' ? 'Cada quien' : m.t === 'decidir' ? 'Por decidir' : m.t === 'col' ? 'Colación' : 'Los dos');
export const llave = (f: string, l: LugarMenu) => f + ':' + l;
export function indexar(items: ItemMenu[]): Map<string, ItemMenu> {
  return new Map(items.map((m) => [llave(m.fecha, m.lugar), m]));
}
/** Lo que se dice de un lugar en una línea: «Yogur con fruta / Huevos con frijoles». */
export function platoTxt(m: ItemMenu): string {
  if (m.t === 'cada') return (m.nl ?? '') + ' / ' + (m.nj ?? '');
  if (m.t === 'decidir') return 'Por decidir' + (m.nota ? ' · ' + m.nota : '');
  return m.n;
}
/** Cuántos takeouts hubo y cuánto costaron. */
export function takeouts(items: ItemMenu[]) {
  const t = items.filter((m) => m.t === 'takeout');
  return { n: t.length, total: t.reduce((a, m) => a + (m.costo ?? 0), 0) };
}
export const takeoutTxt = (t: { n: number; total: number }) => (t.n ? (t.n === 1 ? '1 vez' : t.n + ' veces') + ' · ' + dinero(t.total) : 'Ninguno');

// ---------- Armar lugares del menú ----------
export const itemDos = (fecha: string, lugar: LugarMenu, r: Pick<Receta, 'id' | 'n'>, nota?: string): ItemMenu => ({ fecha, lugar, t: 'dos', n: r.n, r: r.id, ...(nota ? { nota } : {}) });
export const itemCada = (fecha: string, lugar: LugarMenu, rl: Pick<Receta, 'id' | 'n'>, rj: Pick<Receta, 'id' | 'n'>): ItemMenu => ({ fecha, lugar, t: 'cada', n: rl.n + ' / ' + rj.n, rl: rl.id, rj: rj.id, nl: rl.n, nj: rj.n });
export const itemDecidir = (fecha: string, lugar: LugarMenu, nota = ''): ItemMenu => ({ fecha, lugar, t: 'decidir', n: 'Por decidir', ...(nota ? { nota } : {}) });
export const itemTakeout = (fecha: string, lugar: LugarMenu, n: string, extra: Partial<ItemMenu> = {}): ItemMenu => ({ fecha, lugar, t: 'takeout', n, ...extra });

/** Qué lugar del menú le toca a cada tipo de receta. */
export const lugarDe = (cat: string): LugarMenu => (cat === 'Desayuno' ? 'd' : cat === 'Cena' ? 'n' : 'c');

/** Lo que cambiaría «Repetir semana pasada»: la misma comida del mismo día de la semana pasada, de hoy en adelante. */
export function cambiosRepetir(pasada: ItemMenu[], actual: ItemMenu[], hoyIso: string, modo: 'libres' | 'todo'): ItemMenu[] {
  const ahora = indexar(actual);
  const out: ItemMenu[] = [];
  for (const m of pasada) {
    if (m.t !== 'dos' && m.t !== 'cada') continue;
    const d = aFecha(m.fecha);
    d.setDate(d.getDate() + 7);
    const fecha = fechaDe(0, d);
    if (fecha < hoyIso) continue;
    const cur = ahora.get(llave(fecha, m.lugar));
    if (cur && (modo === 'libres' || cur.t === 'takeout' || (cur.n === m.n && cur.t === m.t))) continue;
    out.push({ ...m, fecha });
  }
  return out;
}
