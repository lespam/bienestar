import type { ItemMenu, PerfilComida, Receta } from '../../core/db';
import { norm, porcionDe } from './calculos';
import { cortoLugar, deFabrica, lugaresIniciales, nombreLugar, porReglas, type DatosLugares } from './lugares';

// La lista de compras sale del menú de la semana y de los ingredientes de cada receta.
// Lo que agregas tú se queda aparte. Todo es una cuenta: no hay nada que cumplir.

export const SECCIONES = ['Frutas y verduras', 'Proteínas', 'Lácteos', 'Granos y legumbres', 'Tortillería', 'Despensa', 'Otros'];
/** El id de un lugar de compra (`enfrente` y `walmart` vienen de fábrica; tú agregas los demás). */
export type Destino = string;
export type Pestana = Destino | 'todo';

const RX_LACTEOS = /yogur|leche|queso|panela|oaxaca|cottage|requeson|crema(?! de cacahuate)/;
const RX_PROTEINA = /pollo|huevo|\bres\b|bistec|carne|pescado|salmon|atun|camaron|cerdo|pavo|jamon|filete|chorizo|sardina/;
const RX_TORTILLERIA = /tortilla|tostada|\bpan\b|pita|bolillo/;
const RX_GRANOS = /quinoa|garbanzo|arroz|frijol|lenteja|avena|granola|amaranto|pasta|\bhabas?\b|hummus|palomero|rice cake|elote en grano/;
const RX_FRUTAS = /jitomate|tomate|cebolla|\bajo\b|pepino|limon|zanahoria|platano|fruta|champi|aguacate|\bpapa|espinaca|lechuga|brocoli|calabac|nopal|chile|cilantro|fresa|manzana|\bpera|naranja|mango|papaya|melon|sandia|\buva|elote|verdura|apio|pimiento|jicama|ejote|coliflor|betabel|pina|kiwi|arandano|durazno|germen|perejil|albahaca|menta|col\b|berenjena|chayote/;
const RX_DESPENSA = /al gusto|aceite|caldo|chipotle|canela|salsa|\bsal\b|pimienta|mermelada|miel|stevia|vinagre|mostaza|cacao|nuez|almendra|cacahuate|semilla|chia|ajonjoli|galleta|barra|barrita|vainilla|oregano|polvo|harina|levadura|mayonesa|catsup|soya/;

export function seccionDe(nombre: string): number {
  const t = norm(nombre);
  if (/al gusto/.test(t)) return 5;
  if (RX_LACTEOS.test(t)) return 2;
  if (RX_PROTEINA.test(t)) return 1;
  if (RX_TORTILLERIA.test(t)) return 4;
  if (RX_GRANOS.test(t)) return 3;
  if (RX_FRUTAS.test(t)) return 0;
  return RX_DESPENSA.test(t) ? 5 : 6;
}

/** Lo que pesa: de esto solo se lleva una cosa a pie. */
export const RX_PESADO = /leche|milk|agua|water|paper ?towel|papel|toalla|detergente?|suavizante|cloro|croqueta|treats?|arroz|frijol|lenteja|garbanzo|harina|flour|beans|gatorade|aceite|jugo|juice|bolsas|trash|basura|shampoo|panal/;

const UNIDAD_PL: Record<string, string> = { pieza: 'piezas', taza: 'tazas', lata: 'latas', chile: 'chiles', diente: 'dientes', rebanada: 'rebanadas', sobre: 'sobres', paquete: 'paquetes', barrita: 'barritas', barra: 'barras', hoja: 'hojas', 'porción': 'porciones', 'puño': 'puños', cda: 'cdas', cdita: 'cditas' };
/** Estas se compran enteras: si faltan 0.3 de lata, se compra 1. */
const ENTERAS = new Set(['pieza', 'lata', 'paquete', 'sobre', 'barrita', 'barra', 'diente', 'hoja', 'chile']);

export function cantidadCompra(q: number | null, u: string): string {
  if (q == null) return '';
  if (u === 'g' && q >= 1000) { q /= 1000; u = 'kg'; }
  else if (u === 'ml' && q >= 1000) { q /= 1000; u = 'L'; }
  q = ENTERAS.has(u) ? Math.ceil(q - 1e-9) : Math.round(q * 100) / 100;
  if (u === 'g' || u === 'ml') q = Math.round(q / 10) * 10 || 5;
  return String(q).replace('.', ',') + (u ? ' ' + (q > 1 && UNIDAD_PL[u] ? UNIDAD_PL[u] : u) : '');
}

