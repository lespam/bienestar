import type { Receta } from '../../core/db';
import { vecesUsada, type UsoReceta } from './calculos';

// Elegir con tarjetas: derecha es sí, izquierda es no. Las que dices que sí se acomodan en la semana.
// Salen desayunos, comidas, cenas y bases (Les las pidió de vuelta, 2026-10-15); las colaciones se arman aparte.
export const CATS_TARJETA = ['Desayuno', 'Comida', 'Cena', 'Base'] as const;

/**
 * Primero lo que ya sabes cocinar (lo más usado arriba) y, cada cuarta tarjeta, una que casi no usas,
 * para ampliar las opciones sin que estorben. Sin historial, van en orden alfabético.
 */
export function mazoDe(recetas: Receta[], liked: string[], passed: string[], cat: string, uso: Record<string, UsoReceta> = {}): Receta[] {
  const lista = recetas
    .filter((r) => (CATS_TARJETA as readonly string[]).includes(r.cat) && !liked.includes(r.id) && !passed.includes(r.id) && (cat === 'todo' || r.cat === cat))
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
