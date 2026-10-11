<script lang="ts">
  import type { ItemPrep, Tanda } from '../../core/db';
  import Hoja from '../../core/Hoja.svelte';
  import { avisos } from '../../core/aviso.svelte';
  import { nav } from '../../core/nav.svelte';
  import { cap, fechaDe } from './calculos';
  import { AnfitrionIA, ordenarPreparacion, pedirIA } from '../ia';
  import { guardarPrep, leerPrep } from './datos';
  import { cuandoTxt, diaTanda, estTxt, hechas, horaTxt, idTanda, minutosPendientes, preparoTxt, sumarDias, tandasDeSemana, ultimoDia } from './preparacion';
  import { fechasDeSemana, LETRA_DIA, numeroDia, etiquetaFecha, rangoSemana } from './semana';

  const semana = (nav.pantalla?.datos as { k?: number } | undefined)?.k ?? 0;
  const dias = fechasDeSemana(semana);
  const hoy = fechaDe(0);

  let todas = $state<Tanda[]>([]);
  let listo = $state(false);
  let abiertas = $state<Record<string, boolean>>({});
  let agregando = $state('');
  let nuevo = $state('');

  leerPrep().then((t) => {
    todas = t;
    for (const x of tandasDeSemana(t, dias)) abiertas[x.id] = !(x.fecha < hoy && x.items.every((i) => i.ok));
    listo = true;
  });

  const tandas = $derived(tandasDeSemana(todas, dias));
  const preparadas = $derived(tandas.reduce((a, t) => a + hechas(t), 0));
  const guardar = () => guardarPrep($state.snapshot(todas));

  function marcar(i: ItemPrep, v: boolean) { i.ok = v; guardar(); }

  function pasarAHoy(t: Tanda, i: ItemPrep) {
    const desde = t;
    const pos = desde.items.indexOf(i);
    let hoyT = todas.find((x) => x.fecha === hoy);
    let creada = false;
    if (!hoyT) { todas.push({ id: idTanda(), fecha: hoy, hora: '', items: [] }); hoyT = todas[todas.length - 1]; creada = true; }
    const [item] = desde.items.splice(pos, 1);
    hoyT.items.push(item);
    guardar();
    const idHoy = hoyT.id;
    avisos.deshacer('Pasó a hoy', () => {
      const h = todas.find((x) => x.id === idHoy);
      const o = todas.find((x) => x.id === desde.id);
      if (!h || !o) return;
      h.items = h.items.filter((x) => x.t !== item.t || x.f !== item.f);
      o.items.splice(pos, 0, item);
      if (creada && !h.items.length) todas = todas.filter((x) => x.id !== idHoy);
      guardar();
    });
  }

  function abrirAgregar(t: Tanda) { agregando = t.id; nuevo = ''; }
  function agregarItem(t: Tanda) {
    const v = nuevo.trim();
    if (!v) { avisos.mostrar('Escribe qué vas a preparar'); return; }
    const item: ItemPrep = { t: cap(v), f: '', ok: false };
    t.items.push(item);
    agregando = '';
    guardar();
    avisos.deshacer('Agregado a esta tanda', () => { t.items = t.items.filter((x) => x.t !== item.t); guardar(); });
  }

  // ---------- Ordenar con IA (opcional) ----------
  const llaveItem = (i: ItemPrep) => i.t + '|' + i.f;
  function ordenarIA() {
    const t = tandas.find((x) => x.fecha >= hoy && x.items.filter((i) => !i.ok).length > 1);
    if (!t) { avisos.mostrar('No hay nada más que ordenar por ahora'); return; }
    const id = t.id, cuando = diaTanda(t.fecha, hoy).toLowerCase(), pend = t.items.filter((i) => !i.ok).map((i) => ({ t: i.t, f: i.f, m: i.m }));
    pedirIA({
      fn: 'prep', titulo: 'Ayuda con IA', envia: 'los nombres y tiempos de tus tandas',
      ejecutar: async (clave) => {
        const orden = (await ordenarPreparacion(clave, pend.map((i) => ({ t: i.t, m: i.m })))).map((n) => pend[n]);
        return {
          intro: 'Para la tanda de ' + cuando + ': empieza por lo que más tarda y deja lo rápido para el final.',
          items: [{
            t: orden.map((it, n) => (n + 1) + '. ' + it.t + (it.m ? ' (' + it.m + ' min)' : '')).join('  '), sub: 'Así lo largo se cocina mientras haces lo demás.', act: 'Usar este orden',
            aplicar: () => {
              const tt = todas.find((x) => x.id === id);
              if (!tt) return;
              const antes = $state.snapshot(todas) as Tanda[];
              const hechasAntes = tt.items.filter((i) => i.ok), faltan = tt.items.filter((i) => !i.ok);
              const colocadas = orden.map((o) => faltan.find((i) => llaveItem(i) === llaveItem(o as ItemPrep))).filter((i): i is ItemPrep => !!i);
              tt.items = [...hechasAntes, ...colocadas, ...faltan.filter((i) => !colocadas.includes(i))];
              guardar();
              avisos.deshacer('Orden actualizado', () => { todas = antes; guardar(); });
            }
          }]
        };
      }
    });
  }

  // ---------- Cuándo preparas ----------
  let editando = $state('');
  let dia = $state(hoy);
  let hora = $state('20:00');
  const tandaEdit = $derived(todas.find((x) => x.id === editando));
  const ultimo = $derived(tandaEdit ? ultimoDia(tandaEdit, hoy) : hoy);
  const diasEleg = $derived(Array.from({ length: 7 }, (_, i) => sumarDias(hoy, i)));
  const letraDe = (f: string) => LETRA_DIA[(new Date(+f.slice(0, 4), +f.slice(5, 7) - 1, +f.slice(8, 10)).getDay() + 6) % 7];
  function abrirCuando(t: Tanda) { editando = t.id; dia = t.fecha < hoy ? hoy : t.fecha; hora = t.hora || '20:00'; nav.abrirHoja('pp-cuando'); }
  function guardarCuando() {
    const t = tandaEdit;
    if (!t) return;
    t.fecha = dia;
    t.hora = hora || '20:00';
    guardar();
    nav.cerrar();
    avisos.mostrar('Guardado. ' + cuandoTxt(t, hoy) + '.');
  }
  const porqueTxt = (t: Tanda) => {
    const p = t.items.filter((i) => !i.ok && i.fm);
    return p.length ? 'Esta tanda es para ' + p.map((i) => i.t.replace(/^Preparar /, '')).slice(0, 3).join(', ') + '. Debe quedar lista el ' + etiquetaFecha(ultimoDia(t, hoy)).toLowerCase() + ' como tarde.' : 'Elige el día y la hora de esta tanda.';
  };
