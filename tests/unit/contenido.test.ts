import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { strToU8, zipSync } from 'fflate';
import { BaseBienestar, usarBase, db } from '../../src/core/db';
import { cargarContenido, metaContenido, parte, resumen } from '../../src/core/contenido';

let n = 0;
beforeEach(() => { usarBase(new BaseBienestar('contenido-' + n++)); });

const archivo = (partes: object) => zipSync({ 'contenido.json': strToU8(JSON.stringify({ app: 'bienestar', tipo: 'contenido-personal', version: 1, fecha: '2026-10-11', partes })) });

describe('contenido personal', () => {
  it('carga sus partes y dice qué cargó', async () => {
    const r = await cargarContenido(archivo({ programa: { alcance: 'calentamientos y semanas 1-2' }, recetas: { recetas: [1, 2] }, intercambios: {}, marcas: {}, fresh: {}, letras: [] }));
    expect(r).toEqual({ ok: true, resumen: ['Rutina: calentamientos y semanas 1-2', '2 recetas y la guía de intercambios', 'Marcas y plantilla Fresh', 'Letras de tus frases'] });
    expect((await metaContenido())?.version).toBe(1);
  });

  it('cargar otro archivo no toca tus registros', async () => {
    await db.coleccion.add({ tipo: 'frase', texto: 'Mía', origen: 'Mía' });
    await cargarContenido(archivo({ letras: [{ texto: 'a', artista: 'b' }] }));
    await cargarContenido(archivo({ fresh: { x: [] } }));
    expect(await db.coleccion.count()).toBe(1);
    expect(await parte('letras')).toEqual([{ texto: 'a', artista: 'b' }]);
  });

  it('rechaza un respaldo u otro archivo', async () => {
    expect((await cargarContenido(zipSync({ 'datos.json': strToU8('{"app":"bienestar"}') }))).ok).toBe(false);
    expect(await db.contenido.count()).toBe(0);
  });

  it('resumen sin partes', () => { expect(resumen({})).toEqual([]); });

  // El archivo real vive solo en los archivos privados del proyecto, nunca en el repositorio.
  const real = '/mnt/project-files/app-bienestar/contenido-personal/contenido-personal-1.zip';
  it.skipIf(!existsSync(real))('el archivo real tiene las 3 rutinas y 24 ejercicios', async () => {
    const r = await cargarContenido(new Uint8Array(readFileSync(real)));
    expect(r.ok).toBe(true);
    const p = await parte<{ rutinas: Record<string, unknown>; ejercicios: Record<string, unknown> }>('programa');
    expect(Object.keys(p!.rutinas)).toEqual(['A', 'B', 'C']);
    expect(Object.keys(p!.ejercicios)).toHaveLength(24);
  });
});
