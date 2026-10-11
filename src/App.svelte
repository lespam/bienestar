<script lang="ts">
  import { tick } from 'svelte';
  import Perezoso from './core/Perezoso.svelte';
  import Pronto from './core/Pronto.svelte';
  import Avisos from './core/Avisos.svelte';
  import { nav, type Tab } from './core/nav.svelte';
  import { plataforma } from './core/plataforma.svelte';
  import { prefs, Ajustes, Bienvenida } from './modules/ajustes';
  import { Inicio } from './modules/inicio';

  const TABS: [Tab, string][] = [['inicio', 'Inicio'], ['rutina', 'Rutina'], ['comida', 'Comida'], ['cuerpo', 'Cuerpo']];
  const FASE: Record<string, number> = { rutina: 2, comida: 5, cuerpo: 4 };
  const pantalla = $derived(nav.pantalla);
  const enBienvenida = $derived(!prefs.bienvenida);

  // Al cambiar de pantalla, el foco va a su título (regla 4).
  let primera = true;
  $effect(() => {
    void nav.cambio;
    if (primera) { primera = false; return; }
    // Las pantallas se cargan cuando las abres, así que se espera a que su título exista.
    let intentos = 30;
    const enfocar = () => {
      const h = document.querySelector<HTMLElement>('.view h2');
      if (h) h.focus();
      else if (intentos-- > 0) requestAnimationFrame(enfocar);
    };
    tick().then(enfocar);
  });
</script>

<div class="phone app">
  {#key plataforma.datos}
    {#if enBienvenida}
      <section class="view"><Perezoso cargar={Bienvenida} /></section>
    {:else}
      {#if pantalla}
        <section class="view">
          {#if pantalla.id === 'ajustes'}
            <Perezoso cargar={Ajustes} />
          {:else}
            <header class="cur-head"><button class="back" onclick={() => nav.cerrar()}>‹ Volver</button></header>
            <div class="screen"><Pronto titulo={String(pantalla.datos?.titulo ?? '')} fase={Number(pantalla.datos?.fase ?? 0)} /></div>
          {/if}
          <nav class="nav" aria-label="Secciones">
            {#each TABS as [t, n] (t)}<button class:on={nav.tab === t} aria-current={nav.tab === t ? 'page' : undefined} onclick={() => nav.irTab(t)}>{n}</button>{/each}
          </nav>
        </section>
      {:else}
        <section class="view">
          {#if nav.tab === 'inicio'}
            <Perezoso cargar={Inicio} />
          {:else}
            <div class="screen"><Pronto titulo={TABS.find((x) => x[0] === nav.tab)![1]} fase={FASE[nav.tab]} /></div>
          {/if}
          <nav class="nav" aria-label="Secciones">
            {#each TABS as [t, n] (t)}<button class:on={nav.tab === t} aria-current={nav.tab === t ? 'page' : undefined} onclick={() => nav.irTab(t)}>{n}</button>{/each}
          </nav>
        </section>
      {/if}
    {/if}
  {/key}
  <Avisos />
</div>
