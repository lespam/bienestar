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
}
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
}
/** Entreno: Cuándo y dónde, y lo último que elegiste en Rutina. */
export interface AjusteEntreno { k: string; v: unknown }
/** Entreno: marcas de Calentar, por fecha. */
export interface Calentado { fecha: string; item: string }
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
  }
}

/** Tablas que nunca salen en el respaldo. */
export const FUERA_DEL_RESPALDO = new Set(['copias']);
/** Claves de Ajustes que nunca salen del teléfono (tu clave de IA, fase 8). */
export const CLAVES_PRIVADAS = new Set(['ia.clave']);

export let db = new BaseBienestar();

/** Solo para pruebas: usar una base nueva. */
export function usarBase(nueva: BaseBienestar) { db = nueva; }
