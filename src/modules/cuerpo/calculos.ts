// Cuentas de Cuerpo. Gráficas, cambios y calendario se calculan de lo que guardaste; nada de esto se guarda.

export const ZONAS_INICIALES = ['Glúteo', 'Cintura', 'Cadera', 'Muslo', 'Brazo'];
export const ZONAS_EXTRA = ['Pecho', 'Pantorrilla', 'Hombro', 'Antebrazo'];

const MES3 = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

/** "2026-10-01" -> "1 oct" */
export function etiquetaFecha(f: string): string {
  const [, m, d] = f.split('-').map(Number);
  return d + ' ' + MES3[m - 1];
}
export const redondear = (n: number) => Math.round(n * 10) / 10;
/** 101.5 -> "101.5" (sin ceros de más) */
export const formatoNum = (n: number) => String(redondear(n));

/** Nombre de una zona nueva: sin espacios de más, hasta 20 letras, con mayúscula inicial. */
export function nombreDeZona(t: string): string | null {
  const k = t.trim().replace(/\s+/g, ' ');
  if (!k || k.length > 20) return null;
  return k.charAt(0).toUpperCase() + k.slice(1);
}
export const mismaZona = (a: string, b: string) => a.toLocaleLowerCase('es') === b.toLocaleLowerCase('es');

/** Un número escrito por ti ("77,5") dentro de un rango; si no vale, null. */
export function leerNumero(t: string, min: number, max: number): number | null {
  const n = parseFloat(t.trim().replace(',', '.'));
  return Number.isFinite(n) && n > min && n < max ? n : null;
}

export interface Medicion { fecha: string; cm: number }

/** Las mediciones de una zona, de la más antigua a la más reciente. Si hay dos el mismo día, vale la última guardada. */
export function porZona(filas: { id?: number; zona: string; fecha: string; cm: number }[], zona: string): Medicion[] {
  const dia: Record<string, { id: number; cm: number }> = {};
  for (const f of filas) {
    if (!mismaZona(f.zona, zona)) continue;
    const id = f.id ?? 0;
    if (!dia[f.fecha] || id >= dia[f.fecha].id) dia[f.fecha] = { id, cm: f.cm };
  }
  return Object.keys(dia).sort().map((fecha) => ({ fecha, cm: dia[fecha].cm }));
}

/** Cambio contra la medición anterior: null si es la primera. */
export function cambio(v: Medicion[]): number | null {
  return v.length < 2 ? null : redondear(v[v.length - 1].cm - v[v.length - 2].cm);
}

export interface PuntoGrafica { x: number; y: number; fecha: string; cm: number }
export interface Grafica { puntos: PuntoGrafica[]; marcas: { y: number; n: number }[]; area: string; linea: string; abajo: number; izq: number; der: number; arriba: number }

/** Geometría de la gráfica (360 × 190). Necesita al menos 2 mediciones. */
export function armarGrafica(v: Medicion[], W = 360, H = 190): Grafica | null {
  if (v.length < 2) return null;
  const L = 34, R = 52, T = 16, B = 28;
  const vals = v.map((m) => m.cm);
  const lo = Math.floor(Math.min(...vals) - 1), hi = Math.ceil(Math.max(...vals) + 1);
  const x = (i: number) => L + (i * (W - L - R)) / (v.length - 1);
  const y = (n: number) => T + ((hi - n) * (H - T - B)) / (hi - lo);
  const puntos = v.map((m, i) => ({ x: x(i), y: y(m.cm), fecha: m.fecha, cm: m.cm }));
  const linea = puntos.map((p) => p.x + ',' + p.y).join(' ');
  const area = `${x(0)},${y(lo)} ${linea} ${x(v.length - 1)},${y(lo)}`;
  return { puntos, marcas: [lo, (lo + hi) / 2, hi].map((n) => ({ y: y(n), n })), area, linea, abajo: H - B, izq: L, der: W - R, arriba: T };
}

/** Las últimas n mediciones. */
export const ultimas = (v: Medicion[], n = 6) => v.slice(-n);

// ---------- Calendario de Período ----------
export const claveDia = (a: number, m: number, d: number) => `${a}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
export const nombreMes = (a: number, m: number) => `${MESES[m]} ${a}`;
/** Lunes primero: cuántos huecos van antes del día 1 y cuántos días tiene el mes. */
export function diasDelMes(a: number, m: number): { huecos: number; dias: number } {
  return { huecos: (new Date(a, m, 1).getDay() + 6) % 7, dias: new Date(a, m + 1, 0).getDate() };
}
export function sumarMes(a: number, m: number, delta: number): { a: number; m: number } {
  const t = a * 12 + m + delta;
  return { a: Math.floor(t / 12), m: ((t % 12) + 12) % 12 };
}
