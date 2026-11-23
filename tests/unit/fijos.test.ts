import { beforeEach, describe, expect, it } from 'vitest';
import { BaseBienestar, usarBase, type ItemMenu, type Receta } from '../../src/core/db';
import { guardarFijos, leerFijos, nuevoFijo, semanasDeReceta, silenciarSugerencia, sugerenciasDeFijos } from '../../src/modules/comida/datos';
import { cambiosFijos, fijoNuevo, huecosDe, semanasPorReceta, sugerenciaTxt, sugerir } from '../../src/modules/comida/fijos';
import { mazoDe } from '../../src/modules/comida/tarjetas';
import { db } from '../../src/core/db';

let n = 0;
beforeEach(() => { usarBase(new BaseBienestar('fijos-' + n++)); });

const HOY = '2026-11-23'; // lunes
const dos = (fecha: string, lugar: 'd' | 'c' | 'n', r: string): ItemMenu => ({ fecha, lugar, t: 'dos', n: r, r });
const rec = (id: string, cat = 'Desayuno') => ({ id, n: id, cat, y: 1, ing: [], steps: [] }) as unknown as Receta;
// Molletes: lunes de cuatro semanas seguidas en el desayuno
const molletes = ['2026-11-23', '2026-11-16', '2026-11-09'].map((f) => dos(f, 'd', 'molletes'));

describe('qué se planeó y qué se comió', () => {
  it('cuenta semanas distintas, no veces', () => {
    const menu = [...molletes, dos('2026-11-25', 'c', 'molletes'), dos('2026-10-01', 'd', 'molletes'), { ...dos('2026-11-24', 'n', 'x'), t: 'decidir' } as ItemMenu];
    const reg = [{ fecha: '2026-11-17', receta: 'molletes' }, { fecha: '2026-11-18', receta: 'molletes' }, { fecha: '2026-11-10' }];
    const s = semanasPorReceta(menu, reg, HOY);
    expect(s.molletes).toEqual({ plan: 3, comido: 1 });
    expect(s.x).toBeUndefined();
    // La ventana se puede ampliar: 2026-10-01 queda a 8 semanas
    expect(semanasPorReceta(menu, reg, HOY, 9).molletes.plan).toBe(4);
  });

  it('sugiere dejar como fijo lo que estuvo en 3 de 4 semanas, con tono curioso', () => {
    const s = sugerir(molletes, [], [], {}, HOY);
    expect(s).toEqual([{ tipo: 'fijo', r: 'molletes', plan: 3, comido: 0 }]);
    expect(sugerenciaTxt(s[0], 'Molletes')).toBe('Molletes ha estado en tu menú 3 de 4 semanas. ¿Quieres dejarlo como fijo de la semana?');
    // Ya es fijo: no se repite la idea
    expect(sugerir(molletes, [], ['molletes'], {}, HOY)).toEqual([]);
    // Dos semanas no alcanzan
    expect(sugerir(molletes.slice(0, 2), [], [], {}, HOY)).toEqual([]);
  });

  it('«No por ahora» calla la idea 28 días y luego puede volver', () => {
    expect(sugerir(molletes, [], [], { molletes: '2026-11-10' }, HOY)).toEqual([]);
    expect(sugerir(molletes, [], [], { molletes: '2026-10-20' }, HOY)).toHaveLength(1);
  });

  it('lo que planeas mucho y registras poco, solo si sí registras lo demás', () => {
    const otros = [{ fecha: '2026-11-17', receta: 'avena' }, { fecha: '2026-11-03', receta: 'avena' }];
    const s = sugerir(molletes, otros, ['molletes'], {}, HOY);
    expect(s).toEqual([{ tipo: 'poco', r: 'molletes', plan: 3, comido: 0 }]);
    expect(sugerenciaTxt(s[0], 'Molletes')).toContain('lo registras poco');
    expect(sugerenciaTxt(s[0], 'Molletes')).not.toMatch(/mal|falla|debes/i);
    // Si casi no registras nada, no se supone
    expect(sugerir(molletes, [], ['molletes'], {}, HOY)).toEqual([]);
    // Si lo registras seguido, tampoco
    const comidos = [...otros, { fecha: '2026-11-23', receta: 'molletes' }, { fecha: '2026-11-16', receta: 'molletes' }];
    expect(sugerir(molletes, comidos, ['molletes'], {}, HOY)).toEqual([]);
  });
});

