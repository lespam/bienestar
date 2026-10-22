import { describe, expect, it } from 'vitest';
import { armarPlan, columnas, conSaltados, dondeQuedaste, historialDe, llave, mejorMarca, ordenDeGrupos, pasoActual, pasosDeGrupo, resumenPR, textoSeries } from '../../src/modules/entreno/calculos';
import type { Ejercicio, Grupo } from '../../src/modules/entreno/programa';
import type { Serie, Sesion } from '../../src/core/db';

const ej = (clave: string, over: Partial<Ejercicio> = {}): Ejercicio => ({ codigo: clave, clave, series: 2, rango: '10-15', nombre: clave, pagina: 1, registro: ['peso', 'reps'], gym: false, ...over });
const serie = (clave: string, n: number, v: Serie['v'], unidad: 'lb' | 'kg' = 'lb'): Serie => ({ sesion: 1, clave, n, v, unidad, hora: 0 });
const ses = (id: number, fecha: string): Sesion => ({ id, fecha, tipo: 'rutina', modo: 'libro', primero: 'casa', abierta: 0, inicio: 0, nota: '' });

describe('plan por modo', () => {
  const g1: Grupo = { tipo: 'suelto', ejercicios: [ej('a')] };
  const g2: Grupo = { tipo: 'superserie', ejercicios: [ej('b', { gym: true }), ej('c')] };
  const g3: Grupo = { tipo: 'suelto', ejercicios: [ej('d')] };
  it('orden libro y casa dejan un solo bloque', () => {
    expect(armarPlan([g1, g2, g3], 'libro', 'gym')).toHaveLength(1);
    expect(ordenDeGrupos(armarPlan([g1, g2, g3], 'libro', 'gym'))).toEqual([g1, g2, g3]);
  });
  it('mixto agrupa por lugar y no parte superseries', () => {
    const p = armarPlan([g1, g2, g3], 'mixto', 'gym');
    expect(p.map((x) => x.lugar)).toEqual(['gym', 'casa']);
    expect(p[0].grupos).toEqual([g2]);
    expect(p[1].grupos).toEqual([g1, g3]);
    expect(p[1].mover).toBe('Subes a casa');
  });
  it('sin ejercicios de gym no separa', () => { expect(armarPlan([g1, g3], 'mixto', 'gym')).toHaveLength(1); });
});

describe('pasos', () => {
  it('superserie alterna ronda por ronda', () => {
    const g: Grupo = { tipo: 'superserie', ejercicios: [ej('a', { series: 2 }), ej('b', { series: 2 })] };
    expect(pasosDeGrupo(g)).toEqual([{ e: 0, s: 0 }, { e: 1, s: 0 }, { e: 0, s: 1 }, { e: 1, s: 1 }]);
  });
  it('suelto va serie por serie y el paso actual salta lo hecho', () => {
    const g: Grupo = { tipo: 'suelto', ejercicios: [ej('a', { series: 2 }), ej('b', { series: 1 })] };
    const hechas = new Set([llave('a', 0)]);
    expect(pasoActual([g], hechas)).toEqual({ g: 0, i: 1, paso: { e: 0, s: 1 } });
    hechas.add(llave('a', 1)); hechas.add(llave('b', 0));
    expect(pasoActual([g], hechas)).toBeNull();
  });
});

