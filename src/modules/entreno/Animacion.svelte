<script lang="ts">
  import { SCAnim } from './animaciones';

  // La animación abstracta del ejercicio, con el músculo resaltado si lo pides. Solo se mueve cuando la ves.
  // Si pusiste tu propia imagen o GIF en la ficha, se muestra en su lugar.
  let { anim, nombre, hl, propia }: { anim?: string; nombre: string; hl?: { p: string[]; s: string[] }; propia?: Blob } = $props();
  let cv = $state<HTMLCanvasElement>();
  let url = $state('');

  $effect(() => {
    if (!propia) { url = ''; return; }
    const u = URL.createObjectURL(propia);
    url = u;
    return () => URL.revokeObjectURL(u);
  });

  $effect(() => {
    if (!cv || !anim || propia) return;
    const lienzo = cv, id = anim, resalte = hl;
    let parar: (() => void) | null = null;
    const ver = (en: boolean) => {
      if (en && !parar) parar = SCAnim.play(lienzo, id, resalte);
      else if (!en && parar) { parar(); parar = null; }
    };
    if (typeof IntersectionObserver === 'undefined') { ver(true); return () => ver(false); }
    const io = new IntersectionObserver((es) => ver(es.some((e) => e.isIntersecting)));
    io.observe(lienzo);
    return () => { io.disconnect(); ver(false); };
  });
</script>

<div class="anim" role={anim && !propia ? 'img' : undefined} aria-label={anim && !propia ? 'Animación de ' + nombre : undefined}>
  {#if propia && url}
    <img src={url} alt={'Tu animación de ' + nombre} style="width:100%;height:100%;object-fit:contain" />
  {:else if anim}
    <canvas bind:this={cv} width="720" height="540" aria-hidden="true"></canvas>
  {:else}
    <span class="anim-cap" style="position:static">Aquí irá tu GIF o animación</span>
  {/if}
</div>
