import { describe, expect, it } from 'vitest';
import { leerLineas, nombreUnido, unir, yaSeUne } from '../../src/modules/comida/articulos';
import { leerTicket, unirNombres } from '../../src/modules/ia/tareas';

describe('artículos de tickets', () => {
  it('une nombres en inglés y en español', () => {
    expect(nombreUnido('Tomato sauce')).toBe('Salsa de tomate');
    expect(nombreUnido('SALSA DE TOMATE')).toBe('Salsa de tomate');
    expect(nombreUnido('Whole Milk')).toBe('Leche');
    expect(nombreUnido('Aguacates')).toBe('Aguacate');
    // Lo que no se sabe unir queda con su nombre bien escrito, o con lo que guardaste
    expect(nombreUnido('  KALE   chips ')).toBe('Kale chips');
    expect(nombreUnido('kale chips', { 'kale chips': 'Chips de col rizada' })).toBe('Chips de col rizada');
    expect(yaSeUne('Tomato sauce')).toBe(true);
    expect(yaSeUne('kale chips')).toBe(false);
    expect(yaSeUne('Kale Chips', { 'kale chips': 'x' })).toBe(true);
  });

  it('lee líneas con cantidad y precio', () => {
    expect(leerLineas('Leche 2 L $38.50')).toEqual([{ crudo: 'Leche', n: 'Leche', q: '2 L', precio: 38.5 }]);
    expect(leerLineas('2 x Huevo $76')).toEqual([{ crudo: 'Huevo', n: 'Huevo', q: '2', precio: 76 }]);
    expect(leerLineas('Tomato sauce, 24')).toEqual([{ crudo: 'Tomato sauce', n: 'Tomato sauce', precio: 24 }]);
    expect(leerLineas('Aguacate')).toEqual([{ crudo: 'Aguacate', n: 'Aguacate' }]);
    expect(leerLineas('- Pan\n\n• Arroz 1 kg')).toEqual([{ crudo: 'Pan', n: 'Pan' }, { crudo: 'Arroz', n: 'Arroz', q: '1 kg' }]);
    // Un número solo no es un artículo
    expect(leerLineas('24\n  \n')).toEqual([]);
  });

  it('une al leer', () => {
    expect(unir(leerLineas('Tomato sauce 2 $48'), {})[0]).toMatchObject({ crudo: 'Tomato sauce', n: 'Salsa de tomate', precio: 48 });
  });
});

const ask = (respuesta: string) => async () => respuesta;
describe('IA para tickets', () => {
  it('lee los artículos, descarta lo que no sirve y no inventa la fecha', async () => {
    const r = await leerTicket('k', { tipo: 'image/jpeg', base64: 'x' }, ask(JSON.stringify({ fecha: 'ayer', lugar: 'Walmart', items: [{ n: 'Tomato sauce', q: '2', precio: 48 }, { n: '', q: '', precio: 1 }, { n: 'Leche', precio: -3 }, 7] })));
    expect(r.fecha).toBeNull();
    expect(r.lugar).toBe('Walmart');
    expect(r.items).toEqual([{ n: 'Tomato sauce', q: '2', precio: 48 }, { n: 'Leche', q: '', precio: null }]);
    expect((await leerTicket('k', { tipo: 'image/jpeg', base64: 'x' }, ask('{"fecha":"2026-11-20","items":[{"n":"Pan"}]}'))).fecha).toBe('2026-11-20');
  });
  it('un ticket sin artículos es un error, no una lista vacía', async () => {
    await expect(leerTicket('k', { tipo: 'image/jpeg', base64: 'x' }, ask('{"items": []}'))).rejects.toThrow();
  });
  it('solo acepta nombres de los que se pidieron y no llama si no hay nada que unir', async () => {
    let llamadas = 0;
    const r = await unirNombres('k', ['Kale chips', 'Oat milk'], async () => { llamadas++; return '{"nombres": {"Kale chips": "Chips de col rizada", "Otro": "Algo", "Oat milk": 3}}'; });
    expect(r).toEqual({ 'Kale chips': 'Chips de col rizada' });
    expect(await unirNombres('k', [], async () => { llamadas++; return '{}'; })).toEqual({});
    expect(llamadas).toBe(1);
  });
});
