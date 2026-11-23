import type { TareaHogar } from '../../core/db';

// Hogar: todo el orden, el filtrado y la previsión son reglas locales. No usan IA.
// El tono es neutral: no hay «atrasada», no hay rojos; lo que no haces solo pasa a «después».

export type Energia = 'poca' | 'media' | 'buena';
export const ENERGIAS: [Energia, string][] = [['poca', 'Poca'], ['media', 'Media'], ['buena', 'Buena']];
export const TIEMPOS = [5, 15, 30, 60];
/** Cuánto cuesta una tarea, como máximo, con cada nivel de energía. */
export const TOPE_ENERGIA: Record<Energia, number> = { poca: 1, media: 2, buena: 3 };
/** Lo máximo que eliges para hoy (igual que en Alma). */
export const MAXIMO_HOY = 3;

export interface Capacidad { energia: Energia; tiempo: number }
export type Cabe = 'completa' | 'minima' | null;

const DIA = 86_400_000;
const aFecha = (f: string) => { const [a, m, d] = f.split('-').map(Number); return Date.UTC(a, m - 1, d); };
export function sumarDias(f: string, n: number): string {
  const d = new Date(aFecha(f) + n * DIA);
  return d.getUTCFullYear() + '-' + String(d.getUTCMonth() + 1).padStart(2, '0') + '-' + String(d.getUTCDate()).padStart(2, '0');
}
/** Días desde la última vez, o `null` si no hay registro. */
export function diasDesde(t: Pick<TareaHogar, 'ult'>, hoy: string): number | null {
  return t.ult ? Math.max(0, Math.round((aFecha(hoy) - aFecha(t.ult)) / DIA)) : null;
}
/** Minutos de la versión mínima: los que anotaste o, si no, un tercio con piso de 2. */
export const minutosMinima = (t: TareaHogar) => t.minima ? (t.minMin ?? Math.max(2, Math.round(t.min / 3))) : 0;

/** ¿Cabe en tu tiempo y energía? Completa, en versión mínima, o no. */
export function cabe(t: TareaHogar, c: Capacidad): Cabe {
  if (t.min <= c.tiempo && t.e <= TOPE_ENERGIA[c.energia]) return 'completa';
  // La versión mínima siempre pide poca energía.
  if (t.minima && minutosMinima(t) <= c.tiempo) return 'minima';
  return null;
}

/** Qué tan vencida está: días desde la última vez ÷ cada cuánto. Sin registro cuenta como 1. */
export function vencida(t: TareaHogar, hoy: string): number {
  const d = diasDesde(t, hoy);
  if (d == null) return 1;
  return Math.min(3, d / Math.max(1, t.cada));
}
/** Qué tan bien cabe: 1 cuando llena bien tu tiempo, menos si sobra mucho, 0.4 si solo cabe la versión mínima. */
export function ajuste(t: TareaHogar, c: Capacidad): number {
  const k = cabe(t, c);
  if (!k) return 0;
  if (k === 'minima') return 0.4;
  return 0.5 + 0.5 * Math.min(1, t.min / c.tiempo);
}

export interface Sugerida { t: TareaHogar; cabe: 'completa' | 'minima'; puntaje: number }
/** Las tareas que caben hoy, de la que más conviene a la que menos. `elegidas` da el bono por zona compartida. */
export function ordenar(tareas: TareaHogar[], c: Capacidad, hoy: string, quitar: Set<number>, elegidas: TareaHogar[] = []): Sugerida[] {
  const zonas = new Set(elegidas.map((e) => norm(e.zona)));
  const lista: Sugerida[] = [];
  for (const t of tareas) {
    if (t.id == null || quitar.has(t.id) || t.ult === hoy) continue;
    const k = cabe(t, c);
    if (!k) continue;
    const zona = zonas.has(norm(t.zona)) ? 0.5 : 0;
    lista.push({ t, cabe: k, puntaje: Math.round((vencida(t, hoy) + ajuste(t, c) + zona) * 1000) / 1000 });
  }
  return lista.sort((a, b) => b.puntaje - a.puntaje || (a.t.id ?? 0) - (b.t.id ?? 0));
}
/** Cuántas tareas no entran hoy en tu tiempo y energía (solo para decirlo con calma). */
export function noCaben(tareas: TareaHogar[], c: Capacidad, hoy: string, quitar: Set<number>): number {
  return tareas.filter((t) => t.id != null && !quitar.has(t.id) && t.ult !== hoy && !cabe(t, c)).length;
}

