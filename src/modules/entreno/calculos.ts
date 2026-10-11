import type { CampoReg, Ejercicio, Grupo, Letra } from './programa';
import { tieneGym } from './programa';
import type { Serie, Sesion } from '../../core/db';

// Todo lo que se puede calcular se calcula aquí y no se guarda (plan, punto 3a):
// récord, "Última vez", "Dónde estás", logros, tiempo total y el calendario.

// ---------- Plan del día ----------
export type Modo = 'mixto' | 'casa' | 'libro';
export interface Parte { lugar?: 'casa' | 'gym'; mover?: string; grupos: Grupo[] }

/** Cómo se ordena la sesión según el modo (plan de Rutina). Las superseries nunca se parten por lugar. */
export function armarPlan(grupos: Grupo[], modo: Modo, primero: 'gym' | 'casa'): Parte[] {
  if (modo !== 'mixto' || !grupos.some(tieneGym)) return [{ grupos }];
  const partes = { casa: grupos.filter((g) => !tieneGym(g)), gym: grupos.filter(tieneGym) };
  const orden = primero === 'gym' ? (['gym', 'casa'] as const) : (['casa', 'gym'] as const);
  return orden.map((lugar, i) => ({ lugar, mover: i === 1 ? (lugar === 'gym' ? 'Bajas al gym' : 'Subes a casa') : undefined, grupos: partes[lugar] }));
}
export const ordenDeGrupos = (partes: Parte[]) => partes.flatMap((p) => p.grupos);

// ---------- Pasos de la sesión ----------
export interface Paso { g: number; e: number; s: number }
/** Superserie: un ejercicio y luego el otro, ronda por ronda. Series normales: serie por serie. */
export function pasosDeGrupo(g: Grupo): { e: number; s: number }[] {
  const out: { e: number; s: number }[] = [];
  if (g.tipo === 'superserie') {
    const n = Math.max(...g.ejercicios.map((x) => x.series));
    for (let s = 0; s < n; s++) g.ejercicios.forEach((x, e) => { if (s < x.series) out.push({ e, s }); });
  } else g.ejercicios.forEach((x, e) => { for (let s = 0; s < x.series; s++) out.push({ e, s }); });
  return out;
}
export const llave = (clave: string, n: number) => clave + '#' + n;

/** El primer paso sin serie guardada; null si todo está hecho. */
export function pasoActual(grupos: Grupo[], hechas: Set<string>): { g: number; i: number; paso: { e: number; s: number } } | null {
  for (let g = 0; g < grupos.length; g++) {
    const pasos = pasosDeGrupo(grupos[g]);
    const i = pasos.findIndex((p) => !hechas.has(llave(grupos[g].ejercicios[p.e].clave, p.s)));
    if (i >= 0) return { g, i, paso: pasos[i] };
  }
  return null;
}
/** Cuántos ejercicios ya tienen al menos una serie. */
export function ejerciciosEmpezados(grupos: Grupo[], hechas: Set<string>): number {
  return grupos.flatMap((g) => g.ejercicios).filter((e) => [...hechas].some((h) => h.startsWith(e.clave + '#'))).length;
}

// ---------- Columnas y formato ----------
export function columnas(registro: CampoReg[], unidad: string): { campo: CampoReg; texto: string }[] {
  const T: Record<CampoReg, string> = { peso: `Peso (${unidad})`, reps: 'Reps', repsIzq: 'Izq', repsDer: 'Der', seg: 'Seg', segIzq: 'Izq (seg)', segDer: 'Der (seg)', pasosIzq: 'Izq (pasos)', pasosDer: 'Der (pasos)' };
  return registro.map((campo) => ({ campo, texto: T[campo] }));
}
const UNIDAD_METRICA = { reps: 'reps', seg: 'seg', pasos: 'pasos' } as const;
type Metrica = keyof typeof UNIDAD_METRICA;
const METRICAS: { m: Metrica; uno: CampoReg; izq: CampoReg; der: CampoReg }[] = [
  { m: 'reps', uno: 'reps', izq: 'repsIzq', der: 'repsDer' },
  { m: 'seg', uno: 'seg', izq: 'segIzq', der: 'segDer' },
  { m: 'pasos', uno: 'pasosIzq', izq: 'pasosIzq', der: 'pasosDer' }
];
const metricaDe = (registro: CampoReg[]) => METRICAS.find((x) => registro.includes(x.uno) || registro.includes(x.izq))!;
const unilateral = (registro: CampoReg[]) => registro.some((c) => /Izq$/.test(c));
const KG = 0.45359237;
const enKg = (peso: number, unidad: string) => (unidad === 'lb' ? peso * KG : peso);
const num = (x: number | null | undefined) => (typeof x === 'number' && Number.isFinite(x) ? x : null);
const TAPA = '•••';
const lista = (xs: (number | null)[], ocultar = false) => xs.map((x) => (x == null ? '–' : ocultar ? TAPA : x)).join(', ');

