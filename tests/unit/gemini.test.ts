import { describe, expect, it } from 'vitest';
import { BaseBienestar, CLAVES_PRIVADAS } from '../../src/core/db';
import { crearZip, leerZip } from '../../src/core/respaldo';
import { ErrorIA } from '../../src/modules/ia/api';
import { generarImagen, MODELO_IMAGEN, textoDeImagen } from '../../src/modules/ia/gemini';
import { claveGeminiValida } from '../../src/modules/ia/gemini.svelte';
import { esIlustracion, nombreImagen, sePuedeGenerar } from '../../src/modules/comida/imagen';

const PNG = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
const pedido = { nombre: 'Tinga de pollo', ingredientes: ['Pechuga de pollo', 'Jitomate', 'Aceite'] };
const respuesta = (cuerpo: unknown, status = 200) => async () => new Response(JSON.stringify(cuerpo), { status, headers: { 'content-type': 'application/json' } });
const conImagen = { candidates: [{ content: { parts: [{ text: 'Aquí está' }, { inlineData: { mimeType: 'image/png', data: PNG } }] }, finishReason: 'STOP' }] };
const tipoDeError = async (f: typeof fetch) => { try { await generarImagen(pedido, 'AIzaClaveDePrueba1234567890', MODELO_IMAGEN, f); } catch (e) { return e instanceof ErrorIA ? [e.tipo, e.message] : ['?', String(e)]; } return ['sin error', '']; };

describe('Generar imagen con Gemini', () => {
  it('solo manda el nombre y los ingredientes, sin cantidades ni nada de tu registro', () => {
    const t = textoDeImagen({ nombre: 'Tinga de pollo', ingredientes: ['Pechuga de pollo', ' Jitomate ', 'Jitomate', ''] });
    expect(t).toContain('Tinga de pollo');
    expect(t).toContain('Pechuga de pollo, Jitomate.');
    expect(t).toMatch(/sin texto/);
    expect(t).not.toMatch(/kcal|peso|gramos|\d{3}/i);
  });
  it('pide la imagen con tu clave en el encabezado y la devuelve para revisarla', async () => {
    let url = '', cabeceras: Record<string, string> = {}, cuerpo = '';
    const f = (async (u: string, init: RequestInit) => { url = u; cabeceras = init.headers as Record<string, string>; cuerpo = String(init.body); return new Response(JSON.stringify(conImagen), { status: 200 }); }) as unknown as typeof fetch;
    const img = await generarImagen(pedido, 'AIzaClaveDePrueba1234567890', 'mi-modelo', f);
    expect(url).toBe('https://generativelanguage.googleapis.com/v1beta/models/mi-modelo:generateContent');
    expect(cabeceras['x-goog-api-key']).toBe('AIzaClaveDePrueba1234567890');
    expect(url).not.toContain('AIza');
    expect(cuerpo).toContain('Tinga de pollo');
    expect(img.type).toBe('image/png');
    expect(img.size).toBeGreaterThan(20);
  });
  it('entiende la respuesta con guion bajo y usa el modelo de siempre si el campo viene vacío', async () => {
    let url = '';
    const f = (async (u: string) => { url = u; return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ inline_data: { mime_type: 'image/jpeg', data: PNG } }] } }] }), { status: 200 }); }) as unknown as typeof fetch;
    const img = await generarImagen(pedido, 'AIzaClaveDePrueba1234567890', '  ', f);
    expect(url).toContain('/models/' + MODELO_IMAGEN + ':');
    expect(img.type).toBe('image/jpeg');
  });
  it('traduce los errores de Google a lo que la hoja sabe explicar', async () => {
    expect(await tipoDeError(respuesta({ error: { message: 'API key not valid. Please pass a valid API key.', status: 'INVALID_ARGUMENT' } }, 400))).toEqual(['clave', 'clave']);
    expect(await tipoDeError(respuesta({ error: { message: 'denegado' } }, 403))).toEqual(['clave', 'clave']);
    expect(await tipoDeError(respuesta({ error: {} }, 429))).toEqual(['limite', 'limite']);
    expect(await tipoDeError(respuesta({ error: {} }, 404))).toEqual(['otro', 'modelo']);
    expect(await tipoDeError(respuesta({}, 500))).toEqual(['otro', 'HTTP 500']);
    expect(await tipoDeError(respuesta({ promptFeedback: { blockReason: 'SAFETY' } }))).toEqual(['otro', 'bloqueada']);
    expect(await tipoDeError(respuesta({ candidates: [{ content: { parts: [{ text: 'no pude' }] }, finishReason: 'IMAGE_SAFETY' }] }))).toEqual(['otro', 'bloqueada']);
    expect(await tipoDeError(respuesta({ candidates: [{ content: { parts: [{ text: 'solo texto' }] }, finishReason: 'STOP' }] }))).toEqual(['otro', 'vacío']);
    expect(await tipoDeError((async () => { throw new TypeError('red'); }) as unknown as typeof fetch)).toEqual(['internet', 'internet']);
  });
  it('la clave de Google se reconoce por cómo empieza y nunca va en el respaldo', async () => {
    expect(claveGeminiValida('AIzaSyD-abcdefghijklmnopqrstuvwxyz123456')).toBe(true);
    expect(claveGeminiValida('sk-ant-api03-prueba1234')).toBe(false);
    expect(claveGeminiValida('hola')).toBe(false);
    expect(CLAVES_PRIVADAS.has('gem.clave')).toBe(true);
    const base = new BaseBienestar('gemini-respaldo');
    await base.ajustes.put({ k: 'gem.clave', v: 'AIzaSecretaDePrueba1234567890' });
    await base.ajustes.put({ k: 'gem.on', v: true });
    const leido = leerZip(await crearZip(new Date(), base))!;
    expect(JSON.stringify(leido.datos)).not.toContain('AIzaSecreta');
    expect(JSON.stringify(leido.datos.tablas.ajustes)).toContain('gem.on');
  });
  it('una ilustración nunca se presenta como foto real, y una foto nunca se reemplaza', () => {
    expect(nombreImagen({ img_tipo: 'generada' })).toBe('Ilustración hecha con IA');
    expect(nombreImagen({ img_tipo: 'ilustración' })).toBe('Ilustración');
    expect(nombreImagen({ img_tipo: 'foto del libro' })).toBe('Foto del libro');
    expect(nombreImagen({})).toBe('Foto del platillo');
    expect(esIlustracion({ img_tipo: 'generada' })).toBe(true);
    const foto = new Blob(['x']);
    expect(sePuedeGenerar({})).toBe(true);
    expect(sePuedeGenerar({ img: foto, img_tipo: 'ilustración' })).toBe(true);
    expect(sePuedeGenerar({ img: foto, img_tipo: 'generada' })).toBe(true);
    expect(sePuedeGenerar({ img: foto, img_tipo: 'foto del libro' })).toBe(false);
    expect(sePuedeGenerar({ img: foto })).toBe(false);
  });
});
