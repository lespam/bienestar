import { prefs } from '../ajustes';

// Lo que Perfiles y Recetario comparten mientras estás en Comida: los números que mostraste con "Mostrar"
// (solo hasta salir de Comida) y los filtros de la lista de recetas.
export const vista = $state({ ver: false, cat: 'todo', q: '', vin: false, cambio: 0 });

export const numerosVisibles = () => !prefs.ocultarComida || vista.ver;

export function reiniciarVista() { vista.ver = false; vista.cat = 'todo'; vista.q = ''; }