/** El tiempo transcurrido, dicho sin juicio. */
export function haceCuanto(t: TareaHogar, hoy: string): string {
  const d = diasDesde(t, hoy);
  if (d == null) return 'Aún no anotas la primera vez.';
  if (d === 0) return 'La hiciste hoy.';
  if (d === 1) return 'La hiciste ayer.';
  const n = d + ' días';
  return t.yo ? 'Hace ' + n + ' que no ' + t.yo + '.' : 'Hace ' + n + ' que no lo haces.';
}

/** «Mañana toca lavar la ropa; hoy podrías dejar la lavadora lista (3 min).» Solo con lo que cabe en tu tiempo. */
export function previsiones(tareas: TareaHogar[], c: Capacidad, hoy: string, max = 2): string[] {
  const salida: { t: TareaHogar; texto: string }[] = [];
  for (const t of tareas) {
    if (!t.antes || !t.antesMin || t.antesMin > c.tiempo) continue;
    const d = diasDesde(t, hoy);
    // Hoy todavía no toca, pero mañana sí.
    if (d == null || d >= t.cada || d + 1 < t.cada) continue;
    salida.push({ t, texto: 'Mañana toca ' + minuscula(t.n) + '; hoy podrías ' + t.antes + ' (' + t.antesMin + ' min).' });
  }
  return salida.sort((a, b) => (a.t.id ?? 0) - (b.t.id ?? 0)).slice(0, max).map((x) => x.texto);
}
const minuscula = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);

/** Dos de las elegidas en la misma zona: «Las dos son de Cocina.» */
export function mismaZona(t: TareaHogar[]): string {
  const por: Record<string, number> = {};
  for (const x of t) por[x.zona] = (por[x.zona] ?? 0) + 1;
  const z = Object.keys(por).find((k) => por[k] >= 2);
  return z ? 'Dos o más son de «' + z + '»: se hacen juntas sin ir y venir.' : '';
}

// ---------- Texto libre (reglas primero) ----------
export const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
const PARA_NADA = new Set(['ya', 'el', 'la', 'los', 'las', 'de', 'del', 'un', 'una', 'mi', 'mis', 'hoy', 'termine', 'acabe', 'hice', 'hize', 'que', 'por', 'con', 'en', 'al', 'se', 'lo', 'le', 'unos', 'unas']);
const palabras = (s: string) => norm(s).replace(/[^a-z0-9ñ\s]/g, ' ').split(/\s+/).filter((w) => w.length >= 3 && !PARA_NADA.has(w));
/** Dos palabras se parecen si empiezan igual (aspirar ≈ aspiré). */
function parecidas(a: string, b: string): boolean {
  if (a === b) return true;
  const n = Math.min(5, Math.min(a.length, b.length) - 1);
  return n >= 3 && a.slice(0, n) === b.slice(0, n);
}
/** Las tareas que más se parecen a una frase. Más de una = hay que preguntar cuál. */
export function buscarTarea(frase: string, tareas: TareaHogar[]): TareaHogar[] {
  const q = palabras(frase);
  if (!q.length) return [];
  const puntos = tareas.map((t) => {
    const w = palabras(t.n + ' ' + t.zona);
    return { t, p: q.filter((x) => w.some((y) => parecidas(x, y))).length };
  }).filter((x) => x.p > 0);
  const mejor = Math.max(0, ...puntos.map((x) => x.p));
  return puntos.filter((x) => x.p === mejor).map((x) => x.t);
}

