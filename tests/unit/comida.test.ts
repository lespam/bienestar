import { beforeEach, describe, expect, it } from 'vitest';
import { BaseBienestar, usarBase, db } from '../../src/core/db';
import { cargarContenido } from '../../src/core/contenido';
import { crearZip, leerZip } from '../../src/core/respaldo';
import { strToU8, zipSync } from 'fflate';
import { aplicarCambio, ajustar, barra, partes, diaBreve, etiquetaDia, fechaDe, recientes, sinRepetir, sumas, alcanzaTxt, avisoConflicto, calBaja, calculadoraLibro, cantidadTxt, fmtQ, leerIngrediente, leerReceta, lineaIng, notaConflictos, pasaFiltros, usoTxt, porTxt, porcionDe } from '../../src/modules/comida/calculos';
import { mazoDe } from '../../src/modules/comida/tarjetas';
import { itemDeMenu, menuDe, ponerEnMenu, ponerVariosEnMenu, quitarDelMenu, reponerMenu, agregarAlimentos, alimentosDe, quitarAlimento, reponerDia, ultimosRegistrados, guardarPerfil, guardarReceta, leerPerfiles, listarRecetas, perfilInicial, quitarReceta, sembrarRecetas } from '../../src/modules/comida/datos';
import { cargarPrefs } from '../../src/modules/ajustes';
import type { ItemMenu, Receta } from '../../src/core/db';
import { cambiosRepetir, fechasDeSemana, platoTxt, puntoDe, rangoSemana, takeoutTxt, takeouts } from '../../src/modules/comida/semana';
import { colacionTxt } from '../../src/modules/comida/colacion';

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
  it('las imágenes del archivo se vuelven la foto de cada receta y completan las que ya tenías', async () => {
    const pack = (recetas: unknown[]) => zipSync({
      'contenido.json': strToU8(JSON.stringify({ app: 'bienestar', tipo: 'contenido-personal', version: 3, fecha: '2026-10-12', partes: { recetas: { recetas } } })),
      'imagenes/a.jpg': new Uint8Array([1, 2, 3]), 'imagenes/b.svg': strToU8('<svg xmlns="http://www.w3.org/2000/svg"/>')
    });
    await cargarContenido(pack([{ id: 'a', n: 'Avena', cat: 'Desayuno', img: 'imagenes/a.jpg', img_tipo: 'foto del libro', origen: 'Libro' }]));
    expect(await sembrarRecetas()).toBe(1);
    const a = (await db.recetas.get('a'))!;
    expect(a.img).toBeInstanceOf(Blob);
    expect(a.img!.type).toBe('image/jpeg');
    expect(a.origen).toBe('Libro');
    // Una receta que ya era tuya sin foto la recibe en la versión nueva, y lo que cambiaste se queda
    await db.recetas.put({ ...receta({ id: 'b', n: 'Mi bowl' }) });
    await db.comida.put({ k: 'recetas-copiadas', v: ['a', 'b'] });
    await cargarContenido(pack([{ id: 'a', n: 'Otro nombre', cat: 'Desayuno', img: 'imagenes/a.jpg', origen: 'Libro' }, { id: 'b', n: 'Bowl', cat: 'Comida', img: 'imagenes/b.svg', img_tipo: 'ilustración', origen: 'Libro 2' }]));
    expect(await sembrarRecetas()).toBe(0);
    const b = (await db.recetas.get('b'))!;
    expect(b.n).toBe('Mi bowl');
    expect(b.img!.type).toBe('image/svg+xml');
    expect(b.origen).toBe('Libro 2');
    expect((await db.recetas.get('a'))!.n).toBe('Avena');
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
    // Pasar la referencia se ve: la barra llega al final y la marca se recorre
    expect(barra(200, 100)).toEqual({ w: 100, marca: 50 });
    // Sin referencia, la barra cambia con lo que comes: es la parte de las calorías de ese macro
    const pt = partes({ p: 25, c: 50, g: 0 });
    expect(barra(25, null, pt.p).w).toBeCloseTo(33.3, 1);
    expect(barra(50, null, pt.c).w).toBeCloseTo(66.7, 1);
    expect(partes({ p: 0, c: 0, g: 0 })).toEqual({ p: 0, c: 0, g: 0 });
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

describe('menú de la semana', () => {
  const hoy = new Date(2026, 9, 1); // jueves
  it('la semana va de lunes a domingo', () => {
    expect(fechasDeSemana(0, hoy)).toEqual(['2026-09-28', '2026-09-29', '2026-09-30', '2026-10-01', '2026-10-02', '2026-10-03', '2026-10-04']);
    expect(fechasDeSemana(1, hoy)[0]).toBe('2026-09-21');
    expect(fechasDeSemana(-1, hoy)[0]).toBe('2026-10-05');
    expect(fechasDeSemana(0, new Date(2026, 9, 4))[0]).toBe('2026-09-28'); // un domingo sigue en su semana
    expect(rangoSemana(fechasDeSemana(0, hoy))).toBe('28 sep – 4 oct');
    expect(rangoSemana(fechasDeSemana(-1, hoy))).toBe('5 – 11 oct');
  });
  it('dice cómo se ve cada lugar', () => {
    const m = (x: Partial<ItemMenu>): ItemMenu => ({ fecha: '2026-10-01', lugar: 'c', t: 'dos', n: 'Tinga', ...x });
    expect(puntoDe(undefined)).toBe('');
    expect(puntoDe(m({}))).toBe('f');
    expect(puntoDe(m({ t: 'cada' }))).toBe('s');
    expect(puntoDe(m({ t: 'takeout' }))).toBe('t');
    expect(puntoDe(m({ t: 'decidir' }))).toBe('p');
    expect(platoTxt(m({ t: 'cada', nl: 'Yogur', nj: 'Huevos' }))).toBe('Yogur / Huevos');
    expect(platoTxt(m({ t: 'decidir', nota: 'algo con pollo' }))).toBe('Por decidir · algo con pollo');
  });
  it('suma los takeouts de la semana', () => {
    const t = takeouts([{ fecha: 'a', lugar: 'n', t: 'takeout', n: 'X', costo: 380 }, { fecha: 'b', lugar: 'c', t: 'takeout', n: 'Y', costo: 120 }, { fecha: 'c', lugar: 'd', t: 'dos', n: 'Z' }]);
    expect(t).toEqual({ n: 2, total: 500 });
    expect(takeoutTxt(t)).toBe('2 veces · $500');
    expect(takeoutTxt(takeouts([]))).toBe('Ninguno');
  });
  it('arma las colaciones por partes', () => {
    expect(colacionTxt({ base: 'Yogur natural', fruta: 'Manzana', extra: '' })).toBe('Yogur natural + manzana');
    expect(colacionTxt({ base: 'Fruta', fruta: 'Plátano', extra: 'Crema de cacahuate' })).toBe('Plátano + crema de cacahuate');
    expect(colacionTxt({ base: 'Fruta', fruta: '', extra: '' })).toBe('Fruta');
  });
  it('repetir la semana pasada: solo de hoy en adelante y sin tocar takeouts', () => {
    const pasada: ItemMenu[] = [
      { fecha: '2026-09-23', lugar: 'c', t: 'dos', n: 'Tinga' }, // miércoles pasado → antes de hoy
      { fecha: '2026-09-24', lugar: 'c', t: 'dos', n: 'Bowl' }, // jueves pasado → hoy
      { fecha: '2026-09-25', lugar: 'n', t: 'dos', n: 'Tacos' }, // viernes
      { fecha: '2026-09-26', lugar: 'n', t: 'takeout', n: 'Sushi' }
    ];
    const actual: ItemMenu[] = [{ fecha: '2026-10-01', lugar: 'c', t: 'dos', n: 'Sopa' }, { fecha: '2026-10-02', lugar: 'n', t: 'takeout', n: 'Pizza' }];
    expect(cambiosRepetir(pasada, actual, '2026-10-01', 'libres').map((x) => x.fecha + x.lugar)).toEqual([]);
    expect(cambiosRepetir(pasada, [], '2026-10-01', 'libres').map((x) => x.fecha + x.lugar)).toEqual(['2026-10-01c', '2026-10-02n']);
    expect(cambiosRepetir(pasada, actual, '2026-10-01', 'todo').map((x) => x.fecha + x.lugar)).toEqual(['2026-10-01c']);
  });
  it('guarda el menú y lo deja como estaba', async () => {
    const a: ItemMenu = { fecha: '2026-10-01', lugar: 'c', t: 'dos', n: 'Tinga', r: 'x' };
    const b: ItemMenu = { fecha: '2026-10-02', lugar: 'n', t: 'takeout', n: 'Tacos', costo: 380, ticket: new Blob([new Uint8Array([1])], { type: 'image/jpeg' }) };
    await ponerEnMenu(a);
    await ponerVariosEnMenu([b]);
    expect((await menuDe(['2026-10-01', '2026-10-02'])).map((x) => x.n).sort()).toEqual(['Tacos', 'Tinga']);
    expect((await itemDeMenu('2026-10-02', 'n'))!.ticket).toBeInstanceOf(Blob);
    const antes = await menuDe(['2026-10-01', '2026-10-02']);
    await quitarDelMenu('2026-10-01', 'c');
    await ponerEnMenu({ ...b, n: 'Otro' });
    await reponerMenu(['2026-10-01', '2026-10-02'], antes);
    expect((await menuDe(['2026-10-01', '2026-10-02'])).map((x) => x.n).sort()).toEqual(['Tacos', 'Tinga']);
    const zip = leerZip(await crearZip(new Date('2026-10-11')))!;
    expect(zip.datos.tablas.menu).toHaveLength(2);
  });
});

describe('filtros de recetas', () => {
  const perf = { les: { no: [] as string[] }, jeff: { no: ['Huevo'] } };
  const f = { origen: 'todo', sinLes: false, sinJeff: true };
  it('quita la receta si lo que no le gusta se nota en el plato', () => {
    expect(pasaFiltros({ id: 'x', n: 'Tacos de huevo' }, f, perf)).toBe(false);
    expect(pasaFiltros({ id: 'x', n: 'Huevos rancheros' }, f, perf)).toBe(false);
  });
  it('deja las que lo llevan escondido o tienen otra versión', () => {
    expect(pasaFiltros({ id: 'x', n: 'Crepas de avena' }, f, perf)).toBe(true);
    expect(pasaFiltros({ id: 'x', n: 'Galletas de avena' }, f, perf)).toBe(true);
    expect(pasaFiltros({ id: 'x', n: 'Tacos de huevo', alt: { w: 'jeff', x: 'huevo', by: 'tofu' } }, f, perf)).toBe(true);
    expect(pasaFiltros({ id: 'x', n: 'Tacos de huevo' }, { ...f, sinJeff: false }, perf)).toBe(true);
  });
  it('filtra por fuente', () => {
    expect(pasaFiltros({ id: 'x', n: 'Sopa', origen: 'Familia' }, { ...f, origen: 'Familia' }, perf)).toBe(true);
    expect(pasaFiltros({ id: 'x', n: 'Sopa', origen: 'Tastemade' }, { ...f, origen: 'Familia' }, perf)).toBe(false);
    expect(pasaFiltros({ id: 'x', n: 'Sopa' }, { ...f, origen: 'Mías' }, perf)).toBe(true);
  });
});

describe('uso de cada receta', () => {
  const perf = { les: { no: [] as string[] }, jeff: { no: [] as string[] } };
  const base = { origen: 'todo', sinLes: false, sinJeff: false };
  it('dice cuántas veces la usaste', () => {
    expect(usoTxt(undefined)).toBe('Aún no la usas');
    expect(usoTxt({ e: 3, r: 1 })).toBe('En el menú 3 veces · Registrada 1 vez');
    expect(usoTxt({ e: 0, r: 2 })).toBe('Registrada 2 veces');
  });
  it('filtra nunca usadas, ya usadas y con foto', () => {
    const uso = { a: { e: 1, r: 0 } };
    expect(pasaFiltros({ id: 'a', n: 'Sopa' }, { ...base, uso: 'nunca' }, perf, uso)).toBe(false);
    expect(pasaFiltros({ id: 'b', n: 'Sopa' }, { ...base, uso: 'nunca' }, perf, uso)).toBe(true);
    expect(pasaFiltros({ id: 'b', n: 'Sopa' }, { ...base, uso: 'usadas' }, perf, uso)).toBe(false);
    expect(pasaFiltros({ id: 'b', n: 'Sopa' }, { ...base, foto: 'con' }, perf, uso)).toBe(false);
    expect(pasaFiltros({ id: 'b', n: 'Sopa', img: new Blob() }, { ...base, foto: 'con' }, perf, uso)).toBe(true);
  });
  it('las tarjetas ponen lo conocido primero y cada cuarta una nueva', () => {
    const r = (id: string) => ({ id, n: id, cat: 'Comida' }) as never;
    const todas = ['a', 'b', 'c', 'd', 'e', 'f', 'g'].map(r);
    const uso = { e: { e: 5, r: 0 }, f: { e: 3, r: 1 }, g: { e: 2, r: 0 }, d: { e: 2, r: 2 } };
    expect(mazoDe(todas, [], [], 'todo', uso).map((x: { id: string }) => x.id)).toEqual(['e', 'd', 'f', 'a', 'g', 'b', 'c']);
    expect(mazoDe(todas, [], [], 'todo').map((x: { id: string }) => x.id)).toEqual(['a', 'b', 'c', 'd', 'e', 'f', 'g']);
  });
});
