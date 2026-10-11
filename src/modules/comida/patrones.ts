import type { DiaFlexible, ItemMenu } from '../../core/db';
import { lc } from './calculos';
import { dinero } from './semana';

// Patrones: solo describen. Un color, nada de «mejor» o «peor».

export const SEMANAS_PATRONES = 8;
export const MIN_REGISTROS = 3;

export const PREGUNTAS: { k: 'hora' | 'emo' | 'lugar' | 'sueno' | 'estres'; t: string; op: string[] }[] = [
  { k: 'hora', t: 'Hora', op: ['Mañana', 'Tarde', 'Noche', 'Madrugada'] },
  { k: 'emo', t: 'Cómo te sentías', op: ['Calma', 'Cansancio', 'Estrés', 'Ansiedad', 'Tristeza', 'Aburrimiento', 'Alegría', 'Otra'] },
  { k: 'lugar', t: 'Dónde', op: ['Casa', 'Trabajo', 'Fuera', 'Reunión o fiesta'] },
  { k: 'sueno', t: 'Sueño la noche anterior', op: ['Menos de 6 h', '6 a 8 h', 'Más de 8 h'] },
  { k: 'estres', t: 'Estrés', op: ['Bajo', 'Medio', 'Alto'] }
];

const aMs = (f: string) => Date.UTC(+f.slice(0, 4), +f.slice(5, 7) - 1, +f.slice(8, 10));
/** 0 lunes … 6 domingo. */
export const diaSemana = (f: string) => (new Date(aMs(f)).getUTCDay() + 6) % 7;
export const DIAS3 = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
const DIA_LARGO = ['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo'];
const MESES3 = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
/** "Sáb 26 sep". */
export const fechaBreve = (f: string) => DIAS3[diaSemana(f)] + ' ' + +f.slice(8, 10) + ' ' + MESES3[+f.slice(5, 7) - 1];
export const sumar = (f: string, n: number) => new Date(aMs(f) + n * 864e5).toISOString().slice(0, 10);
export const lunesDe = (f: string) => sumar(f, -diaSemana(f));
/** Cuántas semanas atrás de la de `hoy` cae esa fecha (0 = esta semana). */
export const semanasAtras = (f: string, hoy: string) => Math.round((aMs(lunesDe(hoy)) - aMs(lunesDe(f))) / (7 * 864e5));

// ---------- Días flexibles ----------
export interface RegistroFlex extends DiaFlexible { ciclo: string | null }
export type DimFlex = 'dia' | 'hora' | 'ciclo' | 'sueno';
export const DIMENSIONES: Record<DimFlex, { t: string; op: string[]; de: (r: RegistroFlex) => string | null }> = {
  dia: { t: 'Día', op: DIAS3, de: (r) => DIAS3[diaSemana(r.fecha)] },
  hora: { t: 'Hora', op: ['Mañana', 'Tarde', 'Noche', 'Madrugada'], de: (r) => r.hora || null },
  ciclo: { t: 'Ciclo', op: ['Menstrual', 'Folicular', 'Ovulación', 'Lútea'], de: (r) => r.ciclo },
  sueno: { t: 'Sueño', op: ['Menos de 6 h', '6 a 8 h', 'Más de 8 h'], de: (r) => r.sueno || null }
};

export interface ConteoFlex { op: string[]; cnt: Record<string, number>; conocidos: number; max: number; top: string }
export function contarFlex(regs: RegistroFlex[], dim: DimFlex): ConteoFlex {
  const D = DIMENSIONES[dim];
  const cnt: Record<string, number> = Object.fromEntries(D.op.map((o) => [o, 0]));
  let conocidos = 0;
  for (const r of regs) { const v = D.de(r); if (v && v in cnt) { cnt[v]++; conocidos++; } }
  const mayor = Math.max(...D.op.map((o) => cnt[o]));
  return { op: D.op, cnt, conocidos, max: mayor || 1, top: D.op.find((o) => cnt[o] === mayor)! };
}
export function notaFlex(dim: DimFlex, top: string, n: number, tot: number): string {
  if (dim === 'dia') return n + ' de ' + tot + ' fueron en ' + DIA_LARGO[DIAS3.indexOf(top)] + '. ¿Qué suele pasar ese día?';
  if (dim === 'hora') return n + ' de ' + tot + ' fueron en la ' + lc(top) + '. ¿Cómo llegas a esa hora del día?';
  if (dim === 'ciclo') return n + ' de ' + tot + ' fueron ' + (top === 'Ovulación' ? 'en la ovulación' : 'en la fase ' + lc(top)) + '. Es común que el apetito cambie con el ciclo.';
  return n + ' de ' + tot + ' fueron después de dormir ' + lc(top).replace('h', 'horas') + '. El cansancio también cuenta.';
}
/** Los registros de las últimas 8 semanas, del más nuevo al más viejo. */
export const recientes = (regs: RegistroFlex[], hoy: string) =>
  regs.filter((r) => semanasAtras(r.fecha, hoy) < SEMANAS_PATRONES).sort((a, b) => (a.fecha < b.fecha ? 1 : -1));