describe('formato y récord', () => {
  it('columnas con unidad', () => { expect(columnas(['peso', 'reps'], 'lb').map((c) => c.texto)).toEqual(['Peso (lb)', 'Reps']); });
  it('texto de series con peso corporal y con peso', () => {
    expect(textoSeries(['peso', 'reps'], [serie('a', 0, { peso: 0, reps: 20 }), serie('a', 1, { peso: 0, reps: 18 })])).toBe('Peso corporal · 20, 18 reps');
    expect(textoSeries(['peso', 'reps'], [serie('a', 0, { peso: 15, reps: 10 }), serie('a', 1, { peso: 15, reps: 9 })])).toBe('15 lb · 10, 9 reps');
  });
  it('unilateral separa izquierdo y derecho', () => {
    expect(textoSeries(['peso', 'repsIzq', 'repsDer'], [serie('a', 0, { peso: 10, repsIzq: 8, repsDer: 9 })])).toBe('10 lb · izq 8 · der 9 reps');
  });
  it('mejor marca prioriza peso y luego repeticiones, comparando lb con kg', () => {
    const m = mejorMarca(['peso', 'reps'], [serie('a', 0, { peso: 20, reps: 10 }), serie('a', 1, { peso: 10, reps: 12 }, 'kg')]);
    expect(m?.texto).toBe('10 kg × 12 reps');
  });
  it('resumen: primera vez, nuevo e igual', () => {
    const reg = ['peso', 'reps'] as Ejercicio['registro'];
    const solo = historialDe([{ sesion: ses(1, '2026-10-01'), series: [serie('a', 0, { peso: 10, reps: 10 })] }], 'a');
    expect(resumenPR(reg, solo).estado).toBe('primera');
    const dos = historialDe([
      { sesion: ses(1, '2026-10-01'), series: [serie('a', 0, { peso: 10, reps: 10 })] },
      { sesion: ses(2, '2026-10-04'), series: [{ ...serie('a', 0, { peso: 10, reps: 12 }), sesion: 2 }] }
    ], 'a');
    expect(resumenPR(reg, dos, 2).estado).toBe('nuevo');
    expect(resumenPR(reg, dos, 1).estado).toBe('primera');
    const igual = historialDe([
      { sesion: ses(1, '2026-10-01'), series: [serie('a', 0, { peso: 10, reps: 12 })] },
      { sesion: ses(2, '2026-10-04'), series: [{ ...serie('a', 0, { peso: 10, reps: 12 }), sesion: 2 }] }
    ], 'a');
    expect(resumenPR(reg, igual, 2).estado).toBe('igual');
  });
});

describe('dónde quedaste', () => {
  it('describe tope y rango sin hablar de lo que faltó', () => {
    const e = ej('a', { rango: '10-15' });
    const t = dondeQuedaste(e, [serie('a', 0, { peso: 0, reps: 15 }), serie('a', 1, { peso: 0, reps: 12 })]);
    expect(t).toContain('La serie 1 llegó al tope del rango (15)');
    expect(t).toContain('dentro del rango');
    expect(t).not.toMatch(/fall|mal|culp|debes/i);
  });
});

import { armarSemana, letraQueToca, lineaCuando, proximasLetras, semanaDelPrograma, ultimasMejor, DIAS_INICIALES } from '../../src/modules/entreno/semana';
import type { Programa } from '../../src/modules/entreno/programa';

const prog = { alcance: '', semanas: [{ desde: 1, hasta: 2, rutinas: ['A', 'B', 'C'] }], rutinas: { A: { pagina: 1, grupos: [] }, B: { pagina: 2, grupos: [] }, C: { pagina: 3, grupos: [] } }, ejercicios: {} } as unknown as Programa;

