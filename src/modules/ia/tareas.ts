import { ErrorIA, extraerJson, MODELO_FOTO, MODELO_TEXTO, preguntar, SISTEMA_COCINA, type Imagen } from './api';

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

// ---------- Registrar comida escrita ----------
export interface AlimentoEstimado { n: string; por: string; k: number; p: number; c: number; g: number }
const redondea = (v: unknown, tope: number): number => { const n = numero(v); return n == null ? 0 : Math.round(Math.min(n, tope) * 10) / 10; };
/** Solo se envía el texto que se escribió. Los números que vuelven son estimaciones y se revisan antes de guardar. */
export async function estimarComida(clave: string, texto: string, ask: Pregunta = preguntar): Promise<AlimentoEstimado[]> {
  const t = await ask({
    modelo: MODELO_TEXTO, max: 1200,
    texto: 'Una persona describió lo que comió: «' + texto.trim().slice(0, 600) + '»\nSepara cada alimento y estima la porción más probable y sus valores aproximados. ' +
      'JSON: {"items": [{"n": "nombre", "por": "porción en palabras, por ejemplo 2 piezas", "k": kcal, "p": proteína g, "c": carbohidratos g, "g": grasa g}]}. ' +
      'Son estimaciones, sin juicios sobre si es mucho o poco. Si el texto no habla de comida, devuelve {"items": []}.'
  }, clave);
  return leerEstimados(t);
}
function leerEstimados(t: string): AlimentoEstimado[] {
  const j = extraerJson(t);
  const lista = Array.isArray(j.items) ? (j.items as unknown[]) : [];
  const r: AlimentoEstimado[] = [];
  for (const x of lista.slice(0, 8)) {
    const o = x as Record<string, unknown>;
    if (typeof o?.n !== 'string' || !o.n.trim()) continue;
    r.push({ n: o.n.trim(), por: typeof o.por === 'string' && o.por.trim() ? o.por.trim() : '1 porción', k: Math.round(redondea(o.k, 3000)), p: redondea(o.p, 300), c: redondea(o.c, 500), g: redondea(o.g, 300) });
  }
  if (!r.length) throw new ErrorIA('otro', 'sin alimentos');
  return r;
}

// ---------- Escáner: foto de una etiqueta o de un plato ----------
/** Se envía la foto del plato o la etiqueta y el contexto escrito. La foto no se guarda en la app. */
export async function estimarDeFoto(clave: string, imagen: Imagen, contexto: string, ask: Pregunta = preguntar): Promise<AlimentoEstimado[]> {
  const t = await ask({
    modelo: MODELO_FOTO, imagen, max: 1200,
    texto: 'La imagen es una etiqueta nutrimental o un plato de comida.' + (contexto.trim() ? ' Contexto de la persona: «' + contexto.trim().slice(0, 300) + '».' : '') +
      ' Identifica lo que se ve y estima la porción y sus valores aproximados; si es una etiqueta, usa sus números y ajústalos a la porción que indique el contexto. ' +
      'JSON: {"items": [{"n": "nombre", "por": "porción en palabras", "k": kcal, "p": proteína g, "c": carbohidratos g, "g": grasa g}]}. ' +
      'Son estimaciones, sin juicios. Si no se ve comida ni etiqueta, devuelve {"items": []}.'
  }, clave);
  return leerEstimados(t);
}

// ---------- Resumen de la semana de entrenamiento ----------
export interface SesionResumen { cuando: 'esta semana' | 'la semana anterior'; dia: string; rutina: string; sintio?: string; ejercicios: { nombre: string; series: string }[] }
/** Solo se envían las sesiones de entreno de dos semanas. Nada de peso corporal, medidas ni comida. */
export async function resumenSemanal(clave: string, sesiones: SesionResumen[], sinCifras: boolean, ask: Pregunta = preguntar): Promise<string[]> {
  const t = await ask({
    modelo: MODELO_TEXTO, max: 900,
    texto: 'Estas son las sesiones de fuerza de una persona, de esta semana y de la anterior:\n' + JSON.stringify(sesiones).slice(0, 6000) +
      '\nEscribe un resumen cálido de 3 a 5 puntos cortos: (1) constancia (una sesión parcial también cuenta; no la compares con una meta ni la llames falta), ' +
      '(2) fuerza: qué ejercicios subieron o se mantuvieron frente a la semana anterior, (3) algún patrón útil (por ejemplo cómo se sintió después de entrenar). ' +
      (sinCifras ? 'No escribas números de pesos ni de repeticiones. ' : '') +
      'Sin juicios, sin consejos médicos y sin hablar del cuerpo ni de bajar de peso. JSON: {"puntos": ["...", "..."]}'
  }, clave);
  const r = textos(extraerJson(t).puntos, 5);
  if (!r.length) throw new ErrorIA('otro', 'sin resumen');
  return r;
}

