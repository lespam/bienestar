<script lang="ts">
  import Interruptor from '../../core/Interruptor.svelte';
  import { nav } from '../../core/nav.svelte';
  import { prefs, guardar } from './prefs.svelte';
  import { elegirContenido } from './acciones';

  // Bienvenida aprobada el 11 de octubre (mockups/bienvenida.html): dos pasos, se ve una sola vez.
  const paso2 = $derived(nav.pantalla?.id === 'bienvenida-2');
  let estado = $state<'inicio' | 'cargando' | 'listo' | 'error'>('inicio');
  let cargado = $state<string[]>([]);

  async function elegir() {
    const r = await elegirContenido(() => (estado = 'cargando'));
    if (!r) { if (estado === 'cargando') estado = 'inicio'; return; }
    if (r.ok) { cargado = r.resumen; estado = 'listo'; } else estado = 'error';
  }
  async function terminar() {
    await guardar('ocultarComida', prefs.ocultarComida);
    await guardar('ocultarEntreno', prefs.ocultarEntreno);
    await guardar('bienvenida', true);
    nav.irTab('inicio');
  }
</script>

{#if !paso2}
  <div class="screen">
    <div class="bv-steps" aria-hidden="true"><i class="on"></i><i></i><span>Paso 1 de 2</span></div>
    <div class="hello"><small>Bienvenida</small><h2 tabindex="-1">Hola, Les. Antes de empezar, dos cosas.</h2></div>
    <p class="bv-lead">Tú decides qué números ves. Los datos se guardan igual, aunque estén ocultos.</p>
    <section class="tp-sec"><h4>Ocultar números</h4>
      <div class="group aj-g">
        <Interruptor id="bv-food" encendido={prefs.ocultarComida} titulo="Comida y cuerpo" detalle="Oculta calorías, macros, peso y medidas." onchange={() => (prefs.ocultarComida = !prefs.ocultarComida)} />
        <Interruptor id="bv-train" encendido={prefs.ocultarEntreno} titulo="Entrenamiento" detalle="Oculta pesos y repeticiones de tus series." onchange={() => (prefs.ocultarEntreno = !prefs.ocultarEntreno)} />
      </div>
      <p class="tp-hint">Puedes cambiarlo cuando quieras en Ajustes. Cada pantalla tiene un botón «Mostrar» por si quieres verlos un momento.</p>
    </section>
    <div class="bv-acts"><button class="start" onclick={() => { estado = 'inicio'; nav.abrir('bienvenida-2'); }}>Continuar</button></div>
  </div>
{:else}
  <header class="cur-head"><button class="back" onclick={() => nav.cerrar()}>‹ Volver</button></header>
  <div class="screen">
    <div class="bv-steps" aria-hidden="true"><i class="on"></i><i class="on"></i><span>Paso 2 de 2</span></div>
    <div class="tl-head"><h2 tabindex="-1">Carga tu contenido personal</h2></div>
    <p class="bv-lead">Es el archivo privado que te preparé. No está en internet: lo cargas una vez y se queda en tu teléfono.</p>
    {#if estado !== 'listo'}
      <div class="group bv-box">
        <ul class="bv-list">
          <li>Tu rutina de Strong Curves: calentamientos y semanas 1-2</li>
          <li>Las 92 recetas del Reto 25 y la guía de intercambios</li>
          <li>Tus marcas y tu plantilla Fresh</li>
          <li>Las letras de canciones de tus frases</li>
        </ul>
      </div>
    {/if}
    <div role="status" aria-live="polite">
      {#if estado === 'cargando'}
        <div class="group bv-load"><i aria-hidden="true"></i>Cargando tu contenido…</div>
      {:else if estado === 'listo'}
        <div class="group bv-ok"><b>Listo. Ya está en tu teléfono:</b><ul>{#each cargado as c (c)}<li>{c}</li>{/each}</ul></div>
      {:else if estado === 'error'}
        <div class="group bv-err">Este archivo no es tu contenido personal. No cambié nada.</div>
      {/if}
    </div>
    <div class="bv-acts">
      {#if estado === 'listo'}
        <button class="start" onclick={terminar}>Ir a Inicio</button>
      {:else if estado !== 'cargando'}
        <button class="start" onclick={elegir}>{estado === 'error' ? 'Elegir otro archivo' : 'Elegir archivo'}</button>
        <button class="ghost" onclick={terminar}>Lo hago después</button>
        {#if estado === 'inicio'}<p class="tool-note">Sin el archivo, la app funciona igual. Puedes cargarlo después en Ajustes &gt; Contenido personal.</p>{/if}
      {/if}
    </div>
  </div>
{/if}
