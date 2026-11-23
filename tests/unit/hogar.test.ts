import { beforeEach, describe, expect, it } from 'vitest';
import { BaseBienestar, db, usarBase, type TareaHogar } from '../../src/core/db';
import { CATALOGO } from '../../src/modules/hogar/catalogo';
import { guardarDia, leerDia, listarTareas, quitarTarea, hechasDeHoy } from '../../src/modules/hogar/datos';
import { ajuste, buscarTarea, cabe, diasDesde, entendi, entenderTarea, haceCuanto, interpretar, mismaZona, noCaben, ordenar, previsiones, sumarDias, tiempoCercano, vencida } from '../../src/modules/hogar/reglas';

let n = 0;
beforeEach(() => { usarBase(new BaseBienestar('hogar-' + n++)); });

const t = (p: Partial<TareaHogar> & { n: string }): TareaHogar => ({ id: 1, zona: 'Casa', min: 10, e: 1, cada: 7, ...p });
const HOY = '2026-11-23';

describe('capacidad y orden', () => {
  it('cabe completa, en versión mínima o no cabe', () => {
    const aspirar = t({ n: 'Aspirar', min: 15, e: 2, minima: 'Solo la cama', minMin: 5 });
    expect(cabe(aspirar, { energia: 'media', tiempo: 15 })).toBe('completa');
    expect(cabe(aspirar, { energia: 'poca', tiempo: 15 })).toBe('minima');
    expect(cabe(aspirar, { energia: 'buena', tiempo: 5 })).toBe('minima');
    expect(cabe(t({ n: 'X', min: 30, e: 3 }), { energia: 'media', tiempo: 60 })).toBeNull();
    expect(cabe(t({ n: 'Y', min: 30 }), { energia: 'buena', tiempo: 15 })).toBeNull();
  });
  it('lo vencido pesa más y lo que llena bien tu tiempo, también', () => {
    expect(diasDesde({ ult: '2026-11-11' }, HOY)).toBe(12);
    expect(vencida(t({ n: 'a', cada: 7, ult: '2026-11-09' }), HOY)).toBe(2);
    expect(vencida(t({ n: 'a', cada: 7 }), HOY)).toBe(1);
    expect(vencida(t({ n: 'a', cada: 1, ult: '2026-01-01' }), HOY)).toBe(3);
    expect(ajuste(t({ n: 'a', min: 30 }), { energia: 'poca', tiempo: 30 })).toBe(1);
    expect(ajuste(t({ n: 'a', min: 5 }), { energia: 'poca', tiempo: 30 })).toBeLessThan(0.7);
  });
  it('ordena, quita lo apartado y lo hecho hoy, y agrupa por zona', () => {
    const lista = [
      t({ id: 1, n: 'Mostrador', zona: 'Cocina', min: 5, cada: 2, ult: '2026-11-22' }),
      t({ id: 2, n: 'Aspirar', zona: 'Cuarto', min: 15, e: 2, cada: 7, ult: '2026-11-11' }),
      t({ id: 3, n: 'Platos', zona: 'Cocina', min: 10, cada: 1, ult: '2026-11-22' }),
      t({ id: 4, n: 'Plantas', zona: 'Sala', min: 5, cada: 4, ult: HOY }),
      t({ id: 5, n: 'Sábanas', zona: 'Cuarto', min: 30, e: 3, cada: 14 })
    ];
    const cap = { energia: 'media' as const, tiempo: 15 };
    const o = ordenar(lista, cap, HOY, new Set([3]));
    expect(o.map((x) => x.t.n)).toEqual(['Aspirar', 'Mostrador']);
    expect(noCaben(lista, cap, HOY, new Set([3]))).toBe(1);
    // Con una elegida de la cocina, el mostrador sube por compartir zona
    const g = ordenar(lista, cap, HOY, new Set([3]), [lista[2]]);
    expect(g.find((x) => x.t.n === 'Mostrador')!.puntaje).toBeGreaterThan(o.find((x) => x.t.n === 'Mostrador')!.puntaje);
    expect(mismaZona([lista[0], lista[2]])).toContain('Cocina');
    expect(mismaZona([lista[0], lista[1]])).toBe('');
  });
});

