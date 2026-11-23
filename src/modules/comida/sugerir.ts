import type { LugarMenu, PerfilComida, Receta } from '../../core/db';
import { minutosDe, norm, ocultaPorNivel, prefiereEvitar, vecesUsada, type UsoReceta } from './calculos';
import { cambiosFijos, type Fijo } from './fijos';
import { menciona } from './seguro';
import { lugarDeReceta } from './tarjetas';

// «Sugerir menú» y «Con lo que tengo»: todo por reglas. La IA solo entra para huecos, y lo que propone pasa por seguro.ts.

/** Lo que hay en casa (de la foto o escrito). */
export interface Hay { n: string; q?: string; urgente?: boolean }
const BASICOS = ['sal', 'pimienta', 'agua', 'aceite', 'azucar', 'hielo'];
const raiz = (t: string) => norm(t).replace(/s$/, '');

export interface Cobertura { usa: string[]; falta: string[]; cobertura: number; urgentes: number }
/** Cuántos ingredientes de la receta ya hay. Lo básico (sal, agua, aceite) no cuenta ni como tener ni como faltar. */
export function cobertura(r: Pick<Receta, 'ing'>, hay: Hay[]): Cobertura {
  const usa: string[] = [], falta: string[] = [];
  let urgentes = 0;
  for (const it of r.ing) {
    const nombre = it[2];
    if (BASICOS.includes(raiz(nombre).split(/[^a-z]+/)[0] ?? '')) continue;
    const h = hay.find((x) => menciona(nombre, x.n) || menciona(x.n, nombre) || norm(nombre).split(/[^a-z0-9]+/).some((p) => p.length >= 4 && menciona(x.n, p)));
    if (h) { usa.push(nombre); if (h.urgente) urgentes++; } else falta.push(nombre);
  }
  const n = usa.length + falta.length;
  return { usa, falta, cobertura: n ? usa.length / n : 0, urgentes };
}

export type Motivo = 'fijo' | 'gusto' | 'nevera' | 'tiempo' | 'variar';
export const MOTIVO_TXT: Record<Motivo, string> = { fijo: 'Es de tus fijos', gusto: 'La usas poco y te gusta', nevera: 'Usa lo que tienes', tiempo: 'Cabe en tu tiempo', variar: 'Para variar' };
export interface Propuesta { f: string; l: LugarMenu; r: Receta; motivo: Motivo; usa: string[]; falta: string[]; otras: string[] }

export interface EntradaSugerir {
  recetas: Receta[];
  perfiles: Record<'les' | 'jeff', PerfilComida>;
  uso: Record<string, UsoReceta>;
  fijos: Fijo[];
  dias: string[];
  tiempos: LugarMenu[];
  ocupado: (f: string, l: LugarMenu) => boolean;
  hoy: string;
  /** Lo que ya está en el menú de esta semana (para no repetir). */
  yaEnMenu?: string[];
  maxMin?: number;
  hay?: Hay[];
  /** Con «Con lo que tengo» lo que hay en casa pesa más que todo lo demás. */
  nevera?: boolean;
  /** Recetas que no se deben proponer (por ejemplo las que acabas de cambiar). */
  evitar?: string[];
}

/** Una receta que puede ir al menú de los dos: no la oculta ninguno de sus filtros y está a la vista. */
export const sirveParaLosDos = (r: Receta, perfiles: Record<'les' | 'jeff', PerfilComida>) =>
  r.cat !== 'Base' && r.vis !== 'guardada' && !ocultaPorNivel(r, perfiles.les, 'les') && !ocultaPorNivel(r, perfiles.jeff, 'jeff');
const gustaA = (r: Receta, perfiles: Record<'les' | 'jeff', PerfilComida>) => [...perfiles.les.gustos, ...perfiles.jeff.gustos].some((g) => r.ing.some((i) => menciona(i[2], g)));

