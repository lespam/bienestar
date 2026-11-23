import { describe, expect, it } from 'vitest';
import type { ItemMenu, Receta } from '../../src/core/db';
import { mazoDe } from '../../src/modules/comida/tarjetas';
import { acercarARef, aporteDe, barraKcal, barraMacro, distanciaARef, hayReferenciaPorComida, kcalTxt, promedio, resumenDia, textoBarra } from '../../src/modules/comida/macros';

const rec = (id: string, k: number | null, p: number | null, c: number | null, g: number | null, cat: Receta['cat'] = 'Comida', por?: Receta['por']) => ({ id, cat, k, p, c, g, ...(por ? { por } : {}) }) as unknown as Receta;
const recetas = new Map([
  ['tinga', rec('tinga', 400, 30, 40, 12)],
  ['huevos', rec('huevos', 300, 20, 10, 20, 'Desayuno')],
  ['sin', rec('sin', null, null, null, null)],
  ['solo-macros', rec('solo-macros', null, 25, 20, 10)],
  ['doble', rec('doble', 200, 10, 20, 8, 'Cena', { jeff: 2 })]
]);
const perfiles = { les: { por: 1, mk: 400, mp: 30 }, jeff: { por: 1.5, mk: 600, mp: 45 } };
const dos = (r: string, lugar: ItemMenu['lugar'] = 'c'): ItemMenu => ({ fecha: '2026-11-23', lugar, t: 'dos', n: r, r });

