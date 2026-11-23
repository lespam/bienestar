import type { ItemMenu, Receta, Tanda } from '../../core/db';
import { lc, norm } from './calculos';
import { HORA_INICIAL, sumarDias, ponerEnOrden } from './preparacion';
import { NOMBRE_LUGAR, nombreDia } from './semana';

// Catálogo de preparación por reglas (sin IA): cada ingrediente trae su consejo y cuándo conviene hacerlo.
// Es una idea, nunca una obligación: en «Hoy toca» siempre se puede dejar para después.

interface Regla { rx: RegExp; antes: number; m?: number; t: (n: string) => string }
export const REGLAS: Regla[] = [
  { rx: /\b(fresas?|mango|melon|papaya|sandia|pina|manzana|pera|uvas?)\b/, antes: 1, m: 5, t: (n) => 'Corta ' + n },
  { rx: /\b(pollo|pechuga|res|carne|bistec|pescado|salmon|camaron(es)?|cerdo|pavo)\b/, antes: 1, m: 5, t: (n) => 'Saca del congelador ' + n },
  { rx: /\b(frijoles?|garbanzos?|lentejas?|habas?)\b/, antes: 1, m: 5, t: (n) => 'Pon en remojo ' + n },
  { rx: /\b(aguacate|platano|pan|tortillas?|lechuga|cilantro|espinacas?)\b/, antes: 0, t: (n) => 'Compra el mismo día ' + n }
];

export interface Consejo { t: string; m?: number; antes: number }

/** Los consejos de una receta: uno por ingrediente que coincide, máximo 3 por comida. */
export function consejosDe(r: Pick<Receta, 'ing'>): Consejo[] {
  const out: Consejo[] = [], vistos = new Set<string>();
  for (const it of r.ing) {
    const nombre = lc(it[2]);
    for (const g of REGLAS) {
      if (!g.rx.test(norm(it[2]))) continue;
      const t = g.t(nombre);
      if (vistos.has(t)) break;
      vistos.add(t);
      out.push({ t, m: g.m, antes: g.antes });
      break;
    }
  }
  return out.slice(0, 3);
}

/** Agrega los consejos de las comidas de esas fechas a la tanda del día que toca (hoy si ya pasó). */
export function agregarConsejos(tandas: Tanda[], menu: ItemMenu[], recetas: Map<string, Receta>, fechas: string[], hoy: string, nuevoId: () => string): Tanda[] {
  const afectadas = new Set(fechas);
  for (const m of menu.filter((x) => afectadas.has(x.fecha) && x.fecha >= hoy && (x.t === 'dos' || x.t === 'cada'))) {
    if (!['d', 'c', 'n'].includes(m.lugar)) continue;
    const ids = [m.r, m.rl, m.rj].filter((x): x is string => !!x);
    const fm = m.fecha + ':' + m.lugar;
    const hechos = new Set<string>();
    for (const id of ids) {
      const r = recetas.get(id);
      if (!r) continue;
      for (const c of consejosDe(r)) {
        if (hechos.has(c.t)) continue;
        hechos.add(c.t);
        const previo = sumarDias(m.fecha, -c.antes);
        const dia = previo < hoy ? hoy : previo;
        let t = tandas.find((x) => x.fecha === dia);
        if (!t) { t = { id: nuevoId(), fecha: dia, hora: HORA_INICIAL, auto: true, items: [] }; tandas.push(t); }
        if (t.items.some((it) => it.fm === fm && it.t === c.t)) continue;
        ponerEnOrden(t.items, { t: c.t, f: 'Para ' + (m.lugar === 'd' ? 'el ' : 'la ') + lc(NOMBRE_LUGAR[m.lugar]) + ' del ' + lc(nombreDia(m.fecha)), ...(c.m ? { m: c.m } : {}), ok: false, fm });
      }
    }
  }
  return tandas;
}
