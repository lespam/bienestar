import { describe, expect, it, beforeEach } from 'vitest';
import { BaseBienestar, usarBase, db } from '../../src/core/db';
import { ErrorIA, extraerJson, preguntar } from '../../src/modules/ia/api';
import { estimarComida, estimarDeFoto, resumenSemanal, cambiosDeIngredientes, ideasDeMenu, leerRecetaDeFoto, ordenarPreparacion, tipsDeReceta, tipsDeEjercicios } from '../../src/modules/ia/tareas';
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

describe('comida escrita', () => {
  it('separa alimentos, limita los números y no acepta respuestas sin comida', async () => {
    const r = await estimarComida('k', '2 quesadillas y un yogur', responde('{"items":[{"n":"Quesadilla","por":"2 piezas","k":420.4,"p":18,"c":40,"g":20},{"n":"  ","k":1},{"n":"Yogur","k":-5,"p":"x"}]}'));
    expect(r).toEqual([{ n: 'Quesadilla', por: '2 piezas', k: 420, p: 18, c: 40, g: 20 }, { n: 'Yogur', por: '1 porción', k: 0, p: 0, c: 0, g: 0 }]);
    const enorme = await estimarComida('k', 'x', responde('{"items":[{"n":"A","k":99999}]}'));
    expect(enorme[0].k).toBe(3000);
    await expect(estimarComida('k', 'hola', responde('{"items":[]}'))).rejects.toThrow(ErrorIA);
  });
});

describe('escáner', () => {
  it('manda la imagen y el contexto, y limita los números', async () => {
    let pedido: { imagen?: unknown; texto: string } | undefined;
    const r = await estimarDeFoto('k', { tipo: 'image/png', base64: 'AAA' }, 'media porción', async (p) => { pedido = p as never; return '{"items":[{"n":"Barra","por":"1/2 barra","k":99999,"p":5,"c":10,"g":3}]}'; });
    expect(pedido?.imagen).toBeTruthy();
    expect(pedido?.texto).toContain('media porción');
    expect(r[0].k).toBe(3000);
    await expect(estimarDeFoto('k', { tipo: 'image/png', base64: 'AAA' }, '', async () => '{"items":[]}')).rejects.toThrow(ErrorIA);
  });
});

describe('resumen semanal', () => {
  it('limita los puntos, pide sin cifras si se oculta y no acepta vacío', async () => {
    let texto = '';
    const ses = [{ cuando: 'esta semana' as const, dia: 'lun 12 oct', rutina: 'A', ejercicios: [{ nombre: 'Puente', series: '3 x 10' }] }];
    const r = await resumenSemanal('k', ses, true, async (p) => { texto = p.texto; return '{"puntos":["a","b","c","d","e","f"]}'; });
    expect(r).toHaveLength(5);
    expect(texto).toContain('No escribas números');
    expect(texto).toContain('Puente');
    await expect(resumenSemanal('k', ses, false, async () => '{"puntos":[]}')).rejects.toThrow(ErrorIA);
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

describe('tips de ejercicios', () => {
  it('solo acepta ejercicios que se enviaron y no acepta vacío', async () => {
    const ejs = [{ clave: 'a', nombre: 'Puente', series: '3 × 10', casa: true }, { clave: 'b', nombre: 'Remo', series: '3 × 12', casa: false }];
    const r = await tipsDeEjercicios('k', ejs, async () => '{"tips":[{"clave":"a","tip":"Sube lento."},{"clave":"x","tip":"Otro."},{"clave":"rutina","tip":"Respira."}]}');
    expect(r).toEqual([{ clave: 'a', tip: 'Sube lento.' }, { clave: 'rutina', tip: 'Respira.' }]);
    const uno = await tipsDeEjercicios('k', [ejs[0]], async () => '{"tips":[{"clave":"rutina","tip":"No."},{"clave":"a","tip":"Sí."}]}');
    expect(uno).toEqual([{ clave: 'a', tip: 'Sí.' }]);
    await expect(tipsDeEjercicios('k', ejs, async () => '{"tips":[]}')).rejects.toThrow(ErrorIA);
  });
});
