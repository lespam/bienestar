import { describe, expect, it } from 'vitest';
import type { HistCompra } from '../../src/core/db';
import { ideaDeAhorro } from '../../src/modules/comida/ahorro';

// Hoy es lunes 2026-11-23. Las últimas 7 semanas empiezan los lunes 11-23, 11-16, 11-09, 11-02, 10-26, 10-19, 10-12.
const HOY = '2026-11-23';
const compras = (art: string, n: string, fechas: string[], precio?: number): HistCompra[] => fechas.map((fecha) => ({ art, n, fecha, ...(precio ? { precio } : {}) }));
const SEMANAL = ['2026-11-24', '2026-11-17', '2026-11-10', '2026-11-03', '2026-10-27', '2026-10-20'].map((f) => f);

describe('ideas de ahorro', () => {
  it('una idea sin cifras cuando no hay precios', () => {
    const i = ideaDeAhorro(compras('salsa de tomate', 'Salsa de tomate', ['2026-11-18', '2026-11-11', '2026-11-04', '2026-10-28', '2026-10-21']), HOY, ['Salsa de tomate'], []);
    expect(i?.texto).toBe('Compras salsa de tomate casi cada semana: en 5 de las últimas 7. Un paquete de 4 podría ahorrarte dinero y viajes.');
    expect(i?.precio).toBeUndefined();
  });
  it('con precios del historial o el que anotaste, usa cifras', () => {
    const h = compras('salsa de tomate', 'Salsa de tomate', ['2026-11-18', '2026-11-11', '2026-11-04', '2026-10-28', '2026-10-21'], 48);
    expect(ideaDeAhorro(h, HOY, ['Salsa de tomate'], [])?.texto).toContain('unos $48 cada vez, un paquete de 4 que cueste menos de $192 te sale mejor.');
    const sin = compras('salsa de tomate', 'Salsa de tomate', ['2026-11-18', '2026-11-11', '2026-11-04', '2026-10-28', '2026-10-21']);
    expect(ideaDeAhorro(sin, HOY, ['Salsa de tomate'], [], { 'salsa de tomate': 30 })?.texto).toContain('$120');
  });
  it('pide al menos 5 de 7 semanas y que el artículo esté en la lista', () => {
    const cuatro = compras('salsa de tomate', 'Salsa de tomate', ['2026-11-18', '2026-11-11', '2026-11-04', '2026-10-28']);
    expect(ideaDeAhorro(cuatro, HOY, ['Salsa de tomate'], [])).toBeNull();
    const cinco = compras('salsa de tomate', 'Salsa de tomate', ['2026-11-18', '2026-11-11', '2026-11-04', '2026-10-28', '2026-10-21']);
    expect(ideaDeAhorro(cinco, HOY, ['Aceite'], [])).toBeNull();
    // Dos compras en la misma semana cuentan una vez
    expect(ideaDeAhorro(compras('salsa de tomate', 'Salsa de tomate', ['2026-11-18', '2026-11-19', '2026-11-11', '2026-11-12', '2026-11-04']), HOY, ['Salsa de tomate'], [])).toBeNull();
  });
  it('no habla de paquetes de lo que se echa a perder pronto', () => {
    expect(ideaDeAhorro(compras('leche', 'Leche', SEMANAL), HOY, ['Leche'], [])).toBeNull();
    expect(ideaDeAhorro(compras('jitomate', 'Jitomate', SEMANAL), HOY, ['Jitomate'], [])).toBeNull();
  });
  it('lo silenciado no vuelve y entre varios sale uno solo', () => {
    const a = compras('salsa de tomate', 'Salsa de tomate', SEMANAL);
    const b = compras('arroz', 'Arroz', SEMANAL.slice(0, 5));
    expect(ideaDeAhorro([...a, ...b], HOY, ['Salsa de tomate', 'Arroz'], [])?.art).toBe('salsa de tomate');
    expect(ideaDeAhorro([...a, ...b], HOY, ['Salsa de tomate', 'Arroz'], ['salsa de tomate'])?.art).toBe('arroz');
  });
});
