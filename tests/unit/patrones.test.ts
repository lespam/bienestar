import { describe, expect, it } from 'vitest';
import type { ItemMenu } from '../../src/core/db';
import { etapaTxt, faseEn, largoDelCiclo, periodos } from '../../src/modules/cuerpo/ciclo';
import { DIMENSIONES, contarFlex, fechaBreve, lunesDe, notaFlex, patronMenus, patronTakeout, recientes, semanasAtras, sumar, vecesTxt, type RegistroFlex } from '../../src/modules/comida/patrones';

const HOY = '2026-10-11'; // domingo
const reg = (fecha: string, o: Partial<RegistroFlex> = {}): RegistroFlex => ({ fecha, hora: '', emo: '', lugar: '', sueno: '', estres: '', comi: '', ciclo: null, ...o });
const dias = (ini: string, n: number) => Array.from({ length: n }, (_, i) => sumar(ini, i));

describe('ciclo', () => {
  it('junta los días seguidos en un Período', () => {
    expect(periodos([...dias('2026-09-01', 5), ...dias('2026-09-29', 4)])).toEqual([{ inicio: '2026-09-01', dias: 5 }, { inicio: '2026-09-29', dias: 4 }]);
  });
  it('largo: 28 sin datos suficientes, promedio con varios, entre 21 y 35', () => {
    expect(largoDelCiclo([{ inicio: '2026-09-01' }])).toBe(28);
    expect(largoDelCiclo([{ inicio: '2026-08-01' }, { inicio: '2026-08-31' }, { inicio: '2026-09-30' }])).toBe(30);
    expect(largoDelCiclo([{ inicio: '2026-08-01' }, { inicio: '2026-08-05' }])).toBe(21);
  });
  it('fase y día del ciclo', () => {
    const m = dias('2026-09-24', 5); // empezó el 24, ciclo de 28 (un solo inicio)
    expect(faseEn('2026-09-24', m)).toEqual({ fase: 'Menstrual', dia: 1 });
    expect(faseEn('2026-09-28', m)).toEqual({ fase: 'Menstrual', dia: 5 });
    expect(faseEn('2026-10-02', m)).toEqual({ fase: 'Folicular', dia: 9 });
    expect(faseEn('2026-10-07', m)).toEqual({ fase: 'Ovulación', dia: 14 });
    expect(faseEn('2026-10-11', m)).toEqual({ fase: 'Lútea', dia: 18 });
  });
  it('sin Período marcado o muy viejo no inventa fase', () => {
    expect(faseEn('2026-10-11', [])).toBeNull();
    expect(faseEn('2026-09-01', dias('2026-09-24', 3))).toBeNull();
    expect(faseEn('2026-12-01', dias('2026-09-24', 3))).toBeNull();
  });
  it('texto', () => {
    expect(etapaTxt({ fase: 'Lútea', dia: 18 })).toBe('Fase lútea · día 18 del ciclo');
    expect(etapaTxt({ fase: 'Ovulación', dia: 14 })).toBe('Ovulación · día 14 del ciclo');
  });
});

describe('fechas', () => {
  it('lunes, semanas atrás y fecha breve', () => {
    expect(lunesDe(HOY)).toBe('2026-10-05');
    expect(semanasAtras('2026-10-05', HOY)).toBe(0);
    expect(semanasAtras('2026-10-04', HOY)).toBe(1);
    expect(semanasAtras('2026-10-12', HOY)).toBe(-1);
    expect(fechaBreve('2026-09-26')).toBe('Sáb 26 sep');
  });
});

