<script lang="ts">
  import type { PerfilComida, Receta } from '../../core/db';
  import { filtros } from './estado.svelte';
  import { etiquetasDe } from './calculos';

  let { recetas, perfiles, foto = false, mostrando, total }: { recetas: Receta[]; perfiles: Record<'les' | 'jeff', Pick<PerfilComida, 'no'> & { niveles?: PerfilComida['niveles'] }>; foto?: boolean; mostrando?: number; total?: number } = $props();
  const etiquetas = $derived([...new Set(recetas.flatMap((r) => etiquetasDe(r)))].sort((a, b) => a.localeCompare(b, 'es')));
  const hayGuardadas = $derived(recetas.some((r) => r.vis === 'guardada'));
  const activos = $derived([
    filtros.origen !== 'todo' ? { t: 'De ' + filtros.origen, q: () => (filtros.origen = 'todo') } : null,
    filtros.uso === 'nunca' ? { t: 'Nunca usadas', q: () => (filtros.uso = 'todo') } : filtros.uso === 'usadas' ? { t: 'Ya usadas', q: () => (filtros.uso = 'todo') } : null,
    filtros.foto === 'con' ? { t: 'Con foto', q: () => (filtros.foto = 'todo') } : filtros.foto === 'sin' ? { t: 'Sin foto', q: () => (filtros.foto = 'todo') } : null,
    filtros.sinLes ? { t: 'Sin lo que no te gusta', q: () => (filtros.sinLes = false) } : null,
    filtros.sinJeff ? { t: 'Sin lo que no le gusta a Jeff', q: () => (filtros.sinJeff = false) } : null,
    filtros.etq ? { t: 'Etiqueta: ' + filtros.etq, q: () => (filtros.etq = '') } : null,
    filtros.hasta ? { t: 'Hasta ' + filtros.hasta + ' min', q: () => (filtros.hasta = 0) } : null,
    filtros.guardadas ? { t: 'Con guardadas', q: () => (filtros.guardadas = false) } : null
  ].filter((x) => x !== null));
  function quitarTodos() { filtros.origen = 'todo'; filtros.uso = 'todo'; filtros.foto = 'todo'; filtros.sinLes = false; filtros.sinJeff = false; filtros.guardadas = false; filtros.etq = ''; filtros.hasta = 0; }

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
  <label class="rc-fuente"><span>Etiqueta</span>
    <select bind:value={filtros.etq}>
      <option value="">Todas</option>
      {#each etiquetas as e (e)}<option value={e}>{e}</option>{/each}
    </select>
  </label>
  <label class="rc-fuente"><span>Tiempo</span>
    <select bind:value={filtros.hasta}>
      <option value={0}>Cualquiera</option>
      <option value={10}>Hasta 10 min</option>
      <option value={20}>Hasta 20 min</option>
      <option value={30}>Hasta 30 min</option>
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
{#if hayGuardadas}
  <div class="rc-view">
    <span id="rc-gu-l">Ver también las guardadas</span>
    <button class="sw" role="switch" aria-checked={!!filtros.guardadas} aria-labelledby="rc-gu-l" onclick={() => (filtros.guardadas = !filtros.guardadas)}><i></i></button>
  </div>
{/if}
{#if activos.length}
  <div class="m-chips" role="group" aria-label="Filtros activos">
    {#each activos as a (a.t)}<button class="on" aria-label={'Quitar filtro: ' + a.t} onclick={a.q}>{a.t} ×</button>{/each}
  </div>
{/if}
{#if mostrando != null && total != null}
  <p class="seg-help rc-cuenta" aria-live="polite">Mostrando {mostrando} de {total}{#if activos.length} · <button class="link-btn" onclick={quitarTodos}>Quitar filtros</button>{/if}</p>
{/if}