describe('palabras neutrales y previsión', () => {
  it('dice el tiempo sin juicio', () => {
    expect(haceCuanto(t({ n: 'a', ult: '2026-11-11', yo: 'aspiras el cuarto' }), HOY)).toBe('Hace 12 días que no aspiras el cuarto.');
    expect(haceCuanto(t({ n: 'a', ult: '2026-11-11' }), HOY)).toBe('Hace 12 días que no lo haces.');
    expect(haceCuanto(t({ n: 'a' }), HOY)).toBe('Aún no anotas la primera vez.');
    expect(haceCuanto(t({ n: 'a', ult: HOY }), HOY)).toBe('La hiciste hoy.');
    expect(haceCuanto(t({ n: 'a', ult: '2026-11-22' }), HOY)).toBe('La hiciste ayer.');
  });
  it('mira un día adelante y propone algo pequeño que quepa', () => {
    const ropa = t({ n: 'Lavar la ropa', cada: 7, ult: '2026-11-17', antes: 'dejar la lavadora lista', antesMin: 3 });
    expect(previsiones([ropa], { energia: 'poca', tiempo: 5 }, HOY)).toEqual(['Mañana toca lavar la ropa; hoy podrías dejar la lavadora lista (3 min).']);
    expect(previsiones([ropa], { energia: 'poca', tiempo: 5 }, '2026-11-22')).toEqual([]);
    expect(previsiones([{ ...ropa, ult: '2026-11-16' }], { energia: 'poca', tiempo: 5 }, HOY)).toEqual([]);
    expect(previsiones([{ ...ropa, antesMin: 10 }], { energia: 'poca', tiempo: 5 }, HOY)).toEqual([]);
  });
  it('suma días en calendario', () => {
    expect(sumarDias('2026-11-30', 1)).toBe('2026-12-01');
    expect(sumarDias('2026-03-01', -1)).toBe('2026-02-28');
  });
});

describe('frases con reglas', () => {
  const lista = CATALOGO.map((c, i) => ({ ...c, id: i + 1 }));
  it('«ya aspiré el cuarto» encuentra la tarea', () => {
    const f = interpretar('ya aspiré el cuarto', lista);
    expect(f).toMatchObject({ tipo: 'hecha' });
    expect(f && f.tipo === 'hecha' && f.candidatas.map((c) => c.n)).toEqual(['Aspirar el cuarto']);
    expect(entendi(f!)).toBe('Marcar «Aspirar el cuarto» como hecha.');
  });
  it('si dos tareas se parecen, pregunta cuál', () => {
    const f = interpretar('ya limpié el baño', lista);
    expect(f && f.tipo === 'hecha' && f.candidatas.map((c) => c.n).sort()).toEqual(['Limpiar el inodoro del baño', 'Limpiar el lavabo del baño']);
    expect(buscarTarea('lavé la ropa', lista).map((c) => c.n)).toEqual(['Lavar la ropa']);
    expect(buscarTarea('xyz', lista)).toEqual([]);
  });
  it('agrega una tarea con su frecuencia y minutos', () => {
    expect(interpretar('agrega regar plantas cada 3 días', [])).toEqual({ tipo: 'agregar', n: 'Regar plantas', cada: 3, min: undefined });
    expect(interpretar('Agregar tarea: Lavar el coche cada semana 30 min', [])).toEqual({ tipo: 'agregar', n: 'Lavar el coche', cada: 7, min: 30 });
    expect(entenderTarea('')).toBeNull();
    expect(entendi({ tipo: 'agregar', n: 'Regar plantas', cada: 3 })).toBe('Agregar la tarea «Regar plantas», cada 3 días.');
  });
  it('entiende tu capacidad sin pasarse de tu tiempo', () => {
    expect(interpretar('tengo 20 min y poca energía', lista)).toEqual({ tipo: 'capacidad', energia: 'poca', tiempo: 15 });
    expect(interpretar('tengo una hora y buena energía', lista)).toEqual({ tipo: 'capacidad', energia: 'buena', tiempo: 60 });
    expect(interpretar('estoy cansada', lista)).toEqual({ tipo: 'capacidad', energia: 'poca', tiempo: undefined });
    expect(tiempoCercano(4)).toBe(5);
    expect(tiempoCercano(45)).toBe(30);
    expect(interpretar('hola qué tal', lista)).toBeNull();
  });
});

describe('datos de Hogar', () => {
  it('siembra el catálogo una vez y lo que quitas no vuelve', async () => {
    const a = await listarTareas();
    expect(a).toHaveLength(CATALOGO.length);
    await quitarTarea(a[0].id!);
    expect(await listarTareas()).toHaveLength(CATALOGO.length - 1);
  });
  it('guarda tu día y cuenta lo hecho; quitar una tarea la saca del día', async () => {
    const [a, b] = await listarTareas();
    await guardarDia({ fecha: HOY, energia: 'poca', tiempo: 15, hoy: [a.id!], hechas: [b.id!], despues: [] });
    expect((await leerDia(HOY)).energia).toBe('poca');
    expect(await hechasDeHoy(HOY)).toBe(1);
    await quitarTarea(b.id!);
    expect((await leerDia(HOY)).hechas).toEqual([]);
    expect((await leerDia('2026-01-01'))).toEqual({ fecha: '2026-01-01', hoy: [], hechas: [], despues: [] });
    expect(await db.hogar.count()).toBe(CATALOGO.length - 1);
  });
  it('nunca guarda más de 3 elegidas', async () => {
    await guardarDia({ fecha: HOY, hoy: [1, 2, 3, 4, 5], hechas: [], despues: [] });
    expect((await leerDia(HOY)).hoy).toEqual([1, 2, 3]);
  });
});
