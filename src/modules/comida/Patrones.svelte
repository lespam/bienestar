<script lang="ts">
  import type { DiaFlexible, ItemMenu } from '../../core/db';
  import { nav } from '../../core/nav.svelte';
  import { fasesEn } from '../cuerpo';
  import { fechaDe } from './calculos';
  import { leerFlexibles, menuDe, sembrarRecetas } from './datos';
  import {
    DIMENSIONES, LUGAR_PLURAL, MIN_REGISTROS, SEMANAS_PATRONES, contarFlex, contextoDe, dinero, fechaBreve, lunesDe, notaFlex, patronMenus, patronTakeout, recientes, sumar, vecesTxt,
    type DimFlex, type RegistroFlex
  } from './patrones';

  const hoy = fechaDe(0);
  let principal = $state<'flex' | 'menus' | 'take'>('flex');
  let dim = $state<DimFlex>('dia');
  let regs = $state<RegistroFlex[]>([]);
  let items = $state<ItemMenu[]>([]);
  let listo = $state(false);

  (async () => {
    await sembrarRecetas();
    const flex: DiaFlexible[] = await leerFlexibles();
    const fases = await fasesEn(flex.map((f) => f.fecha));
    regs = flex.map((f) => ({ ...f, ciclo: fases[f.fecha]?.fase ?? null }));
    const lunes = lunesDe(hoy);
    items = await menuDe(Array.from({ length: (SEMANAS_PATRONES + 1) * 7 }, (_, i) => sumar(lunes, i - SEMANAS_PATRONES * 7)));
    listo = true;
  })();

  const rec = $derived(recientes(regs, hoy));
  const conteo = $derived(contarFlex(rec, dim));
  const menus = $derived(patronMenus(items, hoy));
  const take = $derived(patronTakeout(items, hoy));
  const ayuda = $derived(principal === 'flex' ? 'Lo que se repite en tus días flexibles. Es curiosidad, no una calificación.' : principal === 'menus' ? 'Lo que se repite en tus menús. Es curiosidad, no una calificación.' : 'Cuánto y cuándo piden takeout. Es información, no una calificación.');
  const maxBarras = (filas: [string, number][]) => Math.max(...filas.map((r) => r[1]), 0) || 1;
  const libreMax = $derived(menus.libresPorLugar.indexOf(Math.max(...menus.libresPorLugar)));
  const formasFilas = $derived<[string, number][]>([['Los dos', menus.formas.f], ['Cada quien', menus.formas.s], ['Takeout', menus.formas.t], ['Libre', menus.formas.l]]);
</script>

