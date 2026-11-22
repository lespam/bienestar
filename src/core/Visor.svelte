<script lang="ts">
  import { nav } from './nav.svelte';
  import { visor } from './visor.svelte';

  // Pellizcar o doble toque para acercar, arrastrar para moverla, deslizar para pasar a otra, un toque para cerrar.
  const MAX = 4;
  let escala = $state(1);
  let x = $state(0);
  let y = $state(0);
  let caja: HTMLElement;
  // eslint-disable-next-line svelte/prefer-svelte-reactivity -- no se muestra, solo sigue los dedos
  const punteros = new Map<number, { x: number; y: number }>();
  let inicio = { x: 0, y: 0, t: 0 };
  let movio = false;
  let distancia = 0;
  let ultimoToque = 0;

  const actual = $derived(visor.imagenes[visor.indice]);
  const hay = $derived(visor.imagenes.length > 1);

  $effect(() => { caja.focus(); });
  $effect(() => { if (visor.indice >= 0) { escala = 1; x = 0; y = 0; } });

  function limitar() {
    if (escala <= 1) { x = 0; y = 0; return; }
    const ancho = caja.clientWidth, alto = caja.clientHeight;
    const mx = (ancho * (escala - 1)) / 2, my = (alto * (escala - 1)) / 2;
    x = Math.max(-mx, Math.min(mx, x));
    y = Math.max(-my, Math.min(my, y));
  }
  const dist = () => { const [a, b] = [...punteros.values()]; return Math.hypot(a.x - b.x, a.y - b.y); };

  function abajo(e: PointerEvent) {
    if ((e.target as HTMLElement).closest('button')) return;
    caja.setPointerCapture(e.pointerId);
    punteros.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (punteros.size === 1) { inicio = { x: e.clientX, y: e.clientY, t: Date.now() }; movio = false; }
    if (punteros.size === 2) { distancia = dist(); movio = true; }
  }
  function mover(e: PointerEvent) {
    const p = punteros.get(e.pointerId);
    if (!p) return;
    const dx = e.clientX - p.x, dy = e.clientY - p.y;
    p.x = e.clientX; p.y = e.clientY;
    if (punteros.size === 2) {
      const d = dist();
      escala = Math.min(MAX, Math.max(1, escala * (d / distancia)));
      distancia = d;
      limitar();
      return;
    }
    if (Math.hypot(e.clientX - inicio.x, e.clientY - inicio.y) > 8) movio = true;
    if (escala > 1) { x += dx; y += dy; limitar(); }
  }
  function arriba(e: PointerEvent) {
    if (!punteros.delete(e.pointerId)) return;
    if (punteros.size) return;
    if (escala < 1.05) escala = 1;
    limitar();
    const dx = e.clientX - inicio.x;
    if (movio) {
      if (escala === 1 && hay && Math.abs(dx) > 50 && Math.abs(e.clientY - inicio.y) < 80) pasar(dx < 0 ? 1 : -1);
      return;
    }
    const ahora = Date.now();
    if (ahora - ultimoToque < 300) { ultimoToque = 0; escala = escala > 1 ? 1 : 2.5; limitar(); return; }
    ultimoToque = ahora;
    setTimeout(() => { if (ultimoToque === ahora && punteros.size === 0) { ultimoToque = 0; nav.cerrar(); } }, 310);
  }
  function pasar(d: number) {
    const n = visor.indice + d;
    if (n >= 0 && n < visor.imagenes.length) visor.indice = n;
  }
  function tecla(e: KeyboardEvent) {
    if (e.key === 'Escape') { e.preventDefault(); nav.cerrar(); }
    else if (e.key === 'ArrowRight') pasar(1);
    else if (e.key === 'ArrowLeft') pasar(-1);
  }
</script>

<div class="visor" bind:this={caja} role="dialog" aria-modal="true" aria-label="Imagen en grande" tabindex="-1"
  onkeydown={tecla} onpointerdown={abajo} onpointermove={mover} onpointerup={arriba} onpointercancel={arriba}>
  {#if actual}
    <img src={actual.src} alt={actual.alt} draggable="false" style:transform="translate({x}px, {y}px) scale({escala})" />
  {/if}
  <button class="visor-x" aria-label="Cerrar" onclick={() => nav.cerrar()}>×</button>
  {#if hay}
    <p class="visor-n" aria-live="polite">{visor.indice + 1} de {visor.imagenes.length}</p>
    <button class="visor-p" aria-label="Anterior" disabled={visor.indice === 0} onclick={() => pasar(-1)}>‹</button>
    <button class="visor-s" aria-label="Siguiente" disabled={visor.indice === visor.imagenes.length - 1} onclick={() => pasar(1)}>›</button>
  {/if}
</div>
