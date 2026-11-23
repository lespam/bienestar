// Tus datos por áreas, para el paquete de continuidad. Cada tabla de la base está en una sola área.
// Al pasar datos entre el teléfono y la computadora se decide por área: qué se reemplaza, qué se conserva y qué se combina.

/**
 * Cómo se puede combinar una tabla:
 * - clave: cada fila tiene su propia clave (una fecha, un nombre, un id de receta). Se juntan por clave.
 * - filas: filas sueltas con un número automático (un peso, una compra). Se juntan si no son la misma fila.
 * - bloque: filas que se apuntan unas a otras (una sesión y sus series). Solo se reemplazan o se conservan completas.
 */
export type TipoTabla = 'clave' | 'filas' | 'bloque';

export interface Grupo {
  id: string;
  nombre: string;
  tablas: Record<string, TipoTabla>;
}

export const GRUPOS: Grupo[] = [
  { id: 'entreno', nombre: 'Rutina y sesiones', tablas: { sesiones: 'bloque', series: 'bloque', descansos: 'bloque', sustitutos: 'clave', fichas: 'clave', entreno: 'clave', calentados: 'clave' } },
  { id: 'comida', nombre: 'Comida y menú', tablas: { recetas: 'clave', perfiles: 'clave', comida: 'clave', menu: 'clave', flexibles: 'clave', registro: 'filas', historial: 'filas' } },
  { id: 'cuerpo', nombre: 'Cuerpo', tablas: { pesos: 'filas', medidas: 'filas', fotos: 'filas', periodo: 'clave', cuerpo: 'clave' } },
  { id: 'mente', nombre: 'Mente y Alma', tablas: { metas: 'bloque', areas: 'bloque', semanas: 'bloque', mente: 'clave', mensajes: 'clave', coleccion: 'bloque' } },
  { id: 'hogar', nombre: 'Hogar', tablas: { hogar: 'bloque', hogarDia: 'bloque' } },
  { id: 'herramientas', nombre: 'Herramientas', tablas: { herramientas: 'clave' } },
  { id: 'ajustes', nombre: 'Ajustes y contenido personal', tablas: { ajustes: 'clave', contenido: 'clave' } }
];

export const grupoPorId = (id: string): Grupo | undefined => GRUPOS.find((g) => g.id === id);
/** Un área se puede combinar si ninguna de sus tablas es un bloque. */
export const combinable = (g: Grupo) => Object.values(g.tablas).every((t) => t !== 'bloque');

/** La fecha de cambio de un área: la más reciente de sus tablas. null si nunca se anotó un cambio. */
export function fechaDeGrupo(g: Grupo, porTabla: Record<string, number>): number | null {
  const v = Object.keys(g.tablas).map((t) => porTabla[t]).filter((x): x is number => typeof x === 'number');
  return v.length ? Math.max(...v) : null;
}
/** Las fechas de cambio por área; las áreas sin cambios anotados no aparecen. */
export function fechasPorGrupo(porTabla: Record<string, number>): Record<string, number> {
  const salida: Record<string, number> = {};
  for (const g of GRUPOS) { const f = fechaDeGrupo(g, porTabla); if (f != null) salida[g.id] = f; }
  return salida;
}
