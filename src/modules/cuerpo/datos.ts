import { db, type DiaPeriodo, type FotoCuerpo, type Medida, type Peso } from '../../core/db';
import { registroNuevo } from '../ajustes';
import { ZONAS_EXTRA, ZONAS_INICIALES, mismaZona } from './calculos';

// Cuerpo es el único que escribe pesos, medidas, fotos y Período. Quitar una zona de la vista no borra su historial.

// ---------- Zonas de medida ----------
export interface Zonas { visibles: string[]; conocidas: string[] }
export async function leerZonas(): Promise<Zonas> {
  const v = (await db.cuerpo.get('zonas'))?.v as Partial<Zonas> | undefined;
  const lista = (x: unknown, otra: string[]) => (Array.isArray(x) && x.every((t) => typeof t === 'string') && x.length ? (x as string[]) : otra);
  const visibles = lista(v?.visibles, ZONAS_INICIALES);
  const conocidas = [...new Set([...lista(v?.conocidas, [...ZONAS_INICIALES, ...ZONAS_EXTRA]), ...visibles])];
  return { visibles, conocidas };
}
export async function guardarZonas(z: Zonas) { await db.cuerpo.put({ k: 'zonas', v: JSON.parse(JSON.stringify(z)) }); }

// ---------- Medidas y peso ----------
export const todasLasMedidas = () => db.medidas.toArray();
export async function ultimoPeso(): Promise<Peso | undefined> {
  return (await db.pesos.orderBy('fecha').toArray()).sort((a, b) => (a.fecha === b.fecha ? (a.id ?? 0) - (b.id ?? 0) : a.fecha < b.fecha ? -1 : 1)).pop();
}

export interface Deshacer { medidas: number[]; reemplazadas: Medida[]; peso?: number; pesoAntes?: Peso }

/** Guarda las medidas y el peso de un día. Si ya había una medida ese día, la cambia. Devuelve lo necesario para deshacer. */
export async function guardarDelDia(fecha: string, valores: Record<string, number>, peso: number | null, unidad: 'lb' | 'kg'): Promise<Deshacer> {
  const u: Deshacer = { medidas: [], reemplazadas: [] };
  await db.transaction('rw', [db.medidas, db.pesos], async () => {
    for (const [zona, cm] of Object.entries(valores)) {
      const previas = (await db.medidas.where('fecha').equals(fecha).toArray()).filter((m) => mismaZona(m.zona, zona));
      for (const p of previas) { u.reemplazadas.push(p); await db.medidas.delete(p.id!); }
      u.medidas.push(await db.medidas.add({ zona, fecha, cm }));
    }
    if (peso != null) {
      const previo = await db.pesos.where('fecha').equals(fecha).first();
      if (previo) { u.pesoAntes = previo; await db.pesos.delete(previo.id!); }
      u.peso = await db.pesos.add({ fecha, valor: peso, unidad });
    }
  });
  await registroNuevo();
  return u;
}
export async function deshacerDelDia(u: Deshacer) {
  await db.transaction('rw', [db.medidas, db.pesos], async () => {
    await db.medidas.bulkDelete(u.medidas);
    await db.medidas.bulkPut(u.reemplazadas);
    if (u.peso != null) await db.pesos.delete(u.peso);
    if (u.pesoAntes) await db.pesos.put(u.pesoAntes);
  });
}

// ---------- Fotos ----------
export async function listarFotos(): Promise<FotoCuerpo[]> {
  return (await db.fotos.toArray()).sort((a, b) => (a.fecha === b.fecha ? (a.id ?? 0) - (b.id ?? 0) : a.fecha < b.fecha ? -1 : 1));
}
export async function contarFotos(): Promise<number> { return db.fotos.count(); }
export async function agregarFoto(fecha: string, foto: Blob): Promise<number> {
  const id = await db.fotos.add({ fecha, foto });
  await registroNuevo();
  return id;
}
export async function quitarFoto(id: number) { await db.fotos.delete(id); }
export async function ponerFoto(f: FotoCuerpo) { await db.fotos.put(f); }

// ---------- Período ----------
export async function diasDePeriodo(): Promise<Record<string, string>> {
  return Object.fromEntries((await db.periodo.toArray()).map((d: DiaPeriodo) => [d.fecha, d.nota]));
}
export async function marcarDia(fecha: string, nota: string) { await db.periodo.put({ fecha, nota }); await registroNuevo(); }
export async function quitarDia(fecha: string) { await db.periodo.delete(fecha); }