/** Lo que dice una tarea nueva: «regar plantas cada 3 días 5 min». */
export function entenderTarea(texto: string): { n: string; cada?: number; min?: number } | null {
  let t = texto.trim();
  let cada: number | undefined, min: number | undefined;
  const c = /\bcada\s+(\d{1,3})\s*d[ií]as?\b/i.exec(t);
  if (c) { cada = +c[1]; t = t.replace(c[0], ' '); }
  else if (/\bcada\s+semana\b|\bsemanal(mente)?\b/i.test(t)) { cada = 7; t = t.replace(/\bcada\s+semana\b|\bsemanal(mente)?\b/i, ' '); }
  else if (/\bcada\s+d[ií]a\b|\bdiari[oa](mente)?\b/i.test(t)) { cada = 1; t = t.replace(/\bcada\s+d[ií]a\b|\bdiari[oa](mente)?\b/i, ' '); }
  else if (/\bcada\s+mes\b|\bmensual(mente)?\b/i.test(t)) { cada = 30; t = t.replace(/\bcada\s+mes\b|\bmensual(mente)?\b/i, ' '); }
  const m = /\b(?:en\s+)?(\d{1,3})\s*(?:min(?:utos?)?)\b/i.exec(t);
  if (m) { min = +m[1]; t = t.replace(m[0], ' '); }
  const n = t.replace(/\s+/g, ' ').replace(/^[\s,.;:]+|[\s,.;:]+$/g, '');
  if (!n) return null;
  return { n: n.charAt(0).toUpperCase() + n.slice(1), cada, min };
}

export type Frase =
  | { tipo: 'hecha'; candidatas: TareaHogar[] }
  | { tipo: 'agregar'; n: string; cada?: number; min?: number }
  | { tipo: 'capacidad'; energia?: Energia; tiempo?: number };

/** El tiempo que dices cabe en una de las opciones: 20 min → 15 (nunca se pasa de lo que tienes). */
export function tiempoCercano(min: number): number {
  return [...TIEMPOS].reverse().find((t) => t <= min) ?? TIEMPOS[0];
}
/**
 * Entiende una frase corta con reglas: «ya aspiré el cuarto», «agrega regar plantas cada 3 días»,
 * «tengo 20 min y poca energía». Si no la entiende devuelve `null` (más adelante, una sola llamada de IA).
 */
export function interpretar(texto: string, tareas: TareaHogar[]): Frase | null {
  const s = norm(texto);
  if (!s) return null;
  if (/^(?:agrega(?:r)?|anade|anadir|nueva tarea|tarea nueva)\b/.test(s)) {
    // Se usa el texto original para conservar acentos y mayúsculas.
    const crudo = texto.trim().replace(/^\s*(?:(?:agrega(?:r)?|a[ñn]ad(?:e|ir))(?:\s+(?:una\s+)?(?:nueva\s+)?tarea)?|nueva tarea|tarea nueva)\s*:?\s*/i, '');
    const d = entenderTarea(crudo);
    return d ? { tipo: 'agregar', ...d } : null;
  }
  if (/\benergia\b|\bcansad[oa]\b|\bagotad[oa]\b|\b(tengo|me quedan|dispongo)\b.*\b(min|minutos|hora)\b/.test(s)) {
    const energia: Energia | undefined = /\b(poca|baja|cansad[oa]|agotad[oa])\b/.test(s) ? 'poca'
      : /\b(buena|mucha|alta)\b/.test(s) && /\benergia\b/.test(s) ? 'buena'
      : /\b(media|regular|normal)\b/.test(s) && /\benergia\b/.test(s) ? 'media' : undefined;
    const m = /(\d{1,3})\s*(?:min|minutos)\b/.exec(s);
    const tiempo = m ? tiempoCercano(+m[1]) : /\b(?:una|1)\s*hora\b/.test(s) ? 60 : undefined;
    if (energia || tiempo) return { tipo: 'capacidad', energia, tiempo };
  }
  if (/^(ya\s+)?(hice|termine|acabe|limpie|lave|aspire|barri|doble|guarde|saque|riegue|ordene|prepare|cambie|zurci|pase|trapee|tire|puse|deje)\b|^ya\b/.test(s)) {
    const c = buscarTarea(texto, tareas);
    if (c.length) return { tipo: 'hecha', candidatas: c };
  }
  return null;
}

/** Lo que se muestra para confirmar antes de guardar nada. */
export function entendi(f: Frase): string {
  if (f.tipo === 'agregar') return 'Agregar la tarea «' + f.n + '»' + (f.cada ? ', cada ' + (f.cada === 1 ? 'día' : f.cada + ' días') : '') + (f.min ? ', ' + f.min + ' min' : '') + '.';
  if (f.tipo === 'capacidad') return 'Hoy: ' + [f.tiempo ? f.tiempo + ' min' : '', f.energia ? 'energía ' + f.energia : ''].filter(Boolean).join(' y ') + '.';
  return f.candidatas.length === 1 ? 'Marcar «' + f.candidatas[0].n + '» como hecha.' : 'Marcar como hecha una de estas tareas.';
}
