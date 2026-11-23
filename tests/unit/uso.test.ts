import { beforeEach, describe, expect, it } from 'vitest';
import { BaseBienestar, db, usarBase } from '../../src/core/db';
import { activarUso, borrarUso, cargarUso, contarFuncion, contarPantalla, contarSugerencia, exportarUso, leerUso, lunesDeUso, restaurarUso, usoActivo } from '../../src/core/uso';
import { resumirUso } from '../../src/modules/ajustes/resumenUso';

let n = 0;
beforeEach(async () => { usarBase(new BaseBienestar('uso-' + n++)); await cargarUso(); });

describe('Medir mi uso', () => {
  it('viene apagado y apagado no cuenta nada', async () => {
    expect(usoActivo()).toBe(false);
    contarPantalla('comida');
    contarFuncion('peso');
    contarSugerencia('fijo', true);
    expect(leerUso().semanas).toEqual({});
  });

  it('encendido cuenta por semana: pantallas, funciones y sugerencias', async () => {
    await activarUso(true);
    contarPantalla('comida'); contarPantalla('comida'); contarPantalla('hogar');
    contarFuncion('planear-menu');
    contarSugerencia('fijo', true); contarSugerencia('fijo', false); contarSugerencia('fijo', false);
    const lunes = lunesDeUso();
    expect(leerUso().semanas[lunes]).toEqual({ p: { comida: 2, hogar: 1 }, f: { 'planear-menu': 1 }, s: { fijo: { si: 1, no: 2 } } });
    expect(leerUso().desde).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('se guarda en la base y vuelve al abrir; borrar y deshacer', async () => {
    await activarUso(true);
    contarPantalla('rutina');
    await activarUso(true); // guarda lo pendiente
    await cargarUso();
    expect(leerUso().semanas[lunesDeUso()].p).toEqual({ rutina: 1 });
    const antes = leerUso();
    await borrarUso();
    expect(leerUso().semanas).toEqual({});
    expect(usoActivo()).toBe(true);
    await restaurarUso(antes);
    expect(leerUso().semanas[lunesDeUso()].p).toEqual({ rutina: 1 });
    expect(((await db.ajustes.get('uso'))!.v as { semanas: object }).semanas).toBeTruthy();
  });

  it('la semana empieza el lunes', () => {
    expect(lunesDeUso(new Date(2026, 10, 25))).toBe('2026-11-23');
    expect(lunesDeUso(new Date(2026, 10, 29))).toBe('2026-11-23');
    expect(lunesDeUso(new Date(2026, 10, 30))).toBe('2026-11-30');
  });

  it('el archivo de exportación solo tiene números y nombres de pantalla, nada escrito', async () => {
    await activarUso(true);
    contarPantalla('comida');
    const j = JSON.parse(exportarUso('2026-11-23'));
    expect(j).toMatchObject({ app: 'bienestar', tipo: 'contadores-de-uso', version: 1, fecha: '2026-11-23' });
    expect(Object.keys(j.semanas)).toHaveLength(1);
  });
});

describe('Cómo uso la app', () => {
  const hoy = new Date(2026, 10, 25);
  const sem = (p: Record<string, number>, f: Record<string, number> = {}) => ({ p, f, s: {} });

  it('lo más usado, lo que no abres y la racha sin castigo', () => {
    const d = {
      activo: true, desde: '2026-10-01',
      semanas: {
        '2026-11-23': sem({ comida: 4, rutina: 2, inicio: 9 }, { 'planear-menu': 3 }),
        '2026-11-16': sem({ comida: 1 }, { 'planear-menu': 1 }),
        '2026-11-09': sem({ rutina: 5 }),
        '2026-10-26': sem({ hogar: 7 })
      }
    };
    const r = resumirUso(d, hoy);
    expect(r.esta.pantallas).toEqual([['Comida', 4], ['Rutina', 2]]);
    expect(r.esta.funciones).toEqual([['Planear comidas', 3]]);
    expect(r.masUsado).toEqual([['Rutina', 7], ['Comida', 5]]);
    expect(r.sinAbrir).toContain('Mente');
    expect(r.sinAbrir).not.toContain('Comida');
    expect(r.racha).toBe(3);
    expect(r.semanasPlaneadas).toBe(2);
  });

  it('si esta semana aún no hay nada, la racha no se pierde', () => {
    const d = { activo: true, desde: '2026-11-01', semanas: { '2026-11-16': sem({ comida: 1 }), '2026-11-09': sem({ comida: 1 }) } };
    expect(resumirUso(d, hoy).racha).toBe(2);
    expect(resumirUso({ activo: true, desde: null, semanas: {} }, hoy).racha).toBe(0);
  });

  it('las sugerencias aceptadas y rechazadas se suman', () => {
    const d = { activo: true, desde: null, semanas: { '2026-11-23': { p: {}, f: {}, s: { fijo: { si: 1, no: 1 } } }, '2026-11-16': { p: {}, f: {}, s: { fijo: { si: 2, no: 0 }, raro: { si: 1, no: 0 } } } } };
    expect(resumirUso(d, hoy).sugerencias).toEqual([{ nombre: 'Mis fijos', si: 3, no: 1 }]);
  });
});
