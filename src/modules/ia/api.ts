// El único lugar que habla con Anthropic. Solo recibe texto (y una imagen de receta) que la pantalla ya decidió enviar.

export type TipoError = 'internet' | 'clave' | 'limite' | 'otro';
export class ErrorIA extends Error {
  constructor(public tipo: TipoError, mensaje: string = tipo) { super(mensaje); }
}

export const MODELO_TEXTO = 'claude-haiku-5-5';
export const MODELO_FOTO = 'claude-sonnet-5-5';
const URL_API = 'https://api.anthropic.com/v1/messages';

export const SISTEMA = 'Eres un apoyo de cocina para una persona que planea sus comidas en casa. Escribes en español de México, con frases cortas y un tono amable. ' +
  'Das ideas prácticas, no consejos médicos ni de dieta, y no juzgas lo que come. No menciones bajar de peso, culpa ni castigos. ' +
  'Responde SOLO con un objeto JSON válido, sin texto antes ni después.';

/** El apoyo de cocina de «Con lo que tengo» y «Sugerir menú»: las reglas duras van en el sistema. */
export const SISTEMA_COCINA = 'Eres un apoyo de cocina para una pareja que planea comidas en casa. Escribes en español de México, con frases cortas y tono amable.\n' +
  'Recibes: (a) ingredientes disponibles, (b) ingredientes que se deben usar pronto, (c) exclusiones de cada persona con su nivel, (d) hasta 15 recetas candidatas con id y nombre, (e) cuántos tiempos de comida hay que llenar.\n' +
  'Reglas duras:\n' +
  '1. No uses NINGÚN ingrediente de las exclusiones de nivel "odio" o "no lo como", de ninguna persona. Tampoco uses combinaciones prohibidas que se te den.\n' +
  '2. Los ingredientes de nivel "no me gusta" solo se evitan como ingrediente principal; los de nivel "prefiero no" evítalos si hay alternativa.\n' +
  '3. Prefiere las recetas candidatas tal cual. Si propones una adaptación, parte de una receta candidata (indica su id) y cambia como máximo 2 ingredientes.\n' +
  '4. Usa primero lo que se debe usar pronto.\n' +
  '5. No des consejos médicos ni de dieta. No menciones calorías, peso, culpa ni castigos. Si dudas, sé neutral.\n' +
  'Responde SOLO con JSON: {"comidas":[{"tiempo":"desayuno|comida|cena|colacion","receta_id":"...","adaptacion":"texto corto o null","usa":["..."],"falta":["..."]}],"nota":"una frase opcional"}';

/** Quien quiera saber cuántos tokens usó cada respuesta (Ajustes > consumo). */
export const ganchos: { uso: ((modelo: string, usage: unknown) => void) | null; /** La función que está pidiendo ahora (la pone la hoja), para contar el gasto por función. */ fn: string | null } = { uso: null, fn: null };

export interface Imagen { tipo: string; base64: string }
export interface Pregunta { modelo: string; texto: string; imagen?: Imagen; /** Varias fotos en un solo pedido (por ejemplo el refrigerador). */ imagenes?: Imagen[]; /** Otro prompt de sistema, si la función trae el suyo. */ sistema?: string; max?: number }

export async function preguntar(p: Pregunta, clave: string, f: typeof fetch = fetch): Promise<string> {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) throw new ErrorIA('internet');
  const contenido: unknown[] = [];
  for (const im of [...(p.imagen ? [p.imagen] : []), ...(p.imagenes ?? [])]) contenido.push({ type: 'image', source: { type: 'base64', media_type: im.tipo, data: im.base64 } });
  contenido.push({ type: 'text', text: p.texto });
  const corte = new AbortController();
  const reloj = setTimeout(() => corte.abort(), 60_000);
  let r: Response;
  try {
    r = await f(URL_API, {
      method: 'POST',
      signal: corte.signal,
      headers: { 'content-type': 'application/json', 'x-api-key': clave, 'anthropic-version': '2023-06-01', 'anthropic-dangerous-direct-browser-access': 'true' },
      body: JSON.stringify({ model: p.modelo, max_tokens: p.max ?? 1500, system: p.sistema ?? SISTEMA, messages: [{ role: 'user', content: contenido }] })
    });
  } catch {
    throw new ErrorIA(corte.signal.aborted ? 'otro' : 'internet');
  } finally {
    clearTimeout(reloj);
  }
  if (r.status === 401 || r.status === 403) throw new ErrorIA('clave');
  if (r.status === 429) throw new ErrorIA('limite');
  if (!r.ok) throw new ErrorIA('otro', 'HTTP ' + r.status);
  const j = (await r.json()) as { content?: { type: string; text?: string }[]; usage?: unknown };
  try { ganchos.uso?.(p.modelo, j.usage); } catch { /* contar no debe romper el pedido */ }
  const t = (j.content ?? []).filter((x) => x.type === 'text').map((x) => x.text ?? '').join('');
  if (!t.trim()) throw new ErrorIA('otro', 'vacío');
  return t;
}

/** Saca el objeto JSON de una respuesta, aunque venga con texto alrededor. */
export function extraerJson(t: string): Record<string, unknown> {
  const a = t.indexOf('{'), z = t.lastIndexOf('}');
  if (a < 0 || z <= a) throw new ErrorIA('otro', 'sin JSON');
  try {
    const v = JSON.parse(t.slice(a, z + 1));
    if (v && typeof v === 'object' && !Array.isArray(v)) return v as Record<string, unknown>;
  } catch { /* cae al error de abajo */ }
  throw new ErrorIA('otro', 'JSON inválido');
}

export async function aBase64(b: Blob): Promise<string> {
  const bytes = new Uint8Array(await b.arrayBuffer());
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}
