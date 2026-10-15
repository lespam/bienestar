<script lang="ts">
  import type { PerfilComida, Receta } from '../../core/db';
  import { filtros } from './estado.svelte';

  let { recetas, perfiles, foto = false }: { recetas: Receta[]; perfiles: Record<'les' | 'jeff', Pick<PerfilComida, 'no'>>; foto?: boolean } = $props();

  const fuentes = $derived([...new Set(recetas.map((r) => r.origen ?? 'Mías'))].sort((a, b) => a.localeCompare(b, 'es')));
  $effect(() => { if (filtros.origen !== 'todo' && fuentes.length && !fuentes.includes(filtros.origen)) filtros.origen = 'todo'; });
</script>

{#if fuentes.length > 1}
  <label class="rc-fuente"><span>Fuente</span>
    <select bind:value={filtros.origen}>
      <option value="todo">Todas las fuentes</option>
      {#each fuentes as f (f)}<option value={f}>{f}</option>{/each}
    </select>
  </label>
{/if}
<div class:rc-dos={foto}>
  <label class="rc-fuente"><span>Uso</span>
    <select bind:value={filtros.uso}>
      <option value="todo">Todas</option>
      <option value="usadas">Las que ya usas</option>
      <option value="nunca">Nunca usadas</option>
    </select>
  </label>
  {#if foto}
    <label class="rc-fuente"><span>Foto</span>
      <select bind:value={filtros.foto}>
        <option value="todo">Con y sin foto</option>
        <option value="con">Con foto</option>
        <option value="sin">Sin foto</option>
      </select>
    </label>
  {/if}
</div>
{#if perfiles.les.no.length || perfiles.jeff.no.length}
  <div class="m-chips" role="group" aria-label="Quitar lo que no les gusta">
    {#if perfiles.les.no.length}<button class:on={filtros.sinLes} aria-pressed={filtros.sinLes} onclick={() => (filtros.sinLes = !filtros.sinLes)}>Sin lo que no te gusta</button>{/if}
    {#if perfiles.jeff.no.length}<button class:on={filtros.sinJeff} aria-pressed={filtros.sinJeff} onclick={() => (filtros.sinJeff = !filtros.sinJeff)}>Sin lo que no le gusta a Jeff</button>{/if}
  </div>
{/if}
