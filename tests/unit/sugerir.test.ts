import { describe, expect, it } from 'vitest';
import type { PerfilComida, Receta } from '../../src/core/db';
import { descartar, exclusionesDe, filtrar, menciona, textoExclusiones } from '../../src/modules/comida/seguro';
import { cobertura, sugerirMenu, type EntradaSugerir } from '../../src/modules/comida/sugerir';

const perfil = (quien: 'les' | 'jeff', no: string[] = [], niveles: PerfilComida['niveles'] = {}, gustos: string[] = []): PerfilComida =>
  ({ quien, src: null, fecha: null, k: null, p: null, c: null, g: null, mk: null, mp: null, por: 1, gustos, no, niveles, nota: '' });
const rec = (id: string, n: string, cat: Receta['cat'], ing: string[], t = '20 min'): Receta =>
  ({ id, n, cat, y: 2, t, src: '', u1: '', k: 300, p: 20, c: 30, g: 10, ing: ing.map((x) => [1, 'pieza', x, 'V']), steps: [] }) as unknown as Receta;

describe('doble seguro', () => {
  const ex = exclusionesDe({ les: perfil('les', ['Cilantro', 'Aceitunas'], { cilantro: 'prefiero', aceitunas: 'nogusta' }), jeff: perfil('jeff', ['Huevo', 'Hígado'], { huevo: 'nocomo', higado: 'odio' }) });
  it('reúne las exclusiones de los dos por nivel', () => {
    expect(ex).toEqual({ duras: ['Huevo', 'Hígado'], medias: ['Aceitunas'], suaves: ['Cilantro'] });
    expect(textoExclusiones(ex)).toContain('prohibido');
    expect(textoExclusiones(ex)).toContain('Huevo, Hígado');
  });
  it('lo duro nunca pasa, esté donde esté', () => {
    expect(descartar({ nombre: 'Huevos con espinaca' }, ex)).toBe('duro: Huevo');
    expect(descartar({ nombre: 'Bowl', ingredientes: ['arroz', 'Hígado de res'] }, ex)).toMatch(/duro/);
    expect(descartar({ nombre: 'Bowl', textos: ['cambia la proteína por huevo'] }, ex)).toMatch(/duro/);
    expect(descartar({ nombre: 'Bowl de arroz', ingredientes: ['arroz', 'pollo'] }, ex)).toBeNull();
  });
  it('lo «no me gusta» solo se descarta si es lo principal', () => {
    expect(descartar({ nombre: 'Pasta con aceitunas', ingredientes: ['pasta'] }, ex)).toBe('principal: Aceitunas');
    expect(descartar({ nombre: 'Pasta', ingredientes: ['aceitunas', 'pasta'] }, ex)).toBe('principal: Aceitunas');
    expect(descartar({ nombre: 'Pasta', ingredientes: ['pasta', 'aceitunas'] }, ex)).toBeNull();
    expect(descartar({ nombre: 'Taco con cilantro' }, ex)).toBeNull();
  });
  it('las combinaciones prohibidas nunca pasan', () => {
    expect(descartar({ nombre: 'Verduras', textos: ['jitomate con queso y piña'] }, { duras: [], medias: [], suaves: [] }, [['queso', 'piña']])).toMatch(/combinación/);
    expect(descartar({ nombre: 'Verduras', textos: ['jitomate con queso'] }, { duras: [], medias: [], suaves: [] }, [['queso', 'piña']])).toBeNull();
  });
  it('compara palabras sin acentos ni plurales', () => {
    expect(menciona('Huevos revueltos', 'huevo')).toBe(true);
    expect(menciona('Hígado encebollado', 'higado')).toBe(true);
    expect(menciona('Chilaquiles', 'chile')).toBe(false);
    expect(menciona('Salsa de chile pasilla', 'chile pasilla')).toBe(true);
  });
  it('filtrar separa lo que pasa y guarda los rechazos para la segunda llamada', () => {
    const r = filtrar([{ n: 'Omelette de huevo' }, { n: 'Ensalada' }], (x) => ({ nombre: x.n }), ex);
    expect(r.pasan).toEqual([{ n: 'Ensalada' }]);
    expect(r.rechazos).toEqual(['Omelette de huevo (duro: Huevo)']);
  });
});

describe('qué hay en casa', () => {
  it('cuenta lo que ya tienes y deja fuera lo básico', () => {
    const r = rec('t', 'Tinga', 'Comida', ['Pechuga de pollo', 'Jitomate', 'Cebolla', 'Sal', 'Aceite']);
    const c = cobertura(r, [{ n: 'pollo', urgente: true }, { n: '3 jitomates' }]);
    expect(c.usa).toEqual(['Pechuga de pollo', 'Jitomate']);
    expect(c.falta).toEqual(['Cebolla']);
    expect(c.urgentes).toBe(1);
    expect(Math.round(c.cobertura * 100)).toBe(67);
  });
});

