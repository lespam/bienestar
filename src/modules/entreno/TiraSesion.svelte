<script lang="ts">
  import { visor } from '../../core/visor.svelte';
  import { SCAnim } from './animaciones';
  import { leerAnimacionesPropias } from './datos';
  import { gruposDeRutina, type Letra, type Programa } from './programa';

  // Debajo de la vista previa: una imagen de cada ejercicio de la sesión. Si pusiste la tuya en la ficha, sale esa;
  // si no, el cuadro quieto de la animación. Un toque la abre en grande y puedes pasar de un ejercicio a otro.
  let { programa, letra }: { programa: Programa; letra: Letra } = $props();

  interface Cuadro { clave: string; nombre: string; anim?: string }
  const cuadros = $derived.by(() => {
    const lista: Cuadro[] = [];
    for (const g of gruposDeRutina(programa, letra)) {
      for (const e of g.ejercicios) {
        if (!lista.some((x) => x.clave === e.clave)) lista.push({ clave: e.clave, nombre: e.nombre, anim: e.anim });
      }
    }
    return lista;
  });

  let propias = $state<Record<string, string>>({});
  let lienzos = $state<Record<string, HTMLCanvasElement | undefined>>({});

  $effect(() => {
    const claves = cuadros.map((c) => c.clave);
    let vigente = true;
    const hechas: string[] = [];
    leerAnimacionesPropias(claves).then((hay) => {
      const nuevas: Record<string, string> = {};
      for (const [k, b] of Object.entries(hay)) {
        const u = URL.createObjectURL(b);
        hechas.push(u);
        nuevas[k] = u;
      }
      if (vigente) propias = nuevas;
      else hechas.forEach((u) => URL.revokeObjectURL(u));
    });
    return () => { vigente = false; hechas.forEach((u) => URL.revokeObjectURL(u)); };
  });

  /** Dibuja el cuadro quieto de cada animación en su lienzo. */
  $effect(() => {
    for (const c of cuadros) {
      const cv = lienzos[c.clave];
      if (cv && c.anim && !propias[c.clave]) SCAnim.draw(cv, c.anim, 0, { still: true });
    }
  });

  const visibles = $derived(cuadros.filter((c) => propias[c.clave] || c.anim));

  function ampliar(clave: string) {
    const imagenes = visibles.map((c) => {
      const propia = propias[c.clave];
      if (propia) return { src: propia, alt: 'Tu animación de ' + c.nombre };
      return { src: lienzos[c.clave]?.toDataURL('image/png') ?? '', alt: 'Animación de ' + c.nombre };
    });
    visor.abrir(imagenes, visibles.findIndex((c) => c.clave === clave));
  }
</script>

{#if visibles.length}
  <section class="tira" aria-label={'Ejercicios de la Rutina ' + letra}>
    <h4>Los ejercicios de la sesión</h4>
    <ul>
      {#each visibles as c (c.clave)}
        <li>
          <button onclick={() => ampliar(c.clave)} aria-label={'Ver en grande: ' + c.nombre}>
            {#if propias[c.clave]}
              <img src={propias[c.clave]} alt="" />
            {:else}
              <canvas bind:this={lienzos[c.clave]} width="720" height="540" aria-hidden="true"></canvas>
            {/if}
            <span>{c.nombre}</span>
          </button>
        </li>
      {/each}
    </ul>
  </section>
{/if}
