<script lang="ts">
  import { untrack } from 'svelte';
  import { nav } from './nav.svelte';
  import { avisos } from './aviso.svelte';
  import { mantenerEncendida } from './pantalla';
  import { avisoDeFin } from './sonido';

  // Descanso: pieza compartida. Cuenta con la hora real, así que no se atrasa si el teléfono la pausa un momento.
  // Entreno la usa entre series y Herramientas la usará sola. Quien la abre decide qué hacer con los segundos descansados.
  let { siguiente = '', automatico = false, frase = null, largoInicial = 60, alElegirLargo, alSalir }: {
    siguiente?: string;
    automatico?: boolean;
    frase?: { texto: string; origen: string } | null;
    /** Duración con la que empieza (la que elegiste la última vez). */
    largoInicial?: number;
    alElegirLargo?: (seg: number) => void;
    /** Segundos que de verdad descansaste. */
    alSalir?: (seg: number) => void;
  } = $props();

  const ARCO = 603.2;
  const LARGOS = [[60, '1 min'], [120, '2 min'], [300, '5 min']] as const;
  let largo = $state(untrack(() => largoInicial));
  let restante = $state(untrack(() => largoInicial));
  let corriendo = $state(false);
  let fin = 0;
  let medido = 0; // segundos que ya corrieron
  let desde = 0;
  let dia = $state<'respirar' | 'frase' | 'imagen'>('respirar');
  let palabra = $state('Inhala');
  const retraso = -(Date.now() % 8000) / 1000;

  const tiempo = $derived(Math.floor(restante / 60) + ':' + String(restante % 60).padStart(2, '0'));
  const estado = $derived(corriendo ? 'descansando' : restante === 0 ? 'listo' : 'en pausa');
  const boton = $derived(corriendo ? 'Pausar' : restante === 0 ? 'Otra vez' : 'Iniciar');

  function parar() {
    if (!corriendo) return;
    // Si el teléfono estuvo dormido, el descanso ya había terminado: no cuenta más allá de su fin.
    medido += (Math.min(Date.now(), fin) - desde) / 1000;
    corriendo = false;
  }
  function tic() {
    if (!corriendo) return;
    restante = Math.max(0, Math.ceil((fin - Date.now()) / 1000));
    if (restante === 0) { parar(); avisoDeFin(); avisos.mostrar('Descanso terminado. Cuando quieras, sigue.'); }
  }
  function iniciar() {
    if (restante === 0) restante = largo;
    desde = Date.now(); fin = desde + restante * 1000; corriendo = true;
  }
  function elegir(s: number) {
    const sigue = corriendo;
    parar(); largo = s; restante = s; alElegirLargo?.(s);
    if (sigue) iniciar();
  }
  function salir() {
    parar();
    nav.cerrar();
  }

  // Al irse, avisa cuánto descansaste de verdad (también con el gesto atrás).
  $effect(() => {
    const suelta = mantenerEncendida();
    const reloj = setInterval(tic, 250);
    const palabras = setInterval(() => { palabra = (Date.now() % 8000) / 8000 < 0.5 ? 'Inhala' : 'Exhala'; }, 250);
    const visible = () => { if (document.visibilityState === 'visible') tic(); };
    document.addEventListener('visibilitychange', visible);
    if (untrack(() => automatico)) iniciar();
    return () => {
      clearInterval(reloj); clearInterval(palabras);
      document.removeEventListener('visibilitychange', visible);
      parar(); suelta();
      alSalir?.(Math.round(medido));
    };
  });

  const PESTAÑAS = [['respirar', 'Respirar'], ['frase', 'Frase'], ['imagen', 'Imagen']] as const;
</script>

<header class="cur-head">
  <button class="back" aria-label="Volver" onclick={salir}>‹ Volver</button>
  {#if siguiente}<span class="rest-next">Sigue: {siguiente}</span>{/if}
</header>
<div class="screen rest-screen">
  <div class="rest-top">
    <h2 tabindex="-1">Descanso</h2>
    <div class="seg rest-seg" role="radiogroup" aria-label="Duración del descanso">
      {#each LARGOS as [s, t] (s)}<button class:on={largo === s} role="radio" aria-checked={largo === s} onclick={() => elegir(s)}>{t}</button>{/each}
    </div>
  </div>
  <div class="ring-wrap">
    <svg class="rest-ring" viewBox="0 0 220 220" aria-hidden="true">
      <circle cx="110" cy="110" r="96" fill="none" stroke="var(--panel)" stroke-width="12" />
      <circle cx="110" cy="110" r="96" fill="none" stroke="var(--accent)" stroke-width="12" stroke-linecap="round" stroke-dasharray={ARCO} stroke-dashoffset={(ARCO * (1 - restante / largo)).toFixed(1)} transform="rotate(-90 110 110)" />
    </svg>
    <div class="rest-time" role="timer" aria-label="Tiempo de descanso"><b>{tiempo}</b><span>{estado}</span></div>
  </div>
  <div class="rest-ctrl">
    <button class="start" onclick={() => (corriendo ? parar() : iniciar())}>{boton}</button>
    <button class="ghost" onclick={salir}>Terminar descanso</button>
  </div>

  <section class="distract">
    <div class="dis-tabs" role="tablist">
      {#each PESTAÑAS as [k, t] (k)}<button class:on={dia === k} role="tab" aria-selected={dia === k} onclick={() => (dia = k)}>{t}</button>{/each}
    </div>
    {#if dia === 'respirar'}
      <div class="dis-panel">
        <div class="breath"><div class="bubble" style:animation-delay="{retraso}s"></div></div>
        <p class="breath-word" aria-hidden="true">{palabra}</p>
        <p class="dis-cap">Sigue el círculo: crece al inhalar, se encoge al exhalar.</p>
      </div>
    {:else if dia === 'frase'}
      <div class="dis-panel">
        {#if frase}
          <p class="dis-quote">“{frase.texto}”</p>
          <p class="dis-cap">De tu colección de frases · {frase.origen}</p>
        {:else}
          <p class="dis-quote">“Cada serie que terminas ya cuenta. El descanso también es parte del entrenamiento.”</p>
          <p class="dis-cap">Aquí aparecerán las frases de tu colección.</p>
        {/if}
      </div>
    {:else}
      <div class="dis-panel">
        <div class="dis-img"><span>Imagen de tu colección</span></div>
        <p class="dis-cap">Aquí aparece una imagen de tu tablero de visión.</p>
      </div>
    {/if}
  </section>
  <p class="rest-foot">Al terminar: vibración y sonido. La pantalla se queda encendida mientras corre el tiempo.</p>
</div>
