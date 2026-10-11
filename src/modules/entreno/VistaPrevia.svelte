<script lang="ts">
  import Icono from '../../core/Icono.svelte';
  import Perezoso from '../../core/Perezoso.svelte';
  import type { Letra, Programa } from './programa';

  // Al principio de Rutina: la cinemática de tu sesión. El motor 3D solo se descarga cuando la abres.
  let { programa, letra }: { programa: Programa; letra: Letra } = $props();
  let abierta = $state(false);
  const cargar = () => import('./Cinematica.svelte');
</script>

{#if abierta}
  <Perezoso {cargar} datos={{ programa, letra }} />
{:else}
  <button class="video" onclick={() => (abierta = true)}>
    <span class="play"><Icono nombre="play" /></span>
    <span class="cap"><span>Vista previa de la sesión</span><span>Ver la cinemática</span></span>
  </button>
{/if}
