import type { HistCompra } from '../../core/db';
import { norm } from './calculos';
import { diasEntre } from '../../core/fechas';

// Historial de compras y frecuencia, todo por reglas: la mediana de días entre compras de cada artículo.
// Informa, no regaña: «ya toca» es una idea, nunca un atraso.

const aMs = (f: string) => new Date(+f.slice(0, 4), +f.slice(5, 7) - 1, +f.slice(8, 10), 12).getTime();
export const diasDesde = (a: string, b: string) => diasEntre(aMs(a), aMs(b));

/** Mediana de días entre compras; null si hay menos de 3 fechas distintas. */
export function intervaloMediano(fechas: string[]): number | null {
  const u = [...new Set(fechas)].sort();
  if (u.length < 3) return null;
  const d = u.slice(1).map((f, i) => diasDesde(u[i], f)).sort((a, b) => a - b);
  const m = Math.floor(d.length / 2);
  return d.length % 2 ? d[m] : Math.round((d[m - 1] + d[m]) / 2);
}
export function cadaTxt(d: number): string {
  if (d <= 8) return 'cada semana';
  if (d <= 17) return 'cada 2 semanas';
  if (d >= 26 && d <= 34) return 'cada mes';
  return 'cada ' + d + ' días';
}
export interface YaToca { art: string; n: string; desde: number; cada: number; texto: string }

/** Lo que ya casi toca comprar: pasó al menos el 85 % del intervalo habitual desde la última compra. Máximo `max`. */
export function yaToca(hist: HistCompra[], hoy: string, enLista: string[], silenciados: string[], max = 3): YaToca[] {
  const por = new Map<string, HistCompra[]>();
  for (const h of hist) por.set(h.art, [...(por.get(h.art) ?? []), h]);
  const lista = new Set(enLista.map(norm)), calla = new Set(silenciados);
  const out: YaToca[] = [];
  for (const [art, hs] of por) {
    if (lista.has(art) || calla.has(art)) continue;
    const cada = intervaloMediano(hs.map((h) => h.fecha));
    if (!cada || cada < 3) continue;
    const ultima = hs.map((h) => h.fecha).sort().pop()!;
    const desde = diasDesde(ultima, hoy);
    if (desde < Math.round(cada * 0.85)) continue;
    const n = hs[hs.length - 1].n;
    out.push({ art, n, desde, cada, texto: 'Hace ' + desde + ' días compraste ' + n.toLowerCase() + '. Lo compras ' + cadaTxt(cada) + '.' });
  }
  return out.sort((a, b) => b.desde / b.cada - a.desde / a.cada).slice(0, max);
}
