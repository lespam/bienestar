import { ejerciciosEmpezados, llave } from './calculos';
import { cargarContexto } from './contexto';
import { iniciarSesion, terminarSesion } from './datos';
import { horaCorta } from './semana';
import type { Letra } from './programa';

// Lo que otros módulos (Inicio) saben de tu entrenamiento de hoy. Todo se calcula; nada se guarda aquí.
export interface ResumenHoy {
  letra: Letra;
  ejercicios: number;
  enGym: number;
  estado: 'nueva' | 'abierta' | 'hecha';
  empezados: number;
  sesion?: number;
  /** "7 pm, en la sala" si hoy es día de entrenar. */
  cuando: string;
  mejor: boolean;
}

export async function resumenDeHoy(ahora = new Date()): Promise<ResumenHoy | null> {
  const c = await cargarContexto(ahora);
  if (!c) return null;
  const todos = c.grupos.flatMap((g) => g.ejercicios);
  const serieDeHoy = c.todas.find((x) => x.sesion.id === c.hoy?.sesion.id)?.series ?? [];
  const toca = c.aj.cuando.dias[(ahora.getDay() + 6) % 7];
  return {
    letra: c.letra,
    ejercicios: todos.length,
    enGym: todos.filter((e) => e.gym).length,
    estado: c.hoy?.estado ?? 'nueva',
    empezados: ejerciciosEmpezados(c.grupos, new Set(serieDeHoy.map((s) => llave(s.clave, s.n)))),
    sesion: c.hoy?.sesion.id,
    cuando: toca ? horaCorta(c.aj.cuando.hora) + (c.aj.cuando.lugar ? ', ' + c.aj.cuando.lugar : '') : '',
    mejor: c.mejor
  };
}

/** Empieza (o sigue) la sesión de hoy con lo último que elegiste en Rutina. */
export async function empezarHoy(): Promise<number | null> {
  const c = await cargarContexto();
  if (!c) return null;
  const s = await iniciarSesion(c.letra, c.aj.modo, c.aj.primero);
  return s.id ?? null;
}

export async function terminarHoy(id: number) { await terminarSesion(id); }
