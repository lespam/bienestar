import { norm } from './calculos';

// Los lugares donde compras (Súper de enfrente, Walmart+ y los que agregues) y las reglas de reparto.
// Todo se puede cambiar. Lo que mueves dos veces al mismo lugar se pregunta una sola vez si lo dejas así.

export interface Lugar { id: string; n: string; color: string }
export interface Movimiento { a: string; n: number; preguntado?: boolean }
export interface DatosLugares {
  lista: Lugar[];
  /** Regla por ingrediente: nombre sin acentos → id del lugar. */
  ing: Record<string, string>;
  /** Regla por sección del súper: número de sección → id del lugar. */
  sec: Record<string, string>;
  /** Cuántas veces moviste cada ingrediente al mismo lugar. */
  movs: Record<string, Movimiento>;
}

export const COLORES_LUGAR = ['#c9b3f5', '#f2b8c6', '#9fd8c4', '#f6d58f', '#9cc7f2', '#e8a98f'];
export const MAX_LUGARES = 8;

export const lugaresIniciales = (): DatosLugares => ({
  lista: [{ id: 'enfrente', n: 'Súper de enfrente', color: COLORES_LUGAR[0] }, { id: 'walmart', n: 'Pedido Walmart+', color: COLORES_LUGAR[1] }],
  ing: {},
  sec: {},
  movs: {}
});

/** Une lo guardado con lo de fábrica: siempre queda al menos un lugar. */
export function normalizarLugares(g: Partial<DatosLugares> | undefined): DatosLugares {
  const base = lugaresIniciales();
  const lista = (g?.lista ?? []).filter((l) => l && typeof l.id === 'string' && typeof l.n === 'string' && l.n.trim());
  return { lista: lista.length ? lista : base.lista, ing: g?.ing ?? {}, sec: g?.sec ?? {}, movs: g?.movs ?? {} };
}

export const lugarDe = (d: DatosLugares, id: string | undefined): Lugar | undefined => d.lista.find((l) => l.id === id);
export const nombreLugar = (d: DatosLugares, id: string | undefined) => lugarDe(d, id)?.n ?? d.lista[0].n;
/** Un nombre corto para las pestañas y los avisos. */
export function cortoLugar(n: string): string {
  const t = n.replace(/^S[úu]per de /i, '').replace(/^Pedido /i, '').trim();
  return t.charAt(0).toUpperCase() + t.slice(1);
}

/** El lugar que te toca por tus reglas: primero por ingrediente, luego por sección. `undefined` si no hay regla. */
export function porReglas(d: DatosLugares, n: string, sec: number): string | undefined {
  const i = d.ing[norm(n)];
  if (i && lugarDe(d, i)) return i;
  const s = d.sec[String(sec)];
  if (s && lugarDe(d, s)) return s;
  return undefined;
}

/** El de fábrica, si ese lugar sigue existiendo; si no, el primero de tu lista. */
export const deFabrica = (d: DatosLugares, id: 'enfrente' | 'walmart') => (lugarDe(d, id) ? id : d.lista[0].id);

export function idNuevo(d: DatosLugares): string {
  let i = d.lista.length + 1;
  while (lugarDe(d, 'l' + i)) i++;
  return 'l' + i;
}

/** Quita un lugar y las reglas que lo usaban. Siempre queda uno. */
export function quitarLugar(d: DatosLugares, id: string): DatosLugares {
  if (d.lista.length <= 1) return d;
  const sin = (m: Record<string, string>) => Object.fromEntries(Object.entries(m).filter(([, v]) => v !== id));
  return { lista: d.lista.filter((l) => l.id !== id), ing: sin(d.ing), sec: sin(d.sec), movs: Object.fromEntries(Object.entries(d.movs).filter(([, v]) => v.a !== id)) };
}

/**
 * Anota que moviste un ingrediente a un lugar. Al segundo movimiento al mismo lugar,
 * `pregunta` es verdadero una sola vez por ingrediente. Si ya hay regla igual, no pregunta.
 */
export function anotarMovimiento(d: DatosLugares, n: string, a: string): { datos: DatosLugares; pregunta: boolean } {
  const k = norm(n);
  const antes = d.movs[k];
  const cuenta = antes && antes.a === a ? antes.n + 1 : 1;
  const yaPreguntado = antes?.preguntado ?? false;
  const pregunta = cuenta >= 2 && !yaPreguntado && d.ing[k] !== a;
  return { datos: { ...d, movs: { ...d.movs, [k]: { a, n: cuenta, ...(yaPreguntado || pregunta ? { preguntado: true } : {}) } } }, pregunta };
}

export const ponerReglaIng = (d: DatosLugares, n: string, a: string): DatosLugares => ({ ...d, ing: { ...d.ing, [norm(n)]: a } });
export const quitarReglaIng = (d: DatosLugares, clave: string): DatosLugares => ({ ...d, ing: Object.fromEntries(Object.entries(d.ing).filter(([k]) => k !== clave)) });
export function ponerReglaSec(d: DatosLugares, sec: number, a: string | ''): DatosLugares {
  const s = { ...d.sec };
  if (a) s[String(sec)] = a; else delete s[String(sec)];
  return { ...d, sec: s };
}
