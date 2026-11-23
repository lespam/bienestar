import type { LugarMenu, Receta } from '../../core/db';
import { vecesUsada, type UsoReceta } from './calculos';

// Elegir con tarjetas: derecha es sí, izquierda es no. Las que dices que sí se acomodan en la semana.
// Salen desayunos, comidas, cenas y bases (Les las pidió de vuelta, 2026-10-15); las colaciones se arman aparte.
export const CATS_TARJETA = ['Desayuno', 'Comida', 'Cena', 'Base'] as const;

/** Planear por tiempos: cada tiempo de comida y el tipo de receta que le toca. Bases no es un tiempo. */
export const TIEMPOS: { l: LugarMenu; cat: string; n: string }[] = [{ l: 'd', cat: 'Desayuno', n: 'Desayuno' }, { l: 'c', cat: 'Comida', n: 'Comida' }, { l: 'n', cat: 'Cena', n: 'Cena' }];
/** Las colaciones son su propio bloque, aparte de las comidas: AM y PM. */
export const COLACIONES: { l: LugarMenu; cat: string; n: string }[] = [{ l: 'a', cat: 'Colación', n: 'Colación AM' }, { l: 'p', cat: 'Colación', n: 'Colación PM' }];
export const TODOS_TIEMPOS = [...TIEMPOS, ...COLACIONES];
export const lugarDeReceta = (r: Pick<Receta, 'cat' | 'sub'>): LugarMenu | null => (r.cat === 'Colación' ? (r.sub === 'PM' ? 'p' : 'a') : TIEMPOS.find((t) => t.cat === r.cat)?.l ?? null);
export const tiemposTxt = (ls: LugarMenu[]) => {
  const ns = TODOS_TIEMPOS.filter((t) => ls.includes(t.l)).map((t) => t.n.toLowerCase());
  return ns.length < 2 ? ns.join('') : ns.slice(0, -1).join(', ') + ' y ' + ns[ns.length - 1];
};
/**
 * Cada receta va a su tiempo (un desayuno al desayuno) en el siguiente día libre, en orden.
 * Lo que no cabe se queda en tus elegidas.
 */
export function repartirPorTiempos(recetas: Receta[], dias: string[], ocupado: (f: string, l: LugarMenu) => boolean): { puestas: { r: Receta; f: string; l: LugarMenu }[]; sobran: Receta[] } {
  const tomado = new Set<string>();
  const puestas: { r: Receta; f: string; l: LugarMenu }[] = [], sobran: Receta[] = [];
  for (const r of recetas) {
    const l = lugarDeReceta(r);
    const f = l && dias.find((d) => !ocupado(d, l) && !tomado.has(d + l));
    if (!l || !f) { sobran.push(r); continue; }
    tomado.add(f + l);
    puestas.push({ r, f, l });
  }
  return { puestas, sobran };
}

/**
 * Primero lo que ya sabes cocinar (lo más usado arriba) y, cada cuarta tarjeta, una que casi no usas,
 * para ampliar las opciones sin que estorben. Sin historial, van en orden alfabético.
 */
export function mazoDe(recetas: Receta[], liked: string[], passed: string[], cat: string, uso: Record<string, UsoReceta> = {}, conColaciones = false): Receta[] {
  const lista = recetas
    .filter((r) => ((CATS_TARJETA as readonly string[]).includes(r.cat) || (conColaciones && r.cat === 'Colación')) && !liked.includes(r.id) && !passed.includes(r.id) && (cat === 'todo' || r.cat === cat))
    .sort((a, b) => a.n.localeCompare(b.n, 'es'));
  const conocidas = lista.filter((r) => vecesUsada(uso[r.id]) >= 2).sort((a, b) => vecesUsada(uso[b.id]) - vecesUsada(uso[a.id]));
  if (!conocidas.length) return lista;
  const nuevas = lista.filter((r) => vecesUsada(uso[r.id]) < 2);
  const out: Receta[] = [];
  while (conocidas.length || nuevas.length) {
    out.push(...conocidas.splice(0, 3));
    if (nuevas.length) out.push(nuevas.shift()!);
    if (!conocidas.length) { out.push(...nuevas); break; }
  }
  return out;
}
/** Una ronda corta: con cientos de recetas no hay dónde parar, así que se eligen de 10 en 10. */
export const RONDA = 10;
export const cuentaRonda = (hechas: number, total: number, si: number) => hechas + ' de ' + total + ' · Sí ' + si;
export const elegidasTxt = (n: number) => 'Acomodar mis elegidas' + (n ? ' (' + n + ')' : '');