describe('patrones de días flexibles', () => {
  const regs = [reg('2026-09-26', { hora: 'Noche', sueno: 'Menos de 6 h', ciclo: 'Lútea' }), reg('2026-09-18', { hora: 'Noche', ciclo: 'Folicular' }), reg('2026-09-11', { hora: 'Noche', sueno: 'Menos de 6 h', ciclo: 'Lútea' }), reg('2026-09-09', { hora: 'Tarde', ciclo: null })];
  it('cuenta, ignora lo que falta y elige lo más frecuente', () => {
    const c = contarFlex(regs, 'hora');
    expect(c.cnt).toMatchObject({ Noche: 3, Tarde: 1, Mañana: 0 });
    expect(c.top).toBe('Noche');
    expect(c.conocidos).toBe(4);
    const ci = contarFlex(regs, 'ciclo');
    expect(ci.conocidos).toBe(3);
    expect(ci.top).toBe('Lútea');
    expect(contarFlex(regs, 'dia').cnt).toMatchObject({ Sáb: 1, Vie: 2, Mié: 1 });
  });
  it('sin ningún dato no truena', () => {
    const c = contarFlex([reg('2026-09-26')], 'ciclo');
    expect(c.conocidos).toBe(0);
    expect(DIMENSIONES.ciclo.op).toContain(c.top);
  });
  it('notas descriptivas', () => {
    expect(notaFlex('dia', 'Vie', 3, 5)).toBe('3 de 5 fueron en viernes. ¿Qué suele pasar ese día?');
    expect(notaFlex('hora', 'Noche', 3, 4)).toBe('3 de 4 fueron en la noche. ¿Cómo llegas a esa hora del día?');
    expect(notaFlex('ciclo', 'Lútea', 2, 3)).toBe('2 de 3 fueron en la fase lútea. Es común que el apetito cambie con el ciclo.');
    expect(notaFlex('ciclo', 'Ovulación', 2, 3)).toContain('en la ovulación');
    expect(notaFlex('sueno', 'Menos de 6 h', 2, 3)).toBe('2 de 3 fueron después de dormir menos de 6 horas. El cansancio también cuenta.');
  });
  it('solo las últimas 8 semanas, del más nuevo al más viejo', () => {
    const r = recientes([reg('2026-05-01'), reg('2026-09-01'), reg('2026-10-01')], HOY);
    expect(r.map((x) => x.fecha)).toEqual(['2026-10-01', '2026-09-01']);
  });
});

const dos = (fecha: string, lugar: ItemMenu['lugar'], n: string): ItemMenu => ({ fecha, lugar, t: 'dos', n, r: n });
describe('patrones de menús', () => {
  it('platos que más se repiten, formas de comer y lo libre', () => {
    const items: ItemMenu[] = [
      dos('2026-10-01', 'c', 'Tinga'), dos('2026-10-02', 'c', 'Tinga'), dos('2026-09-30', 'n', 'Sopa'),
      { fecha: '2026-09-29', lugar: 'c', t: 'cada', n: 'x', nl: 'Tinga', nj: 'Tacos' },
      { fecha: '2026-09-28', lugar: 'n', t: 'takeout', n: 'Pizza' },
      { fecha: '2026-09-27', lugar: 'd', t: 'decidir', n: 'Por decidir' },
      dos('2026-10-06', 'c', 'Esta semana') // la semana actual no cuenta
    ];
    const p = patronMenus(items, HOY);
    expect(p.platos[0]).toEqual(['Tinga', 3]);
    expect(p.platos.map((x) => x[0])).not.toContain('Esta semana');
    expect(p.formas).toMatchObject({ f: 3, s: 1, t: 1 });
    expect(p.total).toBe(56);
    expect(p.formas.l).toBe(56 * 3 - 5);
    expect(p.libresPorLugar[0]).toBe(56 - 0);
  });
});

describe('patrones de takeout', () => {
  it('gasto, lugares, días y meses', () => {
    const t = (fecha: string, n: string, costo: number): ItemMenu => ({ fecha, lugar: 'n', t: 'takeout', n, costo });
    const p = patronTakeout([t('2026-10-09', 'Pizza', 380), t('2026-10-02', 'Pizza', 300), t('2026-09-18', 'Sushi', 500), t('2026-10-08', 'Tacos', 100)], HOY);
    expect(p.total8).toBe(800);
    expect(p.porSemana8).toBe(100);
    expect(p.hay).toBe(true);
    expect(p.mesActual).toEqual({ n: 3, total: 780 });
    expect(p.mesPasado).toEqual({ n: 1, total: 500 });
    expect(p.nombreMesActual).toBe('octubre');
    expect(p.nombreMesPasado).toBe('septiembre');
    expect(p.lugares[0]).toEqual(['Pizza', 1]);
    expect(p.semanas[p.semanas.length - 1]).toEqual(['Esta semana', 480]);
    expect(p.semanas).toHaveLength(9);
    expect(vecesTxt(1)).toBe('1 vez');
    expect(vecesTxt(3)).toBe('3 veces');
  });
  it('sin takeouts', () => {
    expect(patronTakeout([], HOY).hay).toBe(false);
  });
});
