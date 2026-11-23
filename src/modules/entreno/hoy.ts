import { contarFuncion } from '../../core/uso';
import { ejerciciosEmpezados, llave } from './calculos';
import { cargarContexto } from './contexto';
import { guardarAjuste, iniciarSesion, terminarSesion } from './datos';
import { iso } from '../../core/fechas';
import { programa, type Letra } from './programa';
import { horaCorta } from './semana';

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
  contarFuncion('rutina-empezar');
  return s.id ?? null;
}

export async function terminarHoy(id: number) { await terminarSesion(id); }

/** Las rutinas del programa que cargaste («A», «B», «C»). */
export async function letrasDeRutina(): Promise<string[]> {
  const p = await programa();
  return p ? Object.keys(p.rutinas) : [];
}

export type EleccionDeHoy = { ok: true; deshacer: () => Promise<void> } | { ok: false; motivo: 'sin-programa' | 'no-existe' | 'ya-hay-sesion' };
/** «Hoy hago la rutina C»: lo mismo que elegirla en Rutina. Vale solo hoy y solo si todavía no empiezas ninguna. */
export async function elegirRutinaHoy(letra: string, ahora = new Date()): Promise<EleccionDeHoy> {
  const c = await cargarContexto(ahora);
  if (!c) return { ok: false, motivo: 'sin-programa' };
  const l = letra.toUpperCase() as Letra;
  if (!c.p.rutinas[l]) return { ok: false, motivo: 'no-existe' };
  if (c.hoy) return { ok: false, motivo: 'ya-hay-sesion' };
  const hoyIso = iso(ahora);
  const antesElegida = c.aj.elegida, antesCardio = c.aj.cardioHoy;
  await guardarAjuste('elegida', l === c.tocaPorCiclo ? null : { letra: l, fecha: hoyIso });
  await guardarAjuste('cardioHoy', c.cardioHoy || c.aj.cuando.cardio?.[(ahora.getDay() + 6) % 7] ? { fecha: hoyIso, si: false } : null);
  contarFuncion('rutina-elegir');
  return { ok: true, deshacer: async () => { await guardarAjuste('elegida', antesElegida); await guardarAjuste('cardioHoy', antesCardio); } };
}