/** La proteína animal se pesa cocida en la receta; en la tienda se compra cruda: cocida × 1.3. */
const RX_CRUDA = /pollo|\bres\b|bistec|carne|pescado|salmon|camaron|cerdo|pavo|filete|muslo|pierna/;
const RX_NO_CRUDA = /queso|jamon|atun|huevo|yogur|panela/;
export const esCruda = (nombre: string, unidad: string) => unidad === 'g' && RX_CRUDA.test(norm(nombre)) && !RX_NO_CRUDA.test(norm(nombre));
export const FACTOR_CRUDO = 1.3;

export interface FilaCompra {
  n: string;
  /** Cantidad ya escrita ("1,4 kg"). */
  q: string;
  /** De qué platos sale. */
  para: string[];
  sec: number;
  crudo?: boolean;
  dest?: Destino;
  why?: string;
  /** Algo que agregaste tú. */
  extra?: boolean;
  /** Lo que agregaste tú: ya falta o se acaba pronto. */
  urg?: 'falta' | 'pronto';
  /** Para quién es, según el menú. Vacío en lo que agregas a mano. */
  quien?: ('les' | 'jeff')[];
}
export interface Extra { n: string; q: string; sec: number; urg: 'falta' | 'pronto'; chk: boolean }
export interface EstadoCompras { chk: Record<string, boolean>; dest: Record<string, Destino>; extras: Extra[]; /** Lo que ya tienes pero necesitas comprar de todos modos. */ nec?: Record<string, boolean>; /** Las comidas del menú que elegiste para esta lista (fecha:lugar). Sin esto, entran todas. */ sel?: string[] }
export const comprasVacias = (): EstadoCompras => ({ chk: {}, dest: {}, extras: [] });

const mayus = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);

export type PorcionesPerfiles = Record<'les' | 'jeff', Pick<PerfilComida, 'por'>>;
/**
 * Cuántas porciones de cada receta pide el menú. Con los perfiles, cada quien cuenta su porción
 * (la de la receta si la cambiaste, si no la de su perfil). Sin perfiles: los dos suman 2, cada quien 1.
 */
export function usosDelMenu(items: ItemMenu[], recetas: Receta[] = [], perfiles?: PorcionesPerfiles): Map<string, number> {
  const usos = new Map<string, number>();
  const porId = new Map(recetas.map((r) => [r.id, r]));
  const suma = (id: string | undefined, w: 'les' | 'jeff') => {
    if (!id) return;
    const n = perfiles ? porcionDe(porId.get(id) ?? {}, w, perfiles) : 1;
    usos.set(id, (usos.get(id) ?? 0) + n);
  };
  for (const m of items) {
    if (m.t === 'dos') { suma(m.r, 'les'); suma(m.r, 'jeff'); }
    else if (m.t === 'cada') { suma(m.rl, 'les'); suma(m.rj, 'jeff'); }
  }
  return usos;
}

/** Junta los ingredientes de las recetas del menú y las colaciones armadas por partes. */
export function armarLista(items: ItemMenu[], recetas: Receta[], perfiles?: PorcionesPerfiles): FilaCompra[] {
  const porId = new Map(recetas.map((r) => [r.id, r]));
  const acc = new Map<string, { n: string; u: string; q: number | null; para: string[]; crudo: boolean; quien: ('les' | 'jeff')[] }>();
  // Quién come cada receta, según el menú
  const quienDe = new Map<string, ('les' | 'jeff')[]>();
  const come = (id: string | undefined, w: 'les' | 'jeff') => { if (id) quienDe.set(id, [...new Set([...(quienDe.get(id) ?? []), w])]); };
  for (const m of items) {
    if (m.t === 'dos') { come(m.r, 'les'); come(m.r, 'jeff'); }
    else if (m.t === 'cada') { come(m.rl, 'les'); come(m.rj, 'jeff'); }
  }
  for (const [id, usos] of usosDelMenu(items, recetas, perfiles)) {
    const r = porId.get(id);
    if (!r) continue;
    // Con los perfiles se compra lo que de verdad se come (porciones ÷ rendimiento); sin ellos, tandas enteras.
    const tandas = perfiles ? usos / (r.y || 1) : Math.max(1, Math.ceil(usos / (r.y || 1)));
    for (const g of r.ing) {
      if (/^agua/i.test(g[2])) continue;
      const crudo = g[0] != null && esCruda(g[2], g[1]);
      const llave = norm(g[2]) + '|' + g[1];
      let a = acc.get(llave);
      if (!a) { a = { n: g[2], u: g[1], q: null, para: [], crudo, quien: [] }; acc.set(llave, a); }
      for (const w of quienDe.get(id) ?? []) if (!a.quien.includes(w)) a.quien.push(w);
      if (g[0] != null) a.q = (a.q ?? 0) + g[0] * tandas * (crudo ? FACTOR_CRUDO : 1);
      if (!a.para.includes(r.n)) a.para.push(r.n);
    }
  }
  // Un mismo alimento con distintas unidades (aceite en cditas y en cdas) es una sola fila: se marca una vez.
  const filas: FilaCompra[] = [];
  for (const a of acc.values()) {
    const q = cantidadCompra(a.q, a.u);
    const hay = filas.find((f) => norm(f.n) === norm(a.n));
    if (!hay) { filas.push({ n: mayus(a.n), q, para: a.para, sec: seccionDe(a.n), quien: a.quien, ...(a.crudo ? { crudo: true } : {}) }); continue; }
    if (q) hay.q = hay.q ? hay.q + ' + ' + q : q;
    for (const p of a.para) if (!hay.para.includes(p)) hay.para.push(p);
    for (const w of a.quien) if (!(hay.quien ??= []).includes(w)) hay.quien.push(w);
    if (a.crudo) hay.crudo = true;
  }

  // Colaciones: cada parte suma 1 colación. Si ya estaba en la lista, se junta ahí.
  const cuenta = new Map<string, number>();
  for (const m of items) {
    if (m.t !== 'col' || !m.col) continue;
    for (const p of [m.col.base === 'Fruta' ? '' : m.col.base, m.col.fruta, m.col.extra]) if (p) cuenta.set(p, (cuenta.get(p) ?? 0) + 1);
  }
  for (const [n, c] of cuenta) {
    const txt = c + (c === 1 ? ' colación' : ' colaciones');
    const hay = filas.find((f) => norm(f.n) === norm(n));
    if (hay) { hay.q = hay.q ? hay.q + ' + ' + txt : txt; if (!hay.para.includes('Colaciones')) hay.para.push('Colaciones'); }
    else filas.push({ n: mayus(n), q: txt, para: ['Colaciones'], sec: seccionDe(n) });
  }
  return filas.sort((a, b) => a.sec - b.sec);
}