/** "Peso corporal · 20, 18, 16 reps" o "15 lb · izq 10, 10, 9 · der 10, 9, 9 reps". */
export function textoSeries(registro: CampoReg[], series: Pick<Serie, 'v' | 'unidad' | 'n'>[], ocultar = false): string {
  const orden = [...series].sort((a, b) => a.n - b.n);
  if (!orden.length) return '';
  const mt = metricaDe(registro), partes: string[] = [];
  if (registro.includes('peso')) {
    const pesos = orden.map((s) => num(s.v.peso) ?? 0), u = orden[0].unidad;
    partes.push(pesos.every((p) => p === pesos[0]) ? (pesos[0] > 0 ? `${ocultar ? TAPA : pesos[0]} ${u}` : 'Peso corporal') : lista(pesos, ocultar) + ' ' + u);
  }
  if (unilateral(registro)) {
    partes.push('izq ' + lista(orden.map((s) => num(s.v[mt.izq])), ocultar));
    partes.push('der ' + lista(orden.map((s) => num(s.v[mt.der])), ocultar) + ' ' + UNIDAD_METRICA[mt.m]);
  } else partes.push(lista(orden.map((s) => num(s.v[mt.uno])), ocultar) + ' ' + UNIDAD_METRICA[mt.m]);
  return partes.join(' · ');
}

// ---------- Récord ----------
export interface Marca { peso: number; valor: number; texto: string; tapado: string; lado?: 'izq' | 'der' }
/** La mejor serie: primero el peso y luego las repeticiones, los segundos o los pasos. */
export function mejorMarca(registro: CampoReg[], series: Pick<Serie, 'v' | 'unidad'>[]): Marca | null {
  const mt = metricaDe(registro), uni = unilateral(registro), conPeso = registro.includes('peso');
  let mejor: Marca | null = null;
  for (const s of series) {
    const peso = conPeso ? num(s.v.peso) ?? 0 : 0;
    const lados: ['izq' | 'der' | undefined, number | null][] = uni ? [['izq', num(s.v[mt.izq])], ['der', num(s.v[mt.der])]] : [[undefined, num(s.v[mt.uno])]];
    for (const [lado, v] of lados) {
      if (v == null || v <= 0) continue;
      const k = enKg(peso, s.unidad);
      if (!mejor || k > mejor.peso || (k === mejor.peso && v > mejor.valor)) {
        const u = UNIDAD_METRICA[mt.m];
        mejor = { peso: k, valor: v, lado, texto: (peso > 0 ? `${peso} ${s.unidad} × ` : '') + `${v} ${u}`, tapado: (peso > 0 ? `${TAPA} ${s.unidad} × ` : '') + `${TAPA} ${u}` };
      }
    }
  }
  return mejor;
}
const mayor = (a: Marca, b: Marca) => a.peso > b.peso || (a.peso === b.peso && a.valor > b.valor);

export interface SesionConSeries { sesion: Sesion; series: Serie[] }
export interface Historial { fecha: string; sesion: number; series: Serie[] }

/** Series de un ejercicio (y su sustituto) agrupadas por sesión, de la más reciente a la más antigua. */
export function historialDe(todas: SesionConSeries[], clave: string, sust?: string): Historial[] {
  return todas
    .map(({ sesion, series }) => ({ fecha: sesion.fecha, sesion: sesion.id!, series: series.filter((s) => s.clave === clave && (s.sust ?? undefined) === (sust ?? undefined)) }))
    .filter((h) => h.series.length)
    .sort((a, b) => (a.fecha < b.fecha ? 1 : a.fecha > b.fecha ? -1 : b.sesion - a.sesion));
}

