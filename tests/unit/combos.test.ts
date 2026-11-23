import { describe, expect, it } from 'vitest';
import type { PerfilComida } from '../../src/core/db';
import { combosVisibles, enOrdenDeTuPlan, motivoDeOcultar, partesDe, prohibidasDe } from '../../src/modules/comida/combos';
import { exclusionesDe } from '../../src/modules/comida/seguro';
import { COMBINACIONES } from '../../src/modules/comida/tips';
import { CATALOGO, noToca, siguienteIdea, usualesVacios } from '../../src/modules/comida/usuales';
import { ErrorIA } from '../../src/modules/ia/api';
import { ideaDeUsual, masCombinaciones, type PeticionCombos, type PeticionUsual } from '../../src/modules/ia/tareas';

const perfil = (quien: 'les' | 'jeff', no: string[] = [], niveles: PerfilComida['niveles'] = {}): PerfilComida =>
  ({ quien, src: null, fecha: null, k: null, p: null, c: null, g: null, mk: null, mp: null, por: 1, gustos: [], no, niveles, nota: '' });
const exDe = (jeff: string[] = [], nivel: 'odio' | 'nogusta' | 'prefiero' = 'nogusta') => exclusionesDe({ les: perfil('les'), jeff: perfil('jeff', jeff, Object.fromEntries(jeff.map((x) => [x, nivel]))) });

describe('combinaciones y lo que no comen', () => {
  it('con huevo en una lista de exclusiones, nunca sale «huevo + verduras»', () => {
    const todas = combosVisibles(COMBINACIONES, exDe(['huevo']));
    expect(todas.map((c) => c.t)).not.toContain('Huevo + verduras');
    expect(todas.length).toBe(COMBINACIONES.length - 1);
    // sin exclusiones salen todas
    expect(combosVisibles(COMBINACIONES, exDe())).toHaveLength(COMBINACIONES.length);
  });
  it('lo duro se oculta aunque solo aparezca en la explicación', () => {
    const c = { t: 'Verduras + un poco de aceite', x: 'Con aceite o aguacate.' };
    expect(motivoDeOcultar(c, exDe(['aguacate'], 'odio'))).toBe('duro: aguacate');
    // «prefiero no» no oculta
    expect(motivoDeOcultar(c, exDe(['aguacate'], 'prefiero'))).toBeNull();
  });
  it('«no me gusta» oculta si aparece en el nombre de la combinación; en la explicación no', () => {
    expect(motivoDeOcultar({ t: 'Espinaca + fresa, naranja o pimiento', x: 'Hierro.' }, exDe(['pimiento'], 'nogusta'))).toBe('principal: pimiento');
    expect(motivoDeOcultar({ t: 'Pimiento + arroz', x: 'x' }, exDe(['pimiento'], 'nogusta'))).toBe('principal: pimiento');
    expect(motivoDeOcultar({ t: 'Arroz + frijoles', x: 'Con un poco de pimiento.' }, exDe(['pimiento'], 'nogusta'))).toBeNull();
  });
  it('separa las partes y arma las parejas prohibidas de lo oculto', () => {
    expect(partesDe('Lentejas + jitomate o limón')).toEqual(['Lentejas', 'jitomate', 'limón']);
    expect(prohibidasDe(COMBINACIONES, exDe(['huevo']))).toEqual([['Huevo', 'verduras']]);
  });
  it('las de tu plan van primero sin perder el orden', () => {
    expect(enOrdenDeTuPlan([1, 2, 3, 4, 5], (n) => n % 2 === 0)).toEqual([2, 4, 1, 3, 5]);
  });
});

const peticion: PeticionCombos = { exclusiones: 'Nivel «odio» o «no lo como»: ninguna', plan: ['pollo', 'jitomate'], conocidas: ['Arroz + frijoles'], prohibidas: ['Huevo + verduras'] };
const respuestas = (...r: string[]) => { const pedidos: { texto: string }[] = []; let i = 0; return { pedidos, ask: (async (p: { texto: string }) => { pedidos.push(p); return r[i++]; }) as never }; };
const combo = (t: string, partes: string[]) => ({ b: 'Para probar', t, x: 'Porque se complementan en sabor.', partes });

