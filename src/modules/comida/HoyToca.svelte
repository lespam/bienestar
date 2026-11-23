<script lang="ts">
  import type { Tanda } from '../../core/db';
  import { avisos } from '../../core/aviso.svelte';
  import { nav } from '../../core/nav.svelte';
  import { fechaDe } from './calculos';
  import { guardarPrep, leerPrep } from './datos';
  import { idTanda, porDiaYUrgencia, sumarDias } from './preparacion';

  // «Hoy toca»: una sola cosa a la vez, con su tiempo. Lo pospuesto pasa a mañana sin marca de falla; lo hecho solo suma.
  const hoy = fechaDe(0);
  let todas = $state<Tanda[]>([]);
  let listo = $state(false);
  leerPrep().then((t) => { todas = t; listo = true; });

  const guardar = () => guardarPrep($state.snapshot(todas));
  const pendientes = $derived(
    [...todas].filter((t) => t.fecha <= hoy).sort(porDiaYUrgencia).flatMap((t) => t.items.filter((i) => !i.ok).map((i) => ({ t, i })))
  );
  const hechasHoy = $derived(todas.filter((t) => t.fecha === hoy).reduce((a, t) => a + t.items.filter((i) => i.ok).length, 0));
  const ahora = $derived(pendientes[0]);
  const despues = $derived(pendientes.length - 1);

  function hecho() {
    const a = ahora;
    if (!a) return;
    a.i.ok = true;
    guardar();
    avisos.deshacer('Hecho: ' + a.i.t, () => { a.i.ok = false; guardar(); });
  }
  function posponer() {
    const a = ahora;
    if (!a) return;
    const antes = $state.snapshot(todas) as Tanda[];
    const manana = sumarDias(hoy, 1);
    let m = todas.find((x) => x.fecha === manana);
    if (!m) { m = { id: idTanda(), fecha: manana, hora: '', items: [] }; todas.push(m); m = todas[todas.length - 1]; }
    a.t.items.splice(a.t.items.indexOf(a.i), 1);
    m.items.push(a.i);
    guardar();
    avisos.deshacer('«' + a.i.t + '» pasó a mañana', () => { todas = antes; guardar(); });
  }
</script>

<header class="cur-head">
  <button class="back" aria-label="Volver" onclick={() => nav.cerrar()}>‹ Volver</button>
</header>
<div class="screen">
  <div class="tl-head">
    <h2 tabindex="-1">Hoy toca</h2>
    <p class="seg-help">Una cosa a la vez. Lo que no alcances pasa a mañana sin problema.</p>
  </div>
  {#if listo}
    {#if ahora}
      <section class="ht-card" aria-live="polite">
        <b class="ht-t">{ahora.i.t}</b>
        {#if ahora.i.m}<p class="ht-m">Unos {ahora.i.m} min</p>{/if}
        {#if ahora.i.s}<p class="seg-help">{ahora.i.s}</p>{/if}
        <button class="start" onclick={hecho}>Hecho</button>
        <button class="ghost" onclick={posponer}>Después</button>
      </section>
      <p class="seg-help">{despues > 0 ? 'Después de esta hay ' + despues + (despues === 1 ? ' cosa más.' : ' cosas más.') : 'Es la última de hoy.'}</p>
    {:else}
      <section class="ht-card">
        <b class="ht-t">Nada por preparar ahora</b>
        <p class="seg-help">Cuando pongas comidas en el menú, aquí aparece lo que conviene dejar listo antes.</p>
        <button class="ghost" onclick={() => nav.abrir('prep')}>Ver el plan de preparación</button>
      </section>
    {/if}
    {#if hechasHoy}<p class="tool-note">Hoy llevas {hechasHoy} {hechasHoy === 1 ? 'cosa lista' : 'cosas listas'}.</p>{/if}
  {/if}
</div>
