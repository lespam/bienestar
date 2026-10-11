import { db } from '../../core/db';
import { CRONO_NUEVO, tempNuevo, type EstadoCrono, type EstadoTemp } from './calculos';

// Herramientas guarda solo lo que está corriendo (para que siga bien si cierras la app) y tu duración de descanso preferida.
// La moneda no guarda nada. Las claves "en-marcha:" no salen en el respaldo.
const K_CRONO = 'en-marcha:crono', K_TEMP = 'en-marcha:temporizador', K_DESCANSO = 'descanso:largo';

export async function leerCrono(): Promise<EstadoCrono> {
  const f = await db.herramientas.get(K_CRONO);
  const v = f?.v as Partial<EstadoCrono> | undefined;
  if (!v || typeof v.acum !== 'number' || !Array.isArray(v.vueltas)) return structuredClone(CRONO_NUEVO);
  return { inicio: typeof v.inicio === 'number' ? v.inicio : null, acum: v.acum, vueltas: v.vueltas.filter((x) => typeof x === 'number') };
}
export async function guardarCrono(e: EstadoCrono) { await db.herramientas.put({ k: K_CRONO, v: structuredClone(plano(e)) }); }

export async function leerTemp(): Promise<EstadoTemp> {
  const f = await db.herramientas.get(K_TEMP);
  const v = f?.v as Partial<EstadoTemp> | undefined;
  if (!v || !['60', '180', 'libre'].includes(String(v.modo)) || typeof v.largo !== 'number' || typeof v.quedan !== 'number') return tempNuevo();
  return { modo: v.modo!, min: Number(v.min ?? 10), seg: Number(v.seg ?? 0), largo: v.largo, fin: typeof v.fin === 'number' ? v.fin : null, quedan: v.quedan };
}
export async function guardarTemp(e: EstadoTemp) { await db.herramientas.put({ k: K_TEMP, v: structuredClone(plano(e)) }); }

const LARGOS = [60, 120, 300];
export async function leerLargoDescanso(): Promise<number> {
  const v = (await db.herramientas.get(K_DESCANSO))?.v;
  return typeof v === 'number' && LARGOS.includes(v) ? v : 60;
}
export async function guardarLargoDescanso(s: number) { if (LARGOS.includes(s)) await db.herramientas.put({ k: K_DESCANSO, v: s }); }

function plano<T>(x: T): T { return JSON.parse(JSON.stringify(x)) as T; }
