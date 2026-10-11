import Dexie, { type Table } from 'dexie';

// Una sola base para toda la app. Cada tabla tiene un módulo dueño (plan, punto 3):
// solo ese módulo escribe en ella; los demás leen por su puerta pública.

/** Ajustes: preferencias y estado de la app, guardados como clave y valor. */
export interface Ajuste { k: string; v: unknown }
/** Base: el contenido personal (privado), una fila por parte del archivo. */
export interface ParteContenido { parte: string; datos: unknown }
/** Mente: frases, imágenes, videos y canciones de tu Colección. */
export interface ItemColeccion {
  id?: number;
  tipo: 'frase' | 'cancion' | 'libro' | 'video' | 'imagen';
  texto: string;
  origen: string;
  mensaje?: string;
  tema?: string;
  /** De dónde se copió una vez ('fabrica:...' o 'contenido:...'); vacío si lo agregaste tú. */
  semilla?: string;
  /** Video o canción que agregaste: el link para abrirlo (YouTube, Apple Music). */
  url?: string;
  /** Imagen que elegiste de tu teléfono. */
  imagen?: Blob;
}
/** Mente: una meta de tu tablero de visión, con los 4 pasos de WOOP. */
export interface Meta {
  id?: number;
  titulo: string;
  /** Trazo del ícono (vision, chart, rutina...) cuando no hay imagen tuya. */
  icono: string;
  imagen?: Blob;
  resultado: string;
  obstaculo: string;
  plan: string;
  destino: 'alma' | 'rutina';
}
/** Alma: un bloque de tu planeador (por ejemplo «Movimiento y salud»). */
export interface AreaAlma { id?: number; nombre: string; corto: string; color: number }
/** Alma: lo que escribiste en una semana. `lunes` es la fecha del lunes. `dias` son lunes a viernes. */
export interface SemanaAlma { lunes: string; dias: string[]; areas: Record<string, string> }
/** Mente: ajustes propios (por ahora, lo que quitaste de lo que viene de fábrica). */
export interface AjusteMente { k: string; v: unknown }
/** Mente: el mensaje elegido para cada día, para que no cambie durante el día. */
export interface MensajeDia { fecha: string; item: number }
/** Entreno: una sesión de entrenamiento. Abierta hasta que tú la termines; una parcial también cuenta. */
export interface Sesion {
  id?: number;
  fecha: string;
  tipo: 'rutina' | 'cardio';
  rutina?: 'A' | 'B' | 'C';
  modo: 'mixto' | 'casa' | 'libro';
  primero: 'gym' | 'casa';
  abierta: 0 | 1;
  inicio: number;
  fin?: number;
  /** Cómo te sentiste al terminar, comparado con antes de entrenar (opcional). */
  sintio?: 'mejor' | 'igual' | 'peor';
  nota: string;
}
/** Entreno: una serie, guardada en cuanto la marcas. Los valores siguen lo que pide el libro para ese ejercicio. */
export interface Serie {
  id?: number;
  sesion: number;
  clave: string;
  /** Sustituto en casa que usaste en lugar del ejercicio de gym. */
  sust?: string;
  n: number;
  v: Record<string, number | null>;
  unidad: 'lb' | 'kg';
  hora: number;
}
/** Entreno: lo que duró de verdad cada descanso. */
export interface Descanso { id?: number; sesion?: number; despues?: string; seg: number; hora: number }
/** Entreno: tu sustituto en casa para un ejercicio de gym, del índice del libro. */
export interface Sustituto { clave: string; nombre: string; pagina?: string }
/** Entreno: lo tuyo en la ficha de cada ejercicio. */
export interface FichaPropia {
  clave: string;
  animacion?: Blob;
  cancion?: string;
  letra?: string;
  tips?: string[];
  videos?: { t: string; u: string }[];
  faciles?: { n: string; p: string }[];
  dificiles?: { n: string; p: string }[];
}
/** Entreno: Cuándo y dónde, y lo último que elegiste en Rutina. */
export interface AjusteEntreno { k: string; v: unknown }
/** Entreno: marcas de Calentar, por fecha. */
export interface Calentado { fecha: string; item: string }
/** Herramientas: lo que está corriendo (cronómetro, temporizador) y tu duración de descanso preferida. */
export interface AjusteHerramienta { k: string; v: unknown }
/** Cuerpo: un peso. Se guarda oculto; tú decides cuándo verlo. */
export interface Peso { id?: number; fecha: string; valor: number; unidad: 'lb' | 'kg' }
/** Cuerpo: una medida de una zona, en cm. */
export interface Medida { id?: number; zona: string; fecha: string; cm: number }
/** Cuerpo: una foto reducida. Vive solo dentro de la app. */
export interface FotoCuerpo { id?: number; fecha: string; foto: Blob }
/** Cuerpo: un día marcado de Período, con nota opcional. */
export interface DiaPeriodo { fecha: string; nota: string }
/** Cuerpo: tus zonas de medida (cuáles ves y cuáles conoces). */
export interface AjusteCuerpo { k: string; v: unknown }
/** Comida: un ingrediente. [cantidad, unidad, nombre, grupo de equivalentes]. La cantidad puede faltar ("al gusto"). */
export type Ingrediente = [number | null, string, string, string?];
/** Comida: una nota o un tip tuyo en una receta. */
export interface NotaReceta { k: 'tip' | 'nota'; t: string; /** La sugirió la IA y la revisaste antes de guardarla. */ ia?: true }
/** Comida: un cambio de ingredientes que acerca la receta a una referencia. */
export interface CambioReceta { dir: string; t: string; d: { k?: number; p?: number; c?: number; g?: number }; add?: Ingrediente; set?: [string, number]; hecho?: boolean }
/** Comida: una receta tuya. Las del archivo de contenido se copian una vez y desde ahí son tuyas. */
export interface Receta {
  id: string;
  n: string;
  cat: 'Desayuno' | 'Comida' | 'Cena' | 'Colación' | 'Base';
  sub?: 'AM' | 'PM';
  /** Cuántas porciones rinde. */
  y: number;
  t: string;
  src: string;
  /** Qué es 1 porción, en palabras. */
  u1: string;
  eq?: Record<string, number>;
  k: number | null;
  p: number | null;
  c: number | null;
  g: number | null;
  ing: Ingrediente[];
  steps: string[];
  acomp?: string[] | string;
  nota?: string;
  /** Qué datos se estimaron al pasar la receta a la app. */
  est?: string[];
  sw?: CambioReceta[];
  /** Cuando alguien no come un ingrediente: con qué va su versión. */
  alt?: { w: 'les' | 'jeff'; x: string; by: string };
  /** Porción de cada quien en esta receta, si cambiaste la de su perfil. */
  por?: { les?: number; jeff?: number };
  nts?: NotaReceta[];
  img?: Blob;
  page?: Blob;
  /** La receta como estaba antes de aplicar cambios, para "Volver a la receta original". */
  orig?: string;
}
/** Comida: lo que sabe la app de Les o de Jeff. Las referencias las escribe una persona; la app no las calcula. */
export interface PerfilComida {
  quien: 'les' | 'jeff';
  /** Quién las definió. */
  src: 'nut' | 'nos' | 'book' | null;
  fecha: string | null;
  k: [number, number] | null;
  p: number | null;
  c: number | null;
  g: number | null;
  mk: number | null;
  mp: number | null;
  /** Cuántas porciones de una receta come. */
  por: number;
  gustos: string[];
  no: string[];
  nota: string;
}
/** Comida: ajustes y marcas propias (por ejemplo, qué recetas del archivo ya se copiaron). */
export interface AjusteComida { k: string; v: unknown }
/** Comida: un alimento que registraste. `comida`: 0 Desayuno, 1 Comida, 2 Colaciones, 3 Cena. Los números son aproximados y editables. */
export interface Alimento {
  id?: number;
  fecha: string;
  comida: 0 | 1 | 2 | 3;
  n: string;
  por: string;
  k: number | null;
  p: number;
  c: number;
  g: number;
  /** La receta de la que salió, si salió de una. */
  receta?: string;
}
/** Comida: un lugar del menú. `lugar`: d Desayuno, c Comida, n Cena, a Colación AM, p Colación PM. */
export type LugarMenu = 'd' | 'c' | 'n' | 'a' | 'p';
export interface ItemMenu {
  fecha: string;
  lugar: LugarMenu;
  /** dos: los dos comen lo mismo. cada: cada quien lo suyo. takeout. decidir: queda por decidir. col: una colación armada por partes. */
  t: 'dos' | 'cada' | 'takeout' | 'decidir' | 'col';
  /** Nombre del plato, del lugar de takeout o de lo que está por decidir. */
  n: string;
  /** dos: la receta. cada: la receta de cada quien. */
  r?: string;
  rl?: string;
  rj?: string;
  /** cada: el plato de cada quien. */
  nl?: string;
  nj?: string;
  /** Tu nota en esa comida. */
  nota?: string;
  /** takeout: cuánto costó, en pesos, y quién comió (2 los dos, l tú, j Jeff). */
  costo?: number;
  quien?: '2' | 'l' | 'j';
  /** takeout: la foto del ticket. Se queda en el teléfono y nunca se manda a la IA. */
  ticket?: Blob;
  /** col: las partes de la colación y, si va junto con una comida, con cuál. */
  col?: { base: string; fruta: string; extra: string; junto: 'd' | 'c' | 'n' | null };
}
/** Comida: una cosa por preparar dentro de una tanda. `fm` (fecha:lugar) dice de qué comida del menú salió; lo que agregas tú no lo lleva. */
export interface ItemPrep { t: string; f: string; s?: string; m?: number; ok: boolean; fm?: string }
/** Comida: una tanda de preparación en un día y a una hora. `auto`: la creó el menú y se va si queda vacía. */
export interface Tanda { id: string; fecha: string; hora: string; auto?: boolean; items: ItemPrep[] }
/** Comida: un día flexible. Todo es opcional. La fase del ciclo y el día de la semana se calculan, no se guardan. */
export interface DiaFlexible { fecha: string; hora: string; emo: string; lugar: string; sueno: string; estres: string; comi: string }
/** Base: copias internas antes de importar o de cambiar la estructura. Nunca van en el respaldo. */
export interface CopiaInterna { id?: number; fecha: number; motivo: string; datos: Blob }

