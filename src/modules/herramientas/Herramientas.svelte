<script lang="ts">
  import { onMount } from 'svelte';
  import { nav } from '../../core/nav.svelte';
  import { avisos } from '../../core/aviso.svelte';
  import { mantenerEncendida } from '../../core/pantalla';
  import { avisoDeFin } from '../../core/sonido';
  import { CRONO_NUEVO, estadoCrono, estadoTemp, formatoCrono, formatoTemp, lanzar, largoDeModo, msCrono, quedanTemp, tempNuevo, type EstadoCrono, type EstadoTemp, type ModoTemp } from './calculos';
  import { guardarCrono, guardarTemp, leerCrono, leerTemp } from './datos';

  type Herr = 'crono' | 'timer' | 'coin';
  const PESTAÑAS: [Herr, string][] = [['crono', 'Cronómetro'], ['timer', 'Temporizador'], ['coin', 'Moneda']];
  const pedida = String(nav.pantalla?.datos?.tool ?? 'crono');
  let herr = $state<Herr>(pedida === 'timer' || pedida === 'coin' ? pedida : 'crono');

  let ahora = $state(Date.now());
  let crono = $state<EstadoCrono>(structuredClone(CRONO_NUEVO));
  let temp = $state<EstadoTemp>(tempNuevo());
  let listo = $state(false);
  let avisado = false;

  const ms = $derived(msCrono(crono, ahora));
  const corre = $derived(crono.inicio != null);
  const quedan = $derived(quedanTemp(temp, ahora));
  const estT = $derived(estadoTemp(temp, ahora));
  const ARCO = 603.2;

  onMount(() => {
    (async () => {
      crono = await leerCrono();
      temp = await leerTemp();
      ahora = Date.now();
      // Si el tiempo ya se acabó mientras la app estaba cerrada, se muestra terminado sin sonar.
      avisado = temp.fin != null && quedanTemp(temp, ahora) === 0;
      listo = true;
    })();
    const reloj = setInterval(tic, 100);
    const visible = () => { if (document.visibilityState === 'visible') tic(); };
    document.addEventListener('visibilitychange', visible);
    return () => { clearInterval(reloj); document.removeEventListener('visibilitychange', visible); };
  });

  function tic() {
    ahora = Date.now();
    if (temp.fin != null && !avisado && quedanTemp(temp, ahora) === 0) {
      avisado = true;
      avisoDeFin();
      avisos.mostrar('Tiempo terminado.');
      temp = { ...temp, fin: null, quedan: 0 };
      void guardarTemp(temp);
    }
  }

  // La pantalla se queda encendida mientras algo corre.
  $effect(() => {
    const algoCorre = corre || temp.fin != null;
    if (!algoCorre) return;
    return mantenerEncendida();
  });

  // ---------- Cronómetro ----------
  function irCrono() {
    const t = Date.now();
    crono = corre ? { ...crono, acum: msCrono(crono, t), inicio: null } : { ...crono, inicio: t };
    void guardarCrono(crono);
  }
  function vuelta() {
    if (!ms) return;
    crono = { ...crono, vueltas: [msCrono(crono, Date.now()), ...crono.vueltas] };
    void guardarCrono(crono);
  }
  function reiniciarCrono() { crono = structuredClone(CRONO_NUEVO); void guardarCrono(crono); }

  // ---------- Temporizador ----------
  function poner(modo: ModoTemp, min = temp.min, seg = temp.seg) {
    avisado = false;
    temp = tempNuevo(modo, min, seg);
    void guardarTemp(temp);
  }
  function irTemp() {
    const t = Date.now();
    if (temp.fin != null) temp = { ...temp, quedan: quedanTemp(temp, t), fin: null };
    else {
      const desde = temp.quedan === 0 ? largoDeModo(temp.modo, temp.min, temp.seg) : temp.quedan;
      avisado = false;
      temp = { ...temp, largo: temp.quedan === 0 ? desde : temp.largo, quedan: desde, fin: t + desde * 1000 };
    }
    void guardarTemp(temp);
  }
  const textoBotonTemp = $derived(temp.fin != null && estT === 'corriendo' ? 'Pausar' : estT === 'terminado' ? 'Otra vez' : temp.quedan < temp.largo ? 'Seguir' : 'Iniciar');
  const estadoTextoTemp = $derived(estT);
  const MODOS: [ModoTemp, string][] = [['60', '1 min'], ['180', '3 min'], ['libre', 'Libre']];

  // ---------- Moneda ----------
  const reducir = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  let vueltasMoneda = $state(0);
  let resultado = $state('Toca la moneda para lanzarla');
  let a = $state('Fast food'), b = $state('Cocinamos en casa');
  function tirar() {
    const cara = lanzar(Math.random()) === 'cara';
    let siguiente = vueltasMoneda + 6;
    if ((siguiente % 2 === 0) !== cara) siguiente++;
    vueltasMoneda = siguiente;
    resultado = 'Girando…';
    setTimeout(() => { resultado = cara ? 'Cara: ' + (a || 'Cara') : 'Cruz: ' + (b || 'Cruz'); }, reducir ? 0 : 1200);
  }

  const idTab = (k: string) => 'herr-' + k;
