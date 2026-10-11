<script lang="ts">
  import type { Snippet } from 'svelte';
  import { nav } from './nav.svelte';

  // Hoja inferior como diálogo accesible: foco al abrir, Esc, Tab atrapado y foco de regreso (regla 4).
  let { titulo, children }: { titulo: string; children: Snippet } = $props();
  let caja: HTMLElement;
  const id = 'h' + Math.random().toString(36).slice(2, 8);

  $effect(() => {
    const primero = caja.querySelector<HTMLElement>('input, textarea, select, button:not(.cal-nav)') ?? caja;
    primero.focus();
  });

  function tecla(e: KeyboardEvent) {
    if (e.key === 'Escape') { e.preventDefault(); nav.cerrar(); return; }
    if (e.key !== 'Tab') return;
    const f = [...caja.querySelectorAll<HTMLElement>('button, input, textarea, select, a[href], [tabindex]:not([tabindex="-1"])')].filter((x) => !x.hasAttribute('disabled'));
    if (!f.length) return;
    const a = f[0], z = f[f.length - 1];
    if (e.shiftKey && document.activeElement === a) { e.preventDefault(); z.focus(); }
    else if (!e.shiftKey && document.activeElement === z) { e.preventDefault(); a.focus(); }
  }
</script>

<div class="sheet-bg" onclick={() => nav.cerrar()} aria-hidden="true"></div>
<div class="sheet" bind:this={caja} role="dialog" aria-modal="true" aria-labelledby={id} tabindex="-1" onkeydown={tecla}>
  <div class="sh-head"><b id={id}>{titulo}</b><button class="cal-nav" aria-label="Cerrar" onclick={() => nav.cerrar()}>×</button></div>
  {@render children()}
</div>
