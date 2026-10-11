// Puerta pública de Entreno. Las pantallas se cargan cuando las abres.
export { programa } from './programa';
export type { Programa } from './programa';
export { resumenDeHoy, empezarHoy, terminarHoy } from './hoy';
export type { ResumenHoy } from './hoy';
export const Rutina = () => import('./Rutina.svelte');
export const Curso = () => import('./Curso.svelte');
export const Ficha = () => import('./Ficha.svelte');
export const Descanso = () => import('./DescansoEntreno.svelte');
export const Calentar = () => import('./Calentar.svelte');
export const RegistroPR = () => import('./PR.svelte');
export const Fin = () => import('./Fin.svelte');
export const Cardio = () => import('./Cardio.svelte');
