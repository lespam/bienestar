import { describe, expect, it } from 'vitest';
import type { ItemMenu, Receta } from '../../src/core/db';
import { agregarConsejos, consejosDe } from '../../src/modules/comida/consejos';

const rec = (ing: [number, string, string][]) => ({ id: 'a', n: 'Bowl', ing: ing.map((i) => [...i, 'V']) }) as unknown as Receta;
const dos = (fecha: string, lugar: 'd' | 'c' | 'n', r: string): ItemMenu => ({ fecha, lugar, t: 'dos', n: 'Bowl', r });
let k = 0;
const id = () => 'x' + k++;

describe('consejos de preparación', () => {
  it('uno por ingrediente que coincide, con su tiempo', () => {
    const c = consejosDe(rec([[200, 'g', 'Fresas'], [300, 'g', 'Pechuga de pollo'], [1, 'pieza', 'Aguacate'], [1, 'taza', 'Arroz']]));
    expect(c.map((x) => x.t)).toEqual(['Corta fresas', 'Saca del congelador pechuga de pollo', 'Compra el mismo día aguacate']);
    expect(c[0]).toMatchObject({ antes: 1, m: 5 });
    expect(c[2].antes).toBe(0);
    expect(consejosDe(rec([[1, 'taza', 'Arroz']]))).toEqual([]);
  });
  it('los pone el día que toca, o hoy si ya pasó, sin repetirse', () => {
    const recetas = new Map([['a', rec([[200, 'g', 'Fresas'], [1, 'pieza', 'Aguacate']])]]);
    const menu = [dos('2026-10-14', 'c', 'a')];
    const t = agregarConsejos([], menu, recetas, ['2026-10-14'], '2026-10-10', id);
    expect(t.map((x) => x.fecha).sort()).toEqual(['2026-10-13', '2026-10-14']);
    expect(t.find((x) => x.fecha === '2026-10-13')!.items[0]).toMatchObject({ t: 'Corta fresas', fm: '2026-10-14:c', ok: false });
    expect(agregarConsejos(t, menu, recetas, ['2026-10-14'], '2026-10-10', id).flatMap((x) => x.items)).toHaveLength(2);
    // Ya es el día: todo cae hoy
    const hoy = agregarConsejos([], menu, recetas, ['2026-10-14'], '2026-10-14', id);
    expect(hoy).toHaveLength(1);
    expect(hoy[0].items).toHaveLength(2);
  });
});
