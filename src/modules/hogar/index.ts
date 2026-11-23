// Puerta pública de Hogar.
import { iso } from '../../core/fechas';
import { hechasDeHoy } from './datos';

export const Hogar = () => import('./Hogar.svelte');
export { interpretar, entendi, type Frase } from './reglas';
export { listarTareas } from './datos';

/** Lo que Inicio muestra de Hogar: cuántas cosas hiciste hoy (solo suma). */
export const resumenDeHogar = (hoy = new Date()): Promise<number> => hechasDeHoy(iso(hoy));