export interface ListaFinal { filas: FilaCompra[]; pasadas: string[] }

/**
 * Junta lo del menú con lo que agregaste y decide en qué lugar va cada cosa.
 * Manda primero lo que moviste esta semana, luego tus reglas (por ingrediente y por sección) y al final el reparto de fábrica.
 */
export function repartir(menu: FilaCompra[], estado: EstadoCompras, lugares: DatosLugares = lugaresIniciales()): ListaFinal {
  const filas: FilaCompra[] = menu.map((f) => ({ ...f }));
  let pesadas = 0;
  const pasadas: string[] = [];
  const enfrente = deFabrica(lugares, 'enfrente'), walmart = deFabrica(lugares, 'walmart');
  const existe = (id: string | undefined): id is string => !!id && lugares.lista.some((l) => l.id === id);
  for (const e of estado.extras) filas.push({ n: e.n, q: e.q, para: [], sec: e.sec, extra: true, why: e.urg, urg: e.urg });
  for (const f of filas) {
    const mio = estado.dest[f.n];
    if (existe(mio)) { f.dest = mio; if (f.extra) f.why = 'Lo pasaste a ' + cortoLugar(nombreLugar(lugares, mio)); continue; }
    const regla = porReglas(lugares, f.n, f.sec);
    if (regla) { f.dest = regla; if (f.extra) f.why = (f.urg === 'pronto' ? 'Se acaba pronto' : 'Ya falta') + ' · ' + cortoLugar(nombreLugar(lugares, regla)); continue; }
    if (!f.extra) { f.dest = f.sec === 3 || f.sec === 5 ? walmart : enfrente; continue; }
    if (f.why === 'pronto') { f.dest = walmart; f.why = 'Se acaba pronto'; }
    else if (RX_PESADO.test(norm(f.n))) {
      if (pesadas < 1) { pesadas++; f.dest = enfrente; f.why = 'Ya falta'; }
      else { f.dest = walmart; f.why = 'Ya falta · pesado'; if (walmart !== enfrente) pasadas.push(f.n); }
    } else { f.dest = enfrente; f.why = 'Ya falta'; }
  }
  return { filas: filas.sort((a, b) => a.sec - b.sec), pasadas };
}

export const marcada = (estado: EstadoCompras, f: FilaCompra) => (f.extra ? estado.extras.find((e) => e.n === f.n)?.chk : estado.chk[f.n]) ?? false;

/** Cuántas cosas hay por lugar (por id), en total y las ya marcadas. */
export function conteos(filas: FilaCompra[], estado: EstadoCompras, lugares: DatosLugares = lugaresIniciales()): Record<string, number> & { todo: number; hechas: number } {
  const c: Record<string, number> = { todo: filas.length, hechas: 0 };
  for (const l of lugares.lista) c[l.id] = 0;
  for (const f of filas) {
    const d = f.dest && c[f.dest] !== undefined ? f.dest : lugares.lista[0].id;
    c[d]++;
    if (marcada(estado, f)) c.hechas++;
  }
  return c as Record<string, number> & { todo: number; hechas: number };
}

