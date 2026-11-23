import Dexie, { type Table } from 'dexie';
import { db, CLAVES_PRIVADAS } from './db';
import { GRUPOS, combinable, fechaDeGrupo, fechasPorGrupo, type Grupo, type TipoTabla } from './grupos';
import { fechasDeCambio, ponerFechasDeCambio } from './modificado';
import { guardarCopia, leerZip, ponerFotos, type Datos, type Fila } from './respaldo';

// Continuidad entre el teléfono y la computadora: un paquete (el respaldo ZIP) que sale de un aparato y entra en el otro.
// Antes de cambiar nada, la app compara por área cuándo cambió cada lado y te dice qué se reemplaza, qué se conserva y qué
// se combina. Tú confirmas. Todo se guarda antes en una copia interna, para volver con «Deshacer». Sin cuentas ni servidor.

export type Decision = 'reemplazar' | 'conservar' | 'combinar';
export type Sugerida = Decision | 'igual';

export interface FilaRevision {
  id: string;
  nombre: string;
  /** Cuándo cambió esta área aquí y en el paquete (milisegundos). null: no se sabe. */
  aqui: number | null;
  archivo: number | null;
  hayAqui: boolean;
  hayArchivo: boolean;
  sugerida: Sugerida;
  opciones: Decision[];
}
export interface Revision {
  formato: number;
  creado: number | null;
  origen: NonNullable<Datos['origen']>;
  /** Un respaldo del formato 1 no trae fechas por área: se propone traer todo, como antes. */
  sinFechas: boolean;
  filas: FilaRevision[];
}

/** Lo que cada lado dice de una misma área. */
export interface Comparacion {
  aqui: number | null;
  archivo: number | null;
  /** Fecha del área en el último intercambio (cuando se entregó o se recibió un paquete). 0 si nunca hubo uno. */
  base: number;
  hayAqui: boolean;
  hayArchivo: boolean;
  sinFechas: boolean;
}

/**
 * Qué se propone para un área. Por fechas: si solo cambió un lado desde el último intercambio, se queda lo de ese lado;
 * si cambiaron los dos, se combina (cuando se puede) o gana lo más reciente. Nunca se borra lo de aquí con un archivo vacío.
 */
export function decidir(g: Grupo, c: Comparacion): Sugerida {
  if (!c.hayArchivo && !c.hayAqui) return 'igual';
  if (!c.hayArchivo) return 'conservar';
  if (!c.hayAqui) return 'reemplazar';
  if (c.sinFechas || c.archivo == null) return 'reemplazar';
  if (c.aqui != null && c.aqui === c.archivo) return 'igual';
  const cambioArchivo = c.archivo > c.base;
  const cambioAqui = c.aqui == null ? true : c.aqui > c.base;
  if (!cambioArchivo && !cambioAqui) return 'igual';
  if (cambioArchivo && !cambioAqui) return 'reemplazar';
  if (!cambioArchivo && cambioAqui) return 'conservar';
  return combinable(g) ? 'combinar' : c.archivo > (c.aqui ?? 0) ? 'reemplazar' : 'conservar';
}
export const opcionesDe = (g: Grupo): Decision[] => (combinable(g) ? ['reemplazar', 'conservar', 'combinar'] : ['reemplazar', 'conservar']);

export interface Leido { datos: Datos; archivos: Record<string, Uint8Array> }
/** Lo que hay aquí, por tabla. */
export interface EstadoLocal { cambios: Record<string, number>; base: Record<string, number>; filas: Record<string, number> }

const hayFilas = (g: Grupo, filas: Record<string, number>) => Object.keys(g.tablas).some((t) => (filas[t] ?? 0) > 0);

/** Compara el paquete con lo que hay aquí. No cambia nada. */
export function comparar(l: Leido, local: EstadoLocal): Revision {
  const sinFechas = !l.datos.areas;
  const filas: FilaRevision[] = GRUPOS.map((g) => {
    const delArchivo = Object.fromEntries(Object.keys(g.tablas).map((t) => [t, l.datos.tablas[t]?.length ?? 0]));
    const c: Comparacion = {
      aqui: fechaDeGrupo(g, local.cambios), archivo: l.datos.areas?.[g.id] ?? null, base: local.base[g.id] ?? 0,
      hayAqui: hayFilas(g, local.filas), hayArchivo: hayFilas(g, delArchivo), sinFechas
    };
    return { id: g.id, nombre: g.nombre, aqui: c.aqui, archivo: c.archivo, hayAqui: c.hayAqui, hayArchivo: c.hayArchivo, sugerida: decidir(g, c), opciones: opcionesDe(g) };
  });
  return { formato: l.datos.formato, creado: l.datos.creado ?? null, origen: l.datos.origen ?? 'otro', sinFechas, filas };
}

export async function estadoLocal(base = db): Promise<EstadoLocal> {
  const filas: Record<string, number> = {};
  for (const g of GRUPOS) for (const t of Object.keys(g.tablas)) filas[t] = await base.table(t).count();
  const guardada = ((await base.table('sync').get('base'))?.v ?? {}) as Record<string, number>;
  return { cambios: await fechasDeCambio(base), base: guardada, filas };
}

/** Lee el paquete y lo compara con lo de aquí. null si no es un respaldo de la app (o es de una versión más nueva). */
export async function revisarZip(bytes: Uint8Array, base = db): Promise<{ leido: Leido; revision: Revision } | null> {
  const leido = leerZip(bytes);
  if (!leido) return null;
  return { leido, revision: comparar(leido, await estadoLocal(base)) };
}

