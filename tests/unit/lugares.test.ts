import { describe, expect, it } from 'vitest';
import { armarLista, comprasVacias, conteos, repartir, textoCompartir } from '../../src/modules/comida/compras';
import { anotarMovimiento, cortoLugar, lugaresIniciales, normalizarLugares, ponerReglaIng, ponerReglaSec, porReglas, quitarLugar } from '../../src/modules/comida/lugares';
import type { ItemMenu, Receta } from '../../src/core/db';

const fila = (n: string, sec: number) => ({ n, q: '', para: ['x'], sec });

describe('lugares de compra', () => {
  it('vienen los dos de siempre y siempre queda al menos uno', () => {
    expect(lugaresIniciales().lista.map((l) => l.id)).toEqual(['enfrente', 'walmart']);
    expect(normalizarLugares(undefined).lista).toHaveLength(2);
    expect(normalizarLugares({ lista: [] }).lista).toHaveLength(2);
    const solo = quitarLugar(quitarLugar(lugaresIniciales(), 'walmart'), 'enfrente');
    expect(solo.lista.map((l) => l.id)).toEqual(['enfrente']);
  });

  it('nombres cortos para pestañas y avisos', () => {
    expect(cortoLugar('Súper de enfrente')).toBe('Enfrente');
    expect(cortoLugar('Pedido Walmart+')).toBe('Walmart+');
    expect(cortoLugar('Mercado')).toBe('Mercado');
  });

  it('manda primero lo que moviste, luego la regla del ingrediente, la de la sección y al final la de fábrica', () => {
    let d = lugaresIniciales();
    d.lista.push({ id: 'l3', n: 'Mercado', color: '#fff' });
    const base = [fila('Arroz', 3), fila('Jitomate', 0), fila('Aceite', 5)];
    expect(repartir(base, comprasVacias(), d).filas.map((f) => [f.n, f.dest])).toEqual([['Jitomate', 'enfrente'], ['Arroz', 'walmart'], ['Aceite', 'walmart']]);
    d = ponerReglaSec(d, 0, 'l3');
    d = ponerReglaIng(d, 'arroz', 'enfrente');
    const r = repartir(base, comprasVacias(), d).filas;
    expect(r.find((f) => f.n === 'Jitomate')?.dest).toBe('l3');
    expect(r.find((f) => f.n === 'Arroz')?.dest).toBe('enfrente');
    const e = comprasVacias();
    e.dest['Arroz'] = 'walmart';
    expect(repartir(base, e, d).filas.find((f) => f.n === 'Arroz')?.dest).toBe('walmart');
  });

  it('una regla acerca un lugar que ya no existe: se ignora', () => {
    let d = ponerReglaIng(lugaresIniciales(), 'Arroz', 'walmart');
    d = quitarLugar(d, 'walmart');
    expect(porReglas(d, 'Arroz', 3)).toBeUndefined();
    expect(repartir([fila('Arroz', 3)], comprasVacias(), d).filas[0].dest).toBe('enfrente');
    const e = comprasVacias();
    e.dest['Arroz'] = 'walmart';
    expect(repartir([fila('Arroz', 3)], e, d).filas[0].dest).toBe('enfrente');
  });

  it('pregunta una sola vez, al mover dos veces el mismo ingrediente al mismo lugar', () => {
    let d = lugaresIniciales();
    let r = anotarMovimiento(d, 'Arroz', 'walmart');
    expect(r.pregunta).toBe(false);
    r = anotarMovimiento(r.datos, 'Arroz', 'walmart');
    expect(r.pregunta).toBe(true);
    // Ya se preguntó: no vuelve a preguntar
    r = anotarMovimiento(r.datos, 'Arroz', 'walmart');
    expect(r.pregunta).toBe(false);
    // Mover a otro lugar reinicia la cuenta
    d = anotarMovimiento(lugaresIniciales(), 'Leche', 'walmart').datos;
    expect(anotarMovimiento(d, 'Leche', 'enfrente').pregunta).toBe(false);
    // Con regla igual, no pregunta
    const conRegla = ponerReglaIng(anotarMovimiento(lugaresIniciales(), 'Pan', 'walmart').datos, 'Pan', 'walmart');
    expect(anotarMovimiento(conRegla, 'Pan', 'walmart').pregunta).toBe(false);
  });

  it('cuenta, comparte y filtra por lugar', () => {
    const d = lugaresIniciales();
    d.lista.push({ id: 'l3', n: 'Mercado', color: '#fff' });
    const e = comprasVacias();
    e.dest['Jitomate'] = 'l3';
    const { filas } = repartir([fila('Jitomate', 0), fila('Cebolla', 0)], e, d);
    expect(conteos(filas, e, d)).toMatchObject({ enfrente: 1, walmart: 0, l3: 1, todo: 2 });
    expect(textoCompartir(filas, e, 'l3', false, d)).toBe('Mercado\n\nFrutas y verduras\n• Jitomate');
    expect(textoCompartir(filas, e, 'todo', false, d)).toContain('Súper de enfrente');
  });

  it('el menú dice quién come cada cosa', () => {
    const r: Receta = { id: 'a', n: 'A', cat: 'Comida', y: 2, t: '', src: '', u1: '', k: 0, p: 0, c: 0, g: 0, ing: [[1, 'pieza', 'Jitomate', 'V']], steps: [] } as unknown as Receta;
    const items: ItemMenu[] = [
      { fecha: '2026-11-23', lugar: 'c', t: 'cada', n: 'x', rl: 'a' },
      { fecha: '2026-11-24', lugar: 'c', t: 'cada', n: 'x', rj: 'a' }
    ] as ItemMenu[];
    expect(armarLista(items, [r])[0].quien).toEqual(['les', 'jeff']);
    expect(armarLista([items[0]], [r])[0].quien).toEqual(['les']);
  });
});