export class BaseBienestar extends Dexie {
  ajustes!: Table<Ajuste, string>;
  contenido!: Table<ParteContenido, string>;
  coleccion!: Table<ItemColeccion, number>;
  mensajes!: Table<MensajeDia, string>;
  copias!: Table<CopiaInterna, number>;
  sesiones!: Table<Sesion, number>;
  series!: Table<Serie, number>;
  descansos!: Table<Descanso, number>;
  sustitutos!: Table<Sustituto, string>;
  fichas!: Table<FichaPropia, string>;
  entreno!: Table<AjusteEntreno, string>;
  calentados!: Table<Calentado, [string, string]>;
  herramientas!: Table<AjusteHerramienta, string>;
  pesos!: Table<Peso, number>;
  medidas!: Table<Medida, number>;
  fotos!: Table<FotoCuerpo, number>;
  periodo!: Table<DiaPeriodo, string>;
  cuerpo!: Table<AjusteCuerpo, string>;
  recetas!: Table<Receta, string>;
  perfiles!: Table<PerfilComida, string>;
  comida!: Table<AjusteComida, string>;
  registro!: Table<Alimento, number>;
  menu!: Table<ItemMenu, [string, string]>;
  flexibles!: Table<DiaFlexible, string>;
  metas!: Table<Meta, number>;
  areas!: Table<AreaAlma, number>;
  semanas!: Table<SemanaAlma, string>;
  mente!: Table<AjusteMente, string>;

