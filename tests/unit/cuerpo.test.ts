import { beforeEach, describe, expect, it } from 'vitest';
import { BaseBienestar, usarBase, db } from '../../src/core/db';
import { crearZip, leerZip } from '../../src/core/respaldo';
import { armarGrafica, cambio, claveDia, diasDelMes, etiquetaFecha, leerNumero, nombreDeZona, nombreMes, porZona, sumarMes, ultimas } from '../../src/modules/cuerpo/calculos';
import { agregarFoto, deshacerDelDia, diasDePeriodo, guardarDelDia, guardarZonas, leerZonas, listarFotos, marcarDia, quitarDia, quitarFoto, todasLasMedidas, ultimoPeso } from '../../src/modules/cuerpo/datos';
import { cargarPrefs } from '../../src/modules/ajustes';

let n = 0;
beforeEach(async () => { usarBase(new BaseBienestar('cuerpo-' + n++)); await cargarPrefs(); });

describe('cálculos de medidas', () => {
  const filas = [
    { id: 1, zona: 'Glúteo', fecha: '2026-09-03', cm: 100.5 },
    { id: 2, zona: 'Glúteo', fecha: '2026-08-20', cm: 100 },
    { id: 3, zona: 'Glúteo', fecha: '2026-09-03', cm: 101 },
    { id: 4, zona: 'Cintura', fecha: '2026-09-03', cm: 78 }
  ];
  it('ordena por fecha y, si hay dos el mismo día, vale la última', () => {
    expect(porZona(filas, 'glúteo')).toEqual([{ fecha: '2026-08-20', cm: 100 }, { fecha: '2026-09-03', cm: 101 }]);
    expect(porZona(filas, 'Cadera')).toEqual([]);
  });
  it('calcula el cambio contra la medición anterior', () => {
    expect(cambio([{ fecha: 'a', cm: 100 }])).toBeNull();
    expect(cambio(porZona(filas, 'Glúteo'))).toBe(1);
    expect(cambio([{ fecha: 'a', cm: 77.5 }, { fecha: 'b', cm: 77 }])).toBe(-0.5);
  });
  it('arma la gráfica solo con 2 o más mediciones', () => {
    expect(armarGrafica([{ fecha: '2026-09-03', cm: 100 }])).toBeNull();
    const g = armarGrafica([{ fecha: '2026-08-20', cm: 100 }, { fecha: '2026-09-03', cm: 102 }])!;
    expect(g.puntos).toHaveLength(2);
    expect(g.puntos[1].y).toBeLessThan(g.puntos[0].y); // sube: y más chica
    expect(g.marcas.map((m) => m.n)).toEqual([99, 101, 103]);
  });
  it('limpia los nombres y los números que escribes', () => {
    expect(nombreDeZona('  espalda   alta ')).toBe('Espalda alta');
    expect(nombreDeZona('   ')).toBeNull();
    expect(nombreDeZona('x'.repeat(21))).toBeNull();
    expect(leerNumero('77,5', 0, 300)).toBe(77.5);
    expect(leerNumero('0', 0, 300)).toBeNull();
    expect(leerNumero('500', 0, 300)).toBeNull();
    expect(leerNumero('abc', 0, 300)).toBeNull();
    expect(ultimas([1, 2, 3, 4, 5, 6, 7].map((cm) => ({ fecha: 'f', cm })), 6)).toHaveLength(6);
  });
  it('calendario: lunes primero, meses y fechas', () => {
    expect(diasDelMes(2026, 9)).toEqual({ huecos: 3, dias: 31 }); // 1 oct 2026 es jueves
    expect(sumarMes(2026, 0, -1)).toEqual({ a: 2025, m: 11 });
    expect(sumarMes(2026, 11, 1)).toEqual({ a: 2027, m: 0 });
    expect(nombreMes(2026, 8)).toBe('Septiembre 2026');
    expect(claveDia(2026, 8, 5)).toBe('2026-09-05');
    expect(etiquetaFecha('2026-10-01')).toBe('1 oct');
  });
});

describe('lo que se guarda', () => {
  it('guarda medidas y peso del día, cambia lo del mismo día y se puede deshacer', async () => {
    const u1 = await guardarDelDia('2026-10-01', { Glúteo: 101, Cintura: 77 }, 158, 'lb');
    expect(await todasLasMedidas()).toHaveLength(2);
    expect(await ultimoPeso()).toMatchObject({ valor: 158, unidad: 'lb' });
    const u2 = await guardarDelDia('2026-10-01', { Glúteo: 102 }, 157, 'lb');
    expect((await todasLasMedidas()).filter((m) => m.zona === 'Glúteo').map((m) => m.cm)).toEqual([102]);
    expect((await ultimoPeso())!.valor).toBe(157);
    await deshacerDelDia(u2);
    expect((await todasLasMedidas()).filter((m) => m.zona === 'Glúteo').map((m) => m.cm)).toEqual([101]);
    expect((await ultimoPeso())!.valor).toBe(158);
    await deshacerDelDia(u1);
    expect(await todasLasMedidas()).toEqual([]);
    expect(await ultimoPeso()).toBeUndefined();
  });
  it('las zonas empiezan con 5 y quitar una no borra su historial', async () => {
    const z = await leerZonas();
    expect(z.visibles).toEqual(['Glúteo', 'Cintura', 'Cadera', 'Muslo', 'Brazo']);
    expect(z.conocidas).toContain('Pecho');
    await guardarDelDia('2026-10-01', { Brazo: 29 }, null, 'lb');
    await guardarZonas({ visibles: ['Glúteo'], conocidas: z.conocidas });
    expect((await leerZonas()).visibles).toEqual(['Glúteo']);
    expect(await todasLasMedidas()).toHaveLength(1);
  });
  it('fotos: se agregan, se ordenan por fecha y se quitan', async () => {
    const a = await agregarFoto('2026-10-01', new Blob(['a'], { type: 'image/jpeg' }));
    await agregarFoto('2026-09-03', new Blob(['b'], { type: 'image/jpeg' }));
    expect((await listarFotos()).map((f) => f.fecha)).toEqual(['2026-09-03', '2026-10-01']);
    await quitarFoto(a);
    expect(await listarFotos()).toHaveLength(1);
  });
  it('período: marcar, anotar y quitar días', async () => {
    await marcarDia('2026-09-14', '');
    await marcarDia('2026-09-14', 'Cólicos leves');
    await marcarDia('2026-09-15', '');
    expect(await diasDePeriodo()).toEqual({ '2026-09-14': 'Cólicos leves', '2026-09-15': '' });
    await quitarDia('2026-09-15');
    expect(Object.keys(await diasDePeriodo())).toEqual(['2026-09-14']);
  });
  it('el respaldo incluye lo de Cuerpo', async () => {
    await guardarDelDia('2026-10-01', { Glúteo: 101 }, 158, 'lb');
    await marcarDia('2026-09-14', 'x');
    const l = leerZip(await crearZip())!;
    expect(l.datos.tablas.medidas).toHaveLength(1);
    expect(l.datos.tablas.pesos).toHaveLength(1);
    expect(l.datos.tablas.periodo).toHaveLength(1);
    expect(await db.fotos.count()).toBe(0);
  });
});
