import { beforeEach, describe, expect, it } from 'vitest';
import { BaseBienestar, usarBase, db } from '../../src/core/db';
import { crearZip, leerZip } from '../../src/core/respaldo';
import { CRONO_NUEVO, duracionLibre, estadoCrono, estadoTemp, formatoCrono, formatoTemp, lanzar, msCrono, quedanTemp, tempNuevo } from '../../src/modules/herramientas/calculos';
import { guardarCrono, guardarLargoDescanso, guardarTemp, leerCrono, leerLargoDescanso, leerTemp } from '../../src/modules/herramientas/datos';

let n = 0;
beforeEach(() => { usarBase(new BaseBienestar('herr-' + n++)); });

describe('cronómetro', () => {
  it('cuenta con la hora real aunque la app esté cerrada', () => {
    const e = { inicio: 1000, acum: 5000, vueltas: [] };
    expect(msCrono(e, 4500)).toBe(8500);
    expect(msCrono({ ...e, inicio: null }, 99999)).toBe(5000);
    expect(estadoCrono(CRONO_NUEVO, 0)).toBe('listo');
    expect(estadoCrono(e, 2000)).toBe('corriendo');
    expect(estadoCrono({ inicio: null, acum: 10, vueltas: [] }, 0)).toBe('en pausa');
  });
  it('da formato m:ss.d', () => {
    expect(formatoCrono(0)).toBe('0:00.0');
    expect(formatoCrono(61_250)).toBe('1:01.2');
    expect(formatoCrono(599_999)).toBe('9:59.9');
  });
});

describe('temporizador', () => {
  it('calcula lo que falta con la hora de fin y marca terminado', () => {
    const e = { ...tempNuevo('180'), fin: 10_000 };
    expect(quedanTemp(e, 7_001)).toBe(3);
    expect(estadoTemp(e, 7_001)).toBe('corriendo');
    expect(estadoTemp(e, 10_000)).toBe('terminado');
    expect(estadoTemp(tempNuevo(), 0)).toBe('listo');
    expect(quedanTemp({ ...tempNuevo(), quedan: 42 }, 99)).toBe(42);
  });
  it('la duración libre queda entre 1 segundo y 99:59', () => {
    expect(duracionLibre(0, 0)).toBe(1);
    expect(duracionLibre(10, 0)).toBe(600);
    expect(duracionLibre(200, 99)).toBe(99 * 60 + 59);
    expect(duracionLibre(NaN, 5)).toBe(5);
    expect(formatoTemp(75)).toBe('1:15');
  });
  it('la moneda cae en cara o cruz', () => {
    expect(lanzar(0.1)).toBe('cara');
    expect(lanzar(0.9)).toBe('cruz');
  });
});

describe('lo que se guarda', () => {
  it('lo que está corriendo sigue igual al volver, y los datos raros se ignoran', async () => {
    expect(await leerCrono()).toEqual(CRONO_NUEVO);
    await guardarCrono({ inicio: 123, acum: 4, vueltas: [9, 8] });
    expect(await leerCrono()).toEqual({ inicio: 123, acum: 4, vueltas: [9, 8] });
    const t = { ...tempNuevo('libre', 2, 30), fin: 5000 };
    await guardarTemp(t);
    expect(await leerTemp()).toEqual(t);
    await db.herramientas.put({ k: 'en-marcha:temporizador', v: { modo: 'raro' } });
    expect(await leerTemp()).toEqual(tempNuevo());
  });
  it('recuerda tu descanso preferido y solo acepta las duraciones del Descanso', async () => {
    expect(await leerLargoDescanso()).toBe(60);
    await guardarLargoDescanso(300);
    expect(await leerLargoDescanso()).toBe(300);
    await guardarLargoDescanso(77);
    expect(await leerLargoDescanso()).toBe(300);
  });
  it('un cronómetro corriendo no sale en el respaldo, pero tu descanso preferido sí', async () => {
    await guardarCrono({ inicio: 1, acum: 0, vueltas: [] });
    await guardarLargoDescanso(120);
    const l = leerZip(await crearZip());
    const claves = (l!.datos.tablas.herramientas ?? []).map((f) => f.k);
    expect(claves).toEqual(['descanso:largo']);
  });
});
