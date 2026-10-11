import type { Receta } from '../../core/db';

// Elegir con tarjetas: derecha es sí, izquierda es no. Las que dices que sí se acomodan en la semana.
// Solo salen desayunos, comidas y cenas: las colaciones y las bases se arman aparte.
export const CATS_TARJETA = ['Desayuno', 'Comida', 'Cena'] as const;

export function mazoDe(recetas: Receta[], liked: string[], passed: string[], cat: string): Receta[] {
  return recetas
    .filter((r) => (CATS_TARJETA as readonly string[]).includes(r.cat) && !liked.includes(r.id) && !passed.includes(r.id) && (cat === 'todo' || r.cat === cat))
    .sort((a, b) => a.n.localeCompare(b.n, 'es'));
}
export const cuentaTarjetas = (liked: number, passed: number, quedan: number) => 'Sí ' + liked + ' · No ' + passed + ' · Quedan ' + quedan;
export const elegidasTxt = (n: number) => 'Acomodar mis elegidas' + (n ? ' (' + n + ')' : '');
