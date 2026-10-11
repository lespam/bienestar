import { beforeEach, describe, expect, it } from 'vitest';
import { BaseBienestar, usarBase, db } from '../../src/core/db';
import { cargarContenido } from '../../src/core/contenido';
import { crearZip, leerZip } from '../../src/core/respaldo';
import { strToU8, zipSync } from 'fflate';
import { aplicarCambio, ajustar, barra, diaBreve, etiquetaDia, fechaDe, recientes, sinRepetir, sumas, alcanzaTxt, avisoConflicto, calBaja, calculadoraLibro, cantidadTxt, fmtQ, leerIngrediente, leerReceta, lineaIng, notaConflictos, porTxt, porcionDe } from '../../src/modules/comida/calculos';
import { agregarAlimentos, alimentosDe, quitarAlimento, reponerDia, ultimosRegistrados, guardarPerfil, guardarReceta, leerPerfiles, listarRecetas, perfilInicial, quitarReceta, sembrarRecetas } from '../../src/modules/comida/datos';
import { cargarPrefs } from '../../src/modules/ajustes';
import type { Receta } from '../../src/core/db';

let n = 0;
beforeEach(async () => { usarBase(new BaseBienestar('comida-' + n++)); await cargarPrefs(); });

const receta = (extra: Partial<Receta> = {}): Receta => ({ id: 'x', n: 'Tinga', cat: 'Comida', y: 4, t: '', src: '', u1: '', k: 300, p: 20, c: 10, g: 10, ing: [[500, 'g', 'Pechuga de pollo'], [2, 'cda', 'Aceite']], steps: [], ...extra });

describe('cantidades y porciones', () => {
  it('escribe cuartos como fracciones y la unidad en plural', () => {
    expect(fmtQ(1.5)).toBe('1½');
    expect(fmtQ(0.25)).toBe('¼');
    expect(porTxt(1)).toBe('1 porción');
    expect(porTxt(1.5)).toBe('1½ porciones');
    expect(cantidadTxt([2, 'cda', 'Aceite'], 1)).toBe('2 cdas');
    expect(cantidadTxt([500, 'g', 'Pollo'], 1.5)).toBe('750 g');
    expect(cantidadTxt([null, '', 'Sal'], 1)).toBe('');
    expect(lineaIng([500, 'g', 'Pechuga de pollo'])).toBe('500 g de pechuga de pollo');
  });
  it('dice cuántas comidas de los dos salen', () => {
    expect(alcanzaTxt(4, 1, 1)).toBe('Alcanza para 2 comidas de los dos.');
    expect(alcanzaTxt(5, 1, 1.5)).toBe('Alcanza para 2 comidas de los dos.');
    expect(alcanzaTxt(1, 1, 1)).toBe('Para una comida de los dos se necesitan 2 porciones.');
    expect(alcanzaTxt(3, 1, 1)).toContain('sobra 1 porción');
  });
  it('la porción de la receta gana a la del perfil', () => {
    const p = { les: { por: 1 }, jeff: { por: 1.5 } };
    expect(porcionDe({}, 'jeff', p)).toBe(1.5);
    expect(porcionDe({ por: { jeff: 2 } }, 'jeff', p)).toBe(2);
    expect(porcionDe({ por: { jeff: 2 } }, 'les', p)).toBe(1);
  });
});

describe('leer una receta pegada', () => {
  it('separa ingredientes con cantidad, unidad y fracciones', () => {
    expect(leerIngrediente('- 400 g de pechuga de pollo cocida')).toEqual([400, 'g', 'Pechuga de pollo cocida']);
    expect(leerIngrediente('½ cebolla')).toEqual([0.5, '', 'Cebolla']);
    expect(leerIngrediente('2 tazas de frijoles')).toEqual([2, 'taza', 'Frijoles']);
    expect(leerIngrediente('1/2 taza de leche')).toEqual([0.5, 'taza', 'Leche']);
    expect(leerIngrediente('1 kg de arroz')).toEqual([1000, 'g', 'Arroz']);
    expect(leerIngrediente('Sal al gusto')).toEqual([null, '', 'Sal al gusto']);
    expect(leerIngrediente('  ')).toBeNull();
  });
  it('lee nombre, porciones, tiempo, pasos y números', () => {
    const r = leerReceta('# Enfrijoladas\nRinde: 4 porciones · 35 min\n\nIngredientes:\n- 2 tazas de frijoles\n\nPreparación:\n1. Licúa.\n2. Sirve.\n\nPor porción: 500 kcal · proteína 45 g · carbohidratos 50 g · grasa 12 g');
    expect(r).toMatchObject({ n: 'Enfrijoladas', y: 4, t: '35 min', k: 500, p: 45, c: 50, g: 12, steps: ['Licúa.', 'Sirve.'] });
    expect(r.ing).toEqual([[2, 'taza', 'Frijoles']]);
  });
});

