import { describe, it, expect, beforeEach } from 'vitest';
import { strToU8, zipSync } from 'fflate';
import { BaseBienestar, usarBase, db } from '../../src/core/db';
import { crearZip, leerZip, importarZip, volverACopia, ultimaCopia, nombreRespaldo } from '../../src/core/respaldo';
import { DIA_MS } from '../../src/core/fechas';

let n = 0;
beforeEach(() => { usarBase(new BaseBienestar('prueba-' + n++)); });

describe('respaldo', () => {
  it('exporta e importa los mismos datos, con fotos', async () => {
    await db.ajustes.put({ k: 'unidad', v: 'kg' });
    await db.coleccion.add({ tipo: 'imagen', texto: '', origen: 'Mía', foto: new Blob([new Uint8Array([1, 2, 3])], { type: 'image/jpeg' }) } as never);
    const zip = await crearZip(new Date(2026, 9, 11));
    await db.ajustes.put({ k: 'unidad', v: 'lb' });
    await db.coleccion.clear();
    const r = await importarZip(zip);
    expect(r.ok).toBe(true);
    expect((await db.ajustes.get('unidad'))?.v).toBe('kg');
    const foto = ((await db.coleccion.toArray())[0] as unknown as { foto: Blob }).foto;
    expect(new Uint8Array(await foto.arrayBuffer())).toEqual(new Uint8Array([1, 2, 3]));
  });

  it('nunca guarda tu clave de IA en el respaldo ni la borra al importar', async () => {
    await db.ajustes.put({ k: 'ia.clave', v: 'sk-secreta' });
    const zip = await crearZip();
    expect(JSON.stringify(leerZip(zip)!.datos)).not.toContain('sk-secreta');
    await importarZip(zip);
    expect((await db.ajustes.get('ia.clave'))?.v).toBe('sk-secreta');
  });

  it('un archivo equivocado no cambia nada', async () => {
    await db.ajustes.put({ k: 'unidad', v: 'kg' });
    const otro = zipSync({ 'notas.txt': strToU8('hola') });
    expect((await importarZip(otro)).ok).toBe(false);
    expect((await importarZip(new Uint8Array([1, 2, 3]))).ok).toBe(false);
    expect((await db.ajustes.get('unidad'))?.v).toBe('kg');
    expect(await db.copias.count()).toBe(0);
  });

  it('Deshacer vuelve a los datos de antes de importar', async () => {
    await db.ajustes.put({ k: 'unidad', v: 'lb' });
    const viejo = await crearZip();
    await db.ajustes.put({ k: 'unidad', v: 'kg' });
    const r = await importarZip(viejo);
    expect((await db.ajustes.get('unidad'))?.v).toBe('lb');
    if (r.ok) await volverACopia(r.copia);
    expect((await db.ajustes.get('unidad'))?.v).toBe('kg');
  });

  it('la copia interna dura 7 días', async () => {
    const t = Date.now();
    await importarZip(await crearZip());
    expect(await ultimaCopia(t + 6 * DIA_MS)).toBeTruthy();
    expect(await ultimaCopia(t + 8 * DIA_MS)).toBeUndefined();
  });

  it('el nombre lleva la fecha', () => {
    expect(nombreRespaldo(new Date(2026, 9, 1))).toBe('bienestar-2026-10-01.zip');
  });
});
