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
/** Base: copias internas antes de importar o de cambiar la estructura. Nunca van en el respaldo. */
export interface CopiaInterna { id?: number; fecha: number; motivo: string; datos: Blob }

export class BaseBienestar extends Dexie {
  ajustes!: Table<Ajuste, string>;
  contenido!: Table<ParteContenido, string>;
  coleccion!: Table<ItemColeccion, number>;
  mensajes!: Table<MensajeDia, string>;
  copias!: Table<CopiaInterna, number>;

  constructor(nombre = 'bienestar') {
    super(nombre);
    this.version(1).stores({
      ajustes: 'k',
      contenido: 'parte',
      coleccion: '++id, tipo, &semilla',
      mensajes: 'fecha',
      copias: '++id, fecha'
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