// ---------- Tips de los ejercicios ----------
export interface EjercicioCorto { clave: string; nombre: string; series: string; casa: boolean }
export interface TipEjercicio { clave: string; tip: string }
/** Se envían solo los nombres de los ejercicios, sus series y repeticiones y si se hacen en casa. Un ejercicio o la rutina completa. */
export async function tipsDeEjercicios(clave: string, ejercicios: EjercicioCorto[], ask: Pregunta = preguntar): Promise<TipEjercicio[]> {
  const uno = ejercicios.length === 1;
  const t = await ask({
    modelo: MODELO_TEXTO, max: 900,
    texto: (uno ? 'Ejercicio de fuerza' : 'Rutina de fuerza, en orden') + ' (clave, nombre, series y repeticiones, si es en casa):\n' +
      ejercicios.map((e) => e.clave + ' | ' + e.nombre + ' | ' + e.series + ' | ' + (e.casa ? 'casa' : 'gym')).join('\n') +
      '\nDa ' + (uno ? '3 tips cortos de técnica para este ejercicio' : 'un tip corto de técnica para cada ejercicio, más uno general para la rutina con la clave "rutina"') +
      ' (una frase cada uno: postura, ritmo, respiración o cómo sentir el músculo). Sin consejos médicos y sin hablar del cuerpo ni de bajar de peso. ' +
      'JSON: {"tips": [{"clave": "...", "tip": "..."}]}'
  }, clave);
  const validas = new Set([...ejercicios.map((e) => e.clave), ...(uno ? [] : ['rutina'])]);
  const j = extraerJson(t).tips;
  const r = (Array.isArray(j) ? j : [])
    .map((x) => ({ clave: String((x as TipEjercicio)?.clave ?? ''), tip: typeof (x as TipEjercicio)?.tip === 'string' ? (x as TipEjercicio).tip.trim() : '' }))
    .filter((x) => x.tip && validas.has(x.clave))
    .slice(0, uno ? 3 : ejercicios.length + 1);
  if (!r.length) throw new ErrorIA('otro', 'sin tips');
  return r;
}

// ---------- Con lo que tengo: leer fotos del refrigerador ----------
export interface Hallazgo { n: string; q: string; urgente: boolean }
/** Las fotos ya vienen reducidas. Se leen una sola vez; la persona revisa la lista antes de usarla. */
export async function leerRefri(clave: string, imagenes: Imagen[], texto: string, ask: Pregunta = preguntar): Promise<Hallazgo[]> {
  const t = await ask({
    modelo: MODELO_FOTO, imagenes, max: 1500,
    texto: 'Las imágenes muestran un refrigerador, una alacena o un mostrador.' + (texto.trim() ? ' La persona también escribió: «' + texto.trim().slice(0, 400) + '».' : '') +
      ' Lista los alimentos que se ven, con una cantidad aproximada en palabras (por ejemplo "3 piezas", "medio paquete") y marca "urgente": true si parece que se echará a perder pronto. ' +
      'No inventes lo que no se ve. JSON: {"items": [{"n": "nombre corto", "q": "cantidad aproximada o vacío", "urgente": true|false}]}. Si no se ve comida, devuelve {"items": []}.'
  }, clave);
  const lista = Array.isArray(extraerJson(t).items) ? (extraerJson(t).items as unknown[]) : [];
  const r: Hallazgo[] = [];
  for (const x of lista.slice(0, 60)) {
    const o = x as Record<string, unknown>;
    if (typeof o?.n === 'string' && o.n.trim()) r.push({ n: o.n.trim().slice(0, 60), q: typeof o.q === 'string' ? o.q.trim().slice(0, 40) : '', urgente: o.urgente === true });
  }
  if (!r.length) throw new ErrorIA('otro', 'sin alimentos');
  return r;
}

