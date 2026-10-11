import { describe, expect, it, beforeEach } from 'vitest';
import Dexie from 'dexie';
import { BaseBienestar, usarBase, db } from '../../src/core/db';
import { copiaAntesDeActualizar, ultimaCopia, volverACopia } from '../../src/core/respaldo';
import { borrarSerie, calentadosDe, guardarSerie, iniciarSesion, marcarVarios, reabrirSesion, registrarDescanso, segundosDeDescanso, sesionAbierta, sesionesConSeries, terminarSesion } from '../../src/modules/entreno/datos';
import { cargarPrefs } from '../../src/modules/ajustes';

let n = 0;
beforeEach(async () => { usarBase(new BaseBienestar('entreno-' + n++)); await cargarPrefs(); });

describe('sesiones y series', () => {
  it('una sesión queda abierta hasta que la termines y las series se guardan al marcarlas', async () => {
    const s = await iniciarSesion('A', 'mixto', 'gym', new Date(2026, 9, 5, 18, 0));
    expect(s.abierta).toBe(1);
    expect((await iniciarSesion('B', 'libro', 'casa'))).toMatchObject({ id: s.id, rutina: 'A' });
    await guardarSerie(s.id!, 'glute', 0, { peso: 0, reps: 20 });
    await guardarSerie(s.id!, 'glute', 0, { peso: 0, reps: 18 });
    const [x] = await sesionesConSeries();
    expect(x.series).toHaveLength(1);
    expect(x.series[0].v.reps).toBe(18);
    expect((await sesionAbierta())?.id).toBe(s.id);
    await terminarSesion(s.id!);
    expect(await sesionAbierta()).toBeUndefined();
    await reabrirSesion(s.id!);
    expect((await sesionAbierta())?.fin).toBeUndefined();
  });

  it('Deshacer borra la serie y los descansos suman segundos', async () => {
    const s = await iniciarSesion('A', 'mixto', 'gym');
    await guardarSerie(s.id!, 'glute', 0, { reps: 10 });
    await borrarSerie(s.id!, 'glute', 0);
    expect(await db.series.count()).toBe(0);
    await registrarDescanso(s.id, 'A1 · serie 2', 62);
    await registrarDescanso(s.id, undefined, 30);
    await registrarDescanso(s.id, undefined, 0);
    expect(await segundosDeDescanso(s.id!)).toBe(92);
  });

  it('Calentar guarda por día y se puede marcar un bloque completo', async () => {
    await marcarVarios('2026-10-05', ['0-0-0', '0-0-1'], true);
    expect([...(await calentadosDe('2026-10-05'))].sort()).toEqual(['0-0-0', '0-0-1']);
    expect((await calentadosDe('2026-10-06')).size).toBe(0);
    await marcarVarios('2026-10-05', ['0-0-0', '0-0-1'], false);
    expect((await calentadosDe('2026-10-05')).size).toBe(0);
  });
});

describe('actualizar la base', () => {
  it('guarda una copia interna antes de pasar a la versión 2 y no toca tus datos', async () => {
    const nombre = 'vieja-' + n++;
    const v1 = new Dexie(nombre);
    v1.version(1).stores({ ajustes: 'k', contenido: 'parte', coleccion: '++id, tipo, &semilla', mensajes: 'fecha', copias: '++id, fecha' });
    await v1.table('ajustes').put({ k: 'unidad', v: 'kg' });
    await v1.table('coleccion').add({ tipo: 'frase', texto: 'Mía', origen: 'Mía', semilla: 'x' });
    v1.close();

    expect(await copiaAntesDeActualizar(nombre, 2, 1000)).toBe(true);
    usarBase(new BaseBienestar(nombre));
    expect(await db.ajustes.get('unidad')).toEqual({ k: 'unidad', v: 'kg' });
    expect(await db.coleccion.count()).toBe(1);
    const copia = await ultimaCopia(2000);
    expect(copia?.motivo).toBe('actualizar');
    // Con la base ya en versión 2 no hace otra copia
    db.close();
    expect(await copiaAntesDeActualizar(nombre, 2, 3000)).toBe(false);
    // Y la copia sirve para volver
    usarBase(new BaseBienestar(nombre));
    await db.coleccion.clear();
    expect(await volverACopia(copia!.id!)).toBe(true);
    expect(await db.coleccion.count()).toBe(1);
  });

  it('sin base anterior no hace nada', async () => {
    expect(await copiaAntesDeActualizar('no-existe-' + n++, 2)).toBe(false);
  });
});
