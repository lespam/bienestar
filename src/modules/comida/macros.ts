import type { ItemMenu, PerfilComida, Receta } from '../../core/db';
import { fmtN, porcionDe } from './calculos';

// Macros en el plan. La app suma lo que trae cada receta por la porción de cada quien y lo pone junto a la referencia
// que escribieron ustedes o su nutrióloga. Nunca calcula una referencia ni dice que algo «falta» o «sobra».

export type Quien = 'les' | 'jeff';
export const PERSONAS: { w: Quien; n: string }[] = [{ w: 'les', n: 'Les' }, { w: 'jeff', n: 'Jeff' }];

export interface Aporte { k: number; p: number; c: number; g: number }

/** Lo que una receta aporta por porción. Si falta la energía pero hay macros, se saca de ellos (4, 4 y 9 kcal por gramo). */
export function porPorcion(r: Pick<Receta, 'k' | 'p' | 'c' | 'g'>): Aporte | null {
  if (r.k == null && r.p == null && r.c == null && r.g == null) return null;
  const p = r.p ?? 0, c = r.c ?? 0, g = r.g ?? 0;
  return { k: r.k ?? p * 4 + c * 4 + g * 9, p, c, g };
}

type Recetas = Map<string, Pick<Receta, 'k' | 'p' | 'c' | 'g' | 'por'>>;
type Perfiles = Record<Quien, Pick<PerfilComida, 'por'>>;

/**
 * Lo que un lugar del menú le aporta a una persona. null cuando no hay números: takeout, por decidir,
 * una colación armada por partes o una receta sin datos.
 */
export function aporteDe(m: ItemMenu, w: Quien, recetas: Recetas, perfiles: Perfiles): Aporte | null {
  const id = m.t === 'dos' ? m.r : m.t === 'cada' ? (w === 'les' ? m.rl : m.rj) : undefined;
  const r = id ? recetas.get(id) : undefined;
  const base = r ? porPorcion(r) : null;
  if (!r || !base) return null;
  const f = porcionDe(r, w, perfiles);
  return { k: base.k * f, p: base.p * f, c: base.c * f, g: base.g * f };
}

export interface MacrosDia extends Aporte {
  /** Cuántos lugares del día traen números y cuántos no. Por decidir no cuenta: todavía no es una comida. */
  conDato: number;
  sinDato: number;
  /** Hay algo en el menú de ese día (aunque sea por decidir). */
  hayMenu: boolean;
}

/** Lo que suma un día para una persona. Solo cuenta lo que tiene números; lo demás se avisa aparte. */
export function resumenDia(items: ItemMenu[], w: Quien, recetas: Recetas, perfiles: Perfiles): MacrosDia {
  const t: MacrosDia = { k: 0, p: 0, c: 0, g: 0, conDato: 0, sinDato: 0, hayMenu: items.length > 0 };
  for (const m of items) {
    if (m.t === 'decidir') continue;
    const a = aporteDe(m, w, recetas, perfiles);
    if (!a) { t.sinDato++; continue; }
    t.k += a.k; t.p += a.p; t.c += a.c; t.g += a.g; t.conDato++;
  }
  return t;
}

export interface Referencia { k: [number, number] | null; p: number | null; c: number | null; g: number | null }
export const referenciaDe = (p: Pick<PerfilComida, 'k' | 'p' | 'c' | 'g'>): Referencia => ({ k: p.k, p: p.p, c: p.c, g: p.g });
export const hayReferencia = (r: Referencia) => !!(r.k || r.p || r.c || r.g);

export interface BarraKcal {
  /** Ancho del relleno y de la franja de referencia, en % de la barra. */
  relleno: number;
  bandaDesde: number;
  bandaAncho: number;
}
/**
 * La barra de calorías: el relleno es lo planeado y la franja es el rango que escribieron. Si te pasas, la barra sigue
 * creciendo sin cambiar de color: nunca se corta ni se pinta distinto.
 */
export function barraKcal(valor: number, ref: [number, number] | null): BarraKcal {
  const tope = Math.max((ref ? ref[1] : valor) * 1.25, valor, 1);
  const pct = (x: number) => Math.round(Math.min(100, Math.max(0, (x / tope) * 100)) * 10) / 10;
  return { relleno: pct(valor), bandaDesde: ref ? pct(ref[0]) : 0, bandaAncho: ref ? Math.round((pct(ref[1]) - pct(ref[0])) * 10) / 10 : 0 };
}
/** Un macro: la barra mide lo planeado y una marca la referencia, igual que en el registro del día. */
export function barraMacro(valor: number, ref: number | null): { relleno: number; marca: number | null } {
  if (!ref) return { relleno: 0, marca: null };
  const tope = Math.max(ref * 1.4, valor);
  return { relleno: Math.round((valor / tope) * 1000) / 10, marca: Math.round((ref / tope) * 1000) / 10 };
}

