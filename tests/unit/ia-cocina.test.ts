import { describe, expect, it } from 'vitest';
import { ErrorIA, preguntar, SISTEMA_COCINA } from '../../src/modules/ia/api';
import { leerRefri, proponerComidas, type PeticionCocina } from '../../src/modules/ia/tareas';
import { anotar, usoVacio } from '../../src/modules/ia/uso';

const peticion: PeticionCocina = {
  disponibles: ['pollo', 'jitomate'], urgentes: ['pollo'], exclusiones: 'Nivel «odio» o «no lo como»: huevo',
  candidatas: [{ id: 'tinga', n: 'Tinga' }, { id: 'omelette', n: 'Omelette' }, { id: 'sopa', n: 'Sopa' }], tiempos: ['comida', 'cena']
};
const respuestas = (...r: string[]) => { const pedidos: { texto: string; sistema?: string }[] = []; let i = 0; return { pedidos, ask: (async (p: { texto: string; sistema?: string }) => { pedidos.push(p); return r[i++]; }) as never }; };
const sinHuevo = (c: { receta_id: string }) => (c.receta_id === 'omelette' ? 'duro: huevo' : null);

describe('plan con lo que hay', () => {
  it('usa el sistema de cocina y manda solo ids y nombres de candidatas', async () => {
    const { pedidos, ask } = respuestas('{"comidas":[{"tiempo":"comida","receta_id":"tinga","adaptacion":null,"usa":["pollo"],"falta":["cebolla"]}],"nota":"Usa primero el pollo."}');
    const r = await proponerComidas('k', peticion, sinHuevo, ask);
    expect(r.comidas).toEqual([{ tiempo: 'comida', receta_id: 'tinga', adaptacion: null, usa: ['pollo'], falta: ['cebolla'] }]);
    expect(r.nota).toBe('Usa primero el pollo.');
    expect(pedidos).toHaveLength(1);
    expect(pedidos[0].sistema).toBe(SISTEMA_COCINA);
    expect(pedidos[0].texto).toContain('tinga: Tinga');
    expect(pedidos[0].texto).toContain('huevo');
    expect(SISTEMA_COCINA).toContain('NINGÚN ingrediente');
  });
  it('descarta ids que no se enviaron y tiempos raros', async () => {
    const { ask } = respuestas('{"comidas":[{"tiempo":"comida","receta_id":"inventada"},{"tiempo":"brunch","receta_id":"tinga"},{"tiempo":"cena","receta_id":"sopa","usa":["jitomate"],"falta":[]}]}');
    const r = await proponerComidas('k', peticion, () => null, ask);
    expect(r.comidas.map((c) => c.receta_id)).toEqual(['sopa']);
  });
  it('lo que no pasa el seguro nunca se muestra; si se descarta todo, una segunda llamada con los rechazos', async () => {
    const { pedidos, ask } = respuestas(
      '{"comidas":[{"tiempo":"comida","receta_id":"omelette","usa":[],"falta":[]}]}',
      '{"comidas":[{"tiempo":"comida","receta_id":"sopa","usa":[],"falta":[]}]}'
    );
    const r = await proponerComidas('k', peticion, sinHuevo, ask);
    expect(r.comidas.map((c) => c.receta_id)).toEqual(['sopa']);
    expect(pedidos).toHaveLength(2);
    expect(pedidos[1].texto).toContain('omelette (duro: huevo)');
  });
  it('si la segunda también falla, lanza el error y la pantalla usa las reglas', async () => {
    const mala = '{"comidas":[{"tiempo":"comida","receta_id":"omelette","usa":[],"falta":[]}]}';
    const { pedidos, ask } = respuestas(mala, mala);
    await expect(proponerComidas('k', peticion, sinHuevo, ask)).rejects.toThrow(ErrorIA);
    expect(pedidos).toHaveLength(2);
  });
});

describe('leer lo que hay en casa', () => {
  it('devuelve alimentos con cantidad y urgencia, sin inventar', async () => {
    const { ask } = respuestas('{"items":[{"n":"Jitomates","q":"3 piezas","urgente":true},{"n":" "},{"n":"Yogurt","q":"","urgente":false},5]}');
    expect(await leerRefri('k', [{ tipo: 'image/jpeg', base64: 'x' }], '', ask)).toEqual([{ n: 'Jitomates', q: '3 piezas', urgente: true }, { n: 'Yogurt', q: '', urgente: false }]);
    await expect(leerRefri('k', [], '', respuestas('{"items":[]}').ask)).rejects.toThrow(ErrorIA);
  });
  it('manda todas las fotos en un solo pedido, con el prompt de sistema que se le dé', async () => {
    let cuerpo: { system: string; messages: { content: { type: string }[] }[] } | null = null;
    const f = (async (_u: string, init: { body: string }) => { cuerpo = JSON.parse(init.body); return { status: 200, ok: true, json: async () => ({ content: [{ type: 'text', text: '{}' }] }) }; }) as never;
    await preguntar({ modelo: 'm', texto: 't', imagenes: [{ tipo: 'image/jpeg', base64: 'a' }, { tipo: 'image/jpeg', base64: 'b' }], sistema: 'SIS' }, 'k', f);
    expect(cuerpo!.system).toBe('SIS');
    expect(cuerpo!.messages[0].content.map((c) => c.type)).toEqual(['image', 'image', 'text']);
  });
});

describe('consumo por función', () => {
  it('suma lo gastado por cada función', () => {
    let u = usoVacio('2026-11-23');
    u = anotar(u, 'claude-haiku-5-5', { entrada: 1000, salida: 500 }, '2026-11-23', 'huecos');
    u = anotar(u, 'claude-sonnet-5-5', { entrada: 20_000, salida: 4_000 }, '2026-11-23', 'nevera');
    u = anotar(u, 'claude-haiku-5-5', { entrada: 1000, salida: 500 }, '2026-11-24', 'huecos');
    u = anotar(u, 'claude-haiku-5-5', { entrada: 10, salida: 10 }, '2026-11-24');
    expect(u.fns!.huecos.pedidos).toBe(2);
    expect(u.fns!.nevera.usd).toBeCloseTo(0.08);
    expect(u.total.pedidos).toBe(4);
  });
});