</script>

<header class="cur-head">
  <button class="back" aria-label="Volver" onclick={() => nav.cerrar()}>‹ Volver</button>
  <span class="rest-next">Menú {rangoSemana(dias)}</span>
</header>
<div class="screen">
  <div class="tl-head">
    <h2 tabindex="-1">Plan de preparación</h2>
    <p class="seg-help">Lo que conviene cocinar antes, según el menú de la semana. Va en tandas para que todo se coma fresco.</p>
  </div>
  {#if preparadas}<p class="coach">{preparoTxt(preparadas)}</p>{/if}
  <div class="pp-list">
    {#if listo && !tandas.length}
      <p class="tool-note">Aún no hay nada por preparar. Cuando elijas recetas en el menú, aquí aparece qué cocinar antes y cuándo.</p>
    {/if}
    {#each tandas as t (t.id)}
      {@const k = hechas(t)}
      {@const todo = t.items.length > 0 && k === t.items.length}
      {@const pasada = t.fecha < hoy}
      {@const pend = t.items.filter((i) => !i.ok).length}
      {@const primero = t.items.findIndex((i) => !i.ok)}
      {#snippet cabeza()}
        <span><b id={'pp-h' + t.id}>{diaTanda(t.fecha, hoy)}</b><small>{pasada && t.hora ? horaTxt(t.hora) + ' · ' : ''}{k} de {t.items.length} listas{!pasada && !todo && minutosPendientes(t) ? ' · ' + estTxt(minutosPendientes(t)) : ''}</small></span>
        {#if todo}<span class="tag f">{pasada ? 'Hecha' : 'Lista'}</span>{:else if t.fecha === hoy}<span class="tag s">Hoy</span>{:else if !pasada}<span class="tag t">Próxima</span>{/if}
      {/snippet}
      {#snippet filas()}
        {#each t.items as i, n (i.t + n)}
          <div class="pp-it">
            <label class="wu-it" class:done={i.ok}>
              <input type="checkbox" checked={i.ok} onchange={(e) => marcar(i, e.currentTarget.checked)} />
              <span><b>{i.t}</b>{#if i.f}<small>{i.f}</small>{/if}{#if i.s}<em class="pp-s">{i.s}</em>{/if}{#if !pasada && pend > 1 && n === primero}<i class="pp-first">Empieza por aquí</i>{/if}</span>
              <small>{i.m ? i.m + ' min' : ''}</small>
            </label>
            {#if pasada && !i.ok}<button class="al-move" onclick={() => pasarAHoy(t, i)}>Pasar a hoy</button>{/if}
          </div>
        {/each}
      {/snippet}
      {#if pasada}
        <section class="pp-t" aria-labelledby={'pp-h' + t.id}>
          <button class="pp-th" aria-expanded={!!abiertas[t.id]} aria-controls={'pp-b' + t.id} onclick={() => (abiertas[t.id] = !abiertas[t.id])}>
            {@render cabeza()}
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 9l6 6 6-6" /></svg>
          </button>
          <div class="pp-b" id={'pp-b' + t.id} hidden={!abiertas[t.id]}>{@render filas()}</div>
        </section>
      {:else}
        <section class="pp-t" class:now={t.fecha === hoy} aria-labelledby={'pp-h' + t.id}>
          <div class="pp-th static">{@render cabeza()}</div>
          <div class="pp-b">
            <div class="when-row">
              <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>
              <span>{cuandoTxt(t, hoy)}</span>
              <button class="when-btn" aria-label="Cambiar cuándo preparas esta tanda" onclick={() => abrirCuando(t)}>Cambiar</button>
            </div>
            {@render filas()}
            {#if agregando === t.id}
              <div class="pf-add pp-add">
                <input type="text" aria-label="Agregar algo a esta tanda" placeholder="Ej. Lavar la lechuga" bind:value={nuevo} onkeydown={(e) => { if (e.key === 'Enter') { e.preventDefault(); agregarItem(t); } }} />
                <button onclick={() => agregarItem(t)}>Agregar</button>
              </div>
            {:else}
              <button class="add pp-add" onclick={() => abrirAgregar(t)}>+ Agregar algo</button>
            {/if}
          </div>
        </section>
      {/if}
    {/each}
  </div>
  {#if tandas.some((x) => x.fecha >= hoy && x.items.filter((i) => !i.ok).length > 1)}
    <button class="ghost" onclick={ordenarIA}>Ordenar mi preparación con IA</button>
  {/if}
  <p class="tool-note">Si cambias el menú, el plan se actualiza. Los tiempos son aproximados.</p>
</div>

{#if nav.hojaAbierta('pp-cuando') && tandaEdit}
  <Hoja titulo="Cuándo preparas">
    <p class="seg-help">{porqueTxt(tandaEdit)}</p>
    <span class="sh-lbl">Día</span>
    <div class="am-days" role="radiogroup" aria-label="Día" style:grid-template-columns="repeat(7, minmax(0, 1fr))">
      {#each diasEleg as f (f)}
        <button role="radio" class:on={dia === f} aria-checked={dia === f} aria-label={etiquetaFecha(f)} disabled={f > ultimo} onclick={() => (dia = f)}>{letraDe(f)}<b>{numeroDia(f)}</b></button>
      {/each}
    </div>
    <div class="man">
      <label for="pp-time">Hora</label><input id="pp-time" type="time" bind:value={hora} />
    </div>
    <p class="tool-note left">La app no puede avisarte a una hora exacta. Ese día lo verás en Comida, en «Hoy en tu menú».</p>
    <button class="start" onclick={guardarCuando}>Guardar</button>
  </Hoja>
{/if}

<AnfitrionIA />
