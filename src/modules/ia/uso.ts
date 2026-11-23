// Cuánto gasta esta app en la API de Anthropic. Cada respuesta dice cuántos tokens usó; aquí se
// guardan por mes y en total. Es una estimación con los precios de lista: el cobro real está en la consola.

/** Dólares por millón de tokens [entrada, salida]. */
export const PRECIOS: Record<string, [number, number]> = {
  'claude-haiku-5-5': [0.1, 0.5],
  'claude-sonnet-5-5': [2, 10]
};
export interface Tokens { entrada: number; salida: number }
export interface Cuenta { usd: number; entrada: number; salida: number; pedidos: number }
export interface UsoIA { desde: string; total: Cuenta; meses: Record<string, Cuenta>; /** Lo gastado por cada función (clave de FnIA), desde que se cuenta. */ fns?: Record<string, Cuenta> }

export const cuentaVacia = (): Cuenta => ({ usd: 0, entrada: 0, salida: 0, pedidos: 0 });
export const usoVacio = (desde: string): UsoIA => ({ desde, total: cuentaVacia(), meses: {} });

export function costo(modelo: string, t: Tokens): number {
  const [pe, ps] = PRECIOS[modelo] ?? [0, 0];
  return (t.entrada * pe + t.salida * ps) / 1_000_000;
}
/** Lee `usage` de una respuesta; la caché cuenta como entrada (estimación hacia arriba). */
export function tokensDe(usage: unknown): Tokens | null {
  if (!usage || typeof usage !== 'object') return null;
  const u = usage as Record<string, unknown>;
  const n = (k: string) => (typeof u[k] === 'number' ? (u[k] as number) : 0);
  const entrada = n('input_tokens') + n('cache_creation_input_tokens') + n('cache_read_input_tokens');
  const salida = n('output_tokens');
  return entrada || salida ? { entrada, salida } : null;
}
const sumar = (c: Cuenta, t: Tokens, usd: number): Cuenta => ({ usd: c.usd + usd, entrada: c.entrada + t.entrada, salida: c.salida + t.salida, pedidos: c.pedidos + 1 });

/** Suma un pedido al mes de `fecha` (YYYY-MM-DD) y al total. */
export function anotar(u: UsoIA, modelo: string, t: Tokens, fecha: string, fn?: string): UsoIA {
  const usd = costo(modelo, t), mes = fecha.slice(0, 7);
  const fns = fn ? { ...(u.fns ?? {}), [fn]: sumar(u.fns?.[fn] ?? cuentaVacia(), t, usd) } : u.fns;
  return { desde: u.desde || fecha, total: sumar(u.total, t, usd), meses: { ...u.meses, [mes]: sumar(u.meses[mes] ?? cuentaVacia(), t, usd) }, ...(fns ? { fns } : {}) };
}
/** "$0.42" o "menos de $0.01". */
export const dolares = (usd: number) => (usd > 0 && usd < 0.01 ? 'menos de $0.01' : '$' + usd.toFixed(2));
