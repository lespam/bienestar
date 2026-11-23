import { describe, expect, it } from 'vitest';
import type { ItemMenu, Tanda } from '../../src/core/db';
import { porDiaYUrgencia, ponerEnOrden, aLaHora, cuandoTxt, estTxt, filaDeTanda, horaTxt, platosDe, sincronizar, sumarDias, tandasDeSemana, ultimoDia } from '../../src/modules/comida/preparacion';

const HOY = '2026-10-11'; // domingo
let n = 0;
const id = () => 'id' + n++;
const dos = (fecha: string, lugar: ItemMenu['lugar'], nombre: string): ItemMenu => ({ fecha, lugar, t: 'dos', n: nombre, r: nombre });

describe('plan de preparación', () => {
  it('suma días', () => {
    expect(sumarDias('2026-10-31', 1)).toBe('2026-11-01');
    expect(sumarDias('2026-10-01', -1)).toBe('2026-09-30');
  });
  it('platos que se pueden preparar', () => {
    expect(platosDe(dos(HOY, 'c', 'Tinga'))).toEqual(['Tinga']);
    expect(platosDe({ fecha: HOY, lugar: 'c', t: 'cada', n: 'x', nl: 'Tinga', nj: 'Tinga' })).toEqual(['Tinga']);
    expect(platosDe({ fecha: HOY, lugar: 'c', t: 'cada', n: 'x', nl: 'Tinga', nj: 'Tacos' })).toEqual(['Tinga', 'Tacos']);
    expect(platosDe({ fecha: HOY, lugar: 'c', t: 'takeout', n: 'Pizza' })).toEqual([]);
    expect(platosDe({ fecha: HOY, lugar: 'c', t: 'decidir', n: 'Por decidir' })).toEqual([]);
  });
  it('agrega la preparación el día anterior, o hoy si ya no hay tiempo', () => {
    const t = sincronizar([], [dos('2026-10-14', 'c', 'Tinga de pollo'), dos(HOY, 'n', 'Tacos')], ['2026-10-14', HOY], HOY, id);
    expect(t.map((x) => x.fecha)).toEqual([HOY, '2026-10-13']);
    expect(t[0].items[0]).toMatchObject({ t: 'Preparar tacos', f: 'Para la cena del domingo', fm: HOY + ':n', ok: false });
    expect(t[1].items[0]).toMatchObject({ t: 'Preparar tinga de pollo', f: 'Para la comida del miércoles' });
    expect(t[1]).toMatchObject({ hora: '20:00', auto: true });
  });
  it('desayuno usa «el»', () => {
    const t = sincronizar([], [dos('2026-10-14', 'd', 'Avena')], ['2026-10-14'], HOY, id);
    expect(t[0].items[0].f).toBe('Para el desayuno del miércoles');
  });
  it('al cambiar la comida quita lo no hecho, conserva lo hecho y lo tuyo, y no se repite', () => {
    const menu = [dos('2026-10-14', 'c', 'Tinga')];
    let t = sincronizar([], menu, ['2026-10-14'], HOY, id);
    t[0].items[0].ok = true;
    t[0].items.push({ t: 'Lavar la lechuga', f: '', ok: false });
    // mismo plato otra vez: no se duplica
    t = sincronizar(t, menu, ['2026-10-14'], HOY, id);
    expect(t[0].items.map((i) => i.t)).toEqual(['Preparar tinga', 'Lavar la lechuga']);
    // otro plato: la tinga hecha se queda
    t = sincronizar(t, [dos('2026-10-14', 'c', 'Tacos')], ['2026-10-14'], HOY, id);
    expect(t[0].items.map((i) => i.t)).toEqual(['Preparar tinga', 'Lavar la lechuga', 'Preparar tacos']);
    // la comida se quita: lo no hecho se va
    t = sincronizar(t, [], ['2026-10-14'], HOY, id);
    expect(t[0].items.map((i) => i.t)).toEqual(['Preparar tinga', 'Lavar la lechuga']);
  });
  it('una tanda hecha por el menú se va cuando queda vacía; una tuya no', () => {
    let t = sincronizar([], [dos('2026-10-14', 'c', 'Tinga')], ['2026-10-14'], HOY, id);
    t = sincronizar(t, [], ['2026-10-14'], HOY, id);
    expect(t).toEqual([]);
    const mia: Tanda = { id: 'm', fecha: HOY, hora: '', items: [] };
    expect(sincronizar([mia], [], ['2026-10-14'], HOY, id)).toEqual([mia]);
  });
  it('no toca otros días ni agrega para comidas pasadas', () => {
    const otra: Tanda = { id: 'o', fecha: '2026-10-12', hora: '20:00', auto: true, items: [{ t: 'Preparar x', f: '', ok: false, fm: '2026-10-13:c' }] };
    const t = sincronizar([otra], [dos('2026-10-09', 'c', 'Viejo')], ['2026-10-09'], HOY, id);
    expect(t).toEqual([otra]);
  });
  it('último día: la víspera de la primera comida que sigue pendiente', () => {
    const [t] = sincronizar([], [dos('2026-10-14', 'c', 'A'), dos('2026-10-16', 'c', 'B')], ['2026-10-14', '2026-10-16'], HOY, id);
    // las dos caen en tandas distintas; juntarlas a mano
    const junta: Tanda = { ...t, items: [...t.items, { t: 'Preparar b', f: '', ok: false, fm: '2026-10-16:c' }] };
    expect(ultimoDia(junta, HOY)).toBe('2026-10-13');
    expect(ultimoDia({ id: 'x', fecha: HOY, hora: '', items: [] }, HOY)).toBe('2026-10-17');
    expect(ultimoDia({ ...junta, items: [{ t: 'a', f: '', ok: false, fm: '2026-10-11:c' }] }, HOY)).toBe(HOY);
  });
  it('tandas de una semana: desde el domingo anterior', () => {
    const mk = (fecha: string): Tanda => ({ id: fecha, fecha, hora: '', items: [] });
    const dias = ['2026-10-12', '2026-10-13', '2026-10-14', '2026-10-15', '2026-10-16', '2026-10-17', '2026-10-18'];
    expect(tandasDeSemana([mk('2026-10-19'), mk('2026-10-18'), mk('2026-10-11'), mk('2026-10-10')], dias).map((x) => x.fecha)).toEqual(['2026-10-11', '2026-10-18']);
  });
  it('en el mismo día va primero lo que se come antes, y lo que pasas a hoy se acomoda en su lugar', () => {
    const it = (fm: string, t = 'x'): Tanda['items'][number] => ({ t, f: '', ok: false, fm });
    const miercoles: Tanda = { id: 'a', fecha: '2026-10-13', hora: '20:00', items: [it('2026-10-14:c')] };
    const movida: Tanda = { id: 'b', fecha: '2026-10-13', hora: '20:00', items: [it('2026-10-13:c')] };
    expect([miercoles, movida].sort(porDiaYUrgencia).map((x) => x.id)).toEqual(['b', 'a']);
    const items = [it('2026-10-14:c', 'miércoles'), { t: 'Lavar lechuga', f: '', ok: false }];
    ponerEnOrden(items, it('2026-10-13:n', 'martes noche'));
    expect(items.map((x) => x.t)).toEqual(['martes noche', 'miércoles', 'Lavar lechuga']);
    ponerEnOrden(items, it('2026-10-13:d', 'martes desayuno'));
    expect(items.map((x) => x.t)).toEqual(['martes desayuno', 'martes noche', 'miércoles', 'Lavar lechuga']);
  });
  it('textos', () => {
    expect(horaTxt('20:00')).toBe('8 pm');
    expect(horaTxt('08:30')).toBe('8:30 am');
    expect(horaTxt('00:00')).toBe('12 am');
    expect(aLaHora('13:00')).toBe('a la 1 pm');
    expect(aLaHora('20:00')).toBe('a las 8 pm');
    expect(estTxt(25)).toBe('unos 25 min');
    expect(estTxt(90)).toBe('1 h 30 min aprox.');
    expect(cuandoTxt({ id: 'x', fecha: HOY, hora: '', items: [] }, HOY)).toBe('Sin hora');
    expect(cuandoTxt({ id: 'x', fecha: HOY, hora: '20:00', items: [] }, HOY)).toBe('Hoy a las 8 pm');
  });
  it('la fila de Comida: hoy lo pendiente, otro día lo primero, lista si todo está hecho', () => {
    const t = sincronizar([], [dos(HOY, 'c', 'Tinga'), dos(HOY, 'n', 'Tacos')], [HOY], HOY, id);
    expect(filaDeTanda(t, HOY, HOY)).toEqual({ hora: '8 pm', titulo: 'Preparar tinga', mas: 'y 1 cosa más', lista: false });
    t[0].items[0].ok = true;
    expect(filaDeTanda(t, HOY, HOY)).toMatchObject({ titulo: 'Preparar tacos', mas: '' });
    t[0].items[1].ok = true;
    expect(filaDeTanda(t, HOY, HOY)).toMatchObject({ titulo: 'Lista', lista: true });
    expect(filaDeTanda(t, '2026-10-12', HOY)).toBeNull();
  });
});

