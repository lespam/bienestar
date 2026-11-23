import { describe, expect, it } from 'vitest';
import { leerTextoHay, mezclarHay, tengo, vigente } from '../../src/modules/comida/nevera';

describe('Con lo que tengo: leer el texto sin IA', () => {
  it('separa por comas y por «y», con cantidades', () => {
    const r = leerTextoHay('tengo pollo, 3 jitomates, medio aguacate y yogurt');
    expect(r.map((x) => x.n)).toEqual(['Pollo', 'Jitomates', 'Aguacate', 'Yogurt']);
    expect(r[1].q).toBe('3');
    expect(r[2].q).toBe('medio');
    expect(r[0].q).toBeUndefined();
  });
  it('entiende unidades y «un poco de»', () => {
    const r = leerTextoHay('2 latas de atún, un poco de crema, 500g de arroz');
    expect(r[0]).toMatchObject({ n: 'Atún', q: '2 latas' });
    expect(r[1]).toMatchObject({ n: 'Crema', q: 'un poco' });
    expect(r[2]).toMatchObject({ n: 'Arroz', q: '500g' });
  });
  it('marca «usar pronto»', () => {
    const r = leerTextoHay('espinaca (urgente), queso');
    expect(r[0]).toMatchObject({ n: 'Espinaca', urgente: true });
    expect(r[1].urgente).toBeUndefined();
  });
  it('un texto vacío no inventa nada', () => {
    expect(leerTextoHay('  ')).toEqual([]);
    expect(leerTextoHay('tengo')).toEqual([]);
  });
});

describe('Lo que hay hoy', () => {
  it('no repite el mismo alimento y conserva lo nuevo', () => {
    const r = mezclarHay([{ n: 'Pollo', q: '1 pieza' }], [{ n: 'pollo', q: '2 piezas', urgente: true }, { n: 'Arroz' }]);
    expect(r).toHaveLength(2);
    expect(r[0]).toMatchObject({ q: '2 piezas', urgente: true });
  });
  it('sabe si un artículo de la lista ya está en casa', () => {
    const hay = [{ n: 'Jitomates' }, { n: 'Pollo' }];
    expect(tengo('Jitomate', hay)).toBe(true);
    expect(tengo('Pechuga de pollo', hay)).toBe(true);
    expect(tengo('Cebolla', hay)).toBe(false);
  });
  it('la lista deja de contar después de unos días', () => {
    const g = { fecha: '2026-11-20', items: [{ n: 'Pollo' }] };
    expect(vigente(g, '2026-11-22')).toHaveLength(1);
    expect(vigente(g, '2026-11-25')).toEqual([]);
    expect(vigente(null, '2026-11-25')).toEqual([]);
  });
});