describe('lo que alguien no come', () => {
  const perfiles = { les: { no: [] as string[] }, jeff: { no: ['Champiñón'] } };
  const tacos = { ing: [[400, 'g', 'Champiñones'] as [number, string, string]], alt: undefined as Receta['alt'] };
  it('avisa sin imponer', () => {
    expect(notaConflictos(tacos, perfiles)).toBe('Jeff no come champiñón. Cambia ese ingrediente en su porción.');
    expect(avisoConflicto(tacos, perfiles)).toBe('Jeff no come champiñón');
    expect(avisoConflicto({ ...tacos, alt: { w: 'jeff', x: 'Champiñón', by: 'pollo' } }, perfiles)).toBe('La versión de Jeff va con pollo');
    expect(avisoConflicto({ ing: [[1, '', 'Pollo']] }, perfiles)).toBe('');
  });
});

describe('calculadora del libro', () => {
  it('propone un punto de partida y no guarda cifras bajas', () => {
    const r = calculadoraLibro(155, 'lb', 12, 0.4);
    expect(r).toMatchObject({ ok: true, k11: 1705, k12: 1860, k: 1860, p: 155, g: 62 });
    if (r.ok) expect(r.c).toBe(Math.round((1860 - 155 * 4 - 62 * 9) / 4));
    expect(calculadoraLibro(0, 'lb', 12, 0.4).ok).toBe(false);
    expect(calculadoraLibro(60, 'lb', 12, 0.4).ok).toBe(false);
    expect(calculadoraLibro(100, 'lb', 11, 0.4)).toMatchObject({ ok: false });
    expect(calculadoraLibro(70, 'kg', 12, 0.4).ok).toBe(true);
  });
  it('detecta calorías menores a 1,200', () => {
    expect(calBaja(1100, null)).toBe(true);
    expect(calBaja(1200, 1500)).toBe(false);
    expect(calBaja(null, null)).toBe(false);
  });
});

describe('ajustar a una referencia', () => {
  const r = receta({ sw: [{ dir: 'k-', t: 'Usa 1 cda de aceite en vez de 2', d: { k: -30, g: -3.5 }, set: ['Aceite', 1] }, { dir: 'p+', t: 'Más pollo', d: { p: 8 }, set: ['Pechuga de pollo', 650] }] });
  it('dice que ya está cerca', () => {
    expect(ajustar(r, 'k', 310, 1)?.cerca).toBe(true);
  });
  it('propone otro tamaño y los cambios que van hacia la referencia', () => {
    const a = ajustar(r, 'k', 450, 1)!;
    expect(a.cerca).toBe(false);
    expect(a.porcion).toBe(1.5);
    expect(a.cambios).toEqual([]);
    const b = ajustar(r, 'k', 150, 1)!;
    expect(b.porcion).toBe(0.5);
    expect(b.cambios.map((c) => c.i)).toEqual([0]);
  });
  it('sin dato o sin referencia no propone nada', () => {
    expect(ajustar({ ...r, k: null }, 'k', 400, 1)).toBeNull();
    expect(ajustar(r, 'k', 0, 1)).toBeNull();
  });
  it('aplicar un cambio guarda el original y marca el cambio', () => {
    const x = aplicarCambio(r, 0);
    expect(x.ing[1][0]).toBe(1);
    expect(x.k).toBe(270);
    expect(x.g).toBe(6.5);
    expect(x.sw![0].hecho).toBe(true);
    expect(JSON.parse(x.orig!).k).toBe(300);
    expect(r.ing[1][0]).toBe(2);
    expect(aplicarCambio(x, 1).orig).toBe(x.orig);
  });
});