{#snippet barras(filas: [string, number][], fmt?: (n: number) => string, ancho?: number)}
  {@const max = maxBarras(filas)}
  <div class="pat-bars" class:pat-money={!!fmt || !!ancho} role="list" style={ancho ? '--lw:' + ancho + 'px' : undefined}>
    {#each filas as r (r[0])}
      <div class="pat-row" role="listitem"><span>{r[0]}</span><i><b style:width={(r[1] / max) * 100 + '%'}></b></i><em>{fmt ? fmt(r[1]) : r[1]}</em></div>
    {/each}
  </div>
{/snippet}

<header class="cur-head">
  <button class="back" aria-label="Volver" onclick={() => nav.cerrar()}>‹ Volver</button>
</header>
<div class="screen">
  <div class="tl-head">
    <h2 tabindex="-1">Patrones</h2>
    <p class="seg-help">{ayuda}</p>
    <div class="seg pat-main" role="tablist" aria-label="Qué patrones ver">
      {#each [['flex', 'Flexibles'], ['menus', 'Menús'], ['take', 'Takeouts']] as [k, t] (k)}
        <button role="tab" class:on={principal === k} aria-selected={principal === k} onclick={() => (principal = k as typeof principal)}>{t}</button>
      {/each}
    </div>
    {#if principal === 'flex'}
      <div class="seg pat-tabs" role="tablist" aria-label="Ver por">
        {#each Object.entries(DIMENSIONES) as [k, d] (k)}
          <button role="tab" class:on={dim === k} aria-selected={dim === k} onclick={() => (dim = k as DimFlex)}>{d.t}</button>
        {/each}
      </div>
    {/if}
  </div>

  <section class="pf-card" aria-label="Patrón">
    <div>
      {#if !listo}
        <p class="pat-empty">Cargando…</p>
      {:else if principal === 'flex'}
        {#if rec.length < MIN_REGISTROS}
          <p class="pat-empty">Con {MIN_REGISTROS} registros empiezan a verse patrones. Llevas {rec.length}.</p>
        {:else if !conteo.conocidos}
          <p class="pat-empty">Ninguno de tus {rec.length} registros tiene este dato todavía.{dim === 'ciclo' ? ' Marca tu Período en Cuerpo y aparece aquí.' : ''}</p>
        {:else}
          <p class="pat-note">{notaFlex(dim, conteo.top, conteo.cnt[conteo.top], conteo.conocidos)}</p>
          <div class="pat-bars" role="list">
            {#each conteo.op as o (o)}
              <div class="pat-row" role="listitem"><span>{o}</span><i><b style:width={(conteo.cnt[o] / conteo.max) * 100 + '%'}></b></i><em>{conteo.cnt[o]}</em></div>
            {/each}
          </div>
          {#if conteo.conocidos < rec.length}<p class="tool-note left">{rec.length - conteo.conocidos} registro{rec.length - conteo.conocidos > 1 ? 's' : ''} sin este dato.</p>{/if}
        {/if}
      {:else if principal === 'menus'}
        {#if !menus.platos.length}
          <p class="pat-empty">Aún no hay menús guardados de las últimas {SEMANAS_PATRONES} semanas.</p>
        {:else}
          <p class="pat-note">{menus.platos[0][0]} fue lo que más se repitió: {menus.platos[0][1]} {menus.platos[0][1] === 1 ? 'vez' : 'veces'} en {SEMANAS_PATRONES} semanas. Solo para que lo notes.</p>
          <h4>Lo que más se repite</h4>
          {@render barras(menus.platos, undefined, 150)}
          <h4 class="pat-sub">Cómo comieron</h4>
          {@render barras(formasFilas)}
          <p class="tool-note left">{LUGAR_PLURAL[libreMax]} son las que más quedaron libres ({menus.libresPorLugar[libreMax]} de {menus.total}). Libre también es parte del plan.</p>
        {/if}
      {:else}
        {#if !take.hay}
          <p class="pat-empty">Aún no hay takeouts anotados. Cuando registres uno con su ticket, aquí aparece cuánto y cuándo.</p>
        {:else}
          <p class="pat-note">En las últimas {SEMANAS_PATRONES} semanas gastaron {dinero(take.total8)} en takeout, unos {dinero(take.porSemana8)} por semana.</p>
          <div class="stats">
            <div class="stat"><span>{take.nombreMesActual[0].toUpperCase() + take.nombreMesActual.slice(1)}, hasta ahora</span><b>{dinero(take.mesActual.total)}</b><small>{vecesTxt(take.mesActual.n)}</small></div>
            <div class="stat"><span>{take.nombreMesPasado[0].toUpperCase() + take.nombreMesPasado.slice(1)}</span><b>{dinero(take.mesPasado.total)}</b><small>{vecesTxt(take.mesPasado.n)}</small></div>
          </div>
          <h4 class="pat-sub">Por semana</h4>
          {@render barras(take.semanas, dinero)}
          <h4 class="pat-sub">Dónde piden</h4>
          {@render barras(take.lugares, undefined, 128)}
          <h4 class="pat-sub">Qué día</h4>
          {@render barras(take.dias)}
          <p class="tool-note left">No hay una cantidad correcta. Sirve para saber cuánto cuesta y decidir con calma.</p>
        {/if}
      {/if}
    </div>
    <small class="pat-count">{principal === 'flex' ? (rec.length >= MIN_REGISTROS ? 'Con ' + rec.length + ' registros de las últimas ' + SEMANAS_PATRONES + ' semanas.' : '') : principal === 'menus' ? 'Con el menú de las últimas ' + SEMANAS_PATRONES + ' semanas.' : 'Con los tickets de las últimas ' + SEMANAS_PATRONES + ' semanas, más esta.'}</small>
  </section>

  {#if principal === 'flex'}
    <section class="tp-sec">
      <h4>Últimos registros</h4>
      <div class="group pat-list">
        {#each rec.slice(0, 3) as r (r.fecha)}
          <div class="pat-it"><b>{fechaBreve(r.fecha)}</b><span class="pat-ch">{#each contextoDe(r) as x (x)}<i>{x}</i>{/each}</span>{#if r.comi}<small>{r.comi}</small>{/if}</div>
        {:else}
          <p class="tp-none">Aquí aparecen los días flexibles que registres.</p>
        {/each}
      </div>
    </section>
    <button class="add" onclick={() => nav.abrir('flexible')}>+ Registrar un día flexible</button>
  {/if}
  <p class="tool-note">La app no da consejos médicos. Si algo te preocupa, habla con tu nutrióloga o tu terapeuta.</p>
</div>