// ---------- Aplicar ----------
/** Una clave de fila como texto, también cuando la clave tiene dos partes. */
const claveDe = (f: Fila, keyPath: string | string[] | undefined): string => {
  if (Array.isArray(keyPath)) return JSON.stringify(keyPath.map((k) => Dexie.getByKeyPath(f, k)));
  return JSON.stringify(keyPath ? Dexie.getByKeyPath(f, keyPath) : null);
};
/** Qué identifica a una fila suelta sin su número automático. Una foto se distingue por su tamaño. */
const firma = (f: Fila): string => JSON.stringify(Object.entries(f).filter(([k]) => k !== 'id').sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => [k, v instanceof Blob ? 'blob:' + v.type + ':' + v.size : v]));

async function reemplazarTabla(t: Table, filas: Fila[]) {
  if (t.name === 'ajustes') {
    const privadas = (await t.toArray()).filter((f) => CLAVES_PRIVADAS.has(String((f as Fila).k)));
    await t.clear();
    await t.bulkPut(privadas);
    await t.bulkPut(filas.filter((f) => !CLAVES_PRIVADAS.has(String(f.k))));
    return;
  }
  await t.clear();
  await t.bulkPut(filas);
}
/** Junta lo del paquete con lo de aquí. En una misma clave gana el lado más reciente del área. */
async function combinarTabla(t: Table, tipo: TipoTabla, filas: Fila[], ganaArchivo: boolean) {
  if (tipo === 'bloque') return;
  const entrantes = t.name === 'ajustes' ? filas.filter((f) => !CLAVES_PRIVADAS.has(String(f.k))) : filas;
  const actuales = (await t.toArray()) as Fila[];
  if (tipo === 'clave') {
    const kp = t.schema.primKey.keyPath;
    const aqui = new Set(actuales.map((f) => claveDe(f, kp)));
    await t.bulkPut(entrantes.filter((f) => ganaArchivo || !aqui.has(claveDe(f, kp))));
    return;
  }
  const vistas = new Set(actuales.map(firma));
  await t.bulkAdd(entrantes.filter((f) => !vistas.has(firma(f))).map((f) => Object.fromEntries(Object.entries(f).filter(([k]) => k !== 'id'))));
}

export interface ResultadoAplicar { copia: number; reemplazadas: string[]; combinadas: string[] }

/**
 * Aplica lo que confirmaste. Antes guarda una copia interna de lo que tienes (para «Deshacer»). Lo que no está en
 * `decisiones`, o está en «conservar», no se toca.
 */
export async function aplicar(l: Leido, decisiones: Record<string, Decision>, base = db, ahora = Date.now()): Promise<ResultadoAplicar> {
  const copia = await guardarCopia('importar', ahora, base);
  const antes = await fechasDeCambio(base);
  const baseGuardada = ((await base.table('sync').get('base'))?.v ?? {}) as Record<string, number>;
  const grupos = GRUPOS.filter((g) => decisiones[g.id] === 'reemplazar' || decisiones[g.id] === 'combinar');
  const tablas = grupos.flatMap((g) => Object.keys(g.tablas).map((t) => base.table(t)));
  const reemplazadas: string[] = [], combinadas: string[] = [];
  // Las fotos vuelven a ser fotos antes de abrir la transacción.
  const filasDe = (t: string) => ponerFotos(l.datos.tablas[t] ?? [], l.archivos) as Fila[];
  const porTabla = new Map(grupos.flatMap((g) => Object.keys(g.tablas).map((t) => [t, filasDe(t)] as const)));

  if (tablas.length) await base.transaction('rw', tablas, async () => {
    for (const g of grupos) {
      const ganaArchivo = (l.datos.areas?.[g.id] ?? 0) > (fechaDeGrupo(g, antes) ?? 0);
      for (const [nombre, tipo] of Object.entries(g.tablas)) {
        const t = base.table(nombre), filas = porTabla.get(nombre) ?? [];
        if (decisiones[g.id] === 'reemplazar') await reemplazarTabla(t, filas);
        else await combinarTabla(t, tipo, filas, ganaArchivo);
      }
      (decisiones[g.id] === 'reemplazar' ? reemplazadas : combinadas).push(g.id);
    }
  });

  // Fechas después del cambio: lo reemplazado queda con la fecha del paquete; lo combinado cuenta como cambio de aquí.
  const fechas: Record<string, number> = {};
  const nuevaBase = { ...baseGuardada };
  for (const g of grupos) {
    const delArchivo = l.datos.areas?.[g.id];
    for (const t of Object.keys(g.tablas)) fechas[t] = decisiones[g.id] === 'reemplazar' ? delArchivo ?? ahora : ahora;
    nuevaBase[g.id] = delArchivo ?? ahora;
  }
  await ponerFechasDeCambio(base, fechas);
  await base.table('sync').put({ k: 'base', v: nuevaBase });
  return { copia, reemplazadas, combinadas };
}

/** Todo lo del archivo reemplaza lo de aquí (las áreas que traen datos). */
export const reemplazarTodo = (r: Revision): Record<string, Decision> =>
  Object.fromEntries(r.filas.filter((f) => f.hayArchivo).map((f) => [f.id, 'reemplazar' as const]));
/** Lo que se propone para cada área. Las que no cambian no se tocan. */
export const propuesta = (r: Revision): Record<string, Decision> =>
  Object.fromEntries(r.filas.filter((f) => f.sugerida !== 'igual').map((f) => [f.id, f.sugerida as Decision]));

/**
 * Al entregar un paquete, lo que hay aquí queda como el último intercambio: así, lo que cambie después se verá como cambio de aquí.
 */
export async function marcarEntrega(base = db): Promise<void> {
  const cambios = await fechasDeCambio(base);
  const actual = ((await base.table('sync').get('base'))?.v ?? {}) as Record<string, number>;
  await base.table('sync').put({ k: 'base', v: { ...actual, ...fechasPorGrupo(cambios) } });
}
