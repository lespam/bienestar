// Puerta pública de Ajustes.
export { prefs, cargarPrefs, guardar, tocaRespaldo, ahoraNoRespaldo, enlaceObsidian } from './prefs.svelte';
export type { Prefs } from './prefs.svelte';
export { hacerRespaldo, elegirContenido } from './acciones';
export const Ajustes = () => import('./Ajustes.svelte');
export const Bienvenida = () => import('./Bienvenida.svelte');