describe('qué toca y la semana', () => {
  it('sigue el ciclo A, B, C después de la última', () => {
    expect(letraQueToca(prog, [])).toBe('A');
    expect(letraQueToca(prog, [{ tipo: 'rutina', rutina: 'A', inicio: 1 }])).toBe('B');
    expect(letraQueToca(prog, [{ tipo: 'rutina', rutina: 'C', inicio: 5 }, { tipo: 'rutina', rutina: 'A', inicio: 1 }])).toBe('A');
    expect(proximasLetras(prog, 'C', 3)).toEqual(['C', 'A', 'B']);
  });
  it('semana del programa cuenta desde la primera sesión', () => {
    expect(semanaDelPrograma([])).toBe(1);
    expect(semanaDelPrograma([{ inicio: 0 }], 8 * 86_400_000)).toBe(2);
  });
  it('arma de lunes a domingo con hechas, hoy y las que siguen', () => {
    const hoy = new Date(2026, 9, 1); // jueves 1 de octubre
    const s = armarSemana(hoy, [{ fecha: '2026-09-28', tipo: 'rutina', rutina: 'A', abierta: 0 }, { fecha: '2026-09-29', tipo: 'rutina', rutina: 'B', abierta: 0 }], ['C', 'A', 'B'], DIAS_INICIALES);
    expect(s.map((d) => d.num)).toEqual([28, 29, 30, 1, 2, 3, 4]);
    expect(s.map((d) => d.estado)).toEqual(['hecha', 'hecha', 'libre', 'hoy', 'luego', 'luego', 'libre']);
    expect(s[3].ses).toBe('C');
    expect(s[4].ses).toBe('A');
  });
  it('los días de cardio no se llevan letra: la rutina pasa al siguiente día', () => {
    const hoy = new Date(2026, 9, 1); // jueves
    const cardio = [false, false, true, false, true, false, false]; // miércoles y viernes
    const dias = [true, true, false, true, false, true, false];
    const s = armarSemana(hoy, [{ fecha: '2026-09-28', tipo: 'rutina', rutina: 'A', abierta: 0 }, { fecha: '2026-09-30', tipo: 'cardio', abierta: 0 }], ['B', 'C'], dias, cardio);
    expect(s.map((d) => d.ses)).toEqual(['A', '–', 'cardio', 'B', 'cardio', 'C', '–']);
    expect(s[2].texto).toBe('cardio hecho');
    expect(s[4].estado).toBe('luego');
    // Cardio en un día que no era de cardio: también se ve, y la rutina pasa al siguiente día.
    const t = armarSemana(hoy, [{ fecha: '2026-10-01', tipo: 'cardio', abierta: 0 }], ['B', 'C'], DIAS_INICIALES);
    expect(t.map((d) => d.ses).slice(3, 6)).toEqual(['cardio', 'B', 'C']);
    expect(lineaCuando({ dias, cardio, hora: '19:00', lugar: '' }, new Date(2026, 9, 2))).toBe('Hoy toca cardio');
  });
  it('con la sesión de hoy hecha, mañana va la que sigue y no se repite', () => {
    const hoy = new Date(2026, 9, 22); // jueves
    // Así lo arma el contexto: con sesión hoy, las seguidas empiezan con la letra de hoy.
    const s = armarSemana(hoy, [{ fecha: '2026-10-22', tipo: 'rutina', rutina: 'A', abierta: 0 }], ['A', 'B', 'C'], DIAS_INICIALES);
    expect(s.map((d) => d.ses).slice(3, 6)).toEqual(['A', 'B', 'C']);
    const abierta = armarSemana(hoy, [{ fecha: '2026-10-22', tipo: 'rutina', rutina: 'A', abierta: 1 }], ['A', 'B', 'C'], DIAS_INICIALES);
    expect(abierta.map((d) => d.ses).slice(3, 6)).toEqual(['A', 'B', 'C']);
  });
  it('la línea de cuándo y dónde', () => {
    const c = { dias: DIAS_INICIALES, hora: '19:00', lugar: 'en la sala' };
    expect(lineaCuando(c, new Date(2026, 9, 1))).toBe('Hoy a las 7 pm, en la sala');
    expect(lineaCuando(c, new Date(2026, 9, 4))).toBe('Hoy no tienes hora planeada');
  });
  it('el mensaje de "mejor" solo sale con tres sesiones seguidas', () => {
    const m = (i: number, sintio: 'mejor' | 'igual') => ({ inicio: i, abierta: 0 as const, sintio });
    expect(ultimasMejor([m(1, 'mejor'), m(2, 'mejor')])).toBe(false);
    expect(ultimasMejor([m(1, 'mejor'), m(2, 'mejor'), m(3, 'mejor')])).toBe(true);
    expect(ultimasMejor([m(1, 'mejor'), m(2, 'igual'), m(3, 'mejor')])).toBe(false);
  });
});

describe('ejercicios saltados', () => {
  it('cuentan como hechos todas las series del ejercicio saltado y nada más', () => {
    const grupos: Grupo[] = [{ tipo: 'suelto', ejercicios: [ej('a', { series: 3 })] }, { tipo: 'suelto', ejercicios: [ej('b', { series: 2 })] }];
    const h = conSaltados([llave('b', 0)], grupos, ['a']);
    expect([...h].sort()).toEqual([llave('a', 0), llave('a', 1), llave('a', 2), llave('b', 0)].sort());
    expect(pasoActual(grupos, h)).toMatchObject({ g: 1 });
  });
});
