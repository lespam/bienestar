import { describe, expect, it, beforeEach } from 'vitest';
import { BaseBienestar, usarBase, db } from '../../src/core/db';
import { ErrorIA, extraerJson, preguntar } from '../../src/modules/ia/api';
import { cambiosDeIngredientes, ideasDeMenu, leerRecetaDeFoto, ordenarPreparacion, tipsDeReceta } from '../../src/modules/ia/tareas';
import { cargarIA, claveValida, guardarClave, ia, leerClave, ponerFuncion, ponerUsarIA, quitarClave } from '../../src/modules/ia/estado.svelte';
import { crearZip } from '../../src/core/respaldo';

let n = 0;
beforeEach(() => { usarBase(new BaseBienestar('ia-' + n++)); });
const responde = (texto: string) => async () => texto;

describe('respuestas de la IA', () => {
  it('saca el JSON aunque venga con texto alrededor y rechaza lo que no lo es', () => {
    expect(extraerJson('Claro:\n{"a": 1}\nListo')).toEqual({ a: 1 });
    expect(() => extraerJson('nada')).toThrow(ErrorIA);
    expect(() => extraerJson('{no json}')).toThrow(ErrorIA);
  });
  it('lee una receta de foto y no inventa lo que falta', async () => {
    const r = await leerRecetaDeFoto('k', { tipo: 'image/jpeg', base64: 'x' }, responde('{"n":"Tinga","cat":"Rara","y":0,"t":"30 min","ing":["500 g pollo"," ",3],"steps":["Cuece"],"k":290}'));
    expect(r).toMatchObject({ n: 'Tinga', cat: 'Comida', y: 1, t: '30 min', ing: ['500 g pollo'], steps: ['Cuece'], k: 290, p: null });
    await expect(leerRecetaDeFoto('k', { tipo: 'image/jpeg', base64: 'x' }, responde('{"n":""}'))).rejects.toThrow(ErrorIA);
  });
  it('tips: hasta 3; cambios: solo con texto; orden: debe traer todas las cosas', async () => {
    expect(await tipsDeReceta('k', 'R', ['a'], responde('{"tips":["uno","dos","tres","cuatro"]}'))).toEqual(['uno', 'dos', 'tres']);
    await expect(tipsDeReceta('k', 'R', [], responde('{"tips":[]}'))).rejects.toThrow(ErrorIA);
    expect(await cambiosDeIngredientes('k', 'R', ['pollo'], responde('{"cambios":[{"ing":"pollo","alt":"pavo"},{"ing":"x"}]}'))).toEqual([{ ing: 'pollo', alt: 'pavo' }]);
    expect(await ordenarPreparacion('k', [{ t: 'a' }, { t: 'b' }, { t: 'c' }], responde('{"orden":[2,0,1]}'))).toEqual([2, 0, 1]);
    await expect(ordenarPreparacion('k', [{ t: 'a' }, { t: 'b' }], responde('{"orden":[0,0]}'))).rejects.toThrow(ErrorIA);
    await expect(ordenarPreparacion('k', [{ t: 'a' }, { t: 'b' }], responde('{"orden":[0,5]}'))).rejects.toThrow(ErrorIA);
  });
  it('ideas: solo recetas que se enviaron', async () => {
    const rs = [{ id: 'a', n: 'A' }, { id: 'b', n: 'B' }];
    expect(await ideasDeMenu('k', 'Cena', rs, [], responde('{"ids":["b","zzz","b","a"]}'))).toEqual(['b', 'a']);
    await expect(ideasDeMenu('k', 'Cena', rs, [], responde('{"ids":["zzz"]}'))).rejects.toThrow(ErrorIA);
  });
});

describe('la petición a Anthropic', () => {
  const ok = (texto: string): typeof fetch => (async () => new Response(JSON.stringify({ content: [{ type: 'text', text: texto }] }), { status: 200 })) as never;
  it('manda la clave en el encabezado y solo el texto pedido', async () => {
    let visto: { url: string; init: RequestInit } | null = null;
    const f = (async (url: string, init: RequestInit) => { visto = { url, init }; return ok('{"a":1}')(url, init); }) as never;
    expect(await preguntar({ modelo: 'm', texto: 'hola' }, 'sk-ant-prueba', f)).toBe('{"a":1}');
    expect(visto!.url).toBe('https://api.anthropic.com/v1/messages');
    expect((visto!.init.headers as Record<string, string>)['x-api-key']).toBe('sk-ant-prueba');
    expect(String(visto!.init.body)).not.toContain('sk-ant');
  });
  it('traduce los errores a cosas que se pueden explicar', async () => {
    const con = (status: number): typeof fetch => (async () => new Response('{}', { status })) as never;
    await expect(preguntar({ modelo: 'm', texto: 'x' }, 'k', con(401))).rejects.toMatchObject({ tipo: 'clave' });
    await expect(preguntar({ modelo: 'm', texto: 'x' }, 'k', con(429))).rejects.toMatchObject({ tipo: 'limite' });
    await expect(preguntar({ modelo: 'm', texto: 'x' }, 'k', con(500))).rejects.toMatchObject({ tipo: 'otro' });
    await expect(preguntar({ modelo: 'm', texto: 'x' }, 'k', (async () => { throw new TypeError('red'); }) as never)).rejects.toMatchObject({ tipo: 'internet' });
  });
});

describe('Ajustes de IA', () => {
  it('empieza apagada, valida la clave y la clave no sale en el respaldo', async () => {
    await cargarIA();
    expect(ia.on).toBe(false);
    expect(ia.tieneClave).toBe(false);
    expect(Object.values(ia.fn).every(Boolean)).toBe(true);
    expect(claveValida('sk-ant-api03-abcdefgh')).toBe(true);
    expect(claveValida('hola')).toBe(false);
    await ponerUsarIA(true);
    await ponerFuncion('prep', false);
    await guardarClave('  sk-ant-api03-SECRETO1234 ');
    await cargarIA();
    expect(ia).toMatchObject({ on: true, tieneClave: true, fin: '1234' });
    expect(ia.fn.prep).toBe(false);
    expect(await leerClave()).toBe('sk-ant-api03-SECRETO1234');
    const zip = await crearZip(new Date(), db);
    const texto = new TextDecoder().decode((await import('fflate')).unzipSync(zip)['datos.json']);
    expect(texto).not.toContain('SECRETO1234');
    expect(texto).toContain('ia.on');
    await quitarClave();
    expect((await leerClave())).toBe('');
  });
});

describe('privacidad', () => {
  it('el módulo de IA no lee tu cuerpo ni tu registro de comidas', async () => {
    const { readdirSync, readFileSync } = await import('node:fs');
    const dir = 'src/modules/ia/';
    const prohibido = /db\.(pesos|medidas|fotos|periodo|registro|flexibles)|\.\.\/cuerpo|\.\.\/comida/;
    for (const f of readdirSync(dir)) expect(readFileSync(dir + f, 'utf8'), f).not.toMatch(prohibido);
  });
});
