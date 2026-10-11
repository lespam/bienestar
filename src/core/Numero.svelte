<script lang="ts">
  // Un número de comida, cuerpo o entreno. Respeta "Ocultar números" y siempre dice "aprox." cuando lo es.
  let { valor, unidad = '', aprox = false, oculto }: { valor: number | null; unidad?: string; aprox?: boolean; oculto: boolean } = $props();
</script>

{#if oculto}<span class="sr">Número oculto</span><span aria-hidden="true">•••</span>{:else if valor != null}{valor.toLocaleString('es-MX')}{unidad ? ' ' + unidad : ''}{aprox ? ' aprox.' : ''}{/if}