export const kcalTxt = (k: number) => '~' + fmtN(Math.round(k / 10) * 10) + ' kcal';
export const rangoTxt = (k: [number, number]) => (k[0] === k[1] ? fmtN(k[0]) : fmtN(k[0]) + '–' + fmtN(k[1])) + ' kcal';
export const gramosTxt = (g: number) => Math.round(g) + ' g';

/** Lo dicho en palabras para lectores de pantalla y para quien no distingue la barra. Sin juicio. */
export function textoBarra(nombre: string, d: MacrosDia, ref: Referencia): string {
  if (!d.hayMenu) return nombre + ': sin menú este día';
  if (!d.conDato) return nombre + ': sin números en lo planeado';
  return nombre + ': planeado ' + kcalTxt(d.k) + (ref.k ? ', tu referencia ' + rangoTxt(ref.k) : '');
}
export const sinNumerosTxt = (n: number) => (n === 1 ? '1 comida sin números' : n + ' comidas sin números');

/** Promedio de los días planeados que tienen números. */
export function promedio(dias: MacrosDia[]): (Aporte & { dias: number }) | null {
  const con = dias.filter((d) => d.conDato > 0);
  if (!con.length) return null;
  const s = con.reduce((a, d) => ({ k: a.k + d.k, p: a.p + d.p, c: a.c + d.c, g: a.g + d.g }), { k: 0, p: 0, c: 0, g: 0 });
  const n = con.length;
  return { k: s.k / n, p: s.p / n, c: s.c / n, g: s.g / n, dias: n };
}

// ---------- «Acerca a mis referencias»: solo ordena, nunca esconde ----------
const CATS_CON_REFERENCIA = ['Desayuno', 'Comida', 'Cena'];
/** ¿Alguien tiene escrita una referencia por comida (calorías o proteína)? */
export const hayReferenciaPorComida = (perfiles: Record<Quien, Pick<PerfilComida, 'mk' | 'mp'>>) => PERSONAS.some(({ w }) => !!perfiles[w].mk || !!perfiles[w].mp);

/**
 * Qué tan lejos queda una receta de la referencia por comida de ustedes dos (0 = igual). Se mide con la porción de cada quien.
 * null cuando no hay con qué comparar: una colación, una base, una receta sin números o perfiles sin referencia por comida.
 */
export function distanciaARef(r: Pick<Receta, 'cat' | 'k' | 'p' | 'c' | 'g' | 'por'>, perfiles: Record<Quien, Pick<PerfilComida, 'por' | 'mk' | 'mp'>>): number | null {
  if (!CATS_CON_REFERENCIA.includes(r.cat)) return null;
  const base = porPorcion(r);
  if (!base) return null;
  const ds: number[] = [];
  for (const { w } of PERSONAS) {
    const pf = perfiles[w], f = porcionDe(r, w, perfiles);
    const partes: number[] = [];
    if (pf.mk) partes.push(Math.abs(base.k * f - pf.mk) / pf.mk);
    if (pf.mp && r.p != null) partes.push(Math.abs(base.p * f - pf.mp) / pf.mp);
    if (partes.length) ds.push(partes.reduce((a, b) => a + b, 0) / partes.length);
  }
  return ds.length ? ds.reduce((a, b) => a + b, 0) / ds.length : null;
}

/** Ordena de la más cercana a la más lejana. Lo que no se puede comparar va al final, en su mismo orden. Nada se quita. */
export function acercarARef<T extends Pick<Receta, 'cat' | 'k' | 'p' | 'c' | 'g' | 'por'>>(lista: T[], perfiles: Record<Quien, Pick<PerfilComida, 'por' | 'mk' | 'mp'>>): T[] {
  const con = lista.map((r, i) => ({ r, i, d: distanciaARef(r, perfiles) }));
  return [...con.filter((x) => x.d != null).sort((a, b) => a.d! - b.d! || a.i - b.i), ...con.filter((x) => x.d == null)].map((x) => x.r);
}