describe('perfiles y recetas guardados', () => {
  it('un perfil nuevo no trae referencias inventadas', async () => {
    const p = await leerPerfiles();
    expect(p.les).toEqual(perfilInicial('les'));
    expect(p.les.k).toBeNull();
    await guardarPerfil({ ...p.jeff, por: 1.5, no: ['Berenjena'], k: [2400, 2600], src: 'nos', fecha: '2026-09-20' });
    const q = await leerPerfiles();
    expect(q.jeff).toMatchObject({ por: 1.5, no: ['Berenjena'], k: [2400, 2600] });
    expect(q.les.por).toBe(1);
  });
  it('las recetas del archivo se copian una vez y quitar una no la trae de vuelta', async () => {
    const pack = (recetas: unknown[]) => zipSync({ 'contenido.json': strToU8(JSON.stringify({ app: 'bienestar', tipo: 'contenido-personal', version: 1, fecha: '2026-10-11', partes: { recetas: { recetas } } })) });
    await cargarContenido(pack([{ id: 'a', n: 'Avena', cat: 'Desayuno', y: 1, k: 300, ing: [], steps: [] }, { id: 'b', n: 'Bowl', cat: 'Comida' }]));
    expect(await sembrarRecetas()).toBe(2);
    expect(await sembrarRecetas()).toBe(0);
    expect((await listarRecetas()).map((r) => r.id).sort()).toEqual(['a', 'b']);
    await quitarReceta('a');
    const mia = (await db.recetas.get('b'))!;
    await guardarReceta({ ...mia, n: 'Bowl mío' });
    await cargarContenido(pack([{ id: 'a', n: 'Avena', cat: 'Desayuno' }, { id: 'b', n: 'Bowl', cat: 'Comida' }, { id: 'c', n: 'Sopa', cat: 'Comida' }]));
    expect(await sembrarRecetas()).toBe(1);
    const ids = (await listarRecetas()).map((r) => r.id).sort();
    expect(ids).toEqual(['b', 'c']);
    expect((await db.recetas.get('b'))!.n).toBe('Bowl mío');
    expect((await db.recetas.get('b'))!.y).toBe(1);
  });
  it('recetas y perfiles salen en el respaldo con su foto', async () => {
    await guardarReceta(receta({ img: new Blob([new Uint8Array([1, 2, 3])], { type: 'image/jpeg' }) }));
    await guardarPerfil({ ...perfilInicial('les'), gustos: ['Tacos'] });
    const zip = await crearZip(new Date('2026-10-11'));
    const l = leerZip(zip)!;
    expect(l.datos.tablas.recetas).toHaveLength(1);
    expect(l.datos.tablas.perfiles).toHaveLength(1);
    expect(Object.keys(l.archivos).some((k) => k.startsWith('fotos/'))).toBe(true);
  });
});

describe('registro del día', () => {
  const hoy = new Date(2026, 9, 1);
  it('pone la fecha y el nombre del día', () => {
    expect(fechaDe(0, hoy)).toBe('2026-10-01');
    expect(fechaDe(-1, hoy)).toBe('2026-09-30');
    expect(fechaDe(-30, hoy)).toBe('2026-09-01');
    expect(etiquetaDia(0, hoy)).toBe('Hoy · Jueves 1 oct');
    expect(etiquetaDia(-1, hoy)).toBe('Ayer · Miércoles 30 sep');
    expect(etiquetaDia(-5, hoy)).toBe('Sábado 26 sep');
    expect(diaBreve(-2, hoy)).toBe('Mar 29 sep');
  });
  it('suma lo registrado y no cuenta lo que no tiene número', () => {
    expect(sumas([{ k: 100, p: 1.5, c: 2, g: 3 }, { k: null, p: 2, c: 0, g: 0.5 }])).toEqual({ k: 100, p: 3.5, c: 2, g: 3.5 });
  });
  it('copiar no repite lo que ya está igual', () => {
    const a = { n: 'Avena', por: '1 taza', k: 100, p: 1, c: 1, g: 1 };
    expect(sinRepetir([a], [a, { ...a, por: '2 tazas' }])).toEqual([{ ...a, por: '2 tazas' }]);
  });
  it('recientes: lo más nuevo primero, sin repetir', () => {
    const f = (n: string) => ({ n, por: '1', k: 1, p: 0, c: 0, g: 0 });
    expect(recientes([f('a'), f('b'), f('a'), f('c')], 2).map((x) => x.n)).toEqual(['a', 'b']);
  });
  it('las barras usan la referencia si existe', () => {
    expect(barra(70, 100)).toEqual({ w: 50, marca: (100 / 140) * 100 });
    expect(barra(70, null).marca).toBeNull();
  });
  it('guarda alimentos por día y deja un día como estaba', async () => {
    const base = { comida: 1 as const, por: '1', k: 100, p: 1, c: 1, g: 1 };
    await agregarAlimentos([{ ...base, fecha: '2026-10-01', n: 'A' }, { ...base, fecha: '2026-10-02', n: 'B' }]);
    const antes = await alimentosDe('2026-10-01');
    expect(antes.map((x) => x.n)).toEqual(['A']);
    await quitarAlimento(antes[0].id!);
    expect(await alimentosDe('2026-10-01')).toEqual([]);
    await reponerDia('2026-10-01', antes);
    expect((await alimentosDe('2026-10-01')).map((x) => x.n)).toEqual(['A']);
    expect((await alimentosDe('2026-10-02')).map((x) => x.n)).toEqual(['B']);
    expect((await ultimosRegistrados()).map((x) => x.n)).toEqual(['B', 'A']);
  });
});
