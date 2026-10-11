import type { ItemMenu, Receta } from '../../core/db';
import { norm } from './calculos';
import { nombreDia } from './semana';

// Los tips suman (agregar, preparar, disfrutar); ninguno pide quitar o restringir.

export interface Tip { id: string; t: string; w: string }
/** Los que trae la app, en el orden en que van llegando: 6 al empezar y uno nuevo cada semana. */
export const TIPS: Tip[] = [
  { id: 'agua', t: 'Deja agua a la vista', w: 'Una botella en el escritorio hace más fácil tomar agua.' },
  { id: 'grano', t: 'Cocina una base de grano para varios días', w: 'Con arroz o quinoa listos, armas un plato en minutos.' },
  { id: 'verdura', t: 'Agrega una verdura a lo que ya comes', w: 'Sumar algo es más fácil que cambiar todo el plato.' },
  { id: 'colacion', t: 'Ten una colación lista para salir', w: 'Una fruta o unas nueces en la bolsa ayudan en los días largos.' },
  { id: 'pantalla', t: 'Come sin pantalla cuando puedas', w: 'Así disfrutas más el sabor.' },
  { id: 'refri', t: 'Pasa al refrigerador lo que cocinarás mañana', w: 'Así se descongela despacio y está listo a tiempo.' },
  { id: 'dos', t: 'Usa un ingrediente en dos recetas', w: 'Compras menos y cocinas una vez. Ej. el pollo de la tinga y del arroz.' },
  { id: 'congela', t: 'Congela porciones de sopa', w: 'Para los días con poco tiempo o pocas ganas de cocinar.' },
  { id: 'libres', t: 'Deja comidas libres en el menú', w: 'Así hay espacio para invitaciones y cambios de plan.' },
  { id: 'mise', t: 'Pica y mide todo antes de prender la estufa', w: 'Cocinar se siente más tranquilo cuando todo está a la mano.' },
  { id: 'doble', t: 'Cocina doble y congela una porción', w: 'Se recalienta en 3 minutos cuando no tienes tiempo.' },
  { id: 'salsa', t: 'Si vas a llevar la comida, guarda la salsa aparte', w: 'Así no se humedece.' },
  { id: 'lista', t: 'Haz la lista antes de ir al súper', w: 'Con el menú a la vista, compras lo que de verdad vas a usar.' },
  { id: 'fruta', t: 'Deja la fruta lavada y a la mano', w: 'Es más fácil elegirla cuando ya está lista.' }
];
export const TIPS_AL_EMPEZAR = 6;

export interface TipsGuardados { inicio: string | null; ok: string[]; mios: { id: string; t: string; ok: boolean; ia?: true }[] }
export const tipsVacios = (): TipsGuardados => ({ inicio: null, ok: [], mios: [] });

const dif = (a: string, b: string) => Math.round((new Date(+b.slice(0, 4), +b.slice(5, 7) - 1, +b.slice(8, 10)).getTime() - new Date(+a.slice(0, 4), +a.slice(5, 7) - 1, +a.slice(8, 10)).getTime()) / 864e5);

export interface FilaTip { id: string; t: string; w: string; ok: boolean; mio?: boolean; nuevo?: boolean; ia?: true }
/** Los tips que ya llegaron, con tus marcas. Primero los tuyos; el que llegó esta semana lleva «Nuevo». */
export function tipsVisibles(g: TipsGuardados, hoy: string): FilaTip[] {
  const semanas = g.inicio ? Math.max(0, Math.floor(dif(g.inicio, hoy) / 7)) : 0;
  const n = Math.min(TIPS.length, TIPS_AL_EMPEZAR + semanas);
  const ok = new Set(g.ok);
  const base: FilaTip[] = TIPS.slice(0, n).map((x, i) => ({ ...x, ok: ok.has(x.id), nuevo: semanas > 0 && semanas <= TIPS.length - TIPS_AL_EMPEZAR && i === n - 1 && !ok.has(x.id) }));
  const mios: FilaTip[] = g.mios.map((x) => ({ id: x.id, t: x.t, w: x.ia ? 'Lo sugirió la IA y lo guardaste tú.' : 'Lo agregaste tú.', ok: x.ok, mio: true, ...(x.ia ? { ia: true as const } : {}) }));
  return [...mios, ...base];
}

// ---------- Combinaciones ----------
export interface Combinacion { b: string; t: string; x: string; ing: RegExp[] }
/** `ing`: las recetas de tu recetario que ya las usan (todas las partes tienen que aparecer). */
export const COMBINACIONES: Combinacion[] = [
  { b: 'Proteína completa', t: 'Arroz + frijoles', x: 'Cada uno tiene los aminoácidos que al otro le faltan. No tienen que ir en el mismo plato: basta con comerlos el mismo día.', ing: [/arroz/, /frijol/] },
  { b: 'Proteína completa', t: 'Tortilla de maíz + frijoles', x: 'Pasa lo mismo que con el arroz: juntos dan una proteína completa. También basta con comerlos el mismo día.', ing: [/tortilla/, /frijol/] },
  { b: 'Más hierro', t: 'Lentejas + jitomate o limón', x: 'La vitamina C del jitomate o del limón ayuda a absorber el hierro de las lentejas, los frijoles y el garbanzo. Funciona cuando van en la misma comida.', ing: [/lenteja|frijol|garbanzo/, /jitomate|limon/] },
  { b: 'Más vitaminas', t: 'Verduras + un poco de aceite', x: 'El licopeno del jitomate y el betacaroteno de la zanahoria se absorben mejor con un poco de grasa, como aceite o aguacate.', ing: [/jitomate|zanahoria/, /aceite|aguacate/] },
  { b: 'Más proteína', t: 'Avena + leche o yogur', x: 'Con leche o yogur, el desayuno de avena tiene más proteína.', ing: [/avena/, /leche|yogur|yogurt/] }
];
export const MAX_RECETAS_POR_COMBINACION = 3;

export const recetasDe = (c: Combinacion, recetas: Receta[]) =>
  recetas.filter((r) => c.ing.every((rx) => r.ing.some((i) => rx.test(norm(i[2]))))).slice(0, MAX_RECETAS_POR_COMBINACION);

/** Los días de esta semana en que alguna de esas recetas está en el menú. */
export function diasEnMenu(ids: string[], menu: ItemMenu[]): string[] {
  const set = new Set(ids);
  const dias = [...new Set(menu.filter((m) => [m.r, m.rl, m.rj].some((x) => x && set.has(x))).map((m) => m.fecha))].sort();
  return dias.map((f) => nombreDia(f).toLowerCase());
}
export const yLista = (a: string[]) => (a.length > 1 ? a.slice(0, -1).join(', ') + ' y ' + a[a.length - 1] : (a[0] ?? ''));
