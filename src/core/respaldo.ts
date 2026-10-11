import Dexie from 'dexie';
import { zipSync, unzipSync, strToU8, strFromU8 } from 'fflate';
import { db, FUERA_DEL_RESPALDO, CLAVES_PRIVADAS } from './db';
import { iso, DIA_MS } from './fechas';

// Respaldo: un ZIP con datos.json y la carpeta fotos/ (plan, punto 2a).
export const FORMATO = 1;
const DIAS_COPIA = 7;

type Fila = Record<string, unknown>;
interface Datos { app: 'bienestar'; formato: number; fecha: string; tablas: Record<string, Fila[]> }

const EXT: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };

/** Cambia cada Blob por una referencia a fotos/ y guarda sus bytes aparte. */
async function sacarFotos(v: unknown, fotos: Record<string, Uint8Array>): Promise<unknown> {
  if (v instanceof Blob) {
    const ruta = 'fotos/' + (Object.keys(fotos).length + 1) + '.' + (EXT[v.type] ?? 'bin');
    fotos[ruta] = new Uint8Array(await v.arrayBuffer());
    return { $foto: ruta, tipo: v.type };
  }
  if (Array.isArray(v)) return Promise.all(v.map((x) => sacarFotos(x, fotos)));
  if (v && typeof v === 'object') {
    const o: Fila = {};
    for (const [k, x] of Object.entries(v)) o[k] = await sacarFotos(x, fotos);
    return o;
  }
  return v;
}

function ponerFotos(v: unknown, archivos: Record<string, Uint8Array>): unknown {
  if (Array.isArray(v)) return v.map((x) => ponerFotos(x, archivos));
  if (v && typeof v === 'object') {
    const o = v as Fila;
    if (typeof o.$foto === 'string') {
      const b = archivos[o.$foto];
      return new Blob(b ? [b as BlobPart] : [], { type: String(o.tipo ?? '') });
    }
    const r: Fila = {};
    for (const [k, x] of Object.entries(o)) r[k] = ponerFotos(x, archivos);
    return r;
  }
  return v;
}

/** Todo lo tuyo en un ZIP, menos las copias internas y tu clave de IA. */
export async function crearZip(ahora = new Date(), base: Dexie = db): Promise<Uint8Array> {
  const tablas: Record<string, Fila[]> = {};
  const fotos: Record<string, Uint8Array> = {};
  for (const t of base.tables) {
    if (FUERA_DEL_RESPALDO.has(t.name)) continue;
    let filas = (await t.toArray()) as Fila[];
    if (t.name === 'ajustes') filas = filas.filter((f) => !CLAVES_PRIVADAS.has(String(f.k)));
    // Un cronómetro o temporizador corriendo no tiene sentido en otro momento: no sale en el respaldo.
    if (t.name === 'herramientas') filas = filas.filter((f) => !String(f.k).startsWith('en-marcha:'));
    tablas[t.name] = (await sacarFotos(filas, fotos)) as Fila[];
  }
  const datos: Datos = { app: 'bienestar', formato: FORMATO, fecha: iso(ahora), tablas };
  return zipSync({ 'datos.json': strToU8(JSON.stringify(datos)), ...fotos }, { level: 6 });
}

export function nombreRespaldo(ahora = new Date()) { return 'bienestar-' + iso(ahora) + '.zip'; }

/** Lee un ZIP; si no es un respaldo de la app, devuelve null. */
export function leerZip(bytes: Uint8Array): { datos: Datos; archivos: Record<string, Uint8Array> } | null {
  try {
    const archivos = unzipSync(bytes);
    const j = archivos['datos.json'];
    if (!j) return null;
    const datos = JSON.parse(strFromU8(j)) as Datos;
    if (datos?.app !== 'bienestar' || typeof datos.formato !== 'number' || typeof datos.tablas !== 'object') return null;
    if (datos.formato > FORMATO) return null;
    return { datos, archivos };
  } catch {
    return null;
  }
}

/** Cambia tus datos por los del archivo, sin tocar copias internas ni tu clave de IA. */
async function reemplazar(datos: Datos, archivos: Record<string, Uint8Array>) {
  const tablas = db.tables.filter((t) => !FUERA_DEL_RESPALDO.has(t.name));
  await db.transaction('rw', tablas, async () => {
    for (const t of tablas) {
      if (t.name === 'ajustes') {
        const privadas = (await t.toArray()).filter((f) => CLAVES_PRIVADAS.has(String((f as Fila).k)));
        await t.clear();
        await t.bulkPut(privadas);
      } else {
        await t.clear();
      }
      const filas = (ponerFotos(datos.tablas[t.name] ?? [], archivos) as Fila[])
        .filter((f) => !(t.name === 'ajustes' && CLAVES_PRIVADAS.has(String(f.k))));
      await t.bulkPut(filas);
    }
  });
}

/** Copia interna de lo que tienes ahora. Se borra sola después de 7 días. */
export async function guardarCopia(motivo: string, ahora = Date.now()): Promise<number> {
  await limpiarCopias(ahora);
  const zip = await crearZip(new Date(ahora));
  return db.copias.add({ fecha: ahora, motivo, datos: new Blob([zip as BlobPart], { type: 'application/zip' }) });
}

export async function limpiarCopias(ahora = Date.now()) {
  await db.copias.where('fecha').below(ahora - DIAS_COPIA * DIA_MS).delete();
}

/** La copia más reciente que todavía se puede usar. */
export async function ultimaCopia(ahora = Date.now()) {
  await limpiarCopias(ahora);
  return db.copias.orderBy('fecha').last();
}

export async function volverACopia(id: number): Promise<boolean> {
  const c = await db.copias.get(id);
  if (!c) return false;
  const l = leerZip(new Uint8Array(await c.datos.arrayBuffer()));
  if (!l) return false;
  await reemplazar(l.datos, l.archivos);
  return true;
}

export type ResultadoImportar = { ok: true; copia: number } | { ok: false };

/** Importa un respaldo. Antes guarda una copia interna, para "Deshacer". */
export async function importarZip(bytes: Uint8Array): Promise<ResultadoImportar> {
  const l = leerZip(bytes);
  if (!l) return { ok: false };
  const copia = await guardarCopia('importar');
  await reemplazar(l.datos, l.archivos);
  return { ok: true, copia };
}

/**
 * Antes de que la base cambie de estructura (por ejemplo al llegar Entrenamiento), guarda una copia interna
 * de lo que ya tienes, para "Volver a mis datos anteriores" (plan, punto 2b). Debe correr antes de abrir la base de la app.
 */
export async function copiaAntesDeActualizar(nombre = 'bienestar', versionNueva = 5, ahora = Date.now()): Promise<boolean> {
  if (!(await Dexie.exists(nombre))) return false;
  const vieja = new Dexie(nombre);
  try {
    await vieja.open();
    if (vieja.verno >= versionNueva || !vieja.tables.some((t) => t.name === 'copias')) return false;
    const zip = await crearZip(new Date(ahora), vieja);
    await vieja.table('copias').add({ fecha: ahora, motivo: 'actualizar', datos: new Blob([zip as BlobPart], { type: 'application/zip' }) });
    return true;
  } catch {
    return false;
  } finally {
    vieja.close();
  }
}
