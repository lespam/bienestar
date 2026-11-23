import { db } from './db';

// «Medir mi uso»: contadores agregados por semana, solo en este teléfono y apagados hasta que los enciendas.
// Cuentan cuántas veces abriste una pantalla o usaste una función. Nunca guardan texto, fotos ni lo que escribes.

export interface SemanaUso {
  /** Veces que abriste cada pantalla. */
  p: Record<string, number>;
  /** Veces que usaste cada función. */
  f: Record<string, number>;
  /** Sugerencias aceptadas (`si`) y rechazadas (`no`), por tipo. */
  s: Record<string, { si: number; no: number }>;
}
export interface DatosUso { activo: boolean; desde: string | null; semanas: Record<string, SemanaUso> }

const CLAVE = 'uso';
export const SEMANAS_GUARDADAS = 26;
const vacio = (): DatosUso => ({ activo: false, desde: null, semanas: {} });
let datos: DatosUso = vacio();
let pendiente: ReturnType<typeof setTimeout> | undefined;
let escuchando = false;

const dos = (n: number) => String(n).padStart(2, '0');
/** El lunes de la semana de `d`, como AAAA-MM-DD. */
export function lunesDeUso(d = new Date()): string {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate() - ((d.getDay() + 6) % 7));
  return x.getFullYear() + '-' + dos(x.getMonth() + 1) + '-' + dos(x.getDate());
}
const hoyIso = () => { const d = new Date(); return d.getFullYear() + '-' + dos(d.getMonth() + 1) + '-' + dos(d.getDate()); };

export async function cargarUso(): Promise<void> {
  const v = (await db.ajustes.get(CLAVE))?.v as Partial<DatosUso> | undefined;
  datos = { ...vacio(), ...(v ?? {}) };
  // Si cierras o cambias de app, lo pendiente se guarda.
  if (typeof document !== 'undefined' && !escuchando) { escuchando = true; document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') void guardarYa(); });
    addEventListener('pagehide', () => { void guardarYa(); });
  }
}
export const usoActivo = () => datos.activo;
/** Una copia de lo que hay (para mostrarlo, exportarlo o deshacer un borrado). */
export const leerUso = (): DatosUso => JSON.parse(JSON.stringify(datos));

async function guardarYa() {
  clearTimeout(pendiente);
  pendiente = undefined;
  await db.ajustes.put({ k: CLAVE, v: JSON.parse(JSON.stringify(datos)) });
}
function guardarPronto() {
  if (pendiente) return;
  pendiente = setTimeout(() => { void guardarYa(); }, 2000);
}
function semanaActual(): SemanaUso {
  const k = lunesDeUso();
  if (!datos.semanas[k]) {
    datos.semanas[k] = { p: {}, f: {}, s: {} };
    // Solo se guardan las últimas semanas.
    for (const v of Object.keys(datos.semanas).sort().slice(0, -SEMANAS_GUARDADAS)) delete datos.semanas[v];
  }
  return datos.semanas[k];
}

export function contarPantalla(id: string) {
  if (!datos.activo) return;
  const s = semanaActual();
  s.p[id] = (s.p[id] ?? 0) + 1;
  guardarPronto();
}
export function contarFuncion(k: string) {
  if (!datos.activo) return;
  const s = semanaActual();
  s.f[k] = (s.f[k] ?? 0) + 1;
  guardarPronto();
}
export function contarSugerencia(tipo: string, acepto: boolean) {
  if (!datos.activo) return;
  const s = semanaActual();
  const c = (s.s[tipo] ??= { si: 0, no: 0 });
  if (acepto) c.si++; else c.no++;
  guardarPronto();
}

export async function activarUso(si: boolean) {
  datos.activo = si;
  if (si && !datos.desde) datos.desde = hoyIso();
  await guardarYa();
}
/** Borra los contadores. Si sigues midiendo, empieza de cero hoy. */
export async function borrarUso() {
  datos = { activo: datos.activo, desde: datos.activo ? hoyIso() : null, semanas: {} };
  await guardarYa();
}
export async function restaurarUso(d: DatosUso) {
  datos = d;
  await guardarYa();
}

/** El archivo para subir a una conversación: solo números, sin contenido. Nada se envía solo. */
export function exportarUso(hoy = hoyIso()): string {
  return JSON.stringify({ app: 'bienestar', tipo: 'contadores-de-uso', version: 1, fecha: hoy, desde: datos.desde, semanas: datos.semanas }, null, 2);
}
