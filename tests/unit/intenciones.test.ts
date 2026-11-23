import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { BaseBienestar, db, usarBase } from '../../src/core/db';
import { nav } from '../../src/core/nav.svelte';
import { fechaDe } from '../../src/modules/comida/calculos';
import { leerCompras, leerHay } from '../../src/modules/comida/datos';
import { lunesDe } from '../../src/modules/comida/patrones';
import { ejecutar, entender, entenderConIA, partir, textoDeAcciones, vaciarRegistro } from '../../src/modules/ia';
import { registrarIntenciones } from '../../src/intenciones';

vi.mock('../../src/modules/entreno', () => ({
  letrasDeRutina: async () => ['A', 'B', 'C'],
  elegirRutinaHoy: vi.fn(async (l: string) => (l === 'B' ? { ok: false, motivo: 'ya-hay-sesion' } : { ok: true, deshacer: async () => {} }))
}));

let n = 0;
beforeAll(() => { vaciarRegistro(); registrarIntenciones(); });
beforeEach(() => { usarBase(new BaseBienestar('cuadro-' + n++)); });

const ids = async (f: string) => (await entender(f)).map((e) => e.id);

describe('Cuadro único: las reglas entienden sin IA', () => {
  it('lista de compras', async () => {
    const [e] = await entender('agrega leche y huevos a la lista');
    expect(e).toMatchObject({ id: 'compras', datos: { articulos: ['Leche', 'Huevos'] } });
    expect(e.resumen).toBe('Agregar a tu lista de compras: Leche y Huevos.');
    expect((await entender('se me acabó el limón'))[0]).toMatchObject({ id: 'compras', datos: { articulos: ['Limón'] } });
  });
  it('hogar: capacidad, tarea nueva y tarea hecha', async () => {
    expect((await entender('tengo 20 minutos y poca energía'))[0]).toMatchObject({ id: 'hogar', datos: { frase: { tipo: 'capacidad', energia: 'poca', tiempo: 15 } } });
    expect((await entender('agrega regar plantas cada 3 días'))[0]).toMatchObject({ id: 'hogar', datos: { frase: { tipo: 'agregar', cada: 3 } } });
    expect(await ids('ya aspiré el cuarto')).toEqual(['hogar']);
  });
  it('la rutina de hoy solo si existe en tu programa', async () => {
    expect((await entender('hoy hago la rutina C'))[0]).toMatchObject({ id: 'rutina', datos: { letra: 'C' }, resumen: 'Hoy: Rutina C.' });
    expect(await ids('hoy hago la rutina Z')).toEqual([]);
  });
  it('lo que comí se anota con solo el nombre y en su tiempo', async () => {
    expect((await entender('hoy comí yogur y fruta'))[0]).toMatchObject({ id: 'comida', datos: { alimentos: ['Yogur', 'Fruta'], comida: 1, ayer: false } });
    expect((await entender('ayer cené tacos'))[0]).toMatchObject({ datos: { alimentos: ['Tacos'], comida: 3, ayer: true } });
    expect((await entender('desayuné avena'))[0]).toMatchObject({ datos: { comida: 0 } });
  });
  it('una frase con dos ideas da dos acciones', async () => {
    const r = await entender('Hoy comí yogur y la próxima semana quiero algo diferente');
    expect(r.map((e) => e.id)).toEqual(['comida', 'sugerir']);
    expect(r[1].datos).toEqual({ proxima: true });
  });
  it('si una parte no se entiende, se intenta la frase completa', async () => {
    const r = await entender('agrega leche y la mantequilla a la lista');
    expect(r).toHaveLength(1);
    expect(r[0].datos.articulos).toEqual(['Leche', 'Mantequilla']);
  });
  it('sugerir, inspiración, ir a una pantalla y lo que hay en casa', async () => {
    expect(await ids('sugiéreme el menú de esta semana')).toEqual(['sugerir']);
    expect(await ids('muéstrame las inspiraciones de hoy')).toEqual(['inspiracion']);
    expect((await entender('abre la lista de compras'))[0].resumen).toBe('Abrir la lista de compras.');
    const [e] = await entender('tengo pollo, 3 jitomates y medio aguacate');
    expect(e.id).toBe('nevera');
    expect((e.datos.alimentos as { n: string }[]).map((a) => a.n)).toEqual(['Pollo', 'Jitomates', 'Aguacate']);
  });
  it('lo que no es una acción no se inventa', async () => {
    expect(await ids('tengo hambre')).toEqual([]);
    expect(await ids('hola, ¿cómo estás?')).toEqual([]);
    expect(await entender('   ')).toEqual([]);
  });
  it('parte solo donde empieza otra idea', () => {
    expect(partir('hoy comí yogur y fruta')).toEqual(['hoy comí yogur y fruta']);
    expect(partir('hoy comí yogur y la próxima semana quiero algo diferente')).toHaveLength(2);
  });
});

