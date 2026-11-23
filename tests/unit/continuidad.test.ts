import { beforeEach, describe, expect, it } from 'vitest';
import { BaseBienestar, FUERA_DEL_RESPALDO, db, usarBase } from '../../src/core/db';
import { GRUPOS, combinable, grupoPorId } from '../../src/core/grupos';
import { aplicar, decidir, marcarEntrega, propuesta, reemplazarTodo, revisarZip, type Comparacion } from '../../src/core/continuidad';
import { crearZip, leerZip, volverACopia } from '../../src/core/respaldo';
import { fechasDeCambio } from '../../src/core/modificado';

let n = 0;
const nueva = () => new BaseBienestar('continuidad-' + n++);
const esperar = (ms = 8) => new Promise((r) => setTimeout(r, ms));

describe('áreas del paquete', () => {
  it('cada tabla de la base está en una sola área (o fuera del respaldo)', () => {
    const base = nueva();
    const enGrupos = GRUPOS.flatMap((g) => Object.keys(g.tablas));
    expect(new Set(enGrupos).size).toBe(enGrupos.length);
    const tablas = base.tables.map((t) => t.name).filter((t) => !FUERA_DEL_RESPALDO.has(t));
    expect(enGrupos.sort()).toEqual(tablas.sort());
  });
  it('lo que se apunta entre tablas se reemplaza completo, no se combina', () => {
    expect(combinable(grupoPorId('entreno')!)).toBe(false);
    expect(combinable(grupoPorId('hogar')!)).toBe(false);
    expect(combinable(grupoPorId('comida')!)).toBe(true);
    expect(combinable(grupoPorId('cuerpo')!)).toBe(true);
  });
});

describe('qué se propone por área', () => {
  const comida = grupoPorId('comida')!, hogar = grupoPorId('hogar')!;
  const c = (p: Partial<Comparacion>): Comparacion => ({ aqui: 100, archivo: 100, base: 100, hayAqui: true, hayArchivo: true, sinFechas: false, ...p });
  it('si solo cambió el archivo, se reemplaza; si solo cambió lo de aquí, se conserva', () => {
    expect(decidir(comida, c({ archivo: 200 }))).toBe('reemplazar');
    expect(decidir(comida, c({ aqui: 200 }))).toBe('conservar');
    expect(decidir(comida, c({}))).toBe('igual');
    expect(decidir(comida, c({ aqui: 150, archivo: 150, base: 10 }))).toBe('igual');
  });
  it('si cambiaron los dos, se combina; lo que no se puede combinar queda con el lado más reciente', () => {
    expect(decidir(comida, c({ aqui: 200, archivo: 300 }))).toBe('combinar');
    expect(decidir(hogar, c({ aqui: 200, archivo: 300 }))).toBe('reemplazar');
    expect(decidir(hogar, c({ aqui: 300, archivo: 200 }))).toBe('conservar');
  });
  it('nunca borra lo de aquí con un archivo vacío ni deja vacío lo que el archivo trae', () => {
    expect(decidir(comida, c({ hayArchivo: false }))).toBe('conservar');
    expect(decidir(comida, c({ hayAqui: false, archivo: 50 }))).toBe('reemplazar');
    expect(decidir(comida, c({ hayAqui: false, hayArchivo: false }))).toBe('igual');
  });
  it('un respaldo sin fechas trae todo, como antes', () => {
    expect(decidir(comida, c({ sinFechas: true, archivo: null }))).toBe('reemplazar');
    expect(decidir(comida, c({ archivo: null }))).toBe('reemplazar');
  });
  it('sin fechas de aquí cuenta como cambio de aquí', () => {
    expect(decidir(comida, c({ aqui: null, archivo: 200 }))).toBe('combinar');
  });
});

