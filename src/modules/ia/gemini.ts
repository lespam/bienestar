// El único lugar que habla con Gemini (Google). Solo recibe el nombre y los ingredientes que la pantalla ya decidió enviar.
import { ErrorIA } from './api';

/** El modelo de imagen se puede cambiar en Ajustes: Google renombra sus modelos con el tiempo. */
export const MODELO_IMAGEN = 'gemini-2.5-flash-image';
const BASE_API = 'https://generativelanguage.googleapis.com/v1beta/models/';

export interface PedidoImagen { nombre: string; ingredientes: string[] }

/** Lo único que sale del teléfono: el nombre del platillo y sus ingredientes (sin cantidades, notas ni nada de tu registro). */
export function textoDeImagen(p: PedidoImagen): string {
  const ing = [...new Set(p.ingredientes.map((x) => x.trim()).filter(Boolean))].slice(0, 14);
  return 'Ilustración de un platillo casero, vista desde arriba, en un plato sobre una mesa clara, con luz suave y colores cálidos. ' +
    'Estilo de ilustración digital limpia, sin texto, sin letras, sin personas y sin marcas.\n' +
    'Platillo: ' + p.nombre.trim() + '.\n' +
    (ing.length ? 'Ingredientes que se ven: ' + ing.join(', ') + '.' : '');
}

const ERROR_DE_CLAVE = /api key|api_key|permission|unauthenticated/i;

interface Parte { text?: string; inlineData?: { mimeType?: string; data?: string }; inline_data?: { mime_type?: string; data?: string } }
interface Respuesta {
  candidates?: { content?: { parts?: Parte[] }; finishReason?: string }[];
  promptFeedback?: { blockReason?: string };
  error?: { message?: string; status?: string };
}

function aBlob(base64: string, tipo: string): Blob {
  const bin = atob(base64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type: tipo });
}

/** Pide una imagen a Gemini con tu propia clave. Devuelve la imagen para que la revises; no guarda nada. */
export async function generarImagen(p: PedidoImagen, clave: string, modelo: string = MODELO_IMAGEN, f: typeof fetch = fetch): Promise<Blob> {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) throw new ErrorIA('internet');
  const corte = new AbortController();
  const reloj = setTimeout(() => corte.abort(), 90_000);
  let r: Response;
  try {
    r = await f(BASE_API + encodeURIComponent(modelo.trim() || MODELO_IMAGEN) + ':generateContent', {
      method: 'POST',
      signal: corte.signal,
      headers: { 'content-type': 'application/json', 'x-goog-api-key': clave },
      body: JSON.stringify({ contents: [{ parts: [{ text: textoDeImagen(p) }] }], generationConfig: { responseModalities: ['TEXT', 'IMAGE'] } })
    });
  } catch {
    throw new ErrorIA(corte.signal.aborted ? 'otro' : 'internet');
  } finally {
    clearTimeout(reloj);
  }
  let j: Respuesta = {};
  try { j = (await r.json()) as Respuesta; } catch { /* sin cuerpo: se decide por el estado */ }
  if (r.status === 401 || r.status === 403) throw new ErrorIA('clave');
  if (r.status === 400 && ERROR_DE_CLAVE.test(j.error?.message ?? '')) throw new ErrorIA('clave');
  if (r.status === 429) throw new ErrorIA('limite');
  if (r.status === 404) throw new ErrorIA('otro', 'modelo');
  if (!r.ok) throw new ErrorIA('otro', 'HTTP ' + r.status);
  if (j.promptFeedback?.blockReason) throw new ErrorIA('otro', 'bloqueada');
  for (const c of j.candidates ?? []) {
    for (const parte of c.content?.parts ?? []) {
      const d = parte.inlineData ?? (parte.inline_data ? { mimeType: parte.inline_data.mime_type, data: parte.inline_data.data } : undefined);
      if (d?.data) return aBlob(d.data, d.mimeType ?? 'image/png');
    }
  }
  const motivo = j.candidates?.[0]?.finishReason;
  throw new ErrorIA('otro', motivo && motivo !== 'STOP' ? 'bloqueada' : 'vacío');
}
