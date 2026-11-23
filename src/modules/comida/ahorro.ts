import type { HistCompra } from '../../core/db';
import { norm } from './calculos';
import { seccionDe } from './compras';
import { lunesDe, sumar } from './patrones';

// Ideas de ahorro por reglas, sin IA. Una idea por visita a la lista, siempre se puede silenciar con «No me interesa».
// Solo se habla de dinero con cifras si el historial trae precios o si tú anotaste el precio; si no, la idea va sin cifras.

export const SEMANAS_AHORRO = 7;
export const MIN_SEMANAS = 5;
/** Lo que se echa a perder pronto no se compra en paquete: frutas y verduras, proteínas, lácteos y tortillería quedan fuera... */
const SECCIONES_DE_PAQUETE = [3, 5, 6];
/** ...salvo lo que viene envasado aunque lleve el nombre de una verdura («salsa de tomate»). */
const RX_ENVASADO = /salsa|sopa|caldo|\blata|conserva|pure de|pasta de|atun|sardina|mermelada|mayonesa|catsup|mostaza|aceite|vinagre|cereal|galleta/;
const sePuedeEnPaquete = (nombre: string) => SECCIONES_DE_PAQUETE.includes(seccionDe(nombre)) || RX_ENVASADO.test(norm(nombre));

export interface IdeaAhorro { art: string; n: string; semanas: number; precio?: number; texto: string }

const mediana = (xs: number[]) => { const o = [...xs].sort((a, b) => a - b), m = Math.floor(o.length / 2); return o.length % 2 ? o[m] : (o[m - 1] + o[m]) / 2; };
const dinero = (n: number) => '$' + Math.round(n).toLocaleString('es-MX');

/**
 * El artículo de la lista que más compras semana tras semana (al menos 5 de las últimas 7), si no se echa a perder pronto.
 * `precios` son los que anotaste tú; si el historial trae precios, se usa su mediana.
 */
export function ideaDeAhorro(hist: HistCompra[], hoy: string, enLista: string[], silenciados: string[], precios: Record<string, number> = {}): IdeaAhorro | null {
  const desde = lunesDe(hoy);
  const ventana = new Set<string>();
  for (let i = 0; i < SEMANAS_AHORRO; i++) {
    ventana.add(sumar(desde, -7 * i));
  }
  const lista = enLista.map(norm), calla = silenciados;
  const porArt = new Map<string, HistCompra[]>();
  for (const h of hist) porArt.set(h.art, [...(porArt.get(h.art) ?? []), h]);
  let mejor: IdeaAhorro | null = null;
  for (const [art, hs] of porArt) {
    if (calla.includes(art) || !lista.includes(art)) continue;
    const nombre = hs[hs.length - 1].n;
    if (!sePuedeEnPaquete(nombre)) continue;
    const semanas = new Set(hs.map((h) => lunesDe(h.fecha)).filter((l) => ventana.has(l))).size;
    if (semanas < MIN_SEMANAS) continue;
    const vistos = hs.map((h) => h.precio).filter((p): p is number => typeof p === 'number' && p > 0);
    const precio = vistos.length ? mediana(vistos) : precios[art];
    const base = 'Compras ' + nombre.toLowerCase() + ' casi cada semana: en ' + semanas + ' de las últimas ' + SEMANAS_AHORRO + '. ';
    const texto = precio
      ? base + 'Si te cuesta unos ' + dinero(precio) + ' cada vez, un paquete de 4 que cueste menos de ' + dinero(precio * 4) + ' te sale mejor.'
      : base + 'Un paquete de 4 podría ahorrarte dinero y viajes.';
    const idea: IdeaAhorro = { art, n: nombre, semanas, ...(precio ? { precio } : {}), texto };
    if (!mejor || idea.semanas > mejor.semanas || (idea.semanas === mejor.semanas && idea.art < mejor.art)) mejor = idea;
  }
  return mejor;
}