describe('plan de preparación al calendario', () => {
  const t = (id: string, fecha: string, hora: string, items: { t: string; m?: number; ok?: boolean }[]) => ({ id, fecha, hora, items: items.map((i) => ({ t: i.t, f: '', ...(i.m ? { m: i.m } : {}), ok: !!i.ok })) }) as Tanda;
  it('una cita por tanda pendiente de hoy en adelante, en orden, con hora por defecto', async () => {
    const { eventosDePrep } = await import('../../src/modules/comida/preparacion');
    const ev = eventosDePrep([
      t('b', '2026-11-25', '', [{ t: 'Cortar fresas', m: 5 }, { t: 'Cocer arroz', m: 25 }]),
      t('a', '2026-11-24', '19:30', [{ t: 'Sacar el pollo', m: 5 }]),
      t('c', '2026-11-22', '19:00', [{ t: 'Atrasada' }]),
      t('d', '2026-11-26', '18:00', [{ t: 'Ya hecha', ok: true }])
    ], '2026-11-23');
    expect(ev.map((e) => e.id)).toEqual(['prep-a', 'prep-b']);
    expect(ev[0]).toMatchObject({ titulo: 'Preparar: Sacar el pollo', fecha: '2026-11-24', hora: '19:30', minutos: 5 });
    expect(ev[1]).toMatchObject({ hora: '20:00', minutos: 30, titulo: 'Preparar: Cortar fresas, Cocer arroz' });
    expect(ev[1].nota).toBe('• Cortar fresas (5 min)\n• Cocer arroz (25 min)');
  });
});

