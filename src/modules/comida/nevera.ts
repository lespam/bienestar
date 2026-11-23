import { norm } from './calculos';
import { menciona } from './seguro';
import type { Hay } from './sugerir';

// «Con lo que tengo»: lo que hay en casa. Se escribe o se lee de una foto, y siempre lo revisas tú antes de usarlo.

/** «Lo que hay hoy»: la lista confirmada y el día en que la confirmaste. */
export interface HayGuardado { fecha: string; items: Hay[] }
/** La lista deja de contar sola después de unos días: lo que había el lunes ya no es lo que hay el viernes. */
export const DIAS_VIGENTE = 3;

const NUMEROS: Record<string, string> = { un: '1', una: '1', uno: '1', dos: '2', tres: '3', cuatro: '4', cinco: '5', seis: '6', siete: '7', ocho: '8', nueve: '9', diez: '10', medio: 'medio', media: 'media', unos: 'unos', unas: 'unas', poco: 'un poco', poca: 'un poco' };
const UNIDADES = /^(kg|kilos?|g|gr|gramos?|l|lt|litros?|ml|piezas?|pzas?|latas?|paquetes?|bolsas?|botes?|frascos?|cajas?|tazas?|dientes?|manojos?|ramas?|rebanadas?|docenas?|puños?|cdas?|cucharadas?)$/;
const PRONTO = /\b(urgente|pronto|se echa a perder|se va a echar a perder|por echarse a perder|ya casi|madur[oa]s?)\b/;

const mayus = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);

/** Separa «tengo pollo, 3 jitomates, medio aguacate y yogurt» en chips. Sin IA. */
export function leerTextoHay(texto: string): Hay[] {
  const limpio = texto
    .replace(/\b(hoy |ahorita |ahora )?(tengo|tenemos|hay|me quedan?|quedan?|compr[eé])\b:?/gi, ' ')
    .replace(/\s+/g, ' ');
  const partes = limpio.split(/[,;\n]+|\s+y\s+|\s+e\s+(?=[aeiou])/i).map((p) => p.trim()).filter(Boolean);
  const salida: Hay[] = [];
  for (let p of partes) {
    p = p.replace(/^(y|e|con|de)\s+/i, '').replace(/[.:]+$/, '').trim();
    if (!p) continue;
    const t = norm(p);
    const urgente = PRONTO.test(t);
    p = p.replace(/\(([^)]*)\)/g, (_, d: string) => (PRONTO.test(norm(d)) ? '' : ' ' + d)).replace(new RegExp(PRONTO.source, 'gi'), '').replace(/\s+/g, ' ').replace(/[\s,-]+$/, '').trim();
    if (!p) continue;
    const pal = p.split(' ');
    let q = '';
    let i = 0;
    const primera = norm(pal[0]);
    if (/^\d+([.,]\d+)?$/.test(primera) || NUMEROS[primera]) {
      q = NUMEROS[primera] === 'un poco' || primera === 'poco' ? 'un poco' : NUMEROS[primera] ?? pal[0];
      i = 1;
      if (primera === 'un' && norm(pal[1] ?? '') === 'poco') { q = 'un poco'; i = 2; }
      if (UNIDADES.test(norm(pal[i] ?? ''))) { q += ' ' + pal[i]; i++; }
      if (norm(pal[i] ?? '') === 'de') i++;
    } else if (/^\d+([.,]\d+)?(kg|g|gr|l|ml)$/.test(primera)) { q = pal[0]; i = 1; if (norm(pal[i] ?? '') === 'de') i++; }
    const n = pal.slice(i).join(' ').trim();
    if (!n) continue;
    salida.push({ n: mayus(n.slice(0, 60)), ...(q ? { q } : {}), ...(urgente ? { urgente: true } : {}) });
  }
  return salida;
}

/** Junta lo nuevo con lo que ya había: el mismo alimento no se repite; la cantidad nueva y el «usar pronto» se conservan. */
export function mezclarHay(actual: Hay[], nuevos: Hay[]): Hay[] {
  const salida = actual.map((h) => ({ ...h }));
  for (const h of nuevos) {
    const igual = salida.find((x) => norm(x.n) === norm(h.n));
    if (igual) {
      if (h.q) igual.q = h.q;
      if (h.urgente) igual.urgente = true;
    } else salida.push({ ...h });
  }
  return salida;
}

/** ¿Un artículo de la lista de compras ya lo tengo? */
export const tengo = (nombre: string, hay: Hay[]) => hay.some((h) => menciona(nombre, h.n) || menciona(h.n, nombre));

/** La lista guardada solo vale si es reciente. */
export function vigente(g: HayGuardado | null | undefined, hoy: string, dias = DIAS_VIGENTE): Hay[] {
  if (!g?.items?.length) return [];
  const limite = new Date(hoy + 'T12:00:00').getTime() - dias * 86400000;
  return new Date(g.fecha + 'T12:00:00').getTime() >= limite ? g.items : [];
}

export const resumenHay = (h: Hay) => h.n + (h.q ? ' · ' + h.q : '') + (h.urgente ? ' · usar pronto' : '');
