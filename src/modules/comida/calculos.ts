import type { Ingrediente, PerfilComida, Receta } from '../../core/db';

// Cálculos puros de Comida (sin base de datos). Las referencias nunca se calculan aquí,
// salvo la calculadora del libro, que es opcional y solo propone un punto de partida.

/** La app no guarda referencias de calorías más bajas que esta (reglas de tono). */
export const KMIN = 1200;

export const fmtN = (n: number) => Number(n).toLocaleString('es-MX');
export const kRango = (k: [number, number]) => (k[0] === k[1] ? fmtN(k[0]) + ' kcal' : fmtN(k[0]) + '–' + fmtN(k[1]) + ' kcal');
export const norm = (t: string) => String(t).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
export const cap = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);
export const lc = (t: string) => t.charAt(0).toLowerCase() + t.slice(1);
export const r1 = (x: number) => Math.round(x * 10) / 10;

const FRAC: Record<number, string> = { 0.25: '¼', 0.5: '½', 0.75: '¾' };
export const q4 = (x: number) => Math.round(x * 4) / 4;
export function fmtQ(x: number): string {
  x = q4(x);
  const w = Math.floor(x), f = x - w;
  return (w || !f ? String(w) : '') + (FRAC[f] || '');
}
export const porTxt = (x: number) => fmtQ(x) + (q4(x) > 1 ? ' porciones' : ' porción');

export const CATEGORIAS = ['Desayuno', 'Comida', 'Cena', 'Colación', 'Base'] as const;
export const CAT_PLURAL: Record<string, string> = { Desayuno: 'Desayunos', Comida: 'Comidas', Cena: 'Cenas', 'Colación': 'Colaciones', Base: 'Bases' };
export const CAT_COLOR: Record<string, string> = { Desayuno: 'var(--rose)', Comida: 'var(--mint)', Cena: 'var(--sky)', 'Colación': 'var(--accent)', Base: 'var(--accent)' };

// ---------- Lo que alguien no come ----------
const raiz = (t: string) => norm(t).replace(/(es|s)$/, '');

export interface Conflicto { w: 'les' | 'jeff'; x: string }
export function conflictos(r: Pick<Receta, 'ing'>, perfiles: Record<'les' | 'jeff', Pick<PerfilComida, 'no'>>): Conflicto[] {
  const out: Conflicto[] = [];
  for (const w of ['les', 'jeff'] as const) {
    for (const x of perfiles[w].no) {
      const sx = raiz(x);
      if (sx && r.ing.some((it) => raiz(it[2]).includes(sx))) out.push({ w, x });
    }
  }
  return out;
}
const tieneAlt = (r: Pick<Receta, 'alt'>, c: Conflicto) => !!r.alt && r.alt.w === c.w && raiz(r.alt.x) === raiz(c.x);

export function notaConflictos(r: Pick<Receta, 'ing' | 'alt'>, perfiles: Record<'les' | 'jeff', Pick<PerfilComida, 'no'>>): string {
  return conflictos(r, perfiles).map((c) => {
    const yo = c.w === 'les';
    return (yo ? 'No comes ' : 'Jeff no come ') + lc(c.x) + (tieneAlt(r, c) ? ': ' + (yo ? 'tu' : 'su') + ' versión va con ' + r.alt!.by + '.' : '. Cambia ese ingrediente en ' + (yo ? 'tu' : 'su') + ' porción.');
  }).join(' ');
}
/**
 * El ingrediente que no le gusta se nota en el plato: aparece en el nombre de la receta
 * (tacos de huevo sí; crepas o galletas con huevo no) y no hay una versión sin él.
 */