/** El texto que se manda a Jeff. */
export function textoCompartir(filas: FilaCompra[], estado: EstadoCompras, cual: Pestana, todo: boolean, lugares: DatosLugares = lugaresIniciales()): string {
  const partes: string[] = [];
  for (const l of lugares.lista) {
    if (cual !== 'todo' && cual !== l.id) continue;
    const bloques: string[] = [];
    SECCIONES.forEach((s, si) => {
      const its = filas.filter((f) => f.sec === si && (f.dest ?? lugares.lista[0].id) === l.id && (todo || !marcada(estado, f)));
      if (its.length) bloques.push(s + '\n' + its.map((f) => '• ' + f.n + (f.q ? ' (' + f.q + ')' : '')).join('\n'));
    });
    if (bloques.length) partes.push(l.n + '\n\n' + bloques.join('\n\n'));
  }
  return partes.join('\n\n———\n\n');
}

// ---------- Tu plantilla "Fresh": sugerencias al escribir y hoja para imprimir ----------
export const PLANTILLA: Record<string, string[]> = {
  'Fruta, verdura y refrigerados': ['Avocado', 'Bananas', 'Basil', 'Broccoli', 'Butter', 'Carrot', 'Chicken', 'Chobani Flip', 'Chobani Coconut', 'Cilantro', 'Crema', 'Cucumbers', 'Cheese Mozzarella', 'Cheese Cheddar', 'Garlic', 'Green Beans/Green onions', 'Green Pepper / Peppers', 'Greek Yogurt', 'Ice cream', 'Lettuce', 'Lemons/Limes', 'Milk', 'Onions', 'Orange Juice', 'Parsley', 'Philadelphia Cheese', 'Pineapple', 'Queso', 'Spinach', 'Strawberries', 'Tomatillos', 'Turkey'],
  'Despensa y hogar': ['Almonds', 'Balsamic Vinegar', 'Beans 4 lb', 'Bread', 'Chickpeas 2 lb', 'Chicken Broth (Pacific low-sodium)', 'Chocolate Chips/Dark Chocolate', 'Cornstarch', 'Dijon Mustard', 'Eggs', 'Evaporated Milk (Lechera)', 'Flour', 'Gatorade Powder', 'Ginger', 'Green Curry Paste', 'Honey', 'Ketchup', 'Lentils', 'Marias', 'Gamesa/Crackers/Cookies', 'Nutella', 'Oats', 'Olive Oil / balsamic / rice vinegar', 'Oreo Cookies', 'Pasta', 'Peanut Butter', 'Quinoa', 'Rice or Rice cakes', 'Sesame Oil or Seeds', 'Tostadas', 'Tortillas', 'Wine for Cooking', 'Yeast'],
  'Limpieza y cuidado personal': ['Air Filters', 'Alcohol', 'Batteries (AA, AAA, CR2032)', 'Bleach', 'CBD', 'Comet', 'Deodorant', 'Brush/Sponge', 'Dish Detergent', 'Dishwasher Cleaner', 'Dishwasher Pods', 'Dog Treats', 'Latex Gloves', 'Laundry Detergent', 'Mouthwash', 'Paper Towels', 'Peroxide', 'Printer Paper', 'Kleenex', 'Shampoo and Conditioner', 'Tampons', 'Toilet Paper', 'Trash Bags', 'Vinegar', 'Water Filter', 'Ziplock Bags']
};
export const TODA_LA_PLANTILLA = Object.values(PLANTILLA).flat();

export function sugerencias(texto: string, ya: string[]): string[] {
  const t = norm(texto.trim());
  if (!t) return [];
  const tengo = new Set(ya.map(norm));
  return TODA_LA_PLANTILLA.filter((n) => norm(n).includes(t) && !tengo.has(norm(n))).slice(0, 6);
}

/** Cuáles cosas de la plantilla están marcadas con N (necesito) y cuáles son extras fuera de ella. */
export function plantillaMarcada(extras: Extra[]) {
  const quiero = extras.filter((e) => !e.chk).map((e) => norm(e.n));
  const usados = new Set<string>();
  const esN = (n: string) => quiero.some((x) => { const m = norm(n); if (m.includes(x) || x.includes(m)) { usados.add(x); return true; } return false; });
  const columnas = Object.entries(PLANTILLA).map(([titulo, its]) => ({ titulo, its: its.map((n) => ({ n, y: esN(n) })) }));
  const otros = extras.filter((e) => !e.chk && !usados.has(norm(e.n))).map((e) => e.n);
  return { columnas, otros };
}
