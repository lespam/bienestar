import { describe, expect, it, beforeEach } from 'vitest';
import { BaseBienestar, usarBase, db } from '../../src/core/db';
import { agregarItem, devolverItem, guardarAreas, guardarSemana, leerAreas, leerSemana, leerSemanas, listarColeccion, otraFrase, planDeHoy, quitarItem, urlSegura } from '../../src/modules/mente/datos';
import { copiarAreas, diaDePlan, diaCompleto, estaVacia, lunesDe, lunesDeSemana, nombreSemana, normalizar, rangoCorto, semanaVacia } from '../../src/modules/mente/semanas';
import { mensajeDelDia } from '../../src/modules/mente/mensaje';
import { cargarPrefs } from '../../src/modules/ajustes';

let n = 0;
beforeEach(async () => { usarBase(new BaseBienestar('mente-' + n++)); await cargarPrefs(); });

describe('semanas del planeador', () => {
  // 11 de octubre de 2026 es domingo
  it('el lunes y los días de plan salen de la fecha', () => {
    expect(lunesDe(new Date(2026, 9, 11))).toBe('2026-10-05');
    expect(lunesDe(new Date(2026, 9, 5))).toBe('2026-10-05');
    expect(lunesDeSemana(1, new Date(2026, 9, 11))).toBe('2026-10-12');
    expect(lunesDeSemana(-3, new Date(2026, 9, 11))).toBe('2026-09-14');
    expect(diaDePlan(new Date(2026, 9, 7))).toBe(2);
    expect(diaDePlan(new Date(2026, 9, 10))).toBe(-1);
    expect(diaDePlan(new Date(2026, 9, 11))).toBe(-1);
  });
  it('los nombres no juzgan y el rango cruza meses', () => {
    expect(rangoCorto('2026-09-28')).toBe('28 sep – 2 oct');
    expect(rangoCorto('2026-10-05')).toBe('5 – 9 oct');
    expect(nombreSemana(0)).toBe('Esta semana');
    expect(nombreSemana(-2)).toBe('Hace 2 semanas');
    expect(diaCompleto('2026-09-28', 0)).toBe('Lunes 28 sep');
  });
  it('una semana vacía, copiar áreas y normalizar', () => {
    const areas = [{ id: 1, nombre: 'A', corto: 'a', color: 0 }, { id: 2, nombre: 'B', corto: 'b', color: 1 }];
    const v = semanaVacia('2026-10-05');
    expect(estaVacia(v, areas)).toBe(true);
    const o = { ...v, areas: { 1: 'Algo', 2: '  ' } };
    expect(estaVacia(o, areas)).toBe(false);
    const c = copiarAreas(o, semanaVacia('2026-10-12'), areas);
    expect(c?.areas).toEqual({ 1: 'Algo' });
    expect(copiarAreas(v, semanaVacia('x'), areas)).toBeNull();
    expect(normalizar({ lunes: 'x', dias: ['a'], areas: {} }, 'y').dias).toEqual(['a', '', '', '', '']);
  });
});

describe('datos de Alma', () => {
  it('las áreas de tu papel se crean una vez; editarlas no borra lo escrito', async () => {
    const a = await leerAreas();
    expect(a.map((x) => x.corto)).toEqual(['Fundación', 'Profesional', 'Movimiento', 'Reflexión']);
    expect((await leerAreas()).length).toBe(4);
    await guardarSemana({ lunes: '2026-10-05', dias: ['uno', '', '', '', ''], areas: { [a[3].id!]: 'Nota vieja' } });
    await guardarAreas([{ ...a[0], nombre: 'Mi fundación' }, a[1], a[2]]); // se quita la cuarta
    const b = await leerAreas();
    expect(b).toHaveLength(3);
    expect(b[0].nombre).toBe('Mi fundación');
    expect((await leerSemana('2026-10-05')).areas[a[3].id!]).toBe('Nota vieja');
    await guardarAreas([...b, { nombre: 'Dibujo', corto: 'Dib', color: 4 }]);
    expect((await leerAreas()).map((x) => x.nombre)).toContain('Dibujo');
  });
  it('lee varias semanas, con las vacías completas, y el día de hoy para Inicio', async () => {
    await guardarSemana({ lunes: '2026-10-05', dias: ['', '', 'Pedir consejo', '', ''], areas: {} });
    const [x, y] = await leerSemanas(['2026-10-05', '2026-09-28']);
    expect(x.dias[2]).toBe('Pedir consejo');
    expect(y.dias).toEqual(['', '', '', '', '']);
    expect(await planDeHoy('2026-10-05', 2)).toBe('Pedir consejo');
    expect(await planDeHoy('2026-10-05', -1)).toBe('');
  });
});

describe('Colección', () => {
  it('solo acepta links web', () => {
    expect(urlSegura('')).toBe('');
    expect(urlSegura('youtube.com/watch?v=1')).toBe('https://youtube.com/watch?v=1');
    expect(urlSegura('javascript:alert(1)')).toBeNull();
    expect(urlSegura('no es un link')).toBeNull();
  });
  it('agregar, quitar y deshacer; lo de fábrica que quitas no vuelve', async () => {
    const todas = await listarColeccion();
    expect(todas.length).toBeGreaterThan(10);
    const fab = todas.find((x) => x.semilla)!;
    await quitarItem(fab);
    expect((await listarColeccion()).some((x) => x.semilla === fab.semilla)).toBe(false);
    await devolverItem(fab);
    expect((await listarColeccion()).filter((x) => x.semilla === fab.semilla)).toHaveLength(1);
    await quitarItem(fab);
    await agregarItem({ tipo: 'video', texto: 'Mi video', origen: '', url: 'https://youtu.be/x' });
    expect((await listarColeccion())[0].texto).toBe('Mi video');
  });
  it('otra frase cambia el mensaje de hoy y queda guardado', async () => {
    const hoy = new Date(2026, 9, 11);
    const a = await mensajeDelDia(hoy);
    const b = await otraFrase(a!.id, hoy);
    expect(b!.id).not.toBe(a!.id);
    expect(b!.tipo).toBe('frase');
    expect((await mensajeDelDia(hoy))!.id).toBe(b!.id);
    expect(await db.mensajes.count()).toBe(1);
  });
});
