import type { AreaAlma, SemanaAlma } from '../../core/db';
import { iso } from '../../core/fechas';

// El planeador es de lunes a viernes. Una semana se guarda por la fecha de su lunes.
// Nada de esto se guarda si se puede calcular: el nombre de la semana y las fechas salen del lunes.

export const DIAS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes'];
const MESES3 = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
/** Hasta cuántas semanas atrás y adelante se puede mirar. */
export const SEMANA_MIN = -3;
export const SEMANA_MAX = 1;

/** Las áreas que traes en papel. Se crean la primera vez y después son tuyas. */
export const AREAS_INICIALES: Omit<AreaAlma, 'id'>[] = [
  { nombre: 'Fundación y proyecto sin fines de lucro', corto: 'Fundación', color: 0 },
  { nombre: 'Crecimiento profesional', corto: 'Profesional', color: 1 },
  { nombre: 'Movimiento y salud', corto: 'Movimiento', color: 2 },
  { nombre: 'Reflexión y notas', corto: 'Reflexión', color: 3 }
];
export const COLORES_AREA = ['var(--mint)', 'var(--sky)', 'var(--accent)', 'var(--rose)'];
export const colorDe = (a: AreaAlma) => COLORES_AREA[a.color % COLORES_AREA.length];

const aFecha = (f: string) => new Date(+f.slice(0, 4), +f.slice(5, 7) - 1, +f.slice(8, 10));
/** Fecha `n` días después de `f`. */
export const sumarDias = (f: string, n: number) => { const d = aFecha(f); d.setDate(d.getDate() + n); return iso(d); };
/** 0 lunes … 6 domingo. */
export const diaSemana = (d: Date) => (d.getDay() + 6) % 7;
/** El lunes de la semana de `d`. */
export const lunesDe = (d: Date) => sumarDias(iso(d), -diaSemana(d));
/** El lunes de la semana `k` (0 es la de hoy, -1 la pasada, 1 la próxima). */
export const lunesDeSemana = (k: number, hoy = new Date()) => sumarDias(lunesDe(hoy), 7 * k);

/** Día de la semana de hoy si es de lunes a viernes; si no, -1 (sábado o domingo). */
export const diaDePlan = (hoy = new Date()) => { const i = diaSemana(hoy); return i < 5 ? i : -1; };
export const esFinDeSemana = (hoy = new Date()) => diaSemana(hoy) >= 5;

/** "28 sep – 2 oct" (lunes a viernes). */
export function rangoCorto(lunes: string): string {
  const a = aFecha(lunes), b = aFecha(sumarDias(lunes, 4));
  return a.getDate() + (a.getMonth() === b.getMonth() ? '' : ' ' + MESES3[a.getMonth()]) + ' – ' + b.getDate() + ' ' + MESES3[b.getMonth()];
}
export function nombreSemana(k: number): string {
  return k === 0 ? 'Esta semana' : k === -1 ? 'Semana pasada' : k === 1 ? 'Próxima semana' : k < 0 ? 'Hace ' + -k + ' semanas' : 'En ' + k + ' semanas';
}
/** "Lunes 28 sep". */
export function diaCompleto(lunes: string, i: number): string {
  const d = aFecha(sumarDias(lunes, i));
  return DIAS[i] + ' ' + d.getDate() + ' ' + MESES3[d.getMonth()];
}
export const numeroDeDia = (lunes: string, i: number) => aFecha(sumarDias(lunes, i)).getDate();

export const semanaVacia = (lunes: string): SemanaAlma => ({ lunes, dias: ['', '', '', '', ''], areas: {} });
/** Completa una semana guardada (por si le faltan días) sin tocar lo que escribiste. */
export function normalizar(s: SemanaAlma | undefined, lunes: string): SemanaAlma {
  if (!s) return semanaVacia(lunes);
  return { lunes, dias: Array.from({ length: 5 }, (_, i) => s.dias?.[i] ?? ''), areas: { ...(s.areas ?? {}) } };
}
/** Una semana sin nada escrito en las áreas actuales ni en los días. */
export function estaVacia(s: SemanaAlma, areas: AreaAlma[]): boolean {
  return !s.dias.some((d) => d.trim()) && !areas.some((a) => (s.areas[a.id!] ?? '').trim());
}
/** Copia las áreas de otra semana. Devuelve las que cambiaron (para poder deshacer) o null si no había nada. */
export function copiarAreas(origen: SemanaAlma, destino: SemanaAlma, areas: AreaAlma[]): SemanaAlma | null {
  const nuevas = { ...destino.areas };
  let n = 0;
  for (const a of areas) { const t = origen.areas[a.id!] ?? ''; if (t.trim()) { nuevas[a.id!] = t; n++; } }
  return n ? { ...destino, areas: nuevas } : null;
}