interface Ranqueada { r: Receta; rep: number; evita: boolean; gusto: boolean; nevera: number; poco: boolean; tiempo: boolean }
/** Las recetas que sirven para un tiempo de comida, de la que más conviene a la que menos. */
function ranquear(e: EntradaSugerir, l: LugarMenu, usadas: Record<string, number>): Ranqueada[] {
  const hay = e.hay ?? [];
  const rapida = (r: Receta) => { const m = minutosDe(r.t); return e.maxMin == null || m == null || m <= e.maxMin; };
  const todas = e.recetas.filter((r) => lugarDeReceta(r) === l && sirveParaLosDos(r, e.perfiles) && rapida(r));
  // «Algo diferente» evita lo que ya está en el borrador; si no queda nada distinto, vuelve a lo que había.
  const evitar = new Set(e.evitar ?? []);
  const sinEvitar = todas.filter((r) => !evitar.has(r.id));
  return (sinEvitar.length ? sinEvitar : todas)
    .map((r) => {
      const c = cobertura(r, hay);
      const poco = vecesUsada(e.uso[r.id]) <= 1;
      return { r, rep: usadas[r.id] ?? 0, evita: prefiereEvitar(r, e.perfiles.les) || prefiereEvitar(r, e.perfiles.jeff), gusto: poco && gustaA(r, e.perfiles), nevera: hay.length ? c.cobertura + c.urgentes * 0.25 : 0, poco, tiempo: e.maxMin != null && minutosDe(r.t) != null };
    })
    .sort((a, b) =>
      a.rep - b.rep || Number(a.evita) - Number(b.evita) ||
      (e.nevera ? b.nevera - a.nevera || Number(b.gusto) - Number(a.gusto) : Number(b.gusto) - Number(a.gusto) || b.nevera - a.nevera) ||
      Number(b.tiempo) - Number(a.tiempo) || Number(b.poco) - Number(a.poco) || a.r.id.localeCompare(b.r.id));
}
/** Hasta `max` recetas para pedirle ideas a la IA: las mejores de cada tiempo, sin las que ya están en el borrador. */
export function candidatas(e: EntradaSugerir, max = 15): Receta[] {
  const lugares = e.tiempos.filter((l) => ['d', 'c', 'n'].includes(l));
  const listas = lugares.map((l) => ranquear({ ...e, evitar: [...(e.evitar ?? [])] }, l, {}).filter((x) => !(e.evitar ?? []).includes(x.r.id)).map((x) => x.r));
  const out: Receta[] = [];
  for (let i = 0; out.length < max && listas.some((l) => i < l.length); i++) for (const l of listas) if (l[i] && out.length < max && !out.some((x) => x.id === l[i].id)) out.push(l[i]);
  return out;
}

/**
 * Arma un borrador de la semana en este orden: mis fijos, lo que uso poco pero me gusta, lo que hay en casa y lo que cabe en mi tiempo.
 * Nunca toca lugares ocupados. Cada propuesta trae `otras`: las siguientes mejores, para «Cambiar esta comida».
 */
export function sugerirMenu(e: EntradaSugerir): Propuesta[] {
  const porId = Object.fromEntries(e.recetas.map((r) => [r.id, r])) as Record<string, Receta>;
  const usadas: Record<string, number> = {};
  for (const id of e.yaEnMenu ?? []) usadas[id] = (usadas[id] ?? 0) + 1;
  const hay = e.hay ?? [];
  const salida: Propuesta[] = [];
  const tomado = new Set<string>();
  const ocupado = (f: string, l: LugarMenu) => e.ocupado(f, l) || tomado.has(f + l);
  const cubre = (r: Receta) => cobertura(r, hay);
  const poner = (f: string, l: LugarMenu, r: Receta, motivo: Motivo, otras: string[]) => {
    const c = cubre(r);
    tomado.add(f + l);
    usadas[r.id] = (usadas[r.id] ?? 0) + 1;
    salida.push({ f, l, r, motivo, usa: c.usa, falta: c.falta, otras });
  };

  // 1. Mis fijos, en sus huecos de siempre
  if (!e.nevera) {
    for (const c of cambiosFijos(e.fijos, porId, e.dias, ocupado, e.hoy)) {
      if (!e.tiempos.includes(c.l) || !sirveParaLosDos(c.r, e.perfiles)) continue;
      poner(c.f, c.l, c.r, 'fijo', []);
    }
  }

  // 2. El resto, lugar por lugar: sin repetir, lo que gusta y se usa poco, lo que hay en casa y lo que cabe
  const lugares = e.tiempos.filter((l) => ['d', 'c', 'n'].includes(l));
  for (const f of e.dias) {
    if (f < e.hoy) continue;
    for (const l of lugares) {
      if (ocupado(f, l)) continue;
      const ranqueadas = ranquear(e, l, usadas);
      const mejor = ranqueadas[0];
      if (!mejor) continue;
      const motivo: Motivo = e.nevera && mejor.nevera > 0 ? 'nevera' : mejor.gusto ? 'gusto' : mejor.nevera >= 0.5 ? 'nevera' : mejor.tiempo ? 'tiempo' : 'variar';
      poner(f, l, mejor.r, motivo, ranqueadas.slice(1, 6).map((x) => x.r.id));
    }
  }
  return salida.sort((a, b) => a.f.localeCompare(b.f) || ['d', 'c', 'n', 'a', 'p'].indexOf(a.l) - ['d', 'c', 'n', 'a', 'p'].indexOf(b.l));
}
