<script lang="ts">
  import type { Component } from 'svelte';
  // Carga un módulo cuando lo abres, para que Inicio abra rápido (plan, punto 1).
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  type Modulo = { default: Component<any> };
  let { cargar, datos = {} }: { cargar: () => Promise<Modulo>; datos?: Record<string, unknown> } = $props();
</script>

{#await cargar() then m}<m.default {...datos} />{/await}
