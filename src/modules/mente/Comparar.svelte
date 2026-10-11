<script lang="ts">
  import type { AreaAlma, SemanaAlma } from '../../core/db';
  import { nav } from '../../core/nav.svelte';
  import { leerAreas, leerSemanas } from './datos';
  import { colorDe, DIAS, lunesDeSemana, rangoCorto, SEMANA_MAX, SEMANA_MIN } from './semanas';

  const datos = nav.pantalla?.datos as { a?: number; b?: number } | undefined;
  let a = $state(datos?.a ?? 0);
  let b = $state(datos?.b ?? -1);
  let vista = $state<'areas' | 'dias'>('areas');
  let areas = $state<AreaAlma[]>([]);
  let semanas = $state<Record<number, SemanaAlma>>({});

  const ks = Array.from({ length: SEMANA_MAX - SEMANA_MIN + 1 }, (_, i) => SEMANA_MIN + i);
  (async () => {
    areas = await leerAreas();
    const lista = await leerSemanas(ks.map((k) => lunesDeSemana(k)));
    semanas = Object.fromEntries(ks.map((k, i) => [k, lista[i]]));
  })();
</script>

<header class="cur-head">
  <button class="back" aria-label="Volver" onclick={() => nav.cerrar()}>‹ Volver</button>
</header>
<div class="screen">
  <div class="tl-head">
    <h2 tabindex="-1">Comparar semanas</h2>
    <p class="seg-help">Un momento para mirar tu progreso y ver qué quieres ajustar. No hay marcas de cumplimiento.</p>
  </div>
  <span class="sh-lbl">Semana</span>
  <div class="m-chips" role="radiogroup" aria-label="Primera semana">
    {#each ks as k (k)}<button role="radio" class:on={k === a} aria-checked={k === a} onclick={() => (a = k)}>{rangoCorto(lunesDeSemana(k))}</button>{/each}
  </div>
  <span class="sh-lbl">Comparada con</span>
  <div class="m-chips" role="radiogroup" aria-label="Segunda semana">
    {#each ks as k (k)}<button role="radio" class:on={k === b} aria-checked={k === b} onclick={() => (b = k)}>{rangoCorto(lunesDeSemana(k))}</button>{/each}
  </div>
  {#if a === b}<p class="tool-note left">Elegiste la misma semana dos veces.</p>{/if}
  <div class="seg seg2" role="tablist" aria-label="Qué comparar">
    <button role="tab" class:on={vista === 'areas'} aria-selected={vista === 'areas'} onclick={() => (vista = 'areas')}>Áreas</button>
    <button role="tab" class:on={vista === 'dias'} aria-selected={vista === 'dias'} onclick={() => (vista = 'dias')}>Días</button>
  </div>

  {#snippet bloque(k: number, txt: string, cls: string)}
    <div class={'cmp-b ' + cls}><small>{rangoCorto(lunesDeSemana(k))}</small>{#if txt.trim()}<p>{txt}</p>{:else}<p class="none">Sin nada escrito</p>{/if}</div>
  {/snippet}

  <div class="pl-list">
    {#if semanas[a] && semanas[b]}
      {#if vista === 'areas'}
        {#each areas as ar (ar.id)}
          <div class="pl-card" style:--c={colorDe(ar)}>
            <div class="pl-ch pl-ar"><b>{ar.nombre}</b></div>
            {@render bloque(a, semanas[a].areas[ar.id!] ?? '', 'a')}
            {@render bloque(b, semanas[b].areas[ar.id!] ?? '', 'b')}
          </div>
        {/each}
      {:else}
        {#each DIAS as d, i (d)}
          <div class="pl-card">
            <div class="pl-ch"><b>{d}</b></div>
            {@render bloque(a, semanas[a].dias[i] ?? '', 'a')}
            {@render bloque(b, semanas[b].dias[i] ?? '', 'b')}
          </div>
        {/each}
      {/if}
    {/if}
  </div>
</div>
