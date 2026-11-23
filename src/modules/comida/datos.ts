import { db, type Alimento, type DiaFlexible, type ItemMenu, type PerfilComida, type Receta, type Tanda } from '../../core/db';
import { parte } from '../../core/contenido';
import { contarFuncion } from '../../core/uso';
import { registroNuevo } from '../ajustes';
import { comprasVacias, seccionDe, type EstadoCompras } from './compras';
import { mezclarHay, vigente, type HayGuardado } from './nevera';
import { usualesVacios, type DatosUsuales } from './usuales';
import { agregarConsejos } from './consejos';
import { idTanda, sincronizar } from './preparacion';
import { tipsVacios, type TipsGuardados } from './tips';
import { fechaDe, norm, type UsoReceta } from './calculos';
import { fijoNuevo, semanasPorReceta, sugerir, VENTANA, type Fijo, type SemanasDe, type Sugerencia } from './fijos';
import { lunesDe as lunesDeIso, sumar as sumarDiasIso } from './patrones';

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
  const imagenes = (await parte<Record<string, Blob>>('imagenes')) ?? {};
  // En el archivo, img es una ruta; aquí pasa a ser la imagen guardada.
  const conImagen = (x: Partial<Receta>): Partial<Receta> => {
    const resto = limpio({ ...x, img: undefined });
    const b = x.id ? imagenes[x.id] : undefined;
    return b ? { ...resto, img: b } : resto;
  };
  let n = 0;
  await db.transaction('rw', [db.recetas, db.comida], async () => {
    const hechas = new Set(((await db.comida.get('recetas-copiadas'))?.v as string[] | undefined) ?? []);
    const nuevas: Receta[] = [];
    const completar: Receta[] = [];
    const mias = new Map((await db.recetas.bulkGet(lista.filter((x) => x.id && hechas.has(x.id)).map((x) => x.id!))).filter(Boolean).map((r) => [r!.id, r!]));
    for (const x of lista) {
      if (!x.id || !x.n) continue;
      if (hechas.has(x.id)) {
        // Ya es tuya: solo se le agrega lo que le falta (foto y de dónde viene), nunca se pisa lo tuyo.
        const mia = mias.get(x.id);
        const c = conImagen(x);
        if (mia && ((!mia.img && c.img) || (!mia.origen && c.origen))) {
          completar.push({ ...mia, img: mia.img ?? c.img, img_tipo: mia.img_tipo ?? c.img_tipo, origen: mia.origen ?? c.origen });
        }
        continue;
      }
      hechas.add(x.id);
      nuevas.push({ cat: 'Comida', y: 1, t: '', src: '', u1: '', k: null, p: null, c: null, g: null, ing: [], steps: [], ...conImagen(x) } as Receta);
    }
    if (nuevas.length) { await db.recetas.bulkPut(nuevas); n = nuevas.length; }
    if (completar.length) await db.recetas.bulkPut(completar);
    await db.comida.put({ k: 'recetas-copiadas', v: [...hechas] });
  });
  return n;
}

