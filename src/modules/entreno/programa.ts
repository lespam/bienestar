import { parte } from '../../core/contenido';

// El programa llega en el contenido personal y no se edita (plan, punto 3a).
export type CampoReg = 'peso' | 'reps' | 'repsIzq' | 'repsDer' | 'seg' | 'segIzq' | 'segDer' | 'pasosIzq' | 'pasosDer';
export type Letra = 'A' | 'B' | 'C';

export interface EjercicioPrograma { nombre: string; pagina: number; registro: CampoReg[]; gym: boolean; anim?: string }
export interface ItemRutina { codigo: string; clave: string; series: number; rango: string }
export interface GrupoRutina { tipo: 'superserie' | 'suelto'; ejercicios: ItemRutina[] }
export interface BloqueCalentamiento { nombre: string; elementos: { nombre: string; pagina: number | null }[] }
export interface Calentamiento { para: Letra[]; paginas: string; bloques: BloqueCalentamiento[] }
export interface Programa {
  alcance: string;
  nombre?: string;
  reglas?: string[];
  semanas: { desde: number; hasta: number; rutinas: Letra[] }[];
  rutinas: Record<string, { pagina: number; grupos: GrupoRutina[] }>;
  ejercicios: Record<string, EjercicioPrograma>;
  calentamientos?: Calentamiento[];
}

export async function programa() { return parte<Programa>('programa'); }

/** Un ejercicio de la rutina, con todo lo que las pantallas necesitan. */
export interface Ejercicio extends ItemRutina { nombre: string; pagina: number; registro: CampoReg[]; gym: boolean; anim?: string }
export interface Grupo { tipo: 'superserie' | 'suelto'; etiqueta?: string; ejercicios: Ejercicio[] }

export function gruposDeRutina(p: Programa, letra: Letra): Grupo[] {
  const r = p.rutinas[letra];
  if (!r) return [];
  let sup = 0;
  return r.grupos.map((g) => ({
    tipo: g.tipo,
    etiqueta: g.tipo === 'superserie' ? 'Superserie ' + 'AB'[sup++] + ' · alterna ' + g.ejercicios.map((e) => e.codigo).join(' y ') : undefined,
    ejercicios: g.ejercicios.map((e) => ({ ...e, ...p.ejercicios[e.clave] }))
  }));
}

export const tieneGym = (g: Grupo) => g.ejercicios.some((e) => e.gym);

/** Semanas 1-2 usan las mismas rutinas; si ya pasaste las semanas cargadas, se repite la última. */
export function semanaDelPrograma(p: Programa, semana: number) {
  const hasta = Math.max(...p.semanas.map((s) => s.hasta));
  return { semana, usada: p.semanas.find((s) => semana >= s.desde && semana <= s.hasta) ?? p.semanas[p.semanas.length - 1], pasada: semana > hasta };
}

/** Dónde aparece un ejercicio en las rutinas: letra, código, series y rango. */
export function buscarEjercicio(p: Programa, clave: string): { letra: Letra; item: ItemRutina; ejercicio: Ejercicio } | null {
  for (const letra of Object.keys(p.rutinas) as Letra[]) {
    for (const g of p.rutinas[letra].grupos) {
      const item = g.ejercicios.find((e) => e.clave === clave);
      if (item && p.ejercicios[clave]) return { letra, item, ejercicio: { ...item, ...p.ejercicios[clave] } };
    }
  }
  return null;
}

/** Solo links web. Agrega https:// si falta y descarta cualquier otro esquema. */
export function enlaceSeguro(u: string): string | null {
  const t = u.trim();
  if (!t) return null;
  const con = /^[a-z][a-z0-9+.-]*:/i.test(t) ? t : 'https://' + t;
  try { const x = new URL(con); return x.protocol === 'https:' || x.protocol === 'http:' ? x.href : null; } catch { return null; }
}