describe('del teléfono a la computadora y de regreso', () => {
  let telefono: BaseBienestar, compu: BaseBienestar;
  beforeEach(() => { telefono = nueva(); compu = nueva(); usarBase(compu); });

  const menu = (fecha: string, n: string) => ({ fecha, lugar: 'c' as const, t: 'dos' as const, n, r: 'tinga' });
  async function paquete(desde: BaseBienestar, ahora = new Date()) { return crearZip(ahora, desde); }

  it('un aparato nuevo recibe todo lo del paquete', async () => {
    await telefono.menu.put(menu('2026-11-24', 'Tinga'));
    await telefono.pesos.add({ fecha: '2026-11-20', valor: 130, unidad: 'lb' });
    await telefono.ajustes.put({ k: 'unidad', v: 'kg' });
    const zip = await paquete(telefono);
    await marcarEntrega(telefono);
    const r = (await revisarZip(zip, compu))!;
    expect(r.revision.filas.find((f) => f.id === 'comida')!.sugerida).toBe('reemplazar');
    expect(r.revision.filas.find((f) => f.id === 'entreno')!.sugerida).toBe('igual');
    await aplicar(r.leido, propuesta(r.revision), compu);
    expect((await compu.menu.toArray()).map((m) => m.n)).toEqual(['Tinga']);
    expect(await compu.pesos.count()).toBe(1);
    expect((await compu.ajustes.get('unidad'))?.v).toBe('kg');
  });

  it('si cambian los dos lados en áreas distintas, cada cambio se queda donde está', async () => {
    await telefono.menu.put(menu('2026-11-24', 'Tinga'));
    await telefono.pesos.add({ fecha: '2026-11-20', valor: 130, unidad: 'lb' });
    const uno = (await revisarZip(await paquete(telefono), compu))!;
    await marcarEntrega(telefono);
    await aplicar(uno.leido, propuesta(uno.revision), compu);

    await esperar();
    await compu.menu.put(menu('2026-11-25', 'Tacos'));        // la compu cambia Comida
    await telefono.pesos.add({ fecha: '2026-11-22', valor: 129, unidad: 'lb' }); // el teléfono cambia Cuerpo
    await esperar();

    // la compu recibe el paquete del teléfono: Cuerpo se reemplaza, Comida se conserva
    const dos = (await revisarZip(await paquete(telefono), compu))!;
    expect(dos.revision.filas.find((f) => f.id === 'cuerpo')!.sugerida).toBe('reemplazar');
    expect(dos.revision.filas.find((f) => f.id === 'comida')!.sugerida).toBe('conservar');
    await aplicar(dos.leido, propuesta(dos.revision), compu);
    expect(await compu.pesos.count()).toBe(2);
    expect((await compu.menu.toArray()).map((m) => m.n).sort()).toEqual(['Tacos', 'Tinga']);
  });

  it('si cambian los dos en la misma área, se combina y lo de cada lado se queda', async () => {
    await telefono.menu.put(menu('2026-11-24', 'Tinga'));
    await telefono.registro.add({ fecha: '2026-11-24', comida: 1, n: 'Arroz', por: '1 taza', k: 200, p: 4, c: 40, g: 1 });
    const uno = (await revisarZip(await paquete(telefono), compu))!;
    await marcarEntrega(telefono);
    await aplicar(uno.leido, propuesta(uno.revision), compu);

    await esperar();
    await compu.menu.put(menu('2026-11-25', 'Tacos'));
    await compu.registro.add({ fecha: '2026-11-25', comida: 0, n: 'Avena', por: '1 taza', k: 150, p: 5, c: 27, g: 3 });
    await esperar();
    await telefono.menu.put(menu('2026-11-26', 'Sopa'));
    await telefono.registro.add({ fecha: '2026-11-26', comida: 1, n: 'Sopa', por: '1 plato', k: 120, p: 4, c: 20, g: 2 });
    await esperar();

    const dos = (await revisarZip(await paquete(telefono), compu))!;
    expect(dos.revision.filas.find((f) => f.id === 'comida')!.sugerida).toBe('combinar');
    const r = await aplicar(dos.leido, propuesta(dos.revision), compu);
    expect(r.combinadas).toContain('comida');
    expect((await compu.menu.toArray()).map((m) => m.n).sort()).toEqual(['Sopa', 'Tacos', 'Tinga']);
    // las filas sueltas no se duplican: Arroz ya estaba
    expect((await compu.registro.toArray()).map((x) => x.n).sort()).toEqual(['Arroz', 'Avena', 'Sopa']);
  });

  it('en una misma clave gana el lado más reciente del área', async () => {
    await telefono.menu.put(menu('2026-11-24', 'Tinga'));
    const uno = (await revisarZip(await paquete(telefono), compu))!;
    await marcarEntrega(telefono);
    await aplicar(uno.leido, propuesta(uno.revision), compu);
    await esperar();
    await compu.menu.put(menu('2026-11-24', 'Pasta'));
    await esperar();
    await telefono.menu.put(menu('2026-11-24', 'Pizza'));
    await esperar();
    const dos = (await revisarZip(await paquete(telefono), compu))!;
    await aplicar(dos.leido, { comida: 'combinar' }, compu);
    expect((await compu.menu.toArray()).map((m) => m.n)).toEqual(['Pizza']);
  });

  it('con «conservar» no se toca nada y con «Deshacer» se vuelve a lo de antes', async () => {
    await telefono.menu.put(menu('2026-11-24', 'Tinga'));
    await compu.menu.put(menu('2026-11-25', 'Tacos'));
    const dos = (await revisarZip(await paquete(telefono), compu))!;
    await aplicar(dos.leido, { comida: 'conservar' }, compu);
    expect((await compu.menu.toArray()).map((m) => m.n)).toEqual(['Tacos']);
    const r = await aplicar(dos.leido, reemplazarTodo(dos.revision), compu);
    expect((await compu.menu.toArray()).map((m) => m.n)).toEqual(['Tinga']);
    expect(await volverACopia(r.copia)).toBe(true);
    expect((await compu.menu.toArray()).map((m) => m.n)).toEqual(['Tacos']);
  });

  it('reemplazar deja el área con la fecha del paquete y no cuenta como cambio de aquí', async () => {
    await telefono.menu.put(menu('2026-11-24', 'Tinga'));
    const zip = await paquete(telefono);
    const fechaTel = leerZip(zip)!.datos.areas!.comida;
    const r = (await revisarZip(zip, compu))!;
    await aplicar(r.leido, propuesta(r.revision), compu);
    expect((await fechasDeCambio(compu)).menu).toBe(fechaTel);
    // si la compu entrega el mismo paquete al teléfono, no hay nada que traer
    const vuelta = (await revisarZip(await paquete(compu), telefono))!;
    expect(vuelta.revision.filas.find((f) => f.id === 'comida')!.sugerida).toBe('igual');
  });

  it('el paquete lleva su versión, cuándo se creó y de dónde salió, y nunca tu clave de IA ni las fechas internas', async () => {
    await telefono.ajustes.put({ k: 'ia.clave', v: 'sk-secreta' });
    await telefono.menu.put(menu('2026-11-24', 'Tinga'));
    const l = leerZip(await paquete(telefono, new Date(2026, 10, 23, 20, 15)))!;
    expect(l.datos.formato).toBe(2);
    expect(l.datos.creado).toBe(new Date(2026, 10, 23, 20, 15).getTime());
    expect(l.datos.origen).toBe('otro');
    expect(Object.keys(l.datos.tablas)).not.toContain('sync');
    expect(JSON.stringify(l.datos)).not.toContain('sk-secreta');
  });

  it('un respaldo de la versión anterior (sin fechas) propone traer todo, como antes', async () => {
    await telefono.menu.put(menu('2026-11-24', 'Tinga'));
    await compu.menu.put(menu('2026-11-25', 'Tacos'));
    const l = leerZip(await paquete(telefono))!;
    delete l.datos.areas; delete l.datos.creado; l.datos.formato = 1;
    const rev = (await revisarZip(new Uint8Array(0), compu)) ?? null;
    expect(rev).toBeNull();
    const { comparar, estadoLocal } = await import('../../src/core/continuidad');
    const r = comparar(l, await estadoLocal(compu));
    expect(r.sinFechas).toBe(true);
    expect(r.filas.find((f) => f.id === 'comida')!.sugerida).toBe('reemplazar');
  });
});

describe('uso de la base global', () => {
  it('el seguimiento anota la fecha de cada tabla que cambia', async () => {
    usarBase(nueva());
    await db.ajustes.put({ k: 'x', v: 1 });
    const f = await fechasDeCambio(db);
    expect(f.ajustes).toBeGreaterThan(0);
    expect(f.menu).toBeUndefined();
  });
});
