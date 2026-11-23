import { norm } from './calculos';

// Los artículos de tus tickets y capturas de pedidos: se leen, se unen por nombre y se guardan en el historial.
// Un mismo artículo con dos nombres («Tomato sauce» y «Salsa de tomate») cuenta como uno. Esto es solo texto: no hay IA aquí.

export interface Articulo {
  /** El nombre como salió en el ticket. */
  crudo: string;
  /** El nombre con el que se guarda y se cuenta. */
  n: string;
  q?: string;
  precio?: number;
}

/** Nombres que ya sabemos unir (inglés y español). La llave va sin acentos ni mayúsculas. */
export const SINONIMOS: Record<string, string> = {
  'tomato sauce': 'Salsa de tomate', 'salsa de tomate': 'Salsa de tomate', 'tomato puree': 'Salsa de tomate', 'puree de tomate': 'Salsa de tomate',
  milk: 'Leche', leche: 'Leche', 'whole milk': 'Leche', 'leche entera': 'Leche', 'skim milk': 'Leche descremada', 'leche descremada': 'Leche descremada',
  eggs: 'Huevo', egg: 'Huevo', huevos: 'Huevo', huevo: 'Huevo', 'large eggs': 'Huevo',
  'chicken breast': 'Pechuga de pollo', 'pechuga de pollo': 'Pechuga de pollo', chicken: 'Pollo', pollo: 'Pollo',
  banana: 'Plátano', bananas: 'Plátano', platano: 'Plátano', platanos: 'Plátano',
  avocado: 'Aguacate', avocados: 'Aguacate', aguacate: 'Aguacate', aguacates: 'Aguacate',
  tomato: 'Jitomate', tomatoes: 'Jitomate', jitomate: 'Jitomate', jitomates: 'Jitomate',
  onion: 'Cebolla', onions: 'Cebolla', cebolla: 'Cebolla', cebollas: 'Cebolla',
  garlic: 'Ajo', ajo: 'Ajo', lettuce: 'Lechuga', lechuga: 'Lechuga', spinach: 'Espinaca', espinaca: 'Espinaca', espinacas: 'Espinaca',
  carrot: 'Zanahoria', carrots: 'Zanahoria', zanahoria: 'Zanahoria', zanahorias: 'Zanahoria',
  cucumber: 'Pepino', cucumbers: 'Pepino', pepino: 'Pepino', pepinos: 'Pepino',
  broccoli: 'Brócoli', brocoli: 'Brócoli', lemon: 'Limón', lemons: 'Limón', limon: 'Limón', limones: 'Limón', lime: 'Limón', limes: 'Limón',
  strawberries: 'Fresa', strawberry: 'Fresa', fresas: 'Fresa', fresa: 'Fresa', pineapple: 'Piña', pina: 'Piña',
  'greek yogurt': 'Yogur griego', 'yogur griego': 'Yogur griego', yogurt: 'Yogur', yogur: 'Yogur', 'plain yogurt': 'Yogur natural', 'yogur natural': 'Yogur natural',
  butter: 'Mantequilla', mantequilla: 'Mantequilla', cheese: 'Queso', queso: 'Queso', 'cheddar cheese': 'Queso cheddar', 'mozzarella cheese': 'Queso mozzarella',
  cream: 'Crema', crema: 'Crema', 'sour cream': 'Crema', oats: 'Avena', avena: 'Avena', 'rolled oats': 'Avena',
  rice: 'Arroz', arroz: 'Arroz', beans: 'Frijol', frijol: 'Frijol', frijoles: 'Frijol', lentils: 'Lenteja', lenteja: 'Lenteja', lentejas: 'Lenteja',
  chickpeas: 'Garbanzo', garbanzo: 'Garbanzo', garbanzos: 'Garbanzo', pasta: 'Pasta', spaghetti: 'Pasta', quinoa: 'Quinoa',
  bread: 'Pan', pan: 'Pan', tortillas: 'Tortillas', tortilla: 'Tortillas', 'corn tortillas': 'Tortillas de maíz', 'tortillas de maiz': 'Tortillas de maíz',
  'olive oil': 'Aceite de oliva', 'aceite de oliva': 'Aceite de oliva', oil: 'Aceite', aceite: 'Aceite', 'vegetable oil': 'Aceite',
  flour: 'Harina', harina: 'Harina', sugar: 'Azúcar', azucar: 'Azúcar', salt: 'Sal', sal: 'Sal', honey: 'Miel', miel: 'Miel',
  'peanut butter': 'Crema de cacahuate', 'crema de cacahuate': 'Crema de cacahuate', almonds: 'Almendra', almendras: 'Almendra',
  'orange juice': 'Jugo de naranja', 'jugo de naranja': 'Jugo de naranja', water: 'Agua', agua: 'Agua',
  'paper towels': 'Papel de cocina', 'paper towel': 'Papel de cocina', 'toilet paper': 'Papel de baño', 'papel de bano': 'Papel de baño',
  'dish soap': 'Jabón de trastes', 'dish detergent': 'Jabón de trastes', 'laundry detergent': 'Detergente', detergente: 'Detergente',
  'trash bags': 'Bolsas de basura', 'bolsas de basura': 'Bolsas de basura', 'dog food': 'Croquetas', croquetas: 'Croquetas', 'dog treats': 'Premios para perro', treats: 'Premios para perro'
};

