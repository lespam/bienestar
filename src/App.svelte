<script lang="ts">
  import { tick } from 'svelte';
  import Perezoso from './core/Perezoso.svelte';
  import Pronto from './core/Pronto.svelte';
  import Avisos from './core/Avisos.svelte';
  import { nav, type Tab } from './core/nav.svelte';
  import { plataforma } from './core/plataforma.svelte';
  import { prefs, Ajustes, Bienvenida } from './modules/ajustes';
  import { Inicio } from './modules/inicio';
  import { Rutina, Curso, Ficha, Descanso, Calentar, RegistroPR, Fin, Cardio } from './modules/entreno';
  import { Herramientas } from './modules/herramientas';
  import { Cuerpo } from './modules/cuerpo';
  import { Mente, Alma, Comparar } from './modules/mente';
  import { Comida, Recetario, Receta, Perfiles, Menu, Compras, Preparacion, Tips, Tarjetas, Flexible, Patrones } from './modules/comida';

  const TABS: [Tab, string][] = [['inicio', 'Inicio'], ['rutina', 'Rutina'], ['comida', 'Comida'], ['cuerpo', 'Cuerpo']];
    // Pantallas de la sesión: ocupan todo el teléfono, sin la barra de abajo (como en el mockup).
  const SIN_BARRA = new Set(['curso', 'ficha', 'descanso', 'calentar', 'pr', 'fin', 'cardio', 'herramientas']);
  const PANTALLAS: Record<string, () => Promise<{ default: unknown }>> = { ajustes: Ajustes, curso: Curso, ficha: Ficha, descanso: Descanso, calentar: Calentar, pr: RegistroPR, fin: Fin, cardio: Cardio, herramientas: Herramientas, recetas: Recetario, receta: Receta, perfiles: Perfiles, menu: Menu, compras: Compras, prep: Preparacion, tips: Tips, tarjetas: Tarjetas, flexible: Flexible, patrones: Patrones, mente: Mente, alma: Alma, 'alma-cmp': Comparar };
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
          {#if PANTALLAS[pantalla.id]}
            {#key pantalla}<Perezoso cargar={PANTALLAS[pantalla.id] as never} />{/key}
          {:else}
            <header class="cur-head"><button class="back" onclick={() => nav.cerrar()}>‹ Volver</button></header>
            <div class="screen"><Pronto titulo={String(pantalla.datos?.titulo ?? '')} fase={Number(pantalla.datos?.fase ?? 0)} /></div>
          {/if}
          {#if !SIN_BARRA.has(pantalla.id)}
            <nav class="nav" aria-label="Secciones">
              {#each TABS as [t, n] (t)}<button class:on={nav.tab === t} aria-current={nav.tab === t ? 'page' : undefined} onclick={() => nav.irTab(t)}>{n}</button>{/each}
            </nav>
          {/if}
        </section>
      {:else}
        <section class="view">
          {#if nav.tab === 'inicio'}
            <Perezoso cargar={Inicio} />
          {:else if nav.tab === 'rutina'}
            <Perezoso cargar={Rutina} />
          {:else if nav.tab === 'cuerpo'}
            <Perezoso cargar={Cuerpo} />
          {:else if nav.tab === 'comida'}
            <Perezoso cargar={Comida} />
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
