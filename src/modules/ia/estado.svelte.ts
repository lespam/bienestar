import { db } from '../../core/db';

// La IA es opcional y empieza apagada. Todo vive en tu teléfono: la clave nunca sale en el respaldo
// (CLAVES_PRIVADAS) y la pantalla solo guarda si hay una y sus últimos 4 caracteres.

export type FnIA = 'foto' | 'tips' | 'ing' | 'prep' | 'idea' | 'comida' | 'escaner' | 'resumen' | 'entreno';
/** Nombre de cada función en Ajustes y qué datos se envían (el aviso se arma con este texto). */
export const FUNCIONES: Record<FnIA, [string, string]> = {
  foto: ['Leer recetas desde una foto', 'la imagen de la receta'],
  tips: ['Tips de preparación', 'el nombre y los ingredientes de la receta'],
  ing: ['Cambiar ingredientes', 'el nombre y los ingredientes de la receta'],
  prep: ['Ordenar mi preparación', 'los nombres y tiempos de tus tandas'],
  idea: ['Ideas para el menú', 'los nombres de tus recetas y qué comidas están libres'],
  comida: ['Registrar comida escrita', 'solo el texto que escribas sobre lo que comiste'],
  escaner: ['Escáner de etiqueta o plato', 'la foto del plato o la etiqueta y el contexto que escribas'],
  resumen: ['Resumen de la semana', 'tus sesiones de entreno de dos semanas: ejercicios, pesos y repeticiones, y cómo te sentiste'],
  entreno: ['Tips de ejercicios', 'los nombres de los ejercicios de la rutina, sus series y repeticiones']
};
export const NUNCA_SE_ENVIA = 'Nunca se envía: tu peso, medidas, fotos de cuerpo, calorías ni tu registro de comidas.';

const FN_INICIAL = (): Record<FnIA, boolean> => ({ foto: true, tips: true, ing: true, prep: true, idea: true, comida: true, escaner: true, resumen: true, entreno: true });

export const ia = $state({ cargada: false, on: false, fn: FN_INICIAL(), vistas: {} as Record<string, boolean>, tieneClave: false, fin: '' });

const leer = async <T,>(k: string, def: T): Promise<T> => ((await db.ajustes.get(k))?.v as T | undefined) ?? def;
const poner = (k: string, v: unknown) => db.ajustes.put({ k, v });

/** Lee de nuevo todo. Se llama al abrir Ajustes y antes de cada pedido. */
export async function cargarIA() {
  ia.on = await leer('ia.on', false);
  ia.fn = { ...FN_INICIAL(), ...(await leer<Partial<Record<FnIA, boolean>>>('ia.fn', {})) };
  ia.vistas = await leer('ia.vistas', {});
  const c = await leer('ia.clave', '');
  ia.tieneClave = !!c;
  ia.fin = c ? c.slice(-4) : '';
  ia.cargada = true;
}
export async function leerClave(): Promise<string> { return leer('ia.clave', ''); }

export async function ponerUsarIA(v: boolean) { ia.on = v; await poner('ia.on', v); }
export async function ponerFuncion(k: FnIA, v: boolean) { ia.fn[k] = v; await poner('ia.fn', $state.snapshot(ia.fn)); }
/** Después del aviso de la primera vez, esa función ya no lo repite. */
export async function marcarAvisada(k: FnIA) { ia.vistas = { ...ia.vistas, [k]: true }; await poner('ia.vistas', $state.snapshot(ia.vistas)); }

export const claveValida = (v: string) => /^sk-ant-[\w-]{8,}$/.test(v.trim());
export async function guardarClave(v: string) {
  const c = v.trim();
  await poner('ia.clave', c);
  ia.tieneClave = true; ia.fin = c.slice(-4);
}
export async function quitarClave() {
  await db.ajustes.delete('ia.clave');
  ia.tieneClave = false; ia.fin = '';
}
