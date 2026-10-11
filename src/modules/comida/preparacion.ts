import type { ItemMenu, ItemPrep, LugarMenu, Tanda } from '../../core/db';
import { fechaDe, lc } from './calculos';
import { NOMBRE_LUGAR, etiquetaFecha, nombreDia } from './semana';

// El plan de preparación sigue al menú. Lo que se puede cocinar antes va en tandas, el día anterior a esa comida
// (o hoy si ya no hay tiempo). Las tandas y sus items son tuyos: puedes mover el día, agregar y marcar.

const aFecha = (f: string) => new Date(+f.slice(0, 4), +f.slice(5, 7) - 1, +f.slice(8, 10));
export const sumarDias = (f: string, n: number) => fechaDe(n, aFecha(f));
export const HORA_INICIAL = '20:00';
export const MIN_POR_PLATO = 20;

/** Los platos del menú que se pueden preparar antes. Takeout, por decidir y colaciones no. */
export function platosDe(m: ItemMenu): string[] {
  if (m.t === 'dos') return m.n ? [m.n] : [];
  if (m.t === 'cada') return [...new Set([m.nl, m.nj].filter((x): x is string => !!x))];
  return [];
}
const articulo = (l: LugarMenu) => (l === 'd' ? 'el ' : 'la ');

let contador = 0;
export const idTanda = () => 't' + Date.now().toString(36) + (contador++).toString(36);

export const minutosPendientes = (t: Tanda) => t.items.reduce((a, it) => (it.ok ? a : a + (it.m ?? 0)), 0);
export const hechas = (t: Tanda) => t.items.filter((it) => it.ok).length;

/**
 * Deja la preparación de esos días como la pide el menú: quita lo que se había agregado para esas comidas
 * (si no está hecho) y agrega lo de las comidas nuevas en la tanda del día anterior.
 */
export function sincronizar(tandas: Tanda[], menu: ItemMenu[], fechas: string[], hoy: string, nuevoId: () => string = idTanda): Tanda[] {
  const afectadas = new Set(fechas);
  const sal: Tanda[] = tandas.map((t) => ({ ...t, items: t.items.filter((it) => !(it.fm && afectadas.has(it.fm.split(':')[0]) && !it.ok)) }));
  const vivas = sal.filter((t) => t.items.length || !t.auto);
  const orden: LugarMenu[] = ['d', 'c', 'n'];
  const lista = menu.filter((m) => afectadas.has(m.fecha) && m.fecha >= hoy).sort((a, b) => (a.fecha === b.fecha ? orden.indexOf(a.lugar) - orden.indexOf(b.lugar) : a.fecha < b.fecha ? -1 : 1));
  for (const m of lista) {
    const platos = platosDe(m);
    if (!platos.length) continue;
    const previo = sumarDias(m.fecha, -1);
    const dia = previo < hoy ? hoy : previo;
    let t = vivas.find((x) => x.fecha === dia);
    if (!t) { t = { id: nuevoId(), fecha: dia, hora: HORA_INICIAL, auto: true, items: [] }; vivas.push(t); }
    const fm = m.fecha + ':' + m.lugar;
    for (const n of platos) {
      const titulo = 'Preparar ' + lc(n);
      if (t.items.some((it) => it.fm === fm && it.t === titulo)) continue;
      t.items.push({ t: titulo, f: 'Para ' + articulo(m.lugar) + lc(NOMBRE_LUGAR[m.lugar]) + ' del ' + lc(nombreDia(m.fecha)), m: MIN_POR_PLATO, ok: false, fm });
    }
  }
  return vivas.sort((a, b) => (a.fecha < b.fecha ? -1 : a.fecha > b.fecha ? 1 : 0));
}

/** El último día en que esta tanda llega a tiempo: la víspera de la primera comida que sigue pendiente. */
export function ultimoDia(t: Tanda, hoy: string, desde = hoy): string {
  const fechas = t.items.filter((it) => !it.ok && it.fm).map((it) => sumarDias(it.fm!.split(':')[0], -1));
  const tope = sumarDias(desde, 6);
  if (!fechas.length) return tope;
  const u = fechas.sort()[0];
  return u < hoy ? hoy : u;
}

/** Las tandas que se ven en la semana del menú: desde el domingo anterior hasta el domingo. */
export const tandasDeSemana = (tandas: Tanda[], dias: string[]) => {
  const desde = sumarDias(dias[0], -1), hasta = dias[6];
  return tandas.filter((t) => t.fecha >= desde && t.fecha <= hasta).sort((a, b) => (a.fecha < b.fecha ? -1 : a.fecha > b.fecha ? 1 : 0));
};

// ---------- Textos ----------
export function horaTxt(v: string): string {
  const [h, m] = (v || HORA_INICIAL).split(':');
  const n = +h;
  return (n % 12 || 12) + (m && m !== '00' ? ':' + m : '') + (n < 12 ? ' am' : ' pm');
}
export const aLaHora = (v: string) => ((+(v || HORA_INICIAL).split(':')[0] % 12 || 12) === 1 ? 'a la ' : 'a las ') + horaTxt(v);
export const estTxt = (m: number) => (m >= 60 ? Math.floor(m / 60) + ' h' + (m % 60 ? ' ' + (m % 60) + ' min' : '') + ' aprox.' : 'unos ' + m + ' min');
export const diaTanda = (f: string, hoy: string) => (f === hoy ? 'Hoy, ' + lc(etiquetaFecha(f)) : etiquetaFecha(f));
export const cuandoTxt = (t: Tanda, hoy: string) => (t.hora ? (t.fecha === hoy ? 'Hoy ' : etiquetaFecha(t.fecha) + ' ') + aLaHora(t.hora) : 'Sin hora');
export const cosasTxt = (n: number) => 'y ' + n + (n === 1 ? ' cosa más' : ' cosas más');
export const preparoTxt = (n: number) => 'Esta semana ya preparaste ' + n + (n === 1 ? ' cosa.' : ' cosas.');

/** La fila de Comida: lo que sigue de la tanda de ese día. */
export function filaDeTanda(tandas: Tanda[], fecha: string, hoy: string): { hora: string; titulo: string; mas: string; lista: boolean } | null {
  const t = tandas.find((x) => x.fecha === fecha);
  if (!t || !t.items.length) return null;
  const pend = t.items.filter((it) => !it.ok);
  const hora = t.hora ? horaTxt(t.hora) : '';
  if (!pend.length) return { hora, titulo: 'Lista', mas: '', lista: true };
  // En días que vienen se muestra lo primero de la tanda; hoy, lo que falta
  const base: ItemPrep[] = fecha > hoy ? t.items : pend;
  return { hora, titulo: base[0].t, mas: base.length > 1 ? cosasTxt(base.length - 1) : '', lista: false };
}
