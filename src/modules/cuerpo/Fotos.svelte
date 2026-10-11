<script lang="ts">
  import { onDestroy, onMount } from 'svelte';
  import { SvelteSet } from 'svelte/reactivity';
  import { avisos } from '../../core/aviso.svelte';
  import { iso } from '../../core/fechas';
  import type { FotoCuerpo } from '../../core/db';
  import { etiquetaFecha } from './calculos';
  import { agregarFoto, listarFotos, ponerFoto, quitarFoto } from './datos';
  import { reducirFoto } from '../../core/imagen';

  // Las fotos están cubiertas hasta que tú decides verlas, y se cubren otra vez cuando sales o cambias de pestaña.
  let fotos = $state<FotoCuerpo[]>([]);
  let abiertas = $state(false);
  let urls = $state<Record<number, string>>({});
  const elegidas = new SvelteSet<number>();
  let cargado = $state(false);
  let archivo = $state<HTMLInputElement>();

  async function leer() { fotos = await listarFotos(); cargado = true; }
  onMount(() => {
    leer();
    const oculta = () => { if (document.visibilityState === 'hidden') cubrir(); };
    document.addEventListener('visibilitychange', oculta);
    return () => document.removeEventListener('visibilitychange', oculta);
  });
  onDestroy(soltarUrls);

  function soltarUrls() { for (const u of Object.values(urls)) URL.revokeObjectURL(u); urls = {}; }
  function mostrar() {
    soltarUrls();
    urls = Object.fromEntries(fotos.map((f) => [f.id!, URL.createObjectURL(f.foto)]));
    abiertas = true;
  }
  function cubrir() { abiertas = false; elegidas.clear(); soltarUrls(); }

  const dos = $derived([...elegidas].sort((a, b) => a - b).map((id) => fotos.find((f) => f.id === id)).filter((f): f is FotoCuerpo => !!f));
  const una = $derived(dos.length === 1 ? dos[0] : null);
  const reciente = $derived(fotos[fotos.length - 1]);

  function tocar(id: number) {
    if (elegidas.has(id)) elegidas.delete(id);
    else { elegidas.add(id); if (elegidas.size > 2) elegidas.delete([...elegidas][0]); }
  }

  async function nueva(e: Event) {
    const input = e.currentTarget as HTMLInputElement;
    const f = input.files?.[0];
    input.value = '';
    if (!f) return;
    const foto = await reducirFoto(f);
    const id = await agregarFoto(iso(new Date()), foto);
    await leer();
    if (abiertas) mostrar();
    avisos.deshacer('Foto agregada', async () => { await quitarFoto(id); elegidas.delete(id); await leer(); if (abiertas) mostrar(); });
  }

  async function quitar(foto: FotoCuerpo) {
    const f = $state.snapshot(foto) as FotoCuerpo;
    await quitarFoto(f.id!);
    elegidas.delete(f.id!);
    await leer();
    mostrar();
    avisos.deshacer('Foto quitada', async () => { await ponerFoto(f); await leer(); if (abiertas) mostrar(); });
  }
  const estilo = (f: FotoCuerpo) => 'background-image:url(' + urls[f.id!] + ')';
  const nota = $derived(dos.length === 2 ? 'Toca una de las dos para quitarla de la comparación.' : dos.length ? 'Toca otra foto para verlas lado a lado.' : 'Si quieres compararlas, toca dos fotos.');
</script>

<div class="tool" id="b-fot">
  {#if cargado && !abiertas}
    <div class="ph-cover">
      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 3l18 18M10.6 5.1A10 10 0 0 1 12 5c6 0 9.5 7 9.5 7a17 17 0 0 1-3 3.8M6.4 6.4C3.9 8.1 2.5 12 2.5 12S6 19 12 19a9.6 9.6 0 0 0 4.4-1.1M9.9 9.9a3 3 0 0 0 4.2 4.2" /></svg>
      <b>Tus fotos están cubiertas</b>
      <p>{fotos.length ? (fotos.length === 1 ? '1 foto' : fotos.length + ' fotos') + '. La más reciente es del ' + etiquetaFecha(reciente.fecha) + '.' : 'Aún no hay fotos.'}</p>
      {#if fotos.length}<button class="start" onclick={mostrar}>Mostrar fotos</button>{/if}
    </div>
  {:else if abiertas}
    <div class="ph-open">
      {#if dos.length === 2}
        <div class="compare">
          {#each dos as f (f.id)}
            <div class="cmp-side"><div class="ph" style={estilo(f)} role="img" aria-label={'Foto del ' + etiquetaFecha(f.fecha)}></div><span>{etiquetaFecha(f.fecha)}</span></div>
          {/each}
        </div>
      {/if}
      <p class="tool-note left">{nota}</p>
      <div class="gallery">
        {#each fotos as f (f.id)}
          <button class="g-item" class:sel={elegidas.has(f.id!)} aria-pressed={elegidas.has(f.id!)} aria-label={'Foto del ' + etiquetaFecha(f.fecha)} onclick={() => tocar(f.id!)}>
            <span class="ph" style={estilo(f)}></span>{etiquetaFecha(f.fecha)}
          </button>
        {/each}
      </div>
      {#if una}<button class="ghost" onclick={() => quitar(una)}>Quitar la foto del {etiquetaFecha(una.fecha)}</button>{/if}
      <button class="link-btn" onclick={cubrir}>Cubrir otra vez</button>
    </div>
  {/if}
  <button class="ghost upload" onclick={() => archivo?.click()}>Agregar foto</button>
  <input bind:this={archivo} id="ph-file" type="file" accept="image/*" hidden onchange={nueva} aria-label="Elegir una foto" />
  <p class="tool-note">Las fotos se guardan solo dentro de la app, no en la galería de tu teléfono. Se cubren otra vez cuando sales.</p>
</div>
