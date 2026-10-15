import type { Sesion, Sustituto } from '../../core/db';
import { iso } from '../../core/fechas';
import { cargarPrefs } from '../ajustes';
import { armarPlan, dondeEstas, historialDe, ordenDeGrupos, resumenPR, type DondeEstas, type Historial, type Modo, type Parte, type SesionConSeries } from './calculos';
import { leerAjustes, sesionesConSeries, todosLosSustitutos, type AjustesEntreno } from './datos';
import { gruposDeRutina, programa, type Ejercicio, type Grupo, type Letra, type Programa } from './programa';
import { fechaDia, letraQueToca, proximasLetras, semanaDelPrograma, armarSemana, ultimasMejor, type DiaSemana } from './semana';

/** Todo lo que las pantallas de Entreno necesitan, ya calculado de tus datos. */
export interface Contexto {
  p: Programa;
  aj: AjustesEntreno;
  todas: SesionConSeries[];
  sustitutos: Record<string, Sustituto>;
  /** Sesión de hoy: abierta, terminada o ninguna. */
  hoy: { sesion: Sesion; estado: 'abierta' | 'hecha' } | null;
  letra: Letra;
  /** La rutina que toca por el ciclo, aunque hoy hayas elegido otra. */
  tocaPorCiclo: Letra;
  grupos: Grupo[];
  semana: DiaSemana[];
  semanaN: number;
  llevas: number;
  nth: number;
  anterior: string | null;
  donde: DondeEstas;
  mejor: boolean;
}

export const planDe = (c: Pick<Contexto, 'grupos'>, modo: Modo, primero: 'gym' | 'casa'): Parte[] => armarPlan(c.grupos, modo, primero);

export async function cargarContexto(ahora = new Date()): Promise<Contexto | null> {
  const p = await programa();
  if (!p) return null;
  await cargarPrefs();
  const [aj, todas, susts] = await Promise.all([leerAjustes(), sesionesConSeries(), todosLosSustitutos()]);
  const sesiones = todas.map((x) => x.sesion);
  const hoyIso = iso(ahora);
  const abierta = sesiones.filter((s) => s.abierta).sort((a, b) => b.inicio - a.inicio)[0];
  const hecha = sesiones.filter((s) => !s.abierta && s.fecha === hoyIso && s.tipo === 'rutina').sort((a, b) => b.inicio - a.inicio)[0];
  const hoy = abierta ? { sesion: abierta, estado: 'abierta' as const } : hecha ? { sesion: hecha, estado: 'hecha' as const } : null;
  const elegida = aj.elegida && aj.elegida.fecha === hoyIso && p.rutinas[aj.elegida.letra] ? aj.elegida.letra : null;
  const letra = (hoy?.sesion.rutina ?? elegida ?? letraQueToca(p, sesiones)) as Letra;
  const grupos = gruposDeRutina(p, letra);
  const propias = sesiones.filter((s) => s.tipo === 'rutina' && s.rutina === letra && s.id !== hoy?.sesion.id);
  const previas = hoy ? propias.filter((s) => s.inicio < hoy.sesion.inicio) : propias;
  const nth = previas.length + 1;
  const ultima = [...previas].sort((a, b) => b.inicio - a.inicio)[0];
  const anterior = ultima ? 'el ' + fechaDia(ultima.fecha) : null;

  const previos = grupos.flatMap((g) => g.ejercicios).map((e) => ({ e, series: historialDe(excluir(todas, hoy?.sesion.id), e.clave)[0]?.series ?? [] }));
  const donde = dondeEstas(letra, nth, anterior, '', previos);

  const seguidas = proximasLetras(p, letra, 8);
  const semana = armarSemana(ahora, sesiones, seguidas, aj.cuando.dias, aj.cuando.cardio);
  const terminadas = sesiones.filter((s) => !s.abierta);
  return {
    p, aj, todas, tocaPorCiclo: letraQueToca(p, sesiones)!, sustitutos: Object.fromEntries(susts.map((s) => [s.clave, s])), hoy, letra, grupos, semana,
    semanaN: semanaDelPrograma(sesiones, ahora.getTime()), llevas: terminadas.length, nth, anterior, donde, mejor: ultimasMejor(sesiones)
  };
}

export const excluir = (todas: SesionConSeries[], id?: number) => (id == null ? todas : todas.filter((x) => x.sesion.id !== id));

/** Lo que mostrar de un ejercicio: la vez pasada (sin contar hoy) y tu récord (contando hoy). */
export function datosDeEjercicio(c: Contexto, e: Ejercicio, sust?: string) {
  const previas: Historial[] = historialDe(excluir(c.todas, c.hoy?.sesion.id), e.clave, sust);
  const todas: Historial[] = historialDe(c.todas, e.clave, sust);
  const pr = resumenPR(e.registro, todas);
  return { ultima: previas[0] ?? null, record: pr.record, fechaRecord: pr.fecha };
}

export function ordenado(c: Contexto, modo: Modo, primero: 'gym' | 'casa'): Grupo[] { return ordenDeGrupos(planDe(c, modo, primero)); }