  constructor(nombre = 'bienestar') {
    super(nombre);
    this.version(1).stores({
      ajustes: 'k',
      contenido: 'parte',
      coleccion: '++id, tipo, &semilla',
      mensajes: 'fecha',
      copias: '++id, fecha'
    });
    // Fase 2: Entreno. Antes de cambiar la estructura, la app guarda una copia interna (plan, punto 2b).
    this.version(2).stores({
      sesiones: '++id, fecha, abierta',
      series: '++id, sesion, clave, &[sesion+clave+n]',
      descansos: '++id, sesion',
      sustitutos: 'clave',
      fichas: 'clave',
      entreno: 'k',
      calentados: '[fecha+item], fecha'
    });
    // Fase 3: Herramientas.
    this.version(3).stores({ herramientas: 'k' });
    // Fase 4: Cuerpo.
    this.version(4).stores({ pesos: '++id, fecha', medidas: '++id, zona, fecha', fotos: '++id, fecha', periodo: 'fecha', cuerpo: 'k' });
    // Fase 5: Comida.
    this.version(5).stores({ recetas: 'id, cat', perfiles: 'quien', comida: 'k' });
    // Fase 5b: registro de comida por día.
    this.version(6).stores({ registro: '++id, fecha' });
    // Fase 5c: menú de la semana.
    this.version(7).stores({ menu: '[fecha+lugar], fecha' });
    // Fase 6: días flexibles.
    this.version(8).stores({ flexibles: 'fecha' });
    // Fase 7: metas, áreas y semanas del planeador, ajustes de Mente.
    this.version(9).stores({ metas: '++id', areas: '++id', semanas: 'lunes', mente: 'k' });
  }
}

/** Tablas que nunca salen en el respaldo. */
export const FUERA_DEL_RESPALDO = new Set(['copias']);
/** Claves de Ajustes que nunca salen del teléfono (tu clave de IA, fase 8). */
export const CLAVES_PRIVADAS = new Set(['ia.clave']);

export let db = new BaseBienestar();

/** Solo para pruebas: usar una base nueva. */
export function usarBase(nueva: BaseBienestar) { db = nueva; }