// ---------- Huecos del plan: ideas de comidas con lo que hay ----------
export type TiempoIA = 'desayuno' | 'comida' | 'cena' | 'colacion';
export interface PeticionCocina {
  disponibles: string[];
  urgentes: string[];
  /** Las exclusiones de los dos por nivel, ya escritas como regla dura. */
  exclusiones: string;
  /** Hasta 15: solo id y nombre. La IA no recibe el catálogo. */
  candidatas: RecetaCorta[];
  tiempos: TiempoIA[];
  prohibidas?: string[];
}
export interface ComidaIA { tiempo: TiempoIA; receta_id: string; adaptacion: string | null; usa: string[]; falta: string[] }
const TIEMPOS_IA: TiempoIA[] = ['desayuno', 'comida', 'cena', 'colacion'];
function leerComidas(t: string, p: PeticionCocina): { comidas: ComidaIA[]; nota: string } {
  const j = extraerJson(t);
  const ids = new Set(p.candidatas.map((c) => c.id));
  const lista = Array.isArray(j.comidas) ? (j.comidas as unknown[]) : [];
  const comidas: ComidaIA[] = [];
  for (const x of lista.slice(0, 14)) {
    const o = x as Record<string, unknown>;
    // Lo que no es una de las candidatas que se enviaron se descarta: la IA no inventa recetas.
    if (typeof o?.receta_id !== 'string' || !ids.has(o.receta_id) || !TIEMPOS_IA.includes(o.tiempo as TiempoIA)) continue;
    comidas.push({ tiempo: o.tiempo as TiempoIA, receta_id: o.receta_id, adaptacion: typeof o.adaptacion === 'string' && o.adaptacion.trim() && o.adaptacion !== 'null' ? o.adaptacion.trim().slice(0, 200) : null, usa: textos(o.usa, 8), falta: textos(o.falta, 8) });
  }
  return { comidas, nota: typeof j.nota === 'string' ? j.nota.trim().slice(0, 200) : '' };
}
function textoPeticion(p: PeticionCocina, rechazos: string[]): string {
  return 'Ingredientes disponibles: ' + (p.disponibles.join(', ') || 'no se dijo') + '\nSe deben usar pronto: ' + (p.urgentes.join(', ') || 'nada en particular') +
    '\nExclusiones:\n' + p.exclusiones + (p.prohibidas?.length ? '\nCombinaciones prohibidas: ' + p.prohibidas.join('; ') : '') +
    '\nRecetas candidatas (id: nombre):\n' + p.candidatas.slice(0, 15).map((c) => c.id + ': ' + c.n).join('\n') +
    '\nTiempos de comida por llenar: ' + p.tiempos.join(', ') +
    (rechazos.length ? '\nLa propuesta anterior no sirvió por esto, evítalo: ' + rechazos.join('; ') : '');
}
/**
 * Una llamada de texto para los huecos. `revisar` es el doble seguro: devuelve por qué se descarta una comida, o null si pasa.
 * Si se descarta todo, se hace una segunda llamada con la lista de rechazos; si también falla, se lanza el error y la pantalla usa las reglas.
 */
export async function proponerComidas(clave: string, p: PeticionCocina, revisar: (c: ComidaIA) => string | null, ask: Pregunta = preguntar): Promise<{ comidas: ComidaIA[]; nota: string }> {
  let rechazos: string[] = [];
  for (let vuelta = 0; vuelta < 2; vuelta++) {
    const t = await ask({ modelo: MODELO_TEXTO, sistema: SISTEMA_COCINA, max: 1500, texto: textoPeticion(p, rechazos) }, clave);
    const { comidas, nota } = leerComidas(t, p);
    const buenas: ComidaIA[] = [];
    const malos: string[] = [];
    for (const c of comidas) { const r = revisar(c); if (r) malos.push(c.receta_id + ' (' + r + ')'); else buenas.push(c); }
    if (buenas.length) return { comidas: buenas, nota };
    rechazos = [...rechazos, ...malos];
  }
  throw new ErrorIA('otro', 'sin propuestas');
}