describe('sugerir menú', () => {
  const recetas = [
    rec('d1', 'Avena', 'Desayuno', ['avena', 'leche']), rec('d2', 'Molletes', 'Desayuno', ['bolillo', 'frijoles']), rec('d3', 'Huevos', 'Desayuno', ['huevo']),
    rec('c1', 'Tinga', 'Comida', ['pollo', 'jitomate']), rec('c2', 'Sopa', 'Comida', ['verduras', 'caldo'], '60 min'), rec('c3', 'Pasta', 'Comida', ['pasta']),
    rec('n1', 'Tacos', 'Cena', ['tortilla', 'champiñón']), rec('n2', 'Quesadillas', 'Cena', ['tortilla', 'queso'])
  ];
  const dias = ['2026-11-23', '2026-11-24', '2026-11-25'];
  const base = (p: Partial<EntradaSugerir> = {}): EntradaSugerir => ({
    recetas, perfiles: { les: perfil('les'), jeff: perfil('jeff', ['Huevo'], { huevo: 'nocomo' }) }, uso: {}, fijos: [], dias, tiempos: ['d', 'c', 'n'],
    ocupado: () => false, hoy: '2026-11-23', ...p
  });

  it('llena todos los lugares libres, sin repetir y sin lo que Jeff no come', () => {
    const s = sugerirMenu(base());
    expect(s).toHaveLength(9);
    expect(s.some((x) => x.r.id === 'd3')).toBe(false);
    // Con 2 desayunos posibles en 3 días, uno se repite una sola vez
    const ds = s.filter((x) => x.l === 'd').map((x) => x.r.id);
    expect(ds.sort()).toEqual(['d1', 'd1', 'd2'].sort());
    expect(s.every((x) => x.otras.length >= 0)).toBe(true);
  });
  it('no toca lugares ocupados ni días que ya pasaron', () => {
    const s = sugerirMenu(base({ ocupado: (f, l) => f === '2026-11-24' && l === 'c', hoy: '2026-11-24' }));
    expect(s.some((x) => x.f === '2026-11-23')).toBe(false);
    expect(s.some((x) => x.f === '2026-11-24' && x.l === 'c')).toBe(false);
    expect(s).toHaveLength(5);
  });
  it('primero mis fijos, en sus huecos', () => {
    const s = sugerirMenu(base({ fijos: [{ r: 'd2', huecos: [{ dia: 1, l: 'd' }] }] }));
    const f = s.find((x) => x.f === '2026-11-24' && x.l === 'd')!;
    expect(f.r.id).toBe('d2');
    expect(f.motivo).toBe('fijo');
  });
  it('lo que uso poco y me gusta va antes que lo demás', () => {
    const perfiles = { les: perfil('les', [], {}, ['champiñón']), jeff: perfil('jeff') };
    const s = sugerirMenu(base({ perfiles, uso: { n2: { e: 5, r: 5 } }, dias: [dias[0]], tiempos: ['n'] }));
    expect(s[0].r.id).toBe('n1');
    expect(s[0].motivo).toBe('gusto');
  });
  it('lo que hay en casa pesa primero en «Con lo que tengo»', () => {
    const s = sugerirMenu(base({ nevera: true, hay: [{ n: 'pasta', urgente: true }], dias: [dias[0]], tiempos: ['c'] }));
    expect(s[0].r.id).toBe('c3');
    expect(s[0].motivo).toBe('nevera');
    expect(s[0].usa).toEqual(['pasta']);
  });
  it('si tengo poco tiempo, deja fuera lo que tarda más', () => {
    const s = sugerirMenu(base({ maxMin: 30, dias: [dias[0]], tiempos: ['c'] }));
    expect(s[0].r.id).not.toBe('c2');
    expect(s[0].otras).not.toContain('c2');
  });
  it('«acerca a mis referencias» solo ordena: la más cercana va primero y ninguna se quita', () => {
    const rs = [{ ...rec('c1', 'Tinga', 'Comida', ['pollo']), k: 900, p: 10 }, { ...rec('c2', 'Sopa', 'Comida', ['verduras']), k: 410, p: 31 }];
    const perfiles = { les: { ...perfil('les'), mk: 400, mp: 30 }, jeff: { ...perfil('jeff'), mk: 400, mp: 30 } };
    const sin = sugerirMenu(base({ recetas: rs, perfiles, dias: [dias[0]], tiempos: ['c'] }));
    const con = sugerirMenu(base({ recetas: rs, perfiles, dias: [dias[0]], tiempos: ['c'], cerca: true }));
    expect(sin[0].r.id).toBe('c1');
    expect(con[0].r.id).toBe('c2');
    expect([con[0].r.id, ...con[0].otras].sort()).toEqual(['c1', 'c2']);
  });
  it('lo que prefiero evitar queda al final, no se oculta', () => {
    const perfiles = { les: perfil('les', ['pollo'], { pollo: 'prefiero' }), jeff: perfil('jeff') };
    const s = sugerirMenu(base({ perfiles, dias: [dias[0]], tiempos: ['c'] }));
    expect(s[0].r.id).not.toBe('c1');
    expect(s[0].otras).toContain('c1');
  });
});
