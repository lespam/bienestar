import { descartar, type ComboProhibido, type Exclusiones } from './seguro';

// Combinaciones: las del catálogo y las que pide la IA pasan por el mismo doble seguro. Si una incluye algo que alguno de los dos no come,
// no se ve. Así nunca sale «huevo + verduras» cuando el huevo está en una lista de exclusiones.

/** Una combinación que pidió la IA y se guardó en tu teléfono. */
export interface ComboGuardado { b: string; t: string; x: string; ia: true }

/** «Lentejas + jitomate o limón» → ['Lentejas', 'jitomate', 'limón'] */
export const partesDe = (titulo: string) => titulo.split(/\s*\+\s*|\s+o\s+/i).map((p) => p.trim()).filter(Boolean);
const comoSugerencia = (c: { t: string; x: string }) => ({ nombre: c.t, ingredientes: partesDe(c.t), textos: [c.x] });

/** Por qué se oculta, o `null` si se puede mostrar. */
export const motivoDeOcultar = (c: { t: string; x: string }, ex: Exclusiones, prohibidas: ComboProhibido[] = []) => descartar(comoSugerencia(c), ex, prohibidas);

/** Se queda con las que ninguno de los dos excluye. */
export function combosVisibles<T extends { t: string; x: string }>(combos: T[], ex: Exclusiones, prohibidas: ComboProhibido[] = []): T[] {
  return combos.filter((c) => !motivoDeOcultar(c, ex, prohibidas));
}
/** Las parejas de las combinaciones ocultas: se le piden a la IA como «prohibidas». */
export function prohibidasDe<T extends { t: string; x: string }>(combos: T[], ex: Exclusiones): ComboProhibido[] {
  const salida: ComboProhibido[] = [];
  for (const c of combos) {
    if (!motivoDeOcultar(c, ex)) continue;
    const p = partesDe(c.t);
    if (p.length >= 2) salida.push([p[0], p[1]]);
  }
  return salida;
}
/** Las de tu plan primero: las que usan algo de las recetas de esta semana. Mantiene el orden dentro de cada grupo. */
export function enOrdenDeTuPlan<T>(combos: T[], delPlan: (c: T) => boolean): T[] {
  return [...combos.filter(delPlan), ...combos.filter((c) => !delPlan(c))];
}
