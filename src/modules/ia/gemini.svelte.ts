import { db } from '../../core/db';
import { MODELO_IMAGEN } from './gemini';

// Gemini es opcional y empieza apagado, aparte de la IA de Claude. Mismo contrato: tu propia clave, solo en este teléfono
// (GEMINI_CLAVE está en CLAVES_PRIVADAS: nunca sale en el respaldo) y la pantalla dice qué se envía.

export const GEMINI_CLAVE = 'gem.clave';
export const QUE_ENVIA_GEMINI = 'el nombre y los ingredientes de la receta';

export const gem = $state({ cargada: false, on: false, tieneClave: false, fin: '', vista: false, modelo: MODELO_IMAGEN });

const leer = async <T,>(k: string, def: T): Promise<T> => ((await db.ajustes.get(k))?.v as T | undefined) ?? def;
const poner = (k: string, v: unknown) => db.ajustes.put({ k, v });

export async function cargarGemini() {
  gem.on = await leer('gem.on', false);
  gem.vista = await leer('gem.vista', false);
  gem.modelo = (await leer('gem.modelo', MODELO_IMAGEN)) || MODELO_IMAGEN;
  const c = await leer(GEMINI_CLAVE, '');
  gem.tieneClave = !!c;
  gem.fin = c ? c.slice(-4) : '';
  gem.cargada = true;
}
/** Gemini está prendido y con clave: solo así se muestra «Generar imagen». */
export const geminiLista = () => gem.cargada && gem.on && gem.tieneClave;
export const leerClaveGemini = () => leer(GEMINI_CLAVE, '');

export async function ponerUsarGemini(v: boolean) { gem.on = v; await poner('gem.on', v); }
/** Las claves de Google AI Studio empiezan con «AIza». */
export const claveGeminiValida = (v: string) => /^AIza[\w-]{20,}$/.test(v.trim());
export async function guardarClaveGemini(v: string) {
  const c = v.trim();
  await poner(GEMINI_CLAVE, c);
  gem.tieneClave = true; gem.fin = c.slice(-4);
}
export async function quitarClaveGemini() {
  await db.ajustes.delete(GEMINI_CLAVE);
  gem.tieneClave = false; gem.fin = '';
}
export async function ponerModeloGemini(v: string) {
  const m = v.trim() || MODELO_IMAGEN;
  gem.modelo = m;
  if (m === MODELO_IMAGEN) await db.ajustes.delete('gem.modelo'); else await poner('gem.modelo', m);
}
/** Después del aviso de la primera vez, ya no se repite. */
export async function marcarGeminiAvisado() { gem.vista = true; await poner('gem.vista', true); }