// ---------- Combinaciones nuevas, acordes a tu plan y tus exclusiones ----------
export interface PeticionCombos {
  /** Las exclusiones de los dos por nivel, ya escritas como regla dura. */
  exclusiones: string;
  /** Ingredientes de las recetas del menú de esta semana. */
  plan: string[];
  /** Títulos de las que ya conoces, para no repetirlas. */
  conocidas: string[];
  /** Parejas que no se deben proponer («huevo + verduras»). */
  prohibidas: string[];
}
export interface ComboNuevo { b: string; t: string; x: string; partes: string[] }
function leerCombos(t: string): ComboNuevo[] {
  const lista = Array.isArray(extraerJson(t).combos) ? (extraerJson(t).combos as unknown[]) : [];
  const r: ComboNuevo[] = [];
  for (const x of lista.slice(0, 6)) {
    const o = x as Record<string, unknown>;
    const titulo = typeof o?.t === 'string' ? o.t.trim().slice(0, 70) : '';
    const porque = typeof o?.x === 'string' ? o.x.trim().slice(0, 260) : '';
    const partes = textos(o?.partes, 3);
    if (!titulo || !porque || partes.length < 2) continue;
    r.push({ b: (typeof o.b === 'string' && o.b.trim() ? o.b.trim() : 'Para probar').slice(0, 40), t: titulo, x: porque, partes });
  }
  return r;
}
const textoCombos = (p: PeticionCombos, rechazos: string[]) =>
  'Propón 3 combinaciones de alimentos que se complementen por sabor o por aprovechar mejor sus nutrientes, distintas de las que ya conozco. Prefiere ingredientes de mi plan de esta semana.' +
  '\nIngredientes de mi plan: ' + (p.plan.join(', ') || 'no se dijo') +
  '\nReglas duras (de las dos personas):\n' + p.exclusiones +
  '\nNo uses ningún ingrediente de nivel «odio» o «no lo como». Los de «no me gusta» no pueden ser parte de la combinación.' +
  (p.prohibidas.length ? '\nParejas prohibidas: ' + p.prohibidas.join('; ') : '') +
  '\nYa las conozco (no las repitas): ' + (p.conocidas.join('; ') || 'ninguna') +
  (rechazos.length ? '\nLa propuesta anterior no sirvió por esto, evítalo: ' + rechazos.join('; ') : '') +
  '\nCada una lleva el porqué en una frase, sin consejos médicos ni de dieta, sin calorías, peso ni culpa.' +
  '\nJSON: {"combos":[{"b":"beneficio en pocas palabras","t":"A + B","x":"por qué en una frase","partes":["A","B"]}]}';
/** Una llamada (dos como máximo) a pedido. `revisar` es el doble seguro: el motivo por el que se descarta una combinación, o null si pasa. */
export async function masCombinaciones(clave: string, p: PeticionCombos, revisar: (c: ComboNuevo) => string | null, ask: Pregunta = preguntar): Promise<ComboNuevo[]> {
  let rechazos: string[] = [];
  for (let vuelta = 0; vuelta < 2; vuelta++) {
    const t = await ask({ modelo: MODELO_TEXTO, max: 1000, texto: textoCombos(p, rechazos) }, clave);
    const buenas: ComboNuevo[] = [], malas: string[] = [];
    for (const c of leerCombos(t)) { const r = revisar(c); if (r) malas.push(c.t + ' (' + r + ')'); else buenas.push(c); }
    if (buenas.length) return buenas.slice(0, 3);
    rechazos = [...rechazos, ...malas];
  }
  throw new ErrorIA('otro', 'sin combinaciones');
}

// ---------- Mis usuales: un ingrediente nuevo a la vez ----------
export interface PeticionUsual {
  usuales: string[];
  exclusiones: string;
  /** Lo que ya dijiste que no te interesa: no vuelve. */
  rechazados: string[];
  /** Hasta 15 de tus recetas (id y nombre). La IA no recibe el catálogo. */
  recetas: RecetaCorta[];
}
export interface IdeaDeUsual { n: string; por: string; recetaIds: string[]; adaptacion: string | null; paso: string }
function leerIdea(t: string, p: PeticionUsual): IdeaDeUsual | null {
  const j = extraerJson(t);
  const n = typeof j.ingrediente === 'string' ? j.ingrediente.trim().slice(0, 50) : '';
  const por = typeof j.por_que === 'string' ? j.por_que.trim().slice(0, 220) : '';
  const paso = typeof j.paso === 'string' ? j.paso.trim().slice(0, 160) : '';
  if (!n || !por || !paso) return null;
  const ids = new Set(p.recetas.map((r) => r.id));
  const recetaIds = textos(j.receta_ids, 2).filter((id) => ids.has(id));
  const adaptacion = typeof j.adaptacion === 'string' && j.adaptacion.trim() && j.adaptacion !== 'null' ? j.adaptacion.trim().slice(0, 200) : null;
  return { n, por, recetaIds, adaptacion, paso };
}
const textoUsual = (p: PeticionUsual, rechazos: string[]) =>
  'Propón UN ingrediente nuevo para sumar a «mis usuales» (lo que tengo siempre en casa o quiero tener).' +
  '\nYa tengo como usuales: ' + (p.usuales.join(', ') || 'ninguno todavía') +
  '\nNo me interesan (no los propongas): ' + (p.rechazados.join(', ') || 'ninguno') +
  '\nReglas duras (de las dos personas):\n' + p.exclusiones +
  '\nNo uses ningún ingrediente de nivel «odio» o «no lo como». Los de «no me gusta» no pueden ser el ingrediente que propongas.' +
  '\nMis recetas (id: nombre):\n' + p.recetas.slice(0, 15).map((r) => r.id + ': ' + r.n).join('\n') +
  (rechazos.length ? '\nLa propuesta anterior no sirvió por esto, evítalo: ' + rechazos.join('; ') : '') +
  '\nDi por qué conviene en una frase corta, por ejemplo «practica el aroma del tomillo» o «cambiar de verduras suma variedad». Sin consejos médicos ni de dieta, sin calorías, peso ni culpa.' +
  '\nElige una o dos de mis recetas donde usarlo (receta_ids) o, si ninguna sirve, una adaptación corta de una de ellas. Termina con un siguiente paso concreto («agrega tomillo a la lista de compras»).' +
  '\nJSON: {"ingrediente":"...","por_que":"...","receta_ids":["..."],"adaptacion":"texto corto o null","paso":"..."}';