describe('macros en el plan', () => {
  it('suma por la porción de cada quien', () => {
    expect(aporteDe(dos('tinga'), 'les', recetas, perfiles)).toEqual({ k: 400, p: 30, c: 40, g: 12 });
    expect(aporteDe(dos('tinga'), 'jeff', recetas, perfiles)).toEqual({ k: 600, p: 45, c: 60, g: 18 });
    // la porción de la receta pesa más que la del perfil
    expect(aporteDe(dos('doble'), 'jeff', recetas, perfiles)?.k).toBe(400);
    expect(aporteDe(dos('doble'), 'les', recetas, perfiles)?.k).toBe(200);
  });
  it('cada quien con su receta', () => {
    const m: ItemMenu = { fecha: '2026-11-23', lugar: 'c', t: 'cada', n: 'x', rl: 'huevos', rj: 'tinga' };
    expect(aporteDe(m, 'les', recetas, perfiles)?.k).toBe(300);
    expect(aporteDe(m, 'jeff', recetas, perfiles)?.k).toBe(600);
  });
  it('sin números: takeout, por decidir, colación y receta sin datos', () => {
    for (const t of ['takeout', 'decidir', 'col'] as const) expect(aporteDe({ fecha: 'f', lugar: 'c', t, n: 'x' }, 'les', recetas, perfiles)).toBeNull();
    expect(aporteDe(dos('sin'), 'les', recetas, perfiles)).toBeNull();
    expect(aporteDe(dos('no-existe'), 'les', recetas, perfiles)).toBeNull();
  });
  it('la energía se saca de los macros si falta', () => {
    expect(aporteDe(dos('solo-macros'), 'les', recetas, perfiles)?.k).toBe(25 * 4 + 20 * 4 + 10 * 9);
  });
  it('resumen del día: cuenta lo que tiene números y avisa lo demás sin juzgar', () => {
    const d = resumenDia([dos('huevos', 'd'), dos('tinga'), { fecha: 'f', lugar: 'n', t: 'takeout', n: 'Tacos' }, { fecha: 'f', lugar: 'a', t: 'decidir', n: '' }], 'les', recetas, perfiles);
    expect(d).toMatchObject({ k: 700, conDato: 2, sinDato: 1, hayMenu: true });
    expect(resumenDia([], 'les', recetas, perfiles)).toMatchObject({ hayMenu: false, conDato: 0, k: 0 });
  });
  it('la barra de calorías no se corta ni cambia cuando lo planeado pasa de la referencia', () => {
    const dentro = barraKcal(1340, [1200, 1500]);
    expect(dentro.relleno).toBeGreaterThan(dentro.bandaDesde);
    expect(dentro.bandaAncho).toBeGreaterThan(0);
    const fuera = barraKcal(1900, [1200, 1500]);
    expect(fuera.relleno).toBeGreaterThan(dentro.relleno);
    expect(fuera.relleno).toBeLessThanOrEqual(100);
    expect(barraKcal(900, null)).toMatchObject({ bandaAncho: 0 });
  });
  it('barra de un macro: marca en la referencia, sin referencia no hay marca', () => {
    expect(barraMacro(30, 40).marca).toBeGreaterThan(0);
    expect(barraMacro(30, null)).toEqual({ relleno: 0, marca: null });
    expect(barraMacro(80, 40).relleno).toBe(100);
  });
  it('textos neutros', () => {
    const d = resumenDia([dos('tinga')], 'les', recetas, perfiles);
    expect(textoBarra('Les', d, { k: [1200, 1500], p: null, c: null, g: null })).toBe('Les: planeado ~400 kcal, tu referencia 1,200–1,500 kcal');
    expect(textoBarra('Les', resumenDia([], 'les', recetas, perfiles), { k: null, p: null, c: null, g: null })).toBe('Les: sin menú este día');
    expect(kcalTxt(1344)).toBe('~1,340 kcal');
  });
  it('promedio solo de los días con números', () => {
    const a = resumenDia([dos('tinga')], 'les', recetas, perfiles), b = resumenDia([], 'les', recetas, perfiles);
    expect(promedio([a, b, a])).toMatchObject({ k: 400, dias: 2 });
    expect(promedio([b])).toBeNull();
  });

  describe('acerca a mis referencias', () => {
    const cerca = rec('cerca', 410, 31, 30, 10), lejos = rec('lejos', 900, 5, 100, 30), colacion = rec('col', 100, 5, 10, 3, 'Colación'), nada = rec('nada', null, null, null, null);
    it('mide con la porción de cada quien', () => {
      expect(distanciaARef(cerca, perfiles)).toBeLessThan(distanciaARef(lejos, perfiles)!);
      expect(distanciaARef(colacion, perfiles)).toBeNull();
      expect(distanciaARef(nada, perfiles)).toBeNull();
    });
    it('solo ordena: no quita nada y deja lo que no se puede comparar al final', () => {
      const lista = [lejos, colacion, nada, cerca];
      const orden = acercarARef(lista, perfiles);
      expect(orden.map((r) => r.id)).toEqual(['cerca', 'lejos', 'col', 'nada']);
      expect(orden).toHaveLength(lista.length);
    });
    it('en el mazo de tarjetas: las más cercanas primero, mis fijos antes y ninguna se quita', () => {
      const todas = [{ ...lejos, n: 'A lejos' }, { ...cerca, n: 'B cerca' }, { ...rec('fijo', 700, 10, 10, 10), n: 'C fijo' }];
      const mazo = mazoDe(todas, [], [], 'todo', {}, false, ['fijo'], perfiles).map((r) => r.id);
      expect(mazo).toEqual(['fijo', 'cerca', 'lejos']);
      expect(mazoDe(todas, [], [], 'todo', {}, false, [], perfiles)).toHaveLength(3);
      expect(mazoDe(todas, [], [], 'todo').map((r) => r.id)).toEqual(['lejos', 'cerca', 'fijo']);
    });
    it('sin referencia por comida no cambia el orden', () => {
      const sinRef = { les: { por: 1, mk: null, mp: null }, jeff: { por: 1, mk: null, mp: null } };
      expect(hayReferenciaPorComida(sinRef)).toBe(false);
      expect(hayReferenciaPorComida(perfiles)).toBe(true);
      expect(acercarARef([lejos, cerca], sinRef).map((r) => r.id)).toEqual(['lejos', 'cerca']);
    });
  });
});