export type EstadoPR = 'nuevo' | 'primera' | 'igual';
export interface ResumenPR { record: Marca | null; fecha: string | null; estado: EstadoPR; antes: Marca | null }
/** Récord de todas las sesiones y si el de la sesión indicada es nuevo, primero o igual. */
export function resumenPR(registro: CampoReg[], hist: Historial[], sesionId?: number): ResumenPR {
  let record: Marca | null = null, fecha: string | null = null;
  for (const h of [...hist].reverse()) {
    const m = mejorMarca(registro, h.series);
    if (m && (!record || mayor(m, record))) { record = m; fecha = h.fecha; }
  }
  const ref = sesionId != null ? hist.find((h) => h.sesion === sesionId) : hist[0];
  if (!ref) return { record, fecha, estado: 'igual', antes: null };
  const hoy = mejorMarca(registro, ref.series);
  let antes: Marca | null = null;
  for (const h of hist) if (h !== ref && (h.fecha < ref.fecha || (h.fecha === ref.fecha && h.sesion < ref.sesion))) { const m = mejorMarca(registro, h.series); if (m && (!antes || mayor(m, antes))) antes = m; }
  if (!hoy) return { record, fecha, estado: 'igual', antes };
  return { record, fecha, estado: !antes ? 'primera' : mayor(hoy, antes) ? 'nuevo' : 'igual', antes };
}

// ---------- Dónde estás ----------
export const nombreCorto = (n: string) => n.replace(/^(Bodyweight|Dumbbell) /i, '').replace(/^./, (c) => c.toUpperCase());
export function ordinal(n: number, letra: string) { return `${n}ª Rutina ${letra}`; }

function rangoDe(r: string): { min: number; max: number } | null {
  const m = r.match(/(\d+)-(\d+)/);
  return m ? { min: +m[1], max: +m[2] } : null;
}
/** Dónde quedaron las series de la vez pasada respecto al rango del libro. */
export function dondeQuedaste(e: Ejercicio, series: Serie[]): string {
  const rg = rangoDe(e.rango), mt = metricaDe(e.registro), uni = unilateral(e.registro);
  const orden = [...series].sort((a, b) => a.n - b.n);
  if (!rg || !orden.length) return '';
  const val = (s: Serie) => (uni ? Math.min(num(s.v[mt.izq]) ?? 0, num(s.v[mt.der]) ?? 0) : num(s.v[mt.uno]) ?? 0);
  const unidad = UNIDAD_METRICA[mt.m] === 'reps' ? '' : ' ' + UNIDAD_METRICA[mt.m];
  const tope = orden.filter((s) => val(s) >= rg.max).map((s) => s.n + 1);
  const bajo = orden.filter((s) => val(s) < rg.min).map((s) => s.n + 1);
  const dentro = orden.length - tope.length - bajo.length;
  const plural = (xs: number[]) => (xs.length === 1 ? 'La serie ' + xs[0] : 'Las series ' + xs.join(' y '));
  const out: string[] = [];
  if (tope.length) out.push(`${plural(tope)} llegó al tope del rango (${rg.max}${unidad}).`.replace('llegó', tope.length === 1 ? 'llegó' : 'llegaron'));
  if (dentro > 0) out.push(tope.length || bajo.length ? `${dentro === 1 ? 'La otra serie quedó' : 'Las otras series quedaron'} dentro del rango.` : `${orden.length === 1 ? 'Quedaste' : 'Las ' + orden.length + ' series quedaron'} dentro del rango${uni ? ' en los dos lados' : ''}.`);
  if (bajo.length) out.push(`${plural(bajo)} ${bajo.length === 1 ? 'quedó' : 'quedaron'} por debajo del rango, y está bien: es tu punto de partida.`);
  if (uni) {
    const i = orden.reduce((a, s) => a + (num(s.v[mt.izq]) ?? 0), 0), d = orden.reduce((a, s) => a + (num(s.v[mt.der]) ?? 0), 0);
    if (i !== d) out.push(`${i < d ? 'El izquierdo' : 'El derecho'} fue ${Math.round(Math.abs(i - d) / orden.length)}${unidad || ' reps'} menor.`.replace(/ 0 /, ' menos de 1 '));
  }
  return out.join(' ');
}