describe('Cuadro único: lo confirmado se aplica y se puede deshacer', () => {
  it('agrega a la lista de compras y quita lo agregado', async () => {
    const [e] = await entender('agrega leche y huevos a la lista');
    const r = await ejecutar(e);
    const lunes = lunesDe(fechaDe(0));
    expect((await leerCompras(lunes)).extras.map((x) => x.n)).toEqual(['Leche', 'Huevos']);
    expect(r && r.aviso).toBe('Agregué a tu lista: Leche y Huevos');
    await r!.deshacer!();
    expect((await leerCompras(lunes)).extras).toEqual([]);
  });
  it('anota lo que comiste sin números y lo quita al deshacer', async () => {
    const [e] = await entender('hoy comí yogur');
    const r = await ejecutar(e);
    const filas = await db.registro.toArray();
    expect(filas).toHaveLength(1);
    expect(filas[0]).toMatchObject({ n: 'Yogur', comida: 1, k: null, p: 0 });
    await r!.deshacer!();
    expect(await db.registro.count()).toBe(0);
  });
  it('lo que hay en casa se suma a «Lo que hay hoy» y se deshace', async () => {
    const abrir = vi.spyOn(nav, 'abrir').mockImplementation(() => {});
    const [e] = await entender('tengo pollo y 3 jitomates');
    const r = await ejecutar(e);
    expect((await leerHay())?.items.map((x) => x.n)).toEqual(['Pollo', 'Jitomates']);
    expect(abrir).toHaveBeenCalledWith('nevera');
    await r!.deshacer!();
    expect(await leerHay()).toBeNull();
  });
  it('la capacidad de hoy llega a Hogar', async () => {
    vi.spyOn(nav, 'abrir').mockImplementation(() => {});
    const [e] = await entender('tengo 30 minutos y buena energía');
    await ejecutar(e);
    const dia = await db.hogarDia.get(fechaDe(0));
    expect(dia).toMatchObject({ tiempo: 30, energia: 'buena' });
  });
  it('si hoy ya empezaste una rutina, lo dice y no cambia nada', async () => {
    const [e] = await entender('hoy hago la rutina B');
    const r = await ejecutar(e);
    expect(r && r.aviso).toMatch(/ya empezaste o terminaste/);
    expect(r && r.deshacer).toBeUndefined();
  });
});

describe('Cuadro único: una sola llamada, solo la frase y la lista de acciones', () => {
  it('lo que contesta el modelo se valida antes de mostrarse', async () => {
    const enviados: { texto: string; sistema?: string }[] = [];
    const ask = async (p: { texto: string; sistema?: string }) => { enviados.push(p); return 'Claro: {"intencion":"compras","datos":{"articulos":["leche","pan"]}}'; };
    const r = await entenderConIA('sk-ant-x', 'oye, creo que ya no hay nada para el desayuno', ask as never);
    expect(r[0]).toMatchObject({ id: 'compras', resumen: 'Agregar a tu lista de compras: Leche y Pan.' });
    expect(enviados).toHaveLength(1);
    expect(enviados[0].texto).toContain('Frase: «oye, creo que ya no hay nada para el desayuno»');
    expect(enviados[0].texto).toContain(textoDeAcciones());
    expect(enviados[0].texto).not.toMatch(/Les|Jeff|peso|kg/);
  });
  it('una acción que no existe o datos que no sirven no pasan', async () => {
    expect(await entenderConIA('k', 'x', (async () => '{"intencion":"borrar_todo","datos":{}}') as never)).toEqual([]);
    expect(await entenderConIA('k', 'x', (async () => '{"intencion":"rutina","datos":{"letra":"Z"}}') as never)).toEqual([]);
    expect(await entenderConIA('k', 'x', (async () => '{"intencion":"ninguna"}') as never)).toEqual([]);
    expect(await entenderConIA('k', 'x', (async () => '{"intencion":"comida","datos":{"alimentos":[]}}') as never)).toEqual([]);
  });
});