// ---------- Registro de comida ----------
export const alimentosDe = (fecha: string) => db.registro.where('fecha').equals(fecha).sortBy('id');
export async function agregarAlimentos(filas: Omit<Alimento, 'id'>[]): Promise<number[]> {
  const ids = (await db.registro.bulkAdd(filas.map((f) => limpio(f)), { allKeys: true })) as number[];
  contarFuncion('registrar-comida');
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
/** Una receta guardada que usas en el menú pasa sola a «A la vista». */
async function alaVista(filas: ItemMenu[]) {
  const ids = [...new Set(filas.flatMap((m) => [m.r, m.rl, m.rj]).filter((x): x is string => !!x))];
  if (!ids.length) return;
  for (const r of await db.recetas.bulkGet(ids)) if (r?.vis) await db.recetas.update(r.id, { vis: undefined });
}
export async function ponerEnMenu(m: ItemMenu) { await db.menu.put(sinTicket(m)); contarFuncion('planear-menu'); await alaVista([m]); await sincronizarPrep([m.fecha]); }
export const quitarDelMenu = (fecha: string, lugar: ItemMenu['lugar']) => db.menu.delete([fecha, lugar]).then(() => sincronizarPrep([fecha]));
/** Guarda varios lugares a la vez y avisa que ya hay un registro nuevo. */
export async function ponerVariosEnMenu(filas: ItemMenu[]) {
  await db.menu.bulkPut(filas.map(sinTicket));
  contarFuncion('planear-menu');
  await alaVista(filas);
  await sincronizarPrep([...new Set(filas.map((f) => f.fecha))]);
  await registroNuevo();
}
/** Deja esos días del menú exactamente como estaban (para Deshacer). */
export async function reponerMenu(fechas: string[], filas: ItemMenu[]) {
  await db.transaction('rw', db.menu, async () => {
    await db.menu.where('fecha').anyOf(fechas).delete();
    await db.menu.bulkPut(filas.map(sinTicket));
  });
  await sincronizarPrep(fechas);
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

// ---------- Plan de preparación ----------
export async function leerPrep(): Promise<Tanda[]> {
  return ((await db.comida.get('prep'))?.v as Tanda[] | undefined) ?? [];
}
export async function guardarPrep(t: Tanda[]) {
  await db.comida.put({ k: 'prep', v: limpio(t) });
  await registroNuevo();
}
/** Lo que se cambió en el menú se refleja en la preparación de esos días. */
export async function sincronizarPrep(fechas: string[]) {
  if (!fechas.length) return;
  const [tandas, menu] = await Promise.all([leerPrep(), db.menu.where('fecha').anyOf(fechas).toArray()]);
  const hoy = fechaDe(0);
  const ids = [...new Set(menu.flatMap((m) => [m.r, m.rl, m.rj]).filter((x): x is string => !!x))];
  const recetas = new Map((await db.recetas.bulkGet(ids)).filter((r): r is Receta => !!r).map((r) => [r.id, r]));
  await guardarPrep(agregarConsejos(sincronizar(tandas, menu, fechas, hoy), menu, recetas, fechas, hoy, idTanda));
}

// ---------- Tips ----------
export async function leerTips(): Promise<TipsGuardados> {
  return { ...tipsVacios(), ...((await db.comida.get('tips'))?.v as Partial<TipsGuardados> | undefined) };
}
export async function guardarTips(t: TipsGuardados) {
  await db.comida.put({ k: 'tips', v: limpio(t) });
  await registroNuevo();
}

// ---------- Días flexibles ----------
export const leerFlexibles = () => db.flexibles.toArray();
export const flexibleDe = (fecha: string) => db.flexibles.get(fecha);
export async function guardarFlexible(d: DiaFlexible) { await db.flexibles.put(limpio(d)); await registroNuevo(); }
export const quitarFlexible = (fecha: string) => db.flexibles.delete(fecha);

/** Cuántas veces elegiste cada receta en el menú y cuántos días la registraste. Se calcula; no se guarda. */
export async function usoDeRecetas(): Promise<Record<string, UsoReceta>> {
  const [menu, reg] = await Promise.all([db.menu.toArray(), db.registro.toArray()]);
  const out: Record<string, UsoReceta> = {};
  const de = (id: string) => (out[id] ??= { e: 0, r: 0 });
  for (const m of menu) for (const id of new Set([m.r, m.rl, m.rj])) if (id) de(id).e++;
  const dias = new Set<string>();
  for (const a of reg) if (a.receta && !dias.has(a.receta + '|' + a.fecha)) { dias.add(a.receta + '|' + a.fecha); de(a.receta).r++; }
  return out;
}

/** Guarda (archiva) o deja a la vista todas las recetas de un origen. Devuelve los ids que cambiaron, para Deshacer. */
export async function visibilidadDeOrigen(origen: string, guardar: boolean): Promise<string[]> {
  const enMenu = new Set((await db.menu.toArray()).flatMap((m) => [m.r, m.rl, m.rj]).filter((x): x is string => !!x));
  const cambian = (await db.recetas.toArray()).filter((r) => (r.origen ?? 'Mías') === origen && (guardar ? !r.vis && !enMenu.has(r.id) : !!r.vis)).map((r) => r.id);
  await db.transaction('rw', db.recetas, async () => { for (const id of cambian) await db.recetas.update(id, { vis: guardar ? 'guardada' : undefined }); });
  return cambian;
}
export async function ponerVisibilidad(ids: string[], guardar: boolean) {
  await db.transaction('rw', db.recetas, async () => { for (const id of ids) await db.recetas.update(id, { vis: guardar ? 'guardada' : undefined }); });
}

// ---------- Historial de compras ----------
export const leerHistorial = () => db.historial.toArray();
/** Marcar algo como comprado lo anota (una vez por artículo y día); desmarcarlo lo quita. */
export async function anotarCompra(n: string, fecha: string, lugar?: string, q?: string) {
  const art = norm(n);
  if (await db.historial.where('art').equals(art).filter((h) => h.fecha === fecha).count()) return;
  await db.historial.add({ art, n, fecha, ...(lugar ? { lugar } : {}), ...(q ? { q } : {}) });
  contarFuncion('compra-marcada');
}
export async function quitarCompra(n: string, fecha: string) {
  const art = norm(n);
  await db.historial.where('art').equals(art).filter((h) => h.fecha === fecha).delete();
}
export async function leerSilenciadas(): Promise<string[]> { return ((await db.comida.get('silencio-compras'))?.v as string[] | undefined) ?? []; }
export async function silenciarCompra(art: string) { await db.comida.put({ k: 'silencio-compras', v: [...new Set([...(await leerSilenciadas()), art])] }); }

// ---------- Mis fijos y lo que se repite ----------
export async function leerFijos(): Promise<Fijo[]> { return ((await db.comida.get('fijos'))?.v as Fijo[] | undefined) ?? []; }
export const guardarFijos = (f: Fijo[]) => db.comida.put({ k: 'fijos', v: limpio(f) });
export async function leerSilenciadasFijos(): Promise<Record<string, string>> { return ((await db.comida.get('fijos-no'))?.v as Record<string, string> | undefined) ?? {}; }
export async function silenciarSugerencia(id: string, hoy: string) { await db.comida.put({ k: 'fijos-no', v: { ...(await leerSilenciadasFijos()), [id]: hoy } }); }
/** El menú y lo registrado de las últimas `semanas` semanas (con la actual y lo que viene). */
async function historiaReciente(hoy: string, semanas: number) {
  const desde = sumarDiasIso(lunesDeIso(hoy), -7 * (semanas - 1));
  const [menu, registro] = await Promise.all([db.menu.where('fecha').aboveOrEqual(desde).toArray(), db.registro.where('fecha').aboveOrEqual(desde).toArray()]);
  return { menu, registro };
}
export async function sugerenciasDeFijos(hoy: string): Promise<Sugerencia[]> {
  const [{ menu, registro }, fijos, no] = await Promise.all([historiaReciente(hoy, VENTANA), leerFijos(), leerSilenciadasFijos()]);
  return sugerir(menu, registro, fijos.map((f) => f.r), no, hoy);
}
export async function semanasDeReceta(id: string, hoy: string, semanas = 8): Promise<SemanasDe> {
  const { menu, registro } = await historiaReciente(hoy, semanas);
  return semanasPorReceta(menu, registro, hoy, semanas)[id] ?? { plan: 0, comido: 0 };
}
/** Un fijo nuevo: sus huecos salen de donde la pusiste en las últimas semanas. */
export async function nuevoFijo(id: string, hoy: string): Promise<Fijo> {
  const { menu } = await historiaReciente(hoy, VENTANA);
  return fijoNuevo(menu, id, hoy);
}

// ---------- Con lo que tengo: lo que hay en casa ----------
export async function leerHay(): Promise<HayGuardado | null> { return ((await db.comida.get('hay'))?.v as HayGuardado | undefined) ?? null; }
export async function guardarHay(g: HayGuardado | null) {
  if (g) await db.comida.put({ k: 'hay', v: limpio(g) });
  else await db.comida.delete('hay');
}
/** Lo que falta para un plan se agrega a la lista de compras de esta semana. Devuelve lo que de verdad se agregó. */
export async function agregarFaltantes(nombres: string[], hoy: string): Promise<string[]> {
  const lunes = lunesDeIso(hoy);
  const e = await leerCompras(lunes);
  const nuevos: string[] = [];
  for (const n of nombres) {
    const nombre = n.trim().charAt(0).toUpperCase() + n.trim().slice(1);
    if (!nombre || e.extras.some((x) => norm(x.n) === norm(nombre)) || nuevos.some((x) => norm(x) === norm(nombre))) continue;
    nuevos.push(nombre);
  }
  if (!nuevos.length) return [];
  await guardarCompras(lunes, { ...e, extras: [...e.extras, ...nuevos.map((n) => ({ n, q: '', sec: seccionDe(n), urg: 'falta' as const, chk: false }))] });
  return nuevos;
}
/** Deshace `agregarFaltantes`: quita de la lista de esta semana solo lo que se había agregado. */
export async function quitarFaltantes(nombres: string[], hoy: string) {
  const lunes = lunesDeIso(hoy);
  const e = await leerCompras(lunes);
  await guardarCompras(lunes, { ...e, extras: e.extras.filter((x) => !nombres.some((n) => norm(n) === norm(x.n))) });
}

/** Lo que dijiste que hay en casa se suma a «Lo que hay hoy». Devuelve cómo dejarlo como estaba. */
export async function anotarHay(nuevos: { n: string; q?: string; urgente?: boolean }[], hoy: string): Promise<() => Promise<void>> {
  const antes = await leerHay();
  await guardarHay({ fecha: hoy, items: mezclarHay(vigente(antes, hoy), nuevos) });
  return () => guardarHay(antes);
}
/** Registra lo que comiste con solo el nombre, sin números. Devuelve cómo quitarlo. */
export async function anotarComido(nombres: string[], comida: 0 | 1 | 2 | 3, fecha: string): Promise<() => Promise<void>> {
  const ids = await agregarAlimentos(nombres.map((n) => ({ fecha, comida, n, por: '1 porción', k: null, p: 0, c: 0, g: 0 })));
  return () => db.registro.bulkDelete(ids);
}

// ---------- Mis usuales ----------
export async function leerUsuales(): Promise<DatosUsuales> { return { ...usualesVacios(), ...((await db.comida.get('usuales'))?.v as Partial<DatosUsuales> | undefined) }; }
export async function guardarUsuales(d: DatosUsuales) {
  await db.comida.put({ k: 'usuales', v: limpio(d) });
  await registroNuevo();
}
