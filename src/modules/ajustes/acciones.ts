import { crearZip, nombreRespaldo } from '../../core/respaldo';
import { marcarEntrega } from '../../core/continuidad';
import { entregarArchivo, elegirArchivo } from '../../core/archivos';
import { cargarContenido, type ResultadoCarga } from '../../core/contenido';
import { guardar } from './prefs.svelte';
import { plataforma } from '../../core/plataforma.svelte';

/** Exporta el ZIP. Devuelve el texto del aviso, o null si cancelaste. */
export async function hacerRespaldo(): Promise<string | null> {
  const ahora = new Date();
  const nombre = nombreRespaldo(ahora);
  const r = await entregarArchivo(nombre, await crearZip(ahora));
  if (r === 'cancelado') return null;
  await guardar('ultimoRespaldo', ahora.getTime());
  // Lo que salió en este archivo cuenta como el último intercambio: lo que cambies después se verá como cambio de aquí.
  await marcarEntrega();
  return 'Listo: ' + nombre + '. Guárdalo en Drive o llévalo a tu computadora.';
}

/** Elige y carga el archivo de contenido personal. null si no eligió nada. */
export async function elegirContenido(alElegir?: () => void): Promise<ResultadoCarga | null> {
  const f = await elegirArchivo();
  if (!f) return null;
  alElegir?.();
  const r = await cargarContenido(f.bytes);
  if (r.ok) await plataforma.pedirGuardado();
  return r;
}