const MAYUS = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);

/** El nombre con el que se guarda: lo que ya sabemos unir, lo que guardaste antes, o el mismo nombre bien escrito. */
export function nombreUnido(crudo: string, guardados: Record<string, string> = {}): string {
  const k = norm(crudo);
  return SINONIMOS[k] ?? guardados[k] ?? MAYUS(crudo.trim().replace(/\s+/g, ' ').toLowerCase());
}
/** Si el nombre ya se sabe unir (de fábrica o porque lo guardaste antes). Lo que no, es lo único que se le podría preguntar a la IA. */
export const yaSeUne = (crudo: string, guardados: Record<string, string> = {}) => norm(crudo) in SINONIMOS || norm(crudo) in guardados;

/**
 * Lee líneas escritas a mano: «Leche entera 2 L $38.50», «2 x Huevo $76», «Aguacate, 45».
 * Una línea sin precio también vale. Los números sueltos al inicio («2 x») son la cantidad.
 */
export function leerLineas(texto: string): Articulo[] {
  const salida: Articulo[] = [];
  for (const linea of texto.split(/\n|;/).map((x) => x.trim()).filter(Boolean).slice(0, 80)) {
    let t = linea, q: string | undefined, precio: number | undefined;
    const conSigno = /\$\s*(\d{1,5}(?:[.,]\d{1,2})?)\s*$/.exec(t);
    if (conSigno) { precio = Number(conSigno[1].replace(',', '.')); t = t.slice(0, conSigno.index).trim(); }
    else {
      const coma = /,\s*(\d{1,5}(?:[.,]\d{1,2})?)\s*$/.exec(t);
      if (coma) { precio = Number(coma[1].replace(',', '.')); t = t.slice(0, coma.index).trim(); }
    }
    const ini = /^(\d+(?:[.,]\d+)?)\s*[x×]\s+/i.exec(t);
    if (ini) { q = ini[1]; t = t.slice(ini[0].length).trim(); }
    const fin = /\s(\d+(?:[.,]\d+)?\s?(?:kg|g|l|lt|ml|oz|lb|pzas?|piezas?|paquetes?|pack|latas?))$/i.exec(t);
    if (fin) { q = q ? q + ' · ' + fin[1] : fin[1]; t = t.slice(0, fin.index).trim(); }
    // «Tomato sauce 2 $48»: un entero chico pegado al precio es la cantidad
    const suelto = precio != null && !q ? /\s(\d{1,2})$/.exec(t) : null;
    if (suelto) { q = suelto[1]; t = t.slice(0, suelto.index).trim(); }
    t = t.replace(/^[-•*\s]+/, '').replace(/[,\s]+$/, '');
    if (!t || /^\d+$/.test(t)) continue;
    salida.push({ crudo: t.slice(0, 80), n: t.slice(0, 80), ...(q ? { q: q.slice(0, 40) } : {}), ...(precio != null && Number.isFinite(precio) ? { precio } : {}) });
  }
  return salida;
}

/** Le pone a cada artículo el nombre con que se une. */
export const unir = (arts: Articulo[], guardados: Record<string, string> = {}): Articulo[] => arts.map((a) => ({ ...a, n: nombreUnido(a.crudo, guardados) }));

