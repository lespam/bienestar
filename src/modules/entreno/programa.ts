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

/** La rutina que toca. Se reemplaza por la lógica con sesiones más adelante en la fase 2. */
export async function rutinaDeHoy(): Promise<{ letra: string; ejercicios: number; enGym: number } | null> {
  const p = await programa();
  if (!p) return null;
  const letra = p.semanas[0]?.rutinas[0];
  const r = letra ? p.rutinas[letra] : null;
  if (!r) return null;
  const todos = r.grupos.flatMap((g) => g.ejercicios);
  return { letra, ejercicios: todos.length, enGym: todos.filter((e) => p.ejercicios[e.clave]?.gym).length };
}
