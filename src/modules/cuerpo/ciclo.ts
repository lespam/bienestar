import { db } from '../../core/db';

// La fase del ciclo sale del calendario de Período: nunca se guarda. Es una estimación para que
// Día flexible y Patrones tengan contexto, no un dato médico.

export type Fase = 'Menstrual' | 'Folicular' | 'Ovulación' | 'Lútea';
export interface EtapaCiclo { fase: Fase; dia: number }

const MS = 864e5;
const aMs = (f: string) => Date.UTC(+f.slice(0, 4), +f.slice(5, 7) - 1, +f.slice(8, 10));
const dif = (a: string, b: string) => Math.round((aMs(b) - aMs(a)) / MS);
export const LARGO_USUAL = 28;

/** Cada racha de días marcados seguidos es un Período: empieza ahí y dura tantos días. */
export function periodos(marcados: string[]): { inicio: string; dias: number }[] {
  const fs = [...new Set(marcados)].sort();
  const out: { inicio: string; dias: number }[] = [];
  for (const f of fs) {
    const u = out[out.length - 1];
    if (u && dif(u.inicio, f) === u.dias) u.dias++;
    else out.push({ inicio: f, dias: 1 });
  }
  return out;
}

/** Largo del ciclo: el promedio de los últimos 3 entre inicios; con un solo inicio, 28. */
export function largoDelCiclo(ps: { inicio: string }[]): number {
  if (ps.length < 2) return LARGO_USUAL;
  const ult = ps.slice(-4);
  const gaps = ult.slice(1).map((p, i) => dif(ult[i].inicio, p.inicio));
  const prom = Math.round(gaps.reduce((a, g) => a + g, 0) / gaps.length);
  return Math.min(35, Math.max(21, prom));
}

/** En qué fase estaba ese día, o null si no hay un Período marcado reciente. */
export function faseEn(fecha: string, marcados: string[]): EtapaCiclo | null {
  const ps = periodos(marcados).filter((p) => p.inicio <= fecha);
  const p = ps[ps.length - 1];
  if (!p) return null;
  const largo = largoDelCiclo(ps);
  const dia = dif(p.inicio, fecha) + 1;
  if (dia > largo + 7) return null;
  const mens = Math.min(7, Math.max(1, p.dias));
  const ovu = largo - 14;
  if (dia <= mens) return { fase: 'Menstrual', dia };
  if (dia < ovu - 1) return { fase: 'Folicular', dia };
  if (dia <= ovu + 1) return { fase: 'Ovulación', dia };
  return { fase: 'Lútea', dia };
}

export const etapaTxt = (e: EtapaCiclo) => (e.fase === 'Ovulación' ? 'Ovulación' : 'Fase ' + e.fase.toLowerCase()) + ' · día ' + e.dia + ' del ciclo';

/** Las fases de varios días a la vez, leyendo el calendario una sola vez. */
export async function fasesEn(fechas: string[]): Promise<Record<string, EtapaCiclo | null>> {
  const marcados = (await db.periodo.toArray()).map((d) => d.fecha);
  return Object.fromEntries(fechas.map((f) => [f, faseEn(f, marcados)]));
}