export function noLeGustaPrincipal(r: Pick<Receta, 'n' | 'alt'>, no: string[], w: 'les' | 'jeff'): boolean {
  const nombre = norm(r.n);
  return no.some((x) => {
    const sx = raiz(x);
    return !!sx && nombre.split(/[^a-z0-9]+/).some((p) => raiz(p) === sx || (sx.includes(' ') && nombre.includes(sx))) && !(r.alt && r.alt.w === w && raiz(r.alt.x) === sx);
  });
}
/** e: veces que la elegiste en el menú. r: días que la registraste. */
export interface UsoReceta { e: number; r: number }
export const vecesUsada = (u?: UsoReceta) => (u ? u.e + u.r : 0);
export function usoTxt(u?: UsoReceta): string {
  if (!vecesUsada(u)) return 'Aún no la usas';
  const vez = (n: number) => n + (n === 1 ? ' vez' : ' veces');
  return [u!.e ? 'En el menú ' + vez(u!.e) : '', u!.r ? 'Registrada ' + vez(u!.r) : ''].filter(Boolean).join(' · ');
}
export interface FiltrosReceta { origen: string; sinLes: boolean; sinJeff: boolean; uso?: 'todo' | 'nunca' | 'usadas'; foto?: 'todo' | 'con' | 'sin' }
export function pasaFiltros(r: Pick<Receta, 'id' | 'n' | 'alt' | 'origen' | 'img'>, f: FiltrosReceta, perfiles: Record<'les' | 'jeff', Pick<PerfilComida, 'no'>>, uso: Record<string, UsoReceta> = {}): boolean {
  if (f.origen !== 'todo' && (r.origen ?? 'Mías') !== f.origen) return false;
  if (f.uso === 'nunca' && vecesUsada(uso[r.id])) return false;
  if (f.uso === 'usadas' && !vecesUsada(uso[r.id])) return false;
  if (f.foto === 'con' && !r.img) return false;
  if (f.foto === 'sin' && r.img) return false;
  if (f.sinLes && noLeGustaPrincipal(r, perfiles.les.no, 'les')) return false;
  if (f.sinJeff && noLeGustaPrincipal(r, perfiles.jeff.no, 'jeff')) return false;
  return true;
}
export function avisoConflicto(r: Pick<Receta, 'ing' | 'alt'>, perfiles: Record<'les' | 'jeff', Pick<PerfilComida, 'no'>>): string {
  const c = conflictos(r, perfiles)[0];
  if (!c) return '';
  const yo = c.w === 'les';
  return tieneAlt(r, c) ? (yo ? 'Tu versión va con ' : 'La versión de Jeff va con ') + r.alt!.by : (yo ? 'No comes ' : 'Jeff no come ') + lc(c.x);
}

// ---------- Cantidades ----------
const unidadTxt = (u: string, q: number) => (!u || u === 'g' || u === 'ml' ? u : q > 1 ? u + 's' : u);
/** Cantidad de un ingrediente para un factor de porciones: gramos y ml redondeados, lo demás en cuartos. */
export function cantidadTxt(it: Ingrediente, f: number): string {
  if (it[0] == null) return '';
  let q = it[0] * f;
  if (it[1] === 'g' || it[1] === 'ml') return fmtN(q >= 100 ? Math.round(q / 10) * 10 : Math.max(5, Math.round(q / 5) * 5)) + ' ' + it[1];
  q = Math.max(0.25, q4(q));
  return fmtQ(q) + (it[1] ? ' ' + unidadTxt(it[1], q) : '');
}
/** "500 g de pechuga de pollo": la línea que se muestra y se edita. */
export const lineaIng = (it: Ingrediente) => (it[0] == null ? it[2] : cantidadTxt(it, 1) + (it[1] && it[1] !== 'chile' ? ' de ' : ' ') + lc(it[2]));

// ---------- Leer una receta escrita ----------
const UNIDADES: Record<string, string> = {
  g: 'g', gr: 'g', gramos: 'g', kg: 'kg', ml: 'ml', l: 'l', litro: 'l', litros: 'l', taza: 'taza', tazas: 'taza', cda: 'cda', cdas: 'cda', cucharada: 'cda', cucharadas: 'cda',
  cdita: 'cdita', cditas: 'cdita', cucharadita: 'cdita', cucharaditas: 'cdita', pieza: 'pieza', piezas: 'pieza', pza: 'pieza', pzas: 'pieza', lata: 'lata', latas: 'lata',
  diente: 'diente', dientes: 'diente', chile: 'chile', chiles: 'chile', rebanada: 'rebanada', rebanadas: 'rebanada'
};
const FRV: Record<string, number> = { '½': 0.5, '¼': 0.25, '¾': 0.75 };

export function leerIngrediente(linea: string): Ingrediente | null {
  let t = linea.replace(/^\s*[-•*·]\s*/, '').trim();
  if (!t) return null;
  t = t.replace(/^(\d+)\s*\/\s*(\d+)/, (_, a, b) => String(+a / +b));
  const m = t.match(/^(\d+(?:[.,]\d+)?)?\s*([½¼¾])?\s*(.*)$/)!;
  let q: number | null = null, rest = t;
  if (m[1] || m[2]) { q = (m[1] ? parseFloat(m[1].replace(',', '.')) : 0) + (m[2] ? FRV[m[2]] : 0); rest = m[3]; }
  const sp = rest.indexOf(' ');
  const w = norm(sp < 0 ? rest : rest.slice(0, sp)).replace(/\.$/, '');
  let u = '';
  if (q != null && UNIDADES[w]) { u = UNIDADES[w]; rest = sp < 0 ? '' : rest.slice(sp + 1); }
  rest = rest.replace(/^de\s+/i, '').trim();
  if (q != null && u === 'kg') { q *= 1000; u = 'g'; } else if (q != null && u === 'l') { q *= 1000; u = 'ml'; }
  return [q, u, cap(rest || t)];
}

