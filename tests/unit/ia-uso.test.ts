import { describe, it, expect } from 'vitest';
import { anotar, costo, dolares, tokensDe, usoVacio } from '../../src/modules/ia/uso';

describe('consumo de la API', () => {
  it('estima el costo con los precios de cada modelo', () => {
    expect(costo('claude-haiku-5-5', { entrada: 1_000_000, salida: 1_000_000 })).toBeCloseTo(0.6);
    expect(costo('claude-sonnet-5-5', { entrada: 20_000, salida: 4_000 })).toBeCloseTo(0.08);
    expect(costo('otro', { entrada: 5, salida: 5 })).toBe(0);
  });
  it('lee usage, con la caché como entrada', () => {
    expect(tokensDe({ input_tokens: 10, cache_read_input_tokens: 5, output_tokens: 3 })).toEqual({ entrada: 15, salida: 3 });
    expect(tokensDe(undefined)).toBeNull();
    expect(tokensDe({})).toBeNull();
  });
  it('suma por mes y en total', () => {
    let u = usoVacio('2026-10-30');
    u = anotar(u, 'claude-sonnet-5-5', { entrada: 20_000, salida: 4_000 }, '2026-10-30');
    u = anotar(u, 'claude-sonnet-5-5', { entrada: 20_000, salida: 4_000 }, '2026-11-02');
    expect(u.desde).toBe('2026-10-30');
    expect(u.total.pedidos).toBe(2);
    expect(u.total.usd).toBeCloseTo(0.16);
    expect(u.meses['2026-11'].pedidos).toBe(1);
    expect(dolares(0.004)).toBe('menos de $0.01');
    expect(dolares(0)).toBe('$0.00');
  });
});
