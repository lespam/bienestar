// Puerta pública de Mente y Alma.
import { diaDePlan, esFinDeSemana, lunesDeSemana } from './semanas';
import { listarMetas, planDeHoy } from './datos';
import type { Meta } from '../../core/db';

export { mensajeDelDia, fraseAlAzar, sembrar } from './mensaje';
export const Mente = () => import('./Mente.svelte');
export const Alma = () => import('./Alma.svelte');
export const Comparar = () => import('./Comparar.svelte');

/** Lo que Inicio muestra de tu planeador hoy. `dia` es -1 en sábado y domingo. */
export async function resumenDePlan(hoy = new Date()): Promise<{ dia: number; texto: string; finDeSemana: boolean }> {
  const dia = diaDePlan(hoy);
  return { dia, texto: await planDeHoy(lunesDeSemana(0, hoy), dia), finDeSemana: esFinDeSemana(hoy) };
}
/** Las metas de tu tablero (Inicio muestra las primeras tres). */
export const metasDelTablero = (): Promise<Meta[]> => listarMetas();