describe('repartir un día cargado', () => {
  const item = (t: string, fm: string, m = 20, ok = false) => ({ t, f: '', m, ok, fm }) as Tanda['items'][number];
  const base = (): Tanda[] => [{ id: 'x', fecha: '2026-11-25', hora: '20:00', auto: true, items: [item('Desayuno 26', '2026-11-26:d'), item('Comida 26', '2026-11-26:c'), item('Cena 26', '2026-11-26:n'), item('Cena 26 b', '2026-11-26:n'), item('Comida 26 b', '2026-11-26:c'), { t: 'Lavar la lechuga', f: '', m: 15, ok: false }] }];

  it('propone pasar al día anterior lo de las comidas que vienen después, hasta quedar en el límite', async () => {
    const { repartoPropuesto, LIMITE_DIA } = await import('../../src/modules/comida/preparacion');
    const r = repartoPropuesto(base(), '2026-11-25', '2026-11-23')!;
    expect(LIMITE_DIA).toBe(90);
    expect(r).toMatchObject({ de: '2026-11-25', a: '2026-11-24', antes: 115, quedan: 75, pasan: 40 });
    expect(r.mover.map((m) => base()[0].items[m.n].t)).toEqual(['Cena 26', 'Cena 26 b']);
  });
  it('no propone nada si no está cargado, si el día anterior ya pasó o si no cabe', async () => {
    const { repartoPropuesto } = await import('../../src/modules/comida/preparacion');
    expect(repartoPropuesto(base().map((t) => ({ ...t, items: t.items.slice(0, 3) })), '2026-11-25', '2026-11-23')).toBeNull();
    expect(repartoPropuesto(base(), '2026-11-25', '2026-11-25')).toBeNull();
    const lleno: Tanda = { id: 'y', fecha: '2026-11-24', hora: '', items: [item('a', '2026-11-25:c', 80), item('b', '2026-11-25:n', 50)] };
    expect(repartoPropuesto([...base(), lleno], '2026-11-25', '2026-11-23')).toBeNull();
  });
  it('aplica el reparto sin tocar la lista original, deja lo que escribiste y crea la tanda del día anterior', async () => {
    const { repartoPropuesto, aplicarReparto } = await import('../../src/modules/comida/preparacion');
    const orig = base();
    const r = repartoPropuesto(orig, '2026-11-25', '2026-11-23')!;
    const nueva = aplicarReparto(orig, r, () => 'nuevo');
    expect(orig[0].items).toHaveLength(6);
    expect(nueva.map((t) => [t.id, t.fecha, t.items.map((i) => i.t)])).toEqual([
      ['nuevo', '2026-11-24', ['Cena 26', 'Cena 26 b']],
      ['x', '2026-11-25', ['Desayuno 26', 'Comida 26', 'Comida 26 b', 'Lavar la lechuga']]
    ]);
  });
});
