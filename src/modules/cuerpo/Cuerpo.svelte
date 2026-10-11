<script lang="ts">
  import Medidas from './Medidas.svelte';
  import Fotos from './Fotos.svelte';
  import Periodo from './Periodo.svelte';

  type Parte = 'med' | 'fot' | 'per';
  const PESTAÑAS: [Parte, string][] = [['med', 'Medidas'], ['fot', 'Fotos'], ['per', 'Período']];
  let parte = $state<Parte>('med');
</script>

<div class="screen">
  <div class="tl-head">
    <h2 tabindex="-1">Cuerpo</h2>
    <div class="seg" role="tablist" aria-label="Sección">
      {#each PESTAÑAS as [k, t] (k)}<button class:on={parte === k} role="tab" aria-selected={parte === k} onclick={() => (parte = k)}>{t}</button>{/each}
    </div>
  </div>
  {#if parte === 'med'}<Medidas />{:else if parte === 'fot'}<Fotos />{:else}<Periodo />{/if}
</div>