/** Una sugerencia a pedido. `revisar` es el doble seguro. Si no pasa, una segunda llamada con lo rechazado. */
export async function ideaDeUsual(clave: string, p: PeticionUsual, revisar: (i: IdeaDeUsual) => string | null, ask: Pregunta = preguntar): Promise<IdeaDeUsual> {
  let rechazos: string[] = [];
  for (let vuelta = 0; vuelta < 2; vuelta++) {
    const t = await ask({ modelo: MODELO_TEXTO, max: 700, texto: textoUsual(p, rechazos) }, clave);
    const i = leerIdea(t, p);
    if (i) {
      const r = revisar(i);
      if (!r) return i;
      rechazos = [...rechazos, i.n + ' (' + r + ')'];
    }
  }
  throw new ErrorIA('otro', 'sin idea');
}

// ---------- Historial de compras: leer un ticket o una captura de pedido ----------
export interface ArticuloLeido { n: string; q: string; precio: number | null }
export interface TicketLeido { fecha: string | null; lugar: string; items: ArticuloLeido[] }
/** La foto ya viene reducida. Se lee una vez; la persona revisa la lista antes de guardar nada. */
export async function leerTicket(clave: string, imagen: Imagen, ask: Pregunta = preguntar): Promise<TicketLeido> {
  const t = await ask({
    modelo: MODELO_FOTO, imagen, max: 2500,
    texto: 'La imagen es un ticket de compra del súper o una captura de un pedido en línea. Lista cada artículo con su nombre tal como aparece, la cantidad si se ve ("2", "1 kg") y el precio de esa línea como número sin símbolo si se ve. ' +
      'Ignora totales, impuestos, propinas, datos de tarjeta y direcciones. No inventes lo que no se lee. ' +
      'JSON: {"fecha": "AAAA-MM-DD o null", "lugar": "nombre de la tienda o vacío", "items": [{"n": "nombre", "q": "cantidad o vacío", "precio": 38.5 o null}]}. Si no es un ticket, devuelve {"items": []}.'
  }, clave);
  const j = extraerJson(t);
  const lista = Array.isArray(j.items) ? (j.items as unknown[]) : [];
  const items: ArticuloLeido[] = [];
  for (const x of lista.slice(0, 120)) {
    const o = x as Record<string, unknown>;
    if (typeof o?.n !== 'string' || !o.n.trim()) continue;
    items.push({ n: o.n.trim().slice(0, 80), q: typeof o.q === 'string' ? o.q.trim().slice(0, 40) : '', precio: numero(o.precio) });
  }
  if (!items.length) throw new ErrorIA('otro', 'sin artículos');
  const fecha = typeof j.fecha === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(j.fecha) ? j.fecha : null;
  return { fecha, lugar: typeof j.lugar === 'string' ? j.lugar.trim().slice(0, 40) : '', items };
}
/** Solo los nombres que aún no se saben unir. Lo que vuelve se guarda y no se vuelve a preguntar. */
export async function unirNombres(clave: string, nombres: string[], ask: Pregunta = preguntar): Promise<Record<string, string>> {
  const piden = nombres.slice(0, 60);
  if (!piden.length) return {};
  const t = await ask({
    modelo: MODELO_TEXTO, max: 1500,
    texto: 'Estos son nombres de artículos de un ticket de súper, algunos en inglés o abreviados. Da para cada uno su nombre común en español de México, en singular y corto (por ejemplo "Tomato sauce" → "Salsa de tomate"). ' +
      'No cambies marcas ni agregues datos. JSON: {"nombres": {"original": "nombre común"}}.\n' + piden.map((n) => '- ' + n).join('\n')
  }, clave);
  const j = extraerJson(t).nombres as Record<string, unknown> | undefined;
  const r: Record<string, string> = {};
  if (j && typeof j === 'object') for (const n of piden) { const v = j[n]; if (typeof v === 'string' && v.trim()) r[n] = v.trim().slice(0, 40); }
  return r;
}