export interface Borrador { n: string; cat: Receta['cat']; y: number | ''; t: string; ing: Ingrediente[]; steps: string[]; k: number | null; p: number | null; c: number | null; g: number | null }
export const borradorVacio = (): Borrador => ({ n: '', cat: 'Comida', y: '', t: '', ing: [], steps: [], k: null, p: null, c: null, g: null });

/** Separa un texto pegado en nombre, porciones, tiempo, ingredientes, pasos y números si los trae. */
export function leerReceta(txt: string): Borrador {
  const r = borradorVacio();
  let modo = '';
  for (const raw of txt.split(/\r?\n/)) {
    const l = raw.trim(), bajo = norm(l);
    let m: RegExpMatchArray | null;
    if (!l) continue;
    if (/^#*\s*ingredientes/.test(bajo)) { modo = 'i'; continue; }
    if (/^#*\s*(preparacion|pasos|procedimiento|modo de preparacion|instrucciones)/.test(bajo)) { modo = 's'; continue; }
    if (/\d+\s*(kcal|calorias)/.test(bajo)) {
      if ((m = bajo.match(/(\d+)\s*(kcal|calorias)/))) r.k = +m[1];
      if ((m = bajo.match(/proteinas?\D{0,3}(\d+)/))) r.p = +m[1];
      if ((m = bajo.match(/carbohidratos?\D{0,3}(\d+)/))) r.c = +m[1];
      if ((m = bajo.match(/grasas?\D{0,3}(\d+)/))) r.g = +m[1];
      continue;
    }
    if (!modo) {
      if (!r.n) { r.n = l.replace(/^#+\s*/, ''); continue; }
      if ((m = bajo.match(/(?:rinde|porciones|raciones)\D{0,4}(\d+)/) || bajo.match(/(\d+)\s*(?:porciones|raciones)/))) r.y = +m[1];
      if ((m = bajo.match(/(\d+)\s*(min|minutos|h|horas)\b/))) r.t = m[1] + (m[2].charAt(0) === 'h' ? ' h' : ' min');
      if (/desayuno/.test(bajo)) r.cat = 'Desayuno'; else if (/cena/.test(bajo)) r.cat = 'Cena';
      continue;
    }
    if (modo === 'i') { const it = leerIngrediente(l); if (it) r.ing.push(it); }
    else r.steps.push(l.replace(/^\d+\s*[.)-]?\s*/, '').replace(/^[-•*·]\s*/, ''));
  }
  return r;
}

// ---------- Porciones ----------
/** Porción de alguien en una receta: la de la receta si la cambiaste, si no la de su perfil. */
export const porcionDe = (r: Pick<Receta, 'por'>, w: 'les' | 'jeff', perfiles: Record<'les' | 'jeff', Pick<PerfilComida, 'por'>>) => r.por?.[w] ?? perfiles[w].por;

/** Cuántas comidas de los dos salen con n porciones. */
export function alcanzaTxt(n: number, porLes: number, porJeff: number): string {
  const ambos = porLes + porJeff, m = Math.floor(n / ambos + 1e-9), resto = q4(n - m * ambos);
  if (!m) return 'Para una comida de los dos se necesitan ' + porTxt(ambos) + '.';
  return 'Alcanza para ' + m + (m > 1 ? ' comidas' : ' comida') + ' de los dos' + (resto >= 0.25 ? ' y ' + (resto > 1 ? 'sobran ' : 'sobra ') + porTxt(resto) : '') + '.';
}

// ---------- Ajustar a una referencia ----------
export type Ref = 'k' | 'p';
export interface OpcionPorcion { f: number }
export interface Ajuste { cerca: boolean; ahora: number; porcion: number | null; cambios: { i: number; texto: string; efecto: number }[] }

/** Propone cambiar el tamaño de la porción o aplicar un cambio de ingredientes. Siempre decide la persona. */
export function ajustar(r: Pick<Receta, 'k' | 'p' | 'sw'>, que: Ref, ref: number, actual: number): Ajuste | null {
  const val = r[que];
  if (val == null || !(ref > 0)) return null;
  const ahora = actual * val;
  if (Math.abs(ahora - ref) <= ref * 0.1) return { cerca: true, ahora, porcion: null, cambios: [] };
  const f = Math.min(3, Math.max(0.5, q4(ref / val)));
  const dir = que + (ahora < ref ? '+' : '-');
  const cambios = (r.sw ?? []).flatMap((x, i) => (!x.hecho && x.dir.split(' ').includes(dir) ? [{ i, texto: x.t, efecto: que === 'k' ? x.d.k ?? 0 : x.d.p ?? 0 }] : []));
  return { cerca: false, ahora, porcion: f === actual ? null : f, cambios };
}
export function efectoTxt(d: number, calorias: boolean): string {
  const a = Math.round(Math.abs(d));
  return calorias ? 'Unas ' + a + ' kcal ' + (d < 0 ? 'menos' : 'más') : 'Unos ' + a + ' g ' + (d < 0 ? 'menos' : 'más') + ' de proteína';
}
/** Aplica un cambio de ingredientes a una copia de la receta. */
export function aplicarCambio(r: Receta, i: number): Receta {
  const s = r.sw?.[i];
  if (!s) return r;
  const n: Receta = structuredClone({ ...r, img: undefined, page: undefined, orig: undefined });
  n.img = r.img; n.page = r.page;
  n.orig = r.orig ?? JSON.stringify({ ...r, img: undefined, page: undefined, orig: undefined });
  if (s.add) n.ing.push([...s.add] as Ingrediente);
  if (s.set) for (const it of n.ing) if (it[2] === s.set[0]) it[0] = s.set[1];
  for (const x of ['k', 'p', 'c', 'g'] as const) if (n[x] != null) n[x] = r1(n[x]! + (s.d[x] ?? 0));
  n.sw![i].hecho = true;
  return n;
}

// ---------- Calculadora del libro (Strong Curves, cap. 5) ----------
const r5 = (x: number) => Math.round(x / 5) * 5;
export type ResultadoLibro = { ok: true; k11: number; k12: number; k: number; p: number; c: number; g: number } | { ok: false; texto: string };

/** Calorías: peso en libras × 11 o × 12. Proteína 1 g por libra. Grasa 0.3 a 0.5 g por libra. Carbohidratos: lo que falta. */
export function calculadoraLibro(peso: number, unidad: 'lb' | 'kg', kcal: 11 | 12, grasa: number): ResultadoLibro {
  const lo = unidad === 'kg' ? 36 : 80, hi = unidad === 'kg' ? 180 : 400;
  if (!(peso > 0)) return { ok: false, texto: 'Escribe tu peso para ver la referencia.' };
  if (peso < lo || peso > hi) return { ok: false, texto: 'Escribe un peso entre ' + lo + ' y ' + hi + ' ' + unidad + '.' };
  const lb = unidad === 'kg' ? peso * 2.2 : peso, k11 = r5(lb * 11), k12 = r5(lb * 12);
  if (k11 < KMIN) return { ok: false, texto: 'Con este peso, el libro da menos de ' + fmtN(KMIN) + ' kcal. La app no guarda referencias tan bajas. Coméntalo con tu nutrióloga.' };
  const k = kcal === 12 ? k12 : k11, p = Math.round(lb), g = Math.round(lb * grasa), c = Math.round((k - p * 4 - g * 9) / 4);
  if (c < 0) return { ok: false, texto: 'Con esa grasa no alcanzan las calorías. Prueba con 0.3 g.' };
  return { ok: true, k11, k12, k, p, c, g };
}

/** ¿Alguna cifra de calorías está por debajo del mínimo que la app guarda? */
export const calBaja = (...v: (number | null)[]) => v.some((x) => x != null && x < KMIN);

export const textoOrigen = (src: PerfilComida['src'], quien: 'les' | 'jeff'): string =>
  src === 'book' ? 'Las calculaste con el libro (Strong Curves)' : src === 'nos' ? 'Las definieron tú y Jeff' : quien === 'les' ? 'Las definiste con tu nutrióloga' : 'Las definió Jeff con su nutrióloga';

const MES_CORTO = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
/** "15 sep" a partir de AAAA-MM-DD. */
export const diaCorto = (f: string) => +f.slice(8, 10) + ' ' + MES_CORTO[+f.slice(5, 7) - 1];

// ---------- Registro del día ----------
export const COMIDAS = ['Desayuno', 'Comida', 'Colaciones', 'Cena'] as const;
export const DIAS_ATRAS = 30;
const DIA_LARGO = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

/** Un alimento sin lo que lo ubica en la base: lo que se copia, se pide y se edita. */
export interface Plato { n: string; por: string; k: number | null; p: number; c: number; g: number; receta?: string }

export function sumas(items: Pick<Plato, 'k' | 'p' | 'c' | 'g'>[]) {
  const t = { k: 0, p: 0, c: 0, g: 0 };
  for (const i of items) { t.k += i.k ?? 0; t.p += i.p || 0; t.c += i.c || 0; t.g += i.g || 0; }
  return t;
}
export const macroLinea = (i: Pick<Plato, 'por' | 'p' | 'c' | 'g'>) => i.por + ' · P ' + r1(i.p) + ' · C ' + r1(i.c) + ' · G ' + r1(i.g);

/** AAAA-MM-DD de hoy más `off` días (negativo = antes). */
export function fechaDe(off: number, hoy = new Date()): string {
  const d = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate() + off);
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}
/** "Hoy · Jueves 1 oct", "Ayer · Miércoles 30 sep". */
export function etiquetaDia(off: number, hoy = new Date()): string {
  const f = fechaDe(off, hoy), d = new Date(+f.slice(0, 4), +f.slice(5, 7) - 1, +f.slice(8, 10));
  const base = DIA_LARGO[d.getDay()] + ' ' + diaCorto(f);
  return (off === 0 ? 'Hoy · ' : off === -1 ? 'Ayer · ' : off === 1 ? 'Mañana · ' : '') + base;
}
/** "Hoy", "Ayer", "Mar 29 sep": para elegir a qué días copiar. */
export function diaBreve(off: number, hoy = new Date()): string {
  if (off === 0) return 'Hoy';
  if (off === -1) return 'Ayer';
  const f = fechaDe(off, hoy), d = new Date(+f.slice(0, 4), +f.slice(5, 7) - 1, +f.slice(8, 10));
  return DIA_LARGO[d.getDay()].slice(0, 3) + ' ' + diaCorto(f);
}

/** Lo que se agregaría a un día sin repetir lo que ya está igual (mismo nombre y porción). */
export const sinRepetir = (ya: Pick<Plato, 'n' | 'por'>[], items: Plato[]) => items.filter((it) => !ya.some((x) => x.n === it.n && x.por === it.por));

/** Lo último que registraste, sin repetir, lo más nuevo primero. */
export function recientes<T extends Plato>(filas: T[], limite = 8): T[] {
  const vistos = new Set<string>(), out: T[] = [];
  for (const f of filas) {
    const k = f.n + '|' + f.por;
    if (vistos.has(k)) continue;
    vistos.add(k); out.push(f);
    if (out.length >= limite) break;
  }
  return out;
}
export function fraseDia(off: number, comidas: number): string {
  if (off) return comidas ? 'Registro de ese día. Puedes agregar o corregir lo que falte.' : 'Sin registro este día, y está bien. Puedes agregar lo que recuerdes.';
  return comidas >= 3 ? 'Ya registraste ' + comidas + ' comidas hoy. Registrar también es cuidarte.' : 'Cada comida que registras te da información, no calificaciones.';
}
/** Cuántos gramos mide la barra respecto a la referencia (si no hay, a lo registrado). */
/**
 * Ancho de la barra de un macro. Con referencia, la barra crece con lo que llevas y la marca es la referencia
 * (pasarla se ve, no se corta). Sin referencia, la barra es la parte de las calorías que viene de ese macro.
 */
export function barra(valor: number, ref: number | null, parte = 0) {
  if (!ref) return { w: Math.round(Math.max(0, Math.min(1, parte)) * 1000) / 10, marca: null };
  const max = Math.max(ref * 1.4, valor);
  return { w: Math.min(100, (valor / max) * 100), marca: (ref / max) * 100 };
}
/** Qué parte de las calorías viene de cada macro (proteína y carbohidratos 4 kcal por g, grasa 9). */
export function partes(t: { p: number; c: number; g: number }) {
  const k = t.p * 4 + t.c * 4 + t.g * 9;
  return k > 0 ? { p: (t.p * 4) / k, c: (t.c * 4) / k, g: (t.g * 9) / k } : { p: 0, c: 0, g: 0 };
}