describe('mis fijos', () => {
  it('recuerda en qué días y tiempos suele ir', () => {
    const menu = [dos('2026-11-23', 'd', 'molletes'), dos('2026-11-25', 'd', 'molletes'), dos('2026-11-16', 'd', 'molletes'), dos('2026-11-25', 'c', 'avena')];
    expect(huecosDe(menu, 'molletes', HOY)).toEqual([{ dia: 0, l: 'd' }, { dia: 2, l: 'd' }]);
    expect(fijoNuevo(menu, 'avena', HOY)).toEqual({ r: 'avena', huecos: [{ dia: 2, l: 'c' }] });
    expect(huecosDe([], 'molletes', HOY)).toEqual([]);
  });

  it('«Repetir mis fijos» llena solo lugares libres y de hoy en adelante', () => {
    const dias = ['2026-11-30', '2026-12-01', '2026-12-02', '2026-12-03', '2026-12-04', '2026-12-05', '2026-12-06'];
    const recetas = { molletes: rec('molletes'), sopa: rec('sopa', 'Comida'), cena: rec('cena', 'Cena') };
    const fijos = [{ r: 'molletes', huecos: [{ dia: 0, l: 'd' as const }, { dia: 2, l: 'd' as const }] }, { r: 'sopa', huecos: [] }, { r: 'cena', huecos: [{ dia: 1, l: 'n' as const }] }, { r: 'borrada', huecos: [] }];
    const ocupado = (f: string, l: string) => f === '2026-12-02' && l === 'd';
    const c = cambiosFijos(fijos, recetas, dias, ocupado, '2026-11-30');
    expect(c.map((x) => x.r.id + '@' + x.f + x.l)).toEqual(['molletes@2026-11-30d', 'sopa@2026-11-30c', 'cena@2026-12-01n']);
    // Hoy es martes: lo del lunes ya pasó
    expect(cambiosFijos(fijos, recetas, dias, () => false, '2026-12-01').map((x) => x.r.id + '@' + x.f)).toEqual(['molletes@2026-12-02', 'sopa@2026-12-01', 'cena@2026-12-01']);
  });

  it('las tarjetas empiezan por los fijos, en el orden que los guardaste', () => {
    const lista = ['avena', 'bowl', 'crepas', 'dip'].map((id) => rec(id));
    expect(mazoDe(lista, [], [], 'todo').map((r) => r.id)).toEqual(['avena', 'bowl', 'crepas', 'dip']);
    expect(mazoDe(lista, [], [], 'todo', {}, false, ['dip', 'bowl']).map((r) => r.id)).toEqual(['dip', 'bowl', 'avena', 'crepas']);
    // Lo que ya elegiste o pasaste no vuelve aunque sea fijo
    expect(mazoDe(lista, ['dip'], [], 'todo', {}, false, ['dip', 'bowl']).map((r) => r.id)).toEqual(['bowl', 'avena', 'crepas']);
  });
});

describe('datos de fijos', () => {
  it('guarda tus fijos y la idea silenciada, y las cuentas salen de lo guardado', async () => {
    await db.menu.bulkPut(molletes);
    expect((await sugerenciasDeFijos(HOY)).map((s) => s.r)).toEqual(['molletes']);
    await silenciarSugerencia('molletes', HOY);
    expect(await sugerenciasDeFijos(HOY)).toEqual([]);
    expect(await leerFijos()).toEqual([]);
    await guardarFijos([await nuevoFijo('molletes', HOY)]);
    expect(await leerFijos()).toEqual([{ r: 'molletes', huecos: [{ dia: 0, l: 'd' }] }]);
    expect(await semanasDeReceta('molletes', HOY)).toEqual({ plan: 3, comido: 0 });
  });
});
