import { describe, expect, it } from 'vitest';
import type { ItemMenu, Receta } from '../../src/core/db';
import { armarLista, cantidadCompra, comprasVacias, conteos, plantillaMarcada, repartir, seccionDe, sugerencias, textoCompartir } from '../../src/modules/comida/compras';

const receta = (id: string, n: string, y: number, ing: Receta['ing']) => ({ id, n, y, ing, cat: 'Comida' }) as Receta;
const dos = (r: string, lugar: ItemMenu['lugar'] = 'c', fecha = '2026-10-12'): ItemMenu => ({ fecha, lugar, t: 'dos', n: r, r });

describe('lista de compras', () => {
  it('clasifica por sección', () => {
    expect(seccionDe('Pechuga de pollo')).toBe(1);
    expect(seccionDe('Queso oaxaca')).toBe(2);
    expect(seccionDe('Tortilla de maíz')).toBe(4);
    expect(seccionDe('Pimienta al gusto')).toBe(5);
    expect(seccionDe('Cosa rara')).toBe(6);
  });
  it('escribe cantidades en kilos y piezas enteras', () => {
    expect(cantidadCompra(1400, 'g')).toBe('1,4 kg');
    expect(cantidadCompra(0.33, 'lata')).toBe('1 lata');
    expect(cantidadCompra(3.2, 'pieza')).toBe('4 piezas');
    expect(cantidadCompra(null, '')).toBe('');
  });
  it('un alimento con distintas unidades es una sola fila, para que se marque una vez', () => {
    const rs = [receta('a', 'Tinga', 4, [[1, 'cdita', 'Aceite'], [1, 'pieza', 'Jitomate']]), receta('b', 'Bowl', 4, [[2, 'cda', 'aceite']])];
    const filas = armarLista([dos('a'), dos('b', 'n')], rs);
    const aceite = filas.filter((f) => f.n === 'Aceite');
    expect(aceite).toHaveLength(1);
    expect(aceite[0].q).toBe('1 cdita + 2 cdas');
    expect(aceite[0].para).toEqual(['Tinga', 'Bowl']);
    expect(new Set(filas.map((f) => f.n)).size).toBe(filas.length);
  });
  it('suma por tandas y compra la proteína cruda: cocida × 1.3', () => {
    const rs = [receta('a', 'Tinga', 2, [[300, 'g', 'Pechuga de pollo'], [2, 'pieza', 'Jitomate'], [100, 'g', 'Queso panela']])];
    // los dos comen 2 veces: 4 porciones, 2 tandas
    const filas = armarLista([dos('a'), dos('a', 'n')], rs);
    const pollo = filas.find((f) => f.n === 'Pechuga de pollo')!;
    expect(pollo.q).toBe('780 g');
    expect(pollo.crudo).toBe(true);
    expect(filas.find((f) => f.n === 'Queso panela')!.q).toBe('200 g');
    expect(filas.find((f) => f.n === 'Queso panela')!.crudo).toBeUndefined();
    expect(filas.find((f) => f.n === 'Jitomate')!.q).toBe('4 piezas');
  });
  it('junta las colaciones con lo que ya estaba en la lista', () => {
    const rs = [receta('a', 'Ensalada', 1, [[2, 'pieza', 'Plátano']])];
    const col: ItemMenu = { fecha: '2026-10-12', lugar: 'a', t: 'col', n: 'x', col: { base: 'Yogurt griego', fruta: 'Plátano', extra: '', junto: null } };
    const filas = armarLista([dos('a'), col], rs);
    const pl = filas.find((f) => f.n === 'Plátano')!;
    expect(pl.q).toBe('4 piezas + 1 colación');
    expect(pl.para).toContain('Colaciones');
    expect(filas.some((f) => f.n === 'Yogurt griego')).toBe(true);
  });
  it('reparte entre Enfrente y Walmart+: una sola cosa pesada va enfrente', () => {
    const e = comprasVacias();
    e.extras = [
      { n: 'Paper Towels', q: '', sec: 6, urg: 'falta', chk: false },
      { n: 'Laundry Detergent', q: '', sec: 6, urg: 'falta', chk: false },
      { n: 'Café', q: '', sec: 6, urg: 'pronto', chk: false },
      { n: 'Pan', q: '', sec: 4, urg: 'falta', chk: false }
    ];
    const { filas, pasadas } = repartir([{ n: 'Arroz', q: '1 kg', para: ['x'], sec: 3 }, { n: 'Jitomate', q: '', para: ['x'], sec: 0 }], e);
    const d = (n: string) => filas.find((f) => f.n === n)!.dest;
    expect(d('Arroz')).toBe('walmart');
    expect(d('Jitomate')).toBe('enfrente');
    expect(d('Paper Towels')).toBe('enfrente');
    expect(d('Laundry Detergent')).toBe('walmart');
    expect(d('Café')).toBe('walmart');
    expect(d('Pan')).toBe('enfrente');
    expect(pasadas).toEqual(['Laundry Detergent']);
    // lo que mueves tú manda
    e.dest.Arroz = 'enfrente';
    expect(repartir([{ n: 'Arroz', q: '', para: [], sec: 3 }], e).filas[0].dest).toBe('enfrente');
  });
  it('cuenta, comparte y sugiere', () => {
    const e = comprasVacias();
    const { filas } = repartir([{ n: 'Jitomate', q: '4 piezas', para: ['x'], sec: 0 }, { n: 'Cebolla', q: '2 piezas', para: ['x'], sec: 0 }], e);
    e.chk.Cebolla = true;
    expect(conteos(filas, e)).toMatchObject({ enfrente: 2, walmart: 0, todo: 2, hechas: 1 });
    expect(textoCompartir(filas, e, 'enfrente', false)).toBe('Súper de enfrente\n\nFrutas y verduras\n• Jitomate (4 piezas)');
    expect(textoCompartir(filas, e, 'enfrente', true)).toContain('• Cebolla (2 piezas)');
    expect(textoCompartir(filas, e, 'walmart', false)).toBe('');
    expect(sugerencias('PAPER', [])).toEqual(['Paper Towels', 'Printer Paper', 'Toilet Paper']);
    expect(sugerencias('paper', ['paper towels'])).toEqual(['Printer Paper', 'Toilet Paper']);
    expect(sugerencias('', [])).toEqual([]);
  });
  it('marca la plantilla con N lo que falta', () => {
    const { columnas, otros } = plantillaMarcada([{ n: 'Paper Towels', q: '', sec: 6, urg: 'falta', chk: false }, { n: 'Sal de mar', q: '', sec: 5, urg: 'falta', chk: false }, { n: 'Bananas', q: '', sec: 0, urg: 'falta', chk: true }]);
    const todos = columnas.flatMap((c) => c.its);
    expect(todos.find((i) => i.n === 'Paper Towels')!.y).toBe(true);
    expect(todos.find((i) => i.n === 'Bananas')!.y).toBe(false);
    expect(otros).toEqual(['Sal de mar']);
  });
});
