import type { Sesion } from '../../core/db';
import { DIA_MS, iso } from '../../core/fechas';
import type { Letra, Programa } from './programa';

// Lo que toca y cómo va la semana. Se calcula de tus sesiones; nada de esto se guarda.

const LETRAS: Letra[] = ['A', 'B', 'C'];
const DIA3 = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];
const DIA_LARGO = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
const MES3 = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const INICIAL = ['D', 'L', 'M', 'M', 'J', 'V', 'S'];

export const aFecha = (f: string) => { const [a, m, d] = f.split('-').map(Number); return new Date(a, m - 1, d); };
/** "lun 28 sep" */
export const fechaMini = (f: string) => { const d = aFecha(f); return `${DIA3[d.getDay()]} ${d.getDate()} ${MES3[d.getMonth()]}`; };
/** "lunes 28" */
export const fechaDia = (f: string) => { const d = aFecha(f); return `${DIA_LARGO[d.getDay()]} ${d.getDate()}`; };
/** "lun 28" */
export const fechaCorta3 = (f: string) => { const d = aFecha(f); return `${DIA3[d.getDay()]} ${d.getDate()}`; };

export function rutinasDelPrograma(p: Programa): Letra[] {
  const ls = p.semanas[0]?.rutinas ?? LETRAS;
  return ls.filter((l) => p.rutinas[l]);
}

/** La rutina que toca: la siguiente en el ciclo A, B, C después de la última que hiciste. */
export function letraQueToca(p: Programa, sesiones: Pick<Sesion, 'tipo' | 'rutina' | 'inicio'>[]): Letra | null {
  const ciclo = rutinasDelPrograma(p);
  if (!ciclo.length) return null;
  const ultima = sesiones.filter((s) => s.tipo === 'rutina' && s.rutina).sort((a, b) => b.inicio - a.inicio)[0];
  if (!ultima?.rutina) return ciclo[0];
  const i = ciclo.indexOf(ultima.rutina);
  return ciclo[(i + 1) % ciclo.length];
}

/** Las próximas letras del ciclo, empezando por la que toca. */
export function proximasLetras(p: Programa, primera: Letra, n: number): Letra[] {
  const ciclo = rutinasDelPrograma(p);
  const i = Math.max(0, ciclo.indexOf(primera));
  return Array.from({ length: n }, (_, k) => ciclo[(i + k) % ciclo.length]);
}

/** Semana del programa: cuenta desde tu primera sesión. */
export function semanaDelPrograma(sesiones: Pick<Sesion, 'inicio'>[], ahora = Date.now()): number {
  if (!sesiones.length) return 1;
  const primera = Math.min(...sesiones.map((s) => s.inicio));
  return Math.floor((ahora - primera) / (7 * DIA_MS)) + 1;
}

export interface DiaSemana { iso: string; inicial: string; num: number; ses: string; estado: 'hecha' | 'hoy' | 'luego' | 'libre'; texto: string }

/**
 * De lunes a domingo. Las sesiones hechas muestran su letra; los días que entrenas muestran las que siguen.
 * Los días de cardio no se llevan una letra: la rutina pasa al siguiente día de entrenar.
 */
export function armarSemana(hoy: Date, sesiones: Pick<Sesion, 'fecha' | 'tipo' | 'rutina' | 'abierta'>[], seguidas: Letra[], dias: boolean[], cardio: boolean[] = []): DiaSemana[] {
  const lunes = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate() - ((hoy.getDay() + 6) % 7));
  const hoyIso = iso(hoy);
  let k = 0;
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(lunes.getFullYear(), lunes.getMonth(), lunes.getDate() + i);
    const f = iso(d), dow = d.getDay(), delDia = sesiones.filter((s) => s.fecha === f && s.tipo === 'rutina' && s.rutina);
    const base = { iso: f, inicial: INICIAL[dow], num: d.getDate() };
    const hecha = delDia.find((s) => !s.abierta);
    if (hecha) return { ...base, ses: hecha.rutina!, estado: f === hoyIso ? 'hoy' : 'hecha', texto: f === hoyIso ? 'hoy, hecha' : 'hecha' } as DiaSemana;
    const esCardio = cardio[(dow + 6) % 7] && !delDia.length;
    if (sesiones.some((s) => s.fecha === f && s.tipo === 'cardio') && !delDia.length) return { ...base, ses: 'cardio', estado: f === hoyIso ? 'hoy' : 'hecha', texto: f === hoyIso ? 'hoy, cardio hecho' : 'cardio hecho' } as DiaSemana;
    if (esCardio && f >= hoyIso) return { ...base, ses: 'cardio', estado: f === hoyIso ? 'hoy' : 'luego', texto: f === hoyIso ? 'hoy, cardio' : 'cardio' } as DiaSemana;
    if (f === hoyIso) { const l = delDia[0]?.rutina ?? seguidas[k++]; return { ...base, ses: l ?? '–', estado: 'hoy', texto: 'hoy' } as DiaSemana; }
    if (f > hoyIso && dias[(dow + 6) % 7] && seguidas[k]) return { ...base, ses: seguidas[k++], estado: 'luego', texto: '' } as DiaSemana;
    return { ...base, ses: '–', estado: 'libre', texto: '' } as DiaSemana;
  });
}

export const DIAS_INICIALES = [true, true, true, true, true, true, false];

/** "7 pm" / "7:30 am" */
export function horaCorta(v: string): string {
  const p = (v || '19:00').split(':'), h = +p[0], m = p[1] || '00';
  return (h % 12 || 12) + (m !== '00' ? ':' + m : '') + (h < 12 ? ' am' : ' pm');
}
export function lineaCuando(c: { dias: boolean[]; cardio?: boolean[]; hora: string; lugar: string }, hoy: Date): string {
  if (c.cardio?.[(hoy.getDay() + 6) % 7]) return 'Hoy toca cardio';
  if (!c.dias[(hoy.getDay() + 6) % 7]) return 'Hoy no tienes hora planeada';
  const h = +c.hora.split(':')[0] % 12 || 12;
  return 'Hoy ' + (h === 1 ? 'a la ' : 'a las ') + horaCorta(c.hora) + (c.lugar ? ', ' + c.lugar : '');
}

/** "Las últimas 3 veces terminaste sintiéndote mejor." Solo aparece si es verdad y es bueno. */
export function ultimasMejor(sesiones: Pick<Sesion, 'sintio' | 'inicio' | 'abierta'>[]): boolean {
  const u = sesiones.filter((s) => !s.abierta && s.sintio).sort((a, b) => b.inicio - a.inicio).slice(0, 3);
  return u.length === 3 && u.every((s) => s.sintio === 'mejor');
}
