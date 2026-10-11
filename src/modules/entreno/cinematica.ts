import { MOVIMIENTO, MUSCULOS } from './musculos';
import { gruposDeRutina, type Ejercicio, type Letra, type Programa } from './programa';

// La línea de tiempo de la cinemática: tarjeta de inicio, un bloque a la vez y tarjeta final.
// Es la misma de la previsualización aprobada; solo cambia que ahora sale de tu programa.

export const CICLO = 3800, DESCANSO = 1500, BLOQUE = 1900, INTRO = 4200, OUTRO = 4200, SOLO = 4400;
export type Version = 'res' | 'ser';

export interface SegmentoCin {
  k: 'card' | 'ex' | 'rest';
  /** Qué tarjeta es: 0 inicio, 1 bloque, 2 final. */
  i?: number;
  /** Bloque al que pertenece; -1 antes del primero y el total después del último. */
  b: number;
  d: number;
  e?: { anim: string; p: string[]; s: string[] };
  shot?: number;
  top: string;
  cap: string;
  mid?: { gk: string; gt: string; chico?: boolean; gs: string };
  bot?: { nombre: string; gym: boolean; rx: string; series?: { i: number; n: number }; principales: string[]; apoyo: string[] };
}
export interface Cinematica { tl: SegmentoCin[]; bloques: { pair: boolean; etiqueta: string; chico: string }[]; total: number }

const nombresM = (ks: string[]) => ks.map((k) => MUSCULOS[k]?.nombre ?? k);
const rep = (rango: string) => (/seg|pasos/.test(rango) ? rango : rango.replace(/^([\d-]+)/, '$1 repeticiones'));

export function armarCinematica(p: Programa, letra: Letra, version: Version): Cinematica | null {
  const grupos = gruposDeRutina(p, letra);
  const conAnim = (e: Ejercicio) => !!(e.anim && MOVIMIENTO[e.anim]);
  const pares = grupos.filter((g) => g.tipo === 'superserie').map((g) => g.ejercicios.filter(conAnim));
  const sueltos = grupos.filter((g) => g.tipo === 'suelto').flatMap((g) => g.ejercicios).filter(conAnim);
  const bloques = [...pares.map((ex) => ({ ex, pair: true })), ...(sueltos.length ? [{ ex: sueltos, pair: false }] : [])].filter((b) => b.ex.length);
  const todos = bloques.flatMap((b) => b.ex);
  if (!todos.length) return null;
  const nb = bloques.length, ser = version === 'ser', gym = todos.filter((e) => e.gym).length;
  const info = (e: Ejercicio) => ({ anim: e.anim!, p: MOVIMIENTO[e.anim!].principales, s: MOVIMIENTO[e.anim!].apoyo });
  const seg = (e: Ejercicio, bi: number, i: number, n: number, pair: boolean, conSeries: boolean, shot: number, d: number): SegmentoCin => ({
    k: 'ex', b: bi, d, e: info(e), shot, top: `Bloque ${bi + 1} de ${nb}${pair ? ' · Superserie' : ''}`, cap: MOVIMIENTO[e.anim!].como,
    bot: { nombre: (e.codigo ? e.codigo + ' · ' : '') + e.nombre, gym: e.gym, rx: conSeries ? rep(e.rango) : `${e.series} series · ${e.rango}`, series: conSeries && n > 1 ? { i, n } : undefined, principales: nombresM(MOVIMIENTO[e.anim!].principales), apoyo: nombresM(MOVIMIENTO[e.anim!].apoyo) }
  });

  const tl: SegmentoCin[] = [{ k: 'card', i: 0, b: -1, d: INTRO, e: info(todos[0]), top: 'Tu sesión de hoy', cap: 'Así se ve tu sesión. Un bloque a la vez.',
    mid: { gk: 'TU SESIÓN DE HOY', gt: 'Rutina ' + letra, gs: `${nb} bloques · ${todos.length} ejercicios · ${gym ? gym + (gym > 1 ? ' ejercicios' : ' ejercicio') + ' en el gym' : 'todo en casa'}` } }];
  let shot = 0;
  bloques.forEach((b, bi) => {
    const foco: string[] = [];
    b.ex.forEach((e) => MOVIMIENTO[e.anim!].principales.forEach((k) => { if (!foco.includes(k)) foco.push(k); }));
    const orden = b.pair ? b.ex.map((e) => e.codigo).join(' → ') : b.ex.length + ' ejercicios, uno por uno';
    tl.push({ k: 'card', i: 1, b: bi, d: BLOQUE, e: info(b.ex[0]), top: `Bloque ${bi + 1} de ${nb}`, cap: 'Trabaja: ' + nombresM(foco).join(', ') + '.',
      mid: { gk: `BLOQUE ${bi + 1} DE ${nb}`, gt: b.pair ? 'Superserie' : 'Cierre', chico: true, gs: b.pair ? 'Alternas ' + orden : 'Series normales, ' + orden } });
    if (!ser) { b.ex.forEach((e) => tl.push(seg(e, bi, 0, 0, b.pair, false, shot++, SOLO))); return; }
    if (b.pair) {
      const n = b.ex[0].series;
      for (let s = 1; s <= n; s++) {
        b.ex.forEach((e) => tl.push(seg(e, bi, s, n, true, true, shot++, CICLO)));
        if (s < n) tl.push({ k: 'rest', b: bi, d: DESCANSO, e: info(b.ex[0]), shot, top: 'Descanso', cap: `Descansa de 30 a 90 segundos. Sigue ${b.ex[0].codigo}.`, mid: { gk: 'DESCANSO', gt: '30 a 90 s', chico: true, gs: `Sigue: ${b.ex[0].codigo} · ${b.ex[0].nombre}` } });
      }
    } else b.ex.forEach((e) => { for (let s = 1; s <= e.series; s++) tl.push(seg(e, bi, s, e.series, false, true, shot++, CICLO)); });
  });
  tl.push({ k: 'card', i: 2, b: nb, d: OUTRO, e: info(todos[0]), top: 'Listo', cap: 'Es mejor un poco que nada.',
    mid: { gk: 'ESO ES TODO', gt: 'Un ejercicio a la vez', chico: true, gs: `Empiezas con ${todos[0].codigo ? todos[0].codigo + ' · ' : ''}${todos[0].nombre}` } });
  return {
    tl,
    bloques: bloques.map((b, bi) => ({ pair: b.pair, etiqueta: b.pair ? 'Bloque ' + (bi + 1) : 'Cierre', chico: b.pair ? b.ex.map((e) => e.codigo).join(' ') : b.ex.length + ' ej.' })),
    total: tl.reduce((a, s) => a + s.d, 0)
  };
}
