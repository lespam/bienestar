import { parte } from '../../core/contenido';

// El programa llega en el contenido personal y no se edita (plan, punto 3a).
export interface EjercicioPrograma { nombre: string; pagina: number; registro: string[]; gym: boolean }
export interface Programa {
  alcance: string;
  semanas: { desde: number; hasta: number; rutinas: string[] }[];
  rutinas: Record<string, { pagina: number; grupos: { tipo: 'superserie' | 'suelto'; ejercicios: { codigo: string; clave: string; series: number; rango: string }[] }[] }>;
  ejercicios: Record<string, EjercicioPrograma>;
}

export async function programa() { return parte<Programa>('programa'); }

/** La rutina que toca. En la fase 1 todavía no hay sesiones, así que es la primera de la semana 1. */
export async function rutinaDeHoy(): Promise<{ letra: string; ejercicios: number; enGym: number } | null> {
  const p = await programa();
  if (!p) return null;
  const letra = p.semanas[0]?.rutinas[0];
  const r = letra ? p.rutinas[letra] : null;
  if (!r) return null;
  const todos = r.grupos.flatMap((g) => g.ejercicios);
  return { letra, ejercicios: todos.length, enGym: todos.filter((e) => p.ejercicios[e.clave]?.gym).length };
}
