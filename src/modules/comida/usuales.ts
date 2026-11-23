import type { Receta } from '../../core/db';
import { norm } from './calculos';
import { descartar, menciona, type Exclusiones } from './seguro';

// «Mis usuales»: lo que tengo siempre en casa o quiero tener. De uno en uno se propone un ingrediente nuevo.
// Primero sale de un catálogo corto (sin IA); la IA, a pedido, propone otros. Lo que rechazas no vuelve.

export interface IdeaUsual {
  n: string;
  /** Por qué conviene, en una frase y sin consejos médicos. */
  por: string;
  /** Ids de tus recetas donde ya cabe. */
  recetas: string[];
  /** Si ninguna receta sirve, una forma de usarlo en una que ya haces. */
  adaptacion?: string;
  /** Un siguiente paso concreto. */
  paso: string;
  ia?: true;
}
export interface DatosUsuales {
  items: string[];
  /** «No me interesa»: no vuelve. */
  rechazados: string[];
  /** «Ahora no»: vuelve en un tiempo. Nombre → fecha. */
  ahoraNo: Record<string, string>;
  /** La idea que está esperando tu respuesta. */
  idea: IdeaUsual | null;
}
export const usualesVacios = (): DatosUsuales => ({ items: [], rechazados: [], ahoraNo: {}, idea: null });
export const DIAS_AHORA_NO = 14;

interface Catalogo { n: string; por: string; con: RegExp | null; adaptacion: string }
/** Ideas de partida. Cada una dice qué recetas tuyas ya podrían usarla (por ingrediente). */
export const CATALOGO: Catalogo[] = [
  { n: 'Tomillo', por: 'Practica el aroma del tomillo: un toque de hierba fresca cambia un platillo sencillo.', con: /pollo|champi|calabaz/, adaptacion: 'Prueba una sopa de pollo con unas ramitas de tomillo.' },
  { n: 'Coles de Bruselas', por: 'Cambiar de verduras de vez en cuando suma variedad de sabores y de nutrientes.', con: /brocoli|coliflor|calabac/, adaptacion: 'Cámbialas por el brócoli en una receta que ya haces.' },
  { n: 'Jengibre', por: 'Un poco de jengibre rallado da un sabor fresco a sopas, salteados y tés.', con: /pollo|zanahoria|calabaz/, adaptacion: 'Ralla un poco en un salteado de verduras.' },
  { n: 'Cúrcuma', por: 'Color y sabor suave para arroces, huevos y caldos. Con una pizca basta.', con: /arroz|huevo|lenteja/, adaptacion: 'Agrega una pizca al arroz o a las lentejas.' },
  { n: 'Orégano fresco', por: 'Cambiar el orégano seco por fresco es una forma fácil de variar el sabor.', con: /jitomate|pollo|queso/, adaptacion: 'Úsalo al final en una salsa de jitomate.' },
  { n: 'Cilantro', por: 'Una hierba fresca al final hace que casi cualquier plato se sienta nuevo.', con: /taco|pollo|aguacate|frijol/, adaptacion: 'Pícalo sobre tacos o frijoles.' },
  { n: 'Espinaca', por: 'Las hojas verdes se mezclan fácil en huevos, sopas y licuados sin cambiar mucho el sabor.', con: /huevo|sopa|pasta|queso/, adaptacion: 'Agrégala a unos huevos revueltos.' },
  { n: 'Garbanzo', por: 'Una lata de garbanzo resuelve una comida rápida y sirve para ensaladas, hummus y guisos.', con: /ensalada|verdura|jitomate/, adaptacion: 'Mézclalo con verduras y limón para una ensalada.' },
  { n: 'Champiñones', por: 'Se cocinan en minutos y le dan cuerpo a tacos, pastas y revueltos.', con: /taco|huevo|pasta|tortilla/, adaptacion: 'Saltéalos con cebolla para unos tacos.' },
  { n: 'Chía', por: 'Una cucharada en el yogur o la avena agrega textura y variedad al desayuno.', con: /yogur|avena|fruta/, adaptacion: 'Agrégala al yogur con fruta.' },
  { n: 'Ajonjolí', por: 'Un puñito tostado por encima da crujiente a verduras, arroz y ensaladas.', con: /arroz|verdura|ensalada/, adaptacion: 'Espolvoréalo sobre un arroz o unas verduras salteadas.' },
  { n: 'Calabacita', por: 'Es suave y combina con casi todo: en tacos, sopas, cremas o salteada.', con: /taco|queso|sopa|pasta/, adaptacion: 'Saltéala en cuadritos con un poco de queso.' }
];

/** ¿Ya la tienes, la rechazaste o la pospusiste hace poco? */
export function noToca(n: string, d: DatosUsuales, hoy: string): boolean {
  if ([...d.items, ...d.rechazados].some((x) => menciona(n, x) || menciona(x, n))) return true;
  const f = Object.entries(d.ahoraNo).find(([k]) => norm(k) === norm(n))?.[1];
  if (!f) return false;
  return (new Date(hoy + 'T12:00:00').getTime() - new Date(f + 'T12:00:00').getTime()) / 86400000 < DIAS_AHORA_NO;
}
/** La siguiente idea del catálogo que no excluye ninguno de los dos y que aún no has visto. Sin IA. */
export function siguienteIdea(d: DatosUsuales, ex: Exclusiones, recetas: Receta[], hoy: string): IdeaUsual | null {
  for (const c of CATALOGO) {
    if (noToca(c.n, d, hoy) || descartar({ nombre: c.n, ingredientes: [c.n], textos: [c.por, c.adaptacion] }, ex)) continue;
    const rs = c.con ? recetas.filter((r) => r.vis !== 'guardada' && r.ing.some((i) => c.con!.test(norm(i[2])))).slice(0, 2).map((r) => r.id) : [];
    return { n: c.n, por: c.por, recetas: rs, ...(rs.length ? {} : { adaptacion: c.adaptacion }), paso: 'Agrega ' + c.n.toLowerCase() + ' a la lista de compras.' };
  }
  return null;
}
