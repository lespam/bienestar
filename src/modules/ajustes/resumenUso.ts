import type { DatosUso } from '../../core/uso';
import { lunesDeUso } from '../../core/uso';

// «Cómo uso la app»: lo más usado, lo que no abres y semanas seguidas, solo sumando. Solo cuenta; no juzga.

/** Pantallas que se muestran con nombre. Inicio no entra: siempre se abre. */
export const PANTALLAS_CONOCIDAS: [string, string][] = [
  ['rutina', 'Rutina'], ['comida', 'Comida'], ['cuerpo', 'Cuerpo'], ['mente', 'Mente'], ['alma', 'Alma'], ['hogar', 'Hogar'], ['herramientas', 'Herramientas'],
  ['recetas', 'Recetario'], ['menu', 'Menú'], ['tarjetas', 'Acomoda la semana'], ['compras', 'Lista de compras'], ['prep', 'Plan de preparación'], ['hoytoca', 'Hoy toca'],
  ['patrones', 'Patrones'], ['perfiles', 'Perfiles'], ['flexible', 'Día flexible'], ['tips', 'Tips']
];
export const FUNCIONES_CONOCIDAS: Record<string, string> = {
  'registrar-comida': 'Registrar comida', 'planear-menu': 'Planear comidas', 'compra-marcada': 'Marcar compras', 'preparacion-hecha': 'Hacer lo de «Hoy toca»',
  'rutina-empezar': 'Empezar una rutina', peso: 'Anotar peso', 'hogar-hecha': 'Tareas de la casa hechas'
};
export const SUGERENCIAS_CONOCIDAS: Record<string, string> = { fijo: 'Mis fijos', 'ya-toca': 'Ya toca' };

const NOMBRE = new Map(PANTALLAS_CONOCIDAS);
const mayorAMenor = (r: Record<string, number>, nombre: (k: string) => string | undefined, max = 5): [string, number][] =>
  Object.entries(r).filter(([k, n]) => n > 0 && nombre(k)).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, max).map(([k, n]) => [nombre(k)!, n]);
const sumar = (a: Record<string, number>, b: Record<string, number>) => { for (const [k, n] of Object.entries(b)) a[k] = (a[k] ?? 0) + n; };
const lunesAnterior = (lunes: string, k: number) => lunesDeUso(new Date(+lunes.slice(0, 4), +lunes.slice(5, 7) - 1, +lunes.slice(8, 10) - 7 * k));

export interface ResumenUso {
  activo: boolean;
  diasMidiendo: number;
  esta: { pantallas: [string, number][]; funciones: [string, number][] };
  masUsado: [string, number][];
  sinAbrir: string[];
  semanasPlaneadas: number;
  /** Semanas seguidas con algún uso, contando hacia atrás (la actual solo suma). */
  racha: number;
  sugerencias: { nombre: string; si: number; no: number }[];
}

export function resumirUso(d: DatosUso, hoy = new Date()): ResumenUso {
  const lunes = lunesDeUso(hoy);
  const ventana = [0, 1, 2, 3].map((k) => d.semanas[lunesAnterior(lunes, k)]).filter(Boolean);
  const cuatro: Record<string, number> = {};
  for (const s of ventana) sumar(cuatro, s.p);
  const esta = d.semanas[lunes];
  const tiene = (k: number) => { const s = d.semanas[lunesAnterior(lunes, k)]; return !!s && (Object.keys(s.p).length > 0 || Object.keys(s.f).length > 0); };
  let racha = 0;
  for (let k = tiene(0) ? 0 : 1; tiene(k); k++) racha++;
  const sug: Record<string, { si: number; no: number }> = {};
  for (const s of Object.values(d.semanas)) for (const [k, c] of Object.entries(s.s)) { const x = (sug[k] ??= { si: 0, no: 0 }); x.si += c.si; x.no += c.no; }
  const dias = d.desde ? Math.max(0, Math.round((Date.UTC(hoy.getFullYear(), hoy.getMonth(), hoy.getDate()) - Date.UTC(+d.desde.slice(0, 4), +d.desde.slice(5, 7) - 1, +d.desde.slice(8, 10))) / 864e5)) : 0;
  return {
    activo: d.activo,
    diasMidiendo: dias,
    esta: { pantallas: mayorAMenor(esta?.p ?? {}, (k) => NOMBRE.get(k)), funciones: mayorAMenor(esta?.f ?? {}, (k) => FUNCIONES_CONOCIDAS[k]) },
    masUsado: mayorAMenor(cuatro, (k) => NOMBRE.get(k)),
    sinAbrir: PANTALLAS_CONOCIDAS.filter(([k]) => !cuatro[k]).map(([, n]) => n),
    semanasPlaneadas: Object.values(d.semanas).filter((s) => (s.f['planear-menu'] ?? 0) > 0).length,
    racha,
    sugerencias: Object.entries(sug).filter(([k, c]) => SUGERENCIAS_CONOCIDAS[k] && c.si + c.no > 0).map(([k, c]) => ({ nombre: SUGERENCIAS_CONOCIDAS[k], ...c }))
  };
}