</script>

<header class="cur-head">
  <button class="back" aria-label="Volver" onclick={() => nav.cerrar()}>‹ Volver</button>
</header>
<div class="screen">
  <div class="tl-head">
    <h2 tabindex="-1">Herramientas</h2>
    <div class="seg" role="tablist" aria-label="Herramienta">
      {#each PESTAÑAS as [k, t] (k)}<button class:on={herr === k} role="tab" id={idTab(k)} aria-selected={herr === k} aria-controls={'panel-' + k} onclick={() => (herr = k)}>{t}</button>{/each}
    </div>
  </div>

  {#if herr === 'crono'}
    <div class="tool" id="panel-crono" role="tabpanel" aria-labelledby={idTab('crono')}>
      <div class="big-time"><b role="timer" aria-label="Cronómetro">{formatoCrono(ms)}</b><span>{estadoCrono(crono, ahora)}</span></div>
      <div class="two">
        <button class="ghost" onclick={vuelta} disabled={!ms}>Vuelta</button>
        <button class="start" onclick={irCrono} disabled={!listo}>{corre ? 'Pausar' : ms ? 'Seguir' : 'Iniciar'}</button>
      </div>
      <button class="link-btn" onclick={reiniciarCrono}>Reiniciar</button>
      {#if crono.vueltas.length}
        <ol class="laps">{#each crono.vueltas as t, i (i)}<li><span>Vuelta {crono.vueltas.length - i}</span>{formatoCrono(t)}</li>{/each}</ol>
      {/if}
      <p class="tool-note">Cronómetro general. El de la sesión de entrenamiento está en Rutina en curso.</p>
    </div>
  {:else if herr === 'timer'}
    <div class="tool" id="panel-timer" role="tabpanel" aria-labelledby={idTab('timer')}>
      <div class="seg" role="radiogroup" aria-label="Duración">
        {#each MODOS as [m, t] (m)}<button class:on={temp.modo === m} role="radio" aria-checked={temp.modo === m} onclick={() => poner(m)}>{t}</button>{/each}
      </div>
      {#if temp.modo === 'libre'}
        <div class="free">
          <label for="tm-min">Min</label><input id="tm-min" type="number" inputmode="numeric" min="0" max="99" value={temp.min} oninput={(e) => poner('libre', Number(e.currentTarget.value), temp.seg)} />
          <label for="tm-sec">Seg</label><input id="tm-sec" type="number" inputmode="numeric" min="0" max="59" value={temp.seg} oninput={(e) => poner('libre', temp.min, Number(e.currentTarget.value))} />
        </div>
      {/if}
      <div class="ring-wrap">
        <svg class="rest-ring" viewBox="0 0 220 220" aria-hidden="true">
          <circle cx="110" cy="110" r="96" fill="none" stroke="var(--panel)" stroke-width="12" />
          <circle cx="110" cy="110" r="96" fill="none" stroke="var(--rose)" stroke-width="12" stroke-linecap="round" stroke-dasharray={ARCO} stroke-dashoffset={(ARCO * (1 - (temp.largo ? quedan / temp.largo : 0))).toFixed(1)} transform="rotate(-90 110 110)" />
        </svg>
        <div class="rest-time" role="timer" aria-label="Temporizador"><b>{formatoTemp(quedan)}</b><span>{estadoTextoTemp}</span></div>
      </div>
      <div class="two">
        <button class="ghost" onclick={() => poner(temp.modo)}>Reiniciar</button>
        <button class="start" onclick={irTemp} disabled={!listo}>{textoBotonTemp}</button>
      </div>
      <p class="tool-note">Al terminar: vibración y sonido. La pantalla se queda encendida mientras corre.</p>
    </div>
  {:else}
    <div class="tool" id="panel-coin" role="tabpanel" aria-labelledby={idTab('coin')}>
      <p class="coin-q">¿Fast food hoy? Que decida la moneda.</p>
      <button class="coin" aria-label="Lanzar la moneda" onclick={tirar} style:transform="perspective(600px) rotateY({vueltasMoneda * 180}deg)">
        <span class="face c-front">Cara</span><span class="face c-back">Cruz</span>
      </button>
      <p class="coin-res" aria-live="polite">{resultado}</p>
      <div class="coin-key">
        <label for="coin-a">Cara significa</label><input id="coin-a" type="text" bind:value={a} />
        <label for="coin-b">Cruz significa</label><input id="coin-b" type="text" bind:value={b} />
      </div>
    </div>
  {/if}
</div>
