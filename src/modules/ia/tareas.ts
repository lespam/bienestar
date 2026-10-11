import { ErrorIA, extraerJson, MODELO_FOTO, MODELO_TEXTO, preguntar, type Imagen } from './api';

// Cada función arma exactamente lo que se envía y revisa lo que vuelve. Lo que vuelve nunca se guarda solo:
// la persona lo revisa y decide (por eso aquí no se toca ninguna base de datos).

type Pregunta = typeof preguntar;
const textos = (v: unknown, max: number): string[] =>
  (Array.isArray(v) ? v : []).filter((x): x is string => typeof x === 'string' && !!x.trim()).map((x) => x.trim()).slice(0, max);
const numero = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : null);

// ---------- Leer una receta desde una foto ----------
export interface RecetaLeida { n: string; cat: 'Desayuno' | 'Comida' | 'Cena' | 'Colación'; y: number; t: string; ing: string[]; steps: string[]; k: number | null; p: number | null; c: number | null; g: number | null }
export async function leerRecetaDeFoto(clave: string, imagen: Imagen, ask: Pregunta = preguntar): Promise<RecetaLeida> {
  const t = await ask({
    modelo: MODELO_FOTO, imagen, max: 2500,
    texto: 'La imagen es una receta escrita. Léela y devuelve JSON con estas claves: "n" (nombre), "cat" (Desayuno, Comida, Cena o Colación), "y" (porciones, número), ' +
      '"t" (tiempo, texto corto o vacío), "ing" (lista de líneas de ingredientes, cada una como en la receta, con cantidad y unidad), "steps" (lista de pasos sin numerar), ' +
      'y, solo si la receta los trae escritos, "k" (kcal), "p" (proteína g), "c" (carbohidratos g), "g" (grasa g) por porción. No inventes datos que no estén. Si no se lee una receta, devuelve {"n": ""}.'
  }, clave);
  const j = extraerJson(t);
  const n = typeof j.n === 'string' ? j.n.trim() : '';
  if (!n) throw new ErrorIA('otro', 'sin receta');
  const cat = ['Desayuno', 'Comida', 'Cena', 'Colación'].includes(String(j.cat)) ? (j.cat as RecetaLeida['cat']) : 'Comida';
  return { n, cat, y: Math.max(1, Math.round(numero(j.y) ?? 1)), t: typeof j.t === 'string' ? j.t.trim() : '', ing: textos(j.ing, 60), steps: textos(j.steps, 40), k: numero(j.k), p: numero(j.p), c: numero(j.c), g: numero(j.g) };
}

// ---------- Tips ----------
export async function tipsDeReceta(clave: string, nombre: string, ing: string[], ask: Pregunta = preguntar): Promise<string[]> {
  const t = await ask({ modelo: MODELO_TEXTO, texto: 'Receta: ' + nombre + '\nIngredientes: ' + ing.join('; ') + '\nDa 3 tips cortos para prepararla con menos esfuerzo (una frase cada uno). JSON: {"tips": ["...", "...", "..."]}' }, clave);
  const r = textos(extraerJson(t).tips, 3);
  if (!r.length) throw new ErrorIA('otro', 'sin tips');
  return r;
}
/** Sin datos de la persona: se pide una idea general de cocina. */
export async function tipsGenerales(clave: string, ask: Pregunta = preguntar): Promise<string[]> {
  const t = await ask({ modelo: MODELO_TEXTO, texto: 'Da 3 ideas generales y cortas para cocinar en casa con menos esfuerzo (una frase cada una). JSON: {"tips": ["...", "...", "..."]}' }, clave);
  const r = textos(extraerJson(t).tips, 3);
  if (!r.length) throw new ErrorIA('otro', 'sin tips');
  return r;
}

// ---------- Cambiar ingredientes ----------
export interface CambioIng { ing: string; alt: string }
export async function cambiosDeIngredientes(clave: string, nombre: string, ing: string[], ask: Pregunta = preguntar): Promise<CambioIng[]> {
  const t = await ask({ modelo: MODELO_TEXTO, texto: 'Receta: ' + nombre + '\nIngredientes: ' + ing.join('; ') + '\nPropón hasta 2 cambios posibles si falta un ingrediente. "ing" debe ser uno de los ingredientes tal como está escrito arriba; "alt" es el cambio. JSON: {"cambios": [{"ing": "...", "alt": "..."}]}' }, clave);
  const lista = Array.isArray(extraerJson(t).cambios) ? (extraerJson(t).cambios as unknown[]) : [];
  const r: CambioIng[] = [];
  for (const x of lista) {
    const o = x as { ing?: unknown; alt?: unknown };
    if (typeof o?.ing === 'string' && typeof o.alt === 'string' && o.alt.trim()) r.push({ ing: ing.find((i) => i === o.ing) ?? o.ing.trim(), alt: o.alt.trim() });
  }
  if (!r.length) throw new ErrorIA('otro', 'sin cambios');
  return r.slice(0, 2);
}

// ---------- Ordenar la preparación ----------
export interface CosaPorPreparar { t: string; m?: number }
/** Devuelve las posiciones en el orden sugerido. Si la respuesta no trae todas, no se usa. */
export async function ordenarPreparacion(clave: string, cosas: CosaPorPreparar[], ask: Pregunta = preguntar): Promise<number[]> {
  const lista = cosas.map((c, i) => i + '. ' + c.t + (c.m ? ' (' + c.m + ' min)' : '')).join('\n');
  const t = await ask({ modelo: MODELO_TEXTO, texto: 'Estas cosas se preparan en una sola tanda de cocina:\n' + lista + '\nOrdénalas para que lo que más tarda empiece primero y se aproveche el tiempo. JSON: {"orden": [posiciones, todas, una vez cada una]}' }, clave);
  const o = extraerJson(t).orden;
  const orden = Array.isArray(o) ? o.filter((x): x is number => Number.isInteger(x)) : [];
  const ok = orden.length === cosas.length && new Set(orden).size === cosas.length && orden.every((i) => i >= 0 && i < cosas.length);
  if (!ok) throw new ErrorIA('otro', 'orden inválido');
  return orden;
}

// ---------- Ideas para el menú ----------
export interface RecetaCorta { id: string; n: string }
/** Elige entre las recetas de la persona; lo que no esté en la lista que se envió se descarta. */
export async function ideasDeMenu(clave: string, comida: string, recetas: RecetaCorta[], yaEnMenu: string[], ask: Pregunta = preguntar): Promise<string[]> {
  const t = await ask({ modelo: MODELO_TEXTO, texto: 'Elige hasta 3 ideas para ' + comida.toLowerCase() + ' entre estas recetas (id: nombre):\n' + recetas.map((r) => r.id + ': ' + r.n).join('\n') +
    '\nYa están en el menú de esta semana: ' + (yaEnMenu.join('; ') || 'nada') + '.\nPrefiere las que no se repiten. JSON: {"ids": ["id", "id"]}' }, clave);
  const permitidos = new Set(recetas.map((r) => r.id));
  const ids = [...new Set(textos(extraerJson(t).ids, 6).filter((i) => permitidos.has(i)))].slice(0, 3);
  if (!ids.length) throw new ErrorIA('otro', 'sin ideas');
  return ids;
}