export const contextoDe = (r: DiaFlexible) => [r.hora, r.emo, r.lugar, r.sueno && 'Sueño: ' + r.sueno, r.estres && 'Estrés: ' + lc(r.estres)].filter(Boolean) as string[];

// ---------- Menús ----------
export interface PatronMenus { platos: [string, number][]; formas: { f: number; s: number; t: number; l: number }; libresPorLugar: [number, number, number]; total: number }
/** Cómo se comió en las `SEMANAS_PATRONES` semanas pasadas (sin la actual). Un lugar sin plato, o por decidir, cuenta como libre. */
export function patronMenus(items: ItemMenu[], hoy: string): PatronMenus {
  const dentro = items.filter((m) => { const k = semanasAtras(m.fecha, hoy); return k >= 1 && k <= SEMANAS_PATRONES; });
  const platos = new Map<string, number>();
  const formas = { f: 0, s: 0, t: 0, l: 0 };
  const libres: [number, number, number] = [0, 0, 0];
  const LUGARES = ['d', 'c', 'n'];
  const dias = new Set<string>();
  const porLugar = new Map<string, ItemMenu>();
  for (const m of dentro) { if (LUGARES.includes(m.lugar)) porLugar.set(m.fecha + ':' + m.lugar, m); }
  // Todos los días de esas semanas cuentan, aunque no tengan nada
  for (let k = 1; k <= SEMANAS_PATRONES; k++) for (let i = 0; i < 7; i++) dias.add(sumar(lunesDe(hoy), -7 * k + i));
  let total = 0;
  for (const f of dias) LUGARES.forEach((l, i) => {
    total++;
    const m = porLugar.get(f + ':' + l);
    if (!m || m.t === 'decidir') { formas.l++; libres[i]++; return; }
    if (m.t === 'takeout') { formas.t++; return; }
    if (m.t === 'cada') { formas.s++; for (const n of new Set([m.nl, m.nj])) if (n) platos.set(n, (platos.get(n) ?? 0) + 1); return; }
    formas.f++;
    if (m.n) platos.set(m.n, (platos.get(m.n) ?? 0) + 1);
  });
  return { platos: [...platos].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'es')).slice(0, 5), formas, libresPorLugar: libres, total: total / 3 };
}
export const LUGAR_PLURAL = ['Los desayunos', 'Las comidas', 'Las cenas'];

// ---------- Takeouts ----------
export interface PatronTakeout {
  total8: number; porSemana8: number;
  mesActual: { n: number; total: number }; mesPasado: { n: number; total: number };
  semanas: [string, number][]; lugares: [string, number][]; dias: [string, number][];
  nombreMesActual: string; nombreMesPasado: string; hay: boolean;
}
export function patronTakeout(items: ItemMenu[], hoy: string): PatronTakeout {
  const rows = items.filter((m) => m.t === 'takeout' && semanasAtras(m.fecha, hoy) >= 0 && semanasAtras(m.fecha, hoy) <= SEMANAS_PATRONES).map((m) => ({ ...m, k: semanasAtras(m.fecha, hoy), costo: m.costo ?? 0 }));
  const y = +hoy.slice(0, 4), mes = +hoy.slice(5, 7) - 1;
  const py = mes === 0 ? y - 1 : y, pm = mes === 0 ? 11 : mes - 1;
  const en = (r: { fecha: string }, yy: number, mm: number) => +r.fecha.slice(0, 4) === yy && +r.fecha.slice(5, 7) - 1 === mm;
  const suma = (rs: { costo: number }[]) => ({ n: rs.length, total: rs.reduce((a, r) => a + r.costo, 0) });
  const semanas: [string, number][] = [];
  for (let k = SEMANAS_PATRONES; k >= 0; k--) {
    const lunes = sumar(lunesDe(hoy), -7 * k);
    semanas.push([k === 0 ? 'Esta semana' : +lunes.slice(8, 10) + ' ' + MESES3[+lunes.slice(5, 7) - 1], rows.filter((r) => r.k === k).reduce((a, r) => a + r.costo, 0)]);
  }
  const pasadas = rows.filter((r) => r.k >= 1);
  const lugares = new Map<string, number>();
  const dias = [0, 0, 0, 0, 0, 0, 0];
  for (const r of pasadas) { lugares.set(r.n, (lugares.get(r.n) ?? 0) + 1); dias[diaSemana(r.fecha)]++; }
  const total8 = pasadas.reduce((a, r) => a + r.costo, 0);
  return {
    total8, porSemana8: total8 / SEMANAS_PATRONES,
    mesActual: suma(rows.filter((r) => en(r, y, mes))), mesPasado: suma(rows.filter((r) => en(r, py, pm))),
    semanas, lugares: [...lugares].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'es')), dias: DIAS3.map((n, i) => [n, dias[i]]),
    nombreMesActual: MESES[mes], nombreMesPasado: MESES[pm], hay: rows.length > 0
  };
}
export const vecesTxt = (n: number) => (n === 1 ? '1 vez' : n + ' veces');
export { dinero };