export interface DondeEstas { items: string[]; meta: string }
export function dondeEstas(letra: Letra, nth: number, anterior: string | null, nombreDia: string, previos: { e: Ejercicio; series: Serie[]; hist?: Serie[] }[]): DondeEstas {
  const items = [`Es tu <b>${ordinal(nth, letra)}</b>.${anterior ? ` La anterior fue ${anterior}.` : ''}`];
  if (!previos.length) { items.push('Todavía no hay datos para comparar.'); return { items, meta: 'Hoy registra tus primeras marcas. Todo lo que hagas cuenta.' }; }
  const con = previos.filter((p) => p.series.length);
  for (const p of con.slice(0, 2)) items.push(`<b>${nombreCorto(p.e.nombre)}:</b> ${dondeQuedaste(p.e, p.series)}`);
  const tope = con.find((p) => dondeQuedaste(p.e, p.series).includes('tope'));
  const lados = con.find((p) => unilateral(p.e.registro) && / menor\./.test(dondeQuedaste(p.e, p.series)));
  const meta = tope && lados ? `Enfoque de hoy: sostener las series de ${nombreCorto(tope.e.nombre).toLowerCase()} y acercar los dos lados en ${nombreCorto(lados.e.nombre).toLowerCase()}.`
    : tope ? `Enfoque de hoy: sostener las series de ${nombreCorto(tope.e.nombre).toLowerCase()}.`
    : lados ? `Enfoque de hoy: acercar los dos lados en ${nombreCorto(lados.e.nombre).toLowerCase()}.`
    : 'Enfoque de hoy: hacer cada serie con calma. Lo que hagas cuenta.';
  void nombreDia;
  return { items, meta };
}

// ---------- Logros y tiempo ----------
/** Hasta 2 logros de hoy comparados con la vez anterior. Nunca lo que faltó. */
export function logros(grupos: Grupo[], hoy: Serie[], antes: (clave: string) => Serie[], diaAntes: string, unidad: string): string[] {
  const mas: string[] = [], igual: string[] = [];
  for (const e of grupos.flatMap((g) => g.ejercicios)) {
    const mt = metricaDe(e.registro), prev = antes(e.clave);
    for (const s of hoy.filter((x) => x.clave === e.clave).sort((a, b) => a.n - b.n)) {
      const p = prev.find((x) => x.n === s.n);
      if (!p) continue;
      const campos: CampoReg[] = e.registro.filter((c) => c !== 'peso');
      for (const c of campos) {
        const a = num(s.v[c]), b = num(p.v[c]);
        if (a == null || b == null) continue;
        const lado = /Izq$/.test(c) ? ' con el lado izquierdo' : /Der$/.test(c) ? ' con el lado derecho' : '';
        const u = UNIDAD_METRICA[mt.m];
        const nom = nombreCorto(e.nombre);
        if (a > b) mas.push(`<b>${nom}:</b> ${a - b} ${a - b === 1 && u === 'reps' ? 'rep' : u} más que ${diaAntes}${lado} en la serie ${s.n + 1}.`);
        else if (a === b && c === (mt.uno === 'pasosIzq' ? 'pasosIzq' : mt.uno) && !lado) igual.push(`<b>${nom}:</b> sostuviste ${a} ${u} en la serie ${s.n + 1}, como ${diaAntes}.`);
      }
      const pa = num(s.v.peso), pb = num(p.v.peso);
      if (pa != null && pb != null && pa > pb) mas.push(`<b>${nombreCorto(e.nombre)}:</b> ${Math.round((pa - pb) * 10) / 10} ${unidad} más que ${diaAntes} en la serie ${s.n + 1}.`);
    }
  }
  const todos = [...mas, ...igual];
  return todos.length ? todos.slice(0, 2) : [`<b>Series guardadas:</b> ${hoy.length}. Cada una cuenta.`];
}

export function minutos(ms: number) { return Math.max(1, Math.round(ms / 60000)); }
export function reloj(seg: number) { const m = Math.floor(seg / 60), s = seg % 60; return m + ':' + (s < 10 ? '0' : '') + s; }
