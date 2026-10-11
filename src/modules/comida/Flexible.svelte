<script lang="ts">
  import type { DiaFlexible } from '../../core/db';
  import { avisos } from '../../core/aviso.svelte';
  import { nav } from '../../core/nav.svelte';
  import { etapaTxt, fasesEn } from '../cuerpo';
  import { fechaDe } from './calculos';
  import { flexibleDe, guardarFlexible, quitarFlexible } from './datos';
  import { vista } from './estado.svelte';
  import { PREGUNTAS } from './patrones';

  // Un día flexible es parte del plan. Todo es opcional y se puede guardar sin llenar nada.
  const hoy = fechaDe(0);
  let resp = $state<Record<string, string>>({ hora: 'Tarde' });
  let comi = $state('');
  let previo: DiaFlexible | undefined;
  let etapa = $state<string | null>(null);
  let listo = $state(false);

  (async () => {
    previo = await flexibleDe(hoy);
    if (previo) { resp = { hora: previo.hora, emo: previo.emo, lugar: previo.lugar, sueno: previo.sueno, estres: previo.estres }; comi = previo.comi; }
    const e = (await fasesEn([hoy]))[hoy];
    etapa = e ? etapaTxt(e) : null;
    listo = true;
  })();

  const alternar = (k: string, o: string) => { resp[k] = resp[k] === o ? '' : o; };

  async function guardar() {
    const antes = previo;
    const nuevo: DiaFlexible = { fecha: hoy, hora: resp.hora ?? '', emo: resp.emo ?? '', lugar: resp.lugar ?? '', sueno: resp.sueno ?? '', estres: resp.estres ?? '', comi: comi.trim() };
    await guardarFlexible(nuevo);
    vista.cambio++;
    nav.cerrar();
    avisos.deshacer('Día flexible guardado', async () => { if (antes) await guardarFlexible(antes); else await quitarFlexible(hoy); vista.cambio++; });
  }
</script>

<header class="cur-head">
  <button class="back" aria-label="Volver" onclick={() => nav.cerrar()}>‹ Volver</button>
  <span class="example">todo es opcional</span>
</header>
<div class="screen">
  <div class="tl-head">
    <h2 tabindex="-1">Día flexible</h2>
    <p class="seg-help">Anota lo que quieras del contexto. Sirve para conocerte, no para juzgarte. Puedes guardar sin llenar nada.</p>
  </div>
  <div class="man fx-form">
    <div class="man">
      {#each PREGUNTAS as q (q.k)}
        <span class="sh-lbl">{q.t}</span>
        <div class="m-chips" role="group" aria-label={q.t}>
          {#each q.op as o (o)}<button class:on={resp[q.k] === o} aria-pressed={resp[q.k] === o} onclick={() => alternar(q.k, o)}>{o}</button>{/each}
        </div>
      {/each}
    </div>
    <span class="sh-lbl">Etapa del ciclo</span>
    <p class="fx-cyc">{#if etapa}{etapa} <small>Sale de tu calendario de Período.</small>{:else if listo}Sin dato por ahora <small>Si marcas tu Período en Cuerpo, aquí aparece la etapa.</small>{/if}</p>
    <label for="fx-what">Qué comiste (opcional)</label>
    <textarea id="fx-what" rows="3" placeholder="Ej. pizza con Jeff viendo una película" bind:value={comi}></textarea>
  </div>
</div>
<div class="cur-foot"><button class="start" onclick={guardar}>Guardar</button></div>
