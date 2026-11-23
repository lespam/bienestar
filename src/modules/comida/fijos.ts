import type { Alimento, ItemMenu, LugarMenu, Receta } from '../../core/db';
import { diaSemana, semanasAtras } from './patrones';
import { lugarDeReceta } from './tarjetas';

// Qué se planeó y qué se comió: cuántas semanas aparece cada receta, y «Mis fijos».
// Todo por reglas, sin IA. Las sugerencias son curiosas, nunca un reproche.

/** Una comida que se repite. `huecos` son los días (0 lunes … 6 domingo) y tiempos donde suele ir. */
export interface Fijo { r: string; huecos: { dia: number; l: LugarMenu }[] }
export const VENTANA = 4;
export { semanasAtras };
/** Cuántos días se calla una sugerencia después de «No por ahora». */
export const SILENCIO_DIAS = 28;
const COMIDAS: LugarMenu[] = ['d', 'c', 'n'];

const aMs = (f: string) => Date.UTC(+f.slice(0, 4), +f.slice(5, 7) - 1, +f.slice(8, 10));
const idsDe = (m: ItemMenu) => [...new Set([m.r, m.rl, m.rj])].filter((x): x is string => !!x);

export interface SemanasDe { plan: number; comido: number }
/** En cuántas de las últimas `n` semanas (con la actual) aparece cada receta en el menú y en lo que registraste. */
export function semanasPorReceta(menu: ItemMenu[], registro: Pick<Alimento, 'fecha' | 'receta'>[], hoy: string, n = VENTANA): Record<string, SemanasDe> {
  const plan: Record<string, Set<number>> = {}, comido: Record<string, Set<number>> = {};
  for (const m of menu) {
    if (!COMIDAS.includes(m.lugar) || m.t === 'decidir' || m.t === 'takeout') continue;
    const k = semanasAtras(m.fecha, hoy);
    if (k < 0 || k >= n) continue;
    for (const id of idsDe(m)) (plan[id] ??= new Set()).add(k);
  }
  for (const a of registro) {
    if (!a.receta) continue;
    const k = semanasAtras(a.fecha, hoy);
    if (k < 0 || k >= n) continue;
    (comido[a.receta] ??= new Set()).add(k);
  }
  const out: Record<string, SemanasDe> = {};
  for (const id of new Set([...Object.keys(plan), ...Object.keys(comido)])) out[id] = { plan: plan[id]?.size ?? 0, comido: comido[id]?.size ?? 0 };
  return out;
}

export interface Sugerencia { tipo: 'fijo' | 'poco'; r: string; plan: number; comido: number }
/**
 * «Molletes ha estado en tu menú 3 de 4 semanas»: una sugerencia a la vez.
 * `poco` solo sale si sí registras lo que comes (al menos 2 de las 4 semanas), para no suponer.
 */
export function sugerir(menu: ItemMenu[], registro: Pick<Alimento, 'fecha' | 'receta'>[], fijos: string[], silenciadas: Record<string, string>, hoy: string): Sugerencia[] {
  const sem = semanasPorReceta(menu, registro, hoy);
  const registraSeguido = new Set(registro.map((a) => semanasAtras(a.fecha, hoy)).filter((k) => k >= 0 && k < VENTANA)).size >= 2;
  const fuera = (id: string) => { const s = silenciadas[id]; return !!s && (aMs(hoy) - aMs(s)) / 864e5 < SILENCIO_DIAS; };
  const out: Sugerencia[] = [];
  for (const [r, s] of Object.entries(sem)) {
    if (s.plan < 3 || fuera(r)) continue;
    if (!fijos.includes(r)) out.push({ tipo: 'fijo', r, ...s });
    else if (registraSeguido && s.comido <= 1) out.push({ tipo: 'poco', r, ...s });
  }
  // Primero lo que más se repite
  return out.sort((a, b) => b.plan - a.plan || a.r.localeCompare(b.r));
}
export function sugerenciaTxt(s: Sugerencia, nombre: string): string {
  return s.tipo === 'fijo'
    ? nombre + ' ha estado en tu menú ' + s.plan + ' de ' + VENTANA + ' semanas. ¿Quieres dejarlo como fijo de la semana?'
    : 'Planeas «' + nombre + '» seguido (' + s.plan + ' de ' + VENTANA + ' semanas) y lo registras poco. ¿Lo cambiamos por algo parecido?';
}

/** Dónde suele ir una receta: lo que hizo en la semana más reciente (hasta la de hoy) donde apareció. */
export function huecosDe(menu: ItemMenu[], id: string, hoy: string): Fijo['huecos'] {
  const de = menu.filter((m) => COMIDAS.includes(m.lugar) && m.t !== 'decidir' && m.t !== 'takeout' && idsDe(m).includes(id) && semanasAtras(m.fecha, hoy) >= 0);
  if (!de.length) return [];
  const k = Math.min(...de.map((m) => semanasAtras(m.fecha, hoy)));
  const llaves = new Set<string>();
  const huecos: Fijo['huecos'] = [];
  for (const m of de.filter((x) => semanasAtras(x.fecha, hoy) === k)) {
    const ll = diaSemana(m.fecha) + m.lugar;
    if (!llaves.has(ll)) { llaves.add(ll); huecos.push({ dia: diaSemana(m.fecha), l: m.lugar }); }
  }
  return huecos.sort((a, b) => a.dia - b.dia || COMIDAS.indexOf(a.l) - COMIDAS.indexOf(b.l));
}
export const fijoNuevo = (menu: ItemMenu[], id: string, hoy: string): Fijo => ({ r: id, huecos: huecosDe(menu, id, hoy) });

/**
 * Lo que pondría «Repetir mis fijos» en una semana: cada fijo en sus huecos de siempre, solo en lugares libres y de hoy en adelante.
 * Un fijo sin huecos va al primer lugar libre de su tiempo.
 */
export function cambiosFijos(fijos: Fijo[], recetas: Record<string, Receta>, dias: string[], ocupado: (f: string, l: LugarMenu) => boolean, hoy: string): { r: Receta; f: string; l: LugarMenu }[] {
  const tomado = new Set<string>();
  const out: { r: Receta; f: string; l: LugarMenu }[] = [];
  const poner = (r: Receta, f: string, l: LugarMenu) => {
    if (f < hoy || ocupado(f, l) || tomado.has(f + l)) return false;
    tomado.add(f + l); out.push({ r, f, l });
    return true;
  };
  for (const fj of fijos) {
    const r = recetas[fj.r];
    if (!r) continue;
    if (fj.huecos.length) { for (const h of fj.huecos) if (dias[h.dia]) poner(r, dias[h.dia], h.l); continue; }
    const l = lugarDeReceta(r);
    if (!l || !COMIDAS.includes(l)) continue;
    for (const f of dias) if (poner(r, f, l)) break;
  }
  return out;
}
