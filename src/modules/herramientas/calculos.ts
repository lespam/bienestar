// Cuentas de Herramientas. Todo se calcula con la hora del reloj, así que si sales a otra app el tiempo sigue bien.

/** Cronómetro: `inicio` es la hora en que arrancó la última vez; `acum` lo que ya había corrido antes. */
export interface EstadoCrono { inicio: number | null; acum: number; vueltas: number[] }
export const CRONO_NUEVO: EstadoCrono = { inicio: null, acum: 0, vueltas: [] };

export const msCrono = (e: EstadoCrono, ahora: number) => e.acum + (e.inicio == null ? 0 : Math.max(0, ahora - e.inicio));

/** "0:00.0" */
export function formatoCrono(ms: number): string {
  const t = Math.floor(ms / 100), d = t % 10, sx = Math.floor(t / 10), m = Math.floor(sx / 60), x = sx % 60;
  return m + ':' + (x < 10 ? '0' : '') + x + '.' + d;
}

export const estadoCrono = (e: EstadoCrono, ahora: number): 'corriendo' | 'en pausa' | 'listo' =>
  e.inicio != null ? 'corriendo' : msCrono(e, ahora) > 0 ? 'en pausa' : 'listo';

/** Temporizador: `fin` es la hora en que termina si está corriendo; si no, `quedan` son los segundos que faltan. */
export type ModoTemp = '60' | '180' | 'libre';
export interface EstadoTemp { modo: ModoTemp; min: number; seg: number; largo: number; fin: number | null; quedan: number }

export function duracionLibre(min: number, seg: number): number {
  const m = Number.isFinite(min) ? Math.max(0, Math.min(99, Math.floor(min))) : 0;
  const s = Number.isFinite(seg) ? Math.max(0, Math.min(59, Math.floor(seg))) : 0;
  return Math.max(1, m * 60 + s);
}
export const largoDeModo = (modo: ModoTemp, min: number, seg: number) => (modo === 'libre' ? duracionLibre(min, seg) : Number(modo));
export function tempNuevo(modo: ModoTemp = '60', min = 10, seg = 0): EstadoTemp {
  const largo = largoDeModo(modo, min, seg);
  return { modo, min, seg, largo, fin: null, quedan: largo };
}

export const quedanTemp = (e: EstadoTemp, ahora: number) => (e.fin == null ? e.quedan : Math.max(0, Math.ceil((e.fin - ahora) / 1000)));
export const estadoTemp = (e: EstadoTemp, ahora: number): 'corriendo' | 'terminado' | 'listo' =>
  e.fin != null ? (quedanTemp(e, ahora) === 0 ? 'terminado' : 'corriendo') : e.quedan === 0 ? 'terminado' : 'listo';

/** "1:00" */
export const formatoTemp = (s: number) => Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');

/** Cara o cruz. `azar` es un número entre 0 y 1 (se pasa para poder probarlo). */
export const lanzar = (azar: number): 'cara' | 'cruz' => (azar < 0.5 ? 'cara' : 'cruz');
