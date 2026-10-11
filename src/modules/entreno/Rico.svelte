<script lang="ts">
  // Texto con negritas marcadas como <b>…</b>, sin usar HTML crudo.
  let { texto }: { texto: string } = $props();
  const partes = $derived(texto.split(/(<b>.*?<\/b>)/g).filter(Boolean).map((t) => (t.startsWith('<b>') ? { b: true, t: t.slice(3, -4) } : { b: false, t })));
</script>

{#each partes as x, i (i)}{#if x.b}<b>{x.t}</b>{:else}{x.t}{/if}{/each}
