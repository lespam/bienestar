import { db, type Alimento, type ItemMenu, type PerfilComida, type Receta } from '../../core/db';
import { parte } from '../../core/contenido';
import { registroNuevo } from '../ajustes';
import { comprasVacias, type EstadoCompras } from './compras';

// Comida es la única dueña de recetas y perfiles. Las recetas del archivo de contenido se copian una vez
// a tu tabla y desde ahí son tuyas: si quitas una, no vuelve; si el archivo trae nuevas, solo se agregan esas.

export const perfilInicial = (quien: 'les' | 'jeff'): PerfilComida => ({ quien, src: null, fecha: null, k: null, p: null, c: null, g: null, mk: null, mp: null, por: 1, gustos: [], no: [], nota: '' });

const limpio = <T>(x: T): T => JSON.parse(JSON.stringify(x));

// ---------- Perfiles ----------
export async function leerPerfiles(): Promise<Record<'les' | 'jeff', PerfilComida>> {
  const filas = await db.perfiles.toArray();
  const de = (q: 'les' | 'jeff') => ({ ...perfilInicial(q), ...(filas.find((f) => f.quien === q) ?? {}) });
  return { les: de('les'), jeff: de('jeff') };
}
export async function guardarPerfil(p: PerfilComida) {
  await db.perfiles.put(limpio(p));
  await registroNuevo();
}

// ---------- Recetas ----------
export const listarRecetas = () => db.recetas.toArray();
export const verReceta = (id: string) => db.recetas.get(id);
export async function guardarReceta(r: Receta) { await db.recetas.put({ ...limpio({ ...r, img: undefined, page: undefined }), img: r.img, page: r.page }); }
export const quitarReceta = (id: string) => db.recetas.delete(id);

/** Copia las recetas del archivo de contenido que todavía no copiaste. Devuelve cuántas agregó. */
export async function sembrarRecetas(): Promise<number> {
  const pack = await parte<{ recetas?: Partial<Receta>[] }>('recetas');
  const lista = Array.isArray(pack) ? (pack as Partial<Receta>[]) : pack?.recetas;
  if (!lista?.length) return 0;
  let n = 0;
  await db.transaction('rw', [db.recetas, db.comida], async () => {
    const hechas = new Set(((await db.comida.get('recetas-copiadas'))?.v as string[] | undefined) ?? []);
    const nuevas: Receta[] = [];
    for (const x of lista) {
      if (!x.id || !x.n || hechas.has(x.id)) continue;
      hechas.add(x.id);
      nuevas.push({ cat: 'Comida', y: 1, t: '', src: '', u1: '', k: null, p: null, c: null, g: null, ing: [], steps: [], ...limpio(x) } as Receta);
    }
    if (nuevas.length) { await db.recetas.bulkPut(nuevas); n = nuevas.length; }
    await db.comida.put({ k: 'recetas-copiadas', v: [...hechas] });
  });
  return n;
}

// ---------- Registro de comida ----------
export const alimentosDe = (fecha: string) => db.registro.where('fecha').equals(fecha).sortBy('id');
export async function agregarAlimentos(filas: Omit<Alimento, 'id'>[]): Promise<number[]> {
  const ids = (await db.registro.bulkAdd(filas.map((f) => limpio(f)), { allKeys: true })) as number[];
  await registroNuevo();
  return ids;
}
export const guardarAlimento = (a: Alimento) => db.registro.put(limpio(a));
export const quitarAlimento = (id: number) => db.registro.delete(id);
/** Deja un día exactamente como estaba (para Deshacer). */
export async function reponerDia(fecha: string, filas: Alimento[]) {
  await db.transaction('rw', db.registro, async () => {
    await db.registro.where('fecha').equals(fecha).delete();
    await db.registro.bulkPut(filas.map((f) => limpio(f)));
  });
}
/** Lo último que registraste en cualquier día, lo más nuevo primero. */
export async function ultimosRegistrados(limite = 60): Promise<Alimento[]> {
  return db.registro.orderBy('id').reverse().limit(limite).toArray();
}

// ---------- Menú ----------
export const menuDe = (fechas: string[]) => db.menu.where('fecha').anyOf(fechas).toArray();
const sinTicket = (m: ItemMenu) => ({ ...limpio({ ...m, ticket: undefined }), ...(m.ticket ? { ticket: m.ticket } : {}) });
export async function ponerEnMenu(m: ItemMenu) { await db.menu.put(sinTicket(m)); }
export const quitarDelMenu = (fecha: string, lugar: ItemMenu['lugar']) => db.menu.delete([fecha, lugar]).then(() => {});
/** Guarda varios lugares a la vez y avisa que ya hay un registro nuevo. */
export async function ponerVariosEnMenu(filas: ItemMenu[]) {
  await db.menu.bulkPut(filas.map(sinTicket));
  await registroNuevo();
}
/** Deja esos días del menú exactamente como estaban (para Deshacer). */
export async function reponerMenu(fechas: string[], filas: ItemMenu[]) {
  await db.transaction('rw', db.menu, async () => {
    await db.menu.where('fecha').anyOf(fechas).delete();
    await db.menu.bulkPut(filas.map(sinTicket));
  });
}
export const itemDeMenu = (fecha: string, lugar: ItemMenu['lugar']) => db.menu.get([fecha, lugar]);

// ---------- Lista de compras ----------
// Lo que marcas y lo que agregas se guarda por semana, con el lunes como llave.
export async function leerCompras(lunes: string): Promise<EstadoCompras> {
  const fila = await db.comida.get('compras:' + lunes);
  return { ...comprasVacias(), ...((fila?.v as Partial<EstadoCompras> | undefined) ?? {}) };
}
export async function guardarCompras(lunes: string, e: EstadoCompras) {
  await db.comida.put({ k: 'compras:' + lunes, v: limpio(e) });
  await registroNuevo();
}
