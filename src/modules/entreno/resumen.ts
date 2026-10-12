import { DIA_MS, iso } from '../../core/fechas';
import { textoSeries } from './calculos';
import type { Contexto } from './contexto';
import type { Ejercicio } from './programa';
import { aFecha, fechaMini } from './semana';

/** Las sesiones de entreno de esta semana y la anterior, en texto simple para el resumen con IA. Sin peso corporal ni comida. */
export function sesionesParaResumen(c: Contexto, ahora = new Date()) {
  const hoy = aFecha(iso(ahora)).getTime();
  const ej: Record<string, Ejercicio> = c.p.ejercicios as never;
  const r = [];
  for (const { sesion, series } of c.todas) {
    if (sesion.tipo !== 'rutina' || !series.length) continue;
    const dias = Math.round((hoy - aFecha(sesion.fecha).getTime()) / DIA_MS);
    if (dias < 0 || dias > 13) continue;
    const porClave = new Map<string, typeof series>();
    for (const s of series) porClave.set(s.clave, [...(porClave.get(s.clave) ?? []), s]);
    r.push({
      cuando: dias <= 6 ? ('esta semana' as const) : ('la semana anterior' as const),
      dia: fechaMini(sesion.fecha),
      rutina: sesion.rutina ?? '',
      sintio: sesion.sintio,
      ejercicios: [...porClave].filter(([k]) => ej[k]).map(([k, ss]) => ({ nombre: ej[k].nombre, series: textoSeries(ej[k].registro, ss) }))
    });
  }
  return r;
}
