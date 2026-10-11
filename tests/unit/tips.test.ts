import { describe, expect, it } from 'vitest';
import type { ItemMenu, Receta } from '../../src/core/db';
import { COMBINACIONES, TIPS, TIPS_AL_EMPEZAR, diasEnMenu, recetasDe, tipsVacios, tipsVisibles, yLista } from '../../src/modules/comida/tips';

const receta = (id: string, n: string, ing: string[]) => ({ id, n, ing: ing.map((x) => [1, 'pieza', x]) }) as unknown as Receta;

describe('tips', () => {
  it('empieza con 6 y suma uno cada semana', () => {
    const g = { ...tipsVacios(), inicio: '2026-10-01' };
    expect(tipsVisibles(g, '2026-10-01')).toHaveLength(TIPS_AL_EMPEZAR);
    expect(tipsVisibles(g, '2026-10-07')).toHaveLength(TIPS_AL_EMPEZAR);
    expect(tipsVisibles(g, '2026-10-08')).toHaveLength(TIPS_AL_EMPEZAR + 1);
    expect(tipsVisibles(g, '2027-10-08')).toHaveLength(TIPS.length);
  });
  it('el que llegó esta semana lleva «Nuevo», una vez que llegan todos ya no', () => {
    const g = { ...tipsVacios(), inicio: '2026-10-01' };
    expect(tipsVisibles(g, '2026-10-01').some((x) => x.nuevo)).toBe(false);
    const f = tipsVisibles(g, '2026-10-08');
    expect(f.filter((x) => x.nuevo).map((x) => x.id)).toEqual([TIPS[TIPS_AL_EMPEZAR].id]);
    expect(tipsVisibles({ ...g, ok: [TIPS[TIPS_AL_EMPEZAR].id] }, '2026-10-08').some((x) => x.nuevo)).toBe(false);
    expect(tipsVisibles(g, '2027-10-08').some((x) => x.nuevo)).toBe(false);
  });
  it('los tuyos van primero y se marcan aparte', () => {
    const g = { inicio: '2026-10-01', ok: [TIPS[0].id], mios: [{ id: 'm1', t: 'Lavar la fruta', ok: false }] };
    const f = tipsVisibles(g, '2026-10-01');
    expect(f[0]).toMatchObject({ id: 'm1', mio: true, ok: false, w: 'Lo agregaste tú.' });
    expect(f.find((x) => x.id === TIPS[0].id)!.ok).toBe(true);
  });
  it('combinaciones: recetas que ya usan los dos alimentos (máximo 3)', () => {
    const rs = [receta('a', 'Arroz con frijoles', ['Arroz', 'Frijoles negros']), receta('b', 'Solo arroz', ['Arroz']), receta('c', 'Tinga', ['Jitomate', 'Aceite de oliva']), receta('d', 'Sopa', ['Lentejas', 'Jitomate'])];
    expect(recetasDe(COMBINACIONES[0], rs).map((r) => r.id)).toEqual(['a']);
    expect(recetasDe(COMBINACIONES[3], rs).map((r) => r.id)).toEqual(['c']);
    expect(recetasDe(COMBINACIONES[2], rs).map((r) => r.id)).toEqual(['d']);
    const muchas = ['1', '2', '3', '4', '5'].map((i) => receta(i, 'R' + i, ['Arroz', 'Frijol']));
    expect(recetasDe(COMBINACIONES[0], muchas)).toHaveLength(3);
  });
  it('los días de esta semana en que está en el menú', () => {
    const menu: ItemMenu[] = [
      { fecha: '2026-10-14', lugar: 'c', t: 'dos', n: 'A', r: 'a' },
      { fecha: '2026-10-12', lugar: 'n', t: 'cada', n: 'x', rl: 'a', rj: 'b' },
      { fecha: '2026-10-14', lugar: 'n', t: 'dos', n: 'A', r: 'a' },
      { fecha: '2026-10-15', lugar: 'c', t: 'dos', n: 'B', r: 'z' }
    ];
    expect(diasEnMenu(['a'], menu)).toEqual(['lunes', 'miércoles']);
    expect(diasEnMenu([], menu)).toEqual([]);
    expect(yLista(['lunes', 'miércoles', 'viernes'])).toBe('lunes, miércoles y viernes');
    expect(yLista(['lunes'])).toBe('lunes');
  });
});
