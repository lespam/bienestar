import { prefs } from '../ajustes';
import type { LugarMenu } from '../../core/db';

// Lo que Perfiles y Recetario comparten mientras estás en Comida: los números que mostraste con "Mostrar"
// (solo hasta salir de Comida) y los filtros de la lista de recetas.
export const vista = $state({ ver: false, cat: 'todo', q: '', vin: false, cambio: 0 });

/** Filtros de fuente y de lo que no le gusta a alguien: los mismos en el Recetario y en las Tarjetas. */
export const filtros = $state({ origen: 'todo', sinLes: false, sinJeff: false });

export const numerosVisibles = () => !prefs.ocultarComida || vista.ver;

export function reiniciarVista() { vista.ver = false; vista.cat = 'todo'; vista.q = ''; }

/**
 * Elegir una receta para un lugar del menú: el menú abre el Recetario y vuelve cuando eliges.
 * modo `dos`: los dos comen lo mismo. `les` y después `jeff`: cada quien lo suyo.
 */
export interface Eleccion { fecha: string; lugar: LugarMenu; modo: 'dos' | 'les' | 'jeff'; les?: { id: string; n: string } }
export const eleccion = $state<{ actual: Eleccion | null }>({ actual: null });

/** Elegir con tarjetas: lo que llevas elegido se queda mientras no cierres la app. */
export interface EstadoTarjetas { cat: string; liked: string[]; passed: string[]; hist: { id: string; dir: 'yes' | 'no' }[]; fotos: boolean; sel: string | null }
export const tarjetas = $state<EstadoTarjetas>({ cat: 'todo', liked: [], passed: [], hist: [], fotos: true, sel: null });
export function reiniciarTarjetas() { tarjetas.cat = 'todo'; tarjetas.liked = []; tarjetas.passed = []; tarjetas.hist = []; tarjetas.fotos = true; tarjetas.sel = null; }