describe('más combinaciones con IA', () => {
  it('manda exclusiones, plan y lo conocido; devuelve hasta 3 y descarta lo que no pasa el seguro', async () => {
    const { pedidos, ask } = respuestas(JSON.stringify({ combos: [combo('Pollo + limón', ['pollo', 'limón']), combo('Huevo + espinaca', ['huevo', 'espinaca']), combo('Jitomate + albahaca', ['jitomate', 'albahaca'])] }));
    const r = await masCombinaciones('k', peticion, (c) => (c.partes.includes('huevo') ? 'duro: huevo' : null), ask);
    expect(r.map((c) => c.t)).toEqual(['Pollo + limón', 'Jitomate + albahaca']);
    expect(pedidos).toHaveLength(1);
    expect(pedidos[0].texto).toContain('Ingredientes de mi plan: pollo, jitomate');
    expect(pedidos[0].texto).toContain('Parejas prohibidas: Huevo + verduras');
    expect(pedidos[0].texto).toContain('Arroz + frijoles');
    expect(pedidos[0].texto).not.toMatch(/Jeff|\bLes\b|\bkg\b|\bkcal\b/);
  });
  it('si todo se descarta, una segunda llamada con los rechazos; si también falla, error', async () => {
    const mala = JSON.stringify({ combos: [combo('Huevo + espinaca', ['huevo', 'espinaca'])] });
    const { pedidos, ask } = respuestas(mala, mala);
    await expect(masCombinaciones('k', peticion, () => 'duro: huevo', ask)).rejects.toBeInstanceOf(ErrorIA);
    expect(pedidos).toHaveLength(2);
    expect(pedidos[1].texto).toContain('Huevo + espinaca (duro: huevo)');
  });
  it('ignora combinaciones incompletas', async () => {
    const { ask } = respuestas(JSON.stringify({ combos: [{ t: 'Solo uno', x: 'x', partes: ['uno'] }, combo('Pollo + limón', ['pollo', 'limón'])] }));
    expect((await masCombinaciones('k', peticion, () => null, ask)).map((c) => c.t)).toEqual(['Pollo + limón']);
  });
});

describe('mis usuales', () => {
  const hoy = '2026-11-23';
  it('la primera idea sale del catálogo, sin IA, con recetas que ya la usan', () => {
    const recetas = [{ id: 'tinga', n: 'Tinga', cat: 'Comida', vis: 'visible', ing: [[500, 'g', 'Pechuga de pollo', 'P']] }] as never;
    const i = siguienteIdea(usualesVacios(), exDe(), recetas, hoy)!;
    expect(i.n).toBe(CATALOGO[0].n);
    expect(i.recetas).toEqual(['tinga']);
    expect(i.paso).toBe('Agrega tomillo a la lista de compras.');
  });
  it('sin recetas que sirvan, trae una adaptación', () => {
    const i = siguienteIdea(usualesVacios(), exDe(), [], hoy)!;
    expect(i.recetas).toEqual([]);
    expect(i.adaptacion).toBeTruthy();
  });
  it('lo rechazado no vuelve, lo que ya tienes tampoco y «ahora no» espera dos semanas', () => {
    const d = { ...usualesVacios(), rechazados: ['Tomillo'], items: ['coles de bruselas'], ahoraNo: { Jengibre: '2026-11-20' } };
    expect(noToca('Tomillo', d, hoy)).toBe(true);
    expect(noToca('Coles de Bruselas', d, hoy)).toBe(true);
    expect(noToca('Jengibre', d, hoy)).toBe(true);
    expect(noToca('Jengibre', d, '2026-12-10')).toBe(false);
    expect(siguienteIdea(d, exDe(), [], hoy)!.n).toBe('Cúrcuma');
  });
  it('respeta lo que no comen', () => {
    expect(siguienteIdea(usualesVacios(), exDe(['tomillo'], 'odio'), [], hoy)!.n).not.toBe('Tomillo');
  });
  it('la idea de la IA se revisa, solo cuenta recetas que se enviaron y se repite una vez si no pasa', async () => {
    const pet: PeticionUsual = { usuales: ['limones'], exclusiones: 'ninguna', rechazados: ['tomillo'], recetas: [{ id: 'tinga', n: 'Tinga' }] };
    const idea = (n: string) => JSON.stringify({ ingrediente: n, por_que: 'Cambiar de verduras suma variedad.', receta_ids: ['tinga', 'inventada'], adaptacion: 'null', paso: 'Agrega ' + n + ' a la lista de compras.' });
    const { pedidos, ask } = respuestas(idea('Huevo'), idea('Coles de Bruselas'));
    const r = await ideaDeUsual('k', pet, (i) => (i.n === 'Huevo' ? 'duro: huevo' : null), ask);
    expect(r).toMatchObject({ n: 'Coles de Bruselas', recetaIds: ['tinga'], adaptacion: null });
    expect(pedidos).toHaveLength(2);
    expect(pedidos[0].texto).toContain('Ya tengo como usuales: limones');
    expect(pedidos[0].texto).toContain('No me interesan (no los propongas): tomillo');
    expect(pedidos[1].texto).toContain('Huevo (duro: huevo)');
  });
});
