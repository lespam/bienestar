<script lang="ts">
  import type { Receta } from '../../core/db';
  import { CAT_COLOR } from './calculos';

  // La foto del platillo, o un platillo dibujado con el color de su tipo cuando todavía no tiene foto.
  let { receta, alt = '' }: { receta: Pick<Receta, 'id' | 'n' | 'cat' | 'img'>; alt?: string } = $props();

  const variante = $derived.by(() => {
    let h = 0;
    for (const c of receta.id || receta.n) h = (h * 31 + c.charCodeAt(0)) % 9973;
    return h % 4;
  });
  const color = $derived(CAT_COLOR[receta.cat] ?? 'var(--accent)');
  let url = $state('');
  $effect(() => {
    if (!receta.img) { url = ''; return; }
    const u = URL.createObjectURL(receta.img);
    url = u;
    return () => URL.revokeObjectURL(u);
  });
</script>

{#if url}
  <img src={url} {alt} />
{:else}
  <svg viewBox="0 0 124 100" preserveAspectRatio="xMidYMid slice" aria-hidden="true" style:color>
    <rect width="124" height="100" fill="currentColor" fill-opacity=".16" />
    <circle cx="62" cy="50" r="38" fill="currentColor" fill-opacity=".22" />
    <circle cx="62" cy="50" r="30" fill="#f3eef7" fill-opacity=".9" />
    <g fill="currentColor" stroke="currentColor">
      {#if variante === 0}
        <circle cx="48" cy="44" r="9" /><circle cx="68" cy="40" r="8" /><circle cx="60" cy="54" r="8" />
      {:else if variante === 1}
        <path d="M40 58a22 22 0 0 1 44 0z" /><path d="M46 44h32" stroke-width="2" fill="none" />
      {:else if variante === 2}
        <rect x="42" y="36" width="40" height="7" rx="3.5" /><rect x="42" y="47" width="40" height="7" rx="3.5" /><rect x="42" y="58" width="40" height="7" rx="3.5" />
      {:else}
        <ellipse cx="62" cy="50" rx="20" ry="12" /><path d="M62 38c4-9 12-10 16-8-1 8-8 12-16 8z" />
      {/if}
    </g>
  </svg>
{/if}
