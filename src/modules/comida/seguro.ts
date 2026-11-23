import { nivelDe, norm, type PerfilNo } from './calculos';

// Doble seguro de la IA: la lista de exclusiones va en el prompt como regla dura y, además, todo lo que vuelve
// se revisa aquí. Una sugerencia que no pasa nunca se muestra.

export interface Exclusiones {
  /** «Lo odio» y «No lo como», de cualquiera de los dos: nunca. */
  duras: string[];
  /** «No me gusta»: nunca como ingrediente principal. */
  medias: string[];
  /** «Prefiero no»: se evita si hay con qué cambiarlo. */
  suaves: string[];
}
const unicos = (a: string[]) => [...new Map(a.map((x) => [norm(x), x])).values()];

/** Las exclusiones de los dos, por nivel. Son obligatorias en cada petición. */
export function exclusionesDe(perfiles: Record<'les' | 'jeff', PerfilNo>): Exclusiones {
  const ex: Exclusiones = { duras: [], medias: [], suaves: [] };
  for (const w of ['les', 'jeff'] as const) {
    const p = perfiles[w];
    for (const x of p.no) {
      const n = nivelDe(p, x);
      (n === 'odio' || n === 'nocomo' ? ex.duras : n === 'nogusta' ? ex.medias : ex.suaves).push(x);
    }
  }
  return { duras: unicos(ex.duras), medias: unicos(ex.medias), suaves: unicos(ex.suaves) };
}
/** Las exclusiones que se cuentan en el prompt, como regla dura. */
export function textoExclusiones(ex: Exclusiones): string {
  const l = (t: string, a: string[]) => t + ': ' + (a.length ? a.join(', ') : 'ninguna');
  return [l('Nivel «odio» o «no lo como» (prohibido, de cualquiera de los dos)', ex.duras), l('Nivel «no me gusta» (no como ingrediente principal)', ex.medias), l('Nivel «prefiero no» (evitar si hay alternativa)', ex.suaves)].join('\n');
}

/** Las formas de una palabra sin plural: «jitomates» → jitomates, jitomate, jitomat. Dos palabras se parecen si comparten una. */
const formas = (p: string): string[] => [p, p.replace(/s$/, ''), p.replace(/es$/, '')].filter((x) => x.length >= 3 || x === p);
const mismaPalabra = (a: string, b: string) => { const fb = formas(b); return formas(a).some((x) => fb.includes(x)); };
/** ¿El texto menciona ese ingrediente? Compara palabra por palabra, sin acentos ni plurales. */
export function menciona(texto: string, x: string): boolean {
  const sx = norm(x).trim();
  if (!sx) return false;
  const n = norm(texto);
  if (sx.includes(' ')) return n.includes(sx) || n.includes(sx.replace(/es$|s$/, ''));
  return n.split(/[^a-z0-9]+/).some((p) => !!p && mismaPalabra(p, sx));
}

export interface Sugerencia { nombre?: string; ingredientes?: string[]; textos?: string[] }
/** Un par que no debe aparecer junto (por ejemplo `['huevo', 'verduras']`). */
export type ComboProhibido = [string, string];
/**
 * Devuelve por qué se descarta una sugerencia, o `null` si pasa. Lo duro y las combinaciones prohibidas nunca pasan;
 * lo «no me gusta» no puede ser el nombre ni el primer ingrediente.
 */
export function descartar(s: Sugerencia, ex: Exclusiones, prohibidas: ComboProhibido[] = []): string | null {
  const todo = [s.nombre ?? '', ...(s.ingredientes ?? []), ...(s.textos ?? [])];
  for (const x of ex.duras) if (todo.some((t) => menciona(t, x))) return 'duro: ' + x;
  for (const x of ex.medias) if (menciona(s.nombre ?? '', x) || (s.ingredientes?.[0] && menciona(s.ingredientes[0], x))) return 'principal: ' + x;
  for (const [a, b] of prohibidas) if (todo.some((t) => menciona(t, a)) && todo.some((t) => menciona(t, b))) return 'combinación: ' + a + ' + ' + b;
  return null;
}
/** Se queda con lo que pasa y devuelve también lo descartado, para la segunda llamada. */
export function filtrar<T>(lista: T[], como: (x: T) => Sugerencia, ex: Exclusiones, prohibidas: ComboProhibido[] = []): { pasan: T[]; rechazos: string[] } {
  const pasan: T[] = [], rechazos: string[] = [];
  for (const x of lista) {
    const r = descartar(como(x), ex, prohibidas);
    if (r) rechazos.push((como(x).nombre ?? 'sugerencia') + ' (' + r + ')'); else pasan.push(x);
  }
  return { pasan, rechazos };
}
