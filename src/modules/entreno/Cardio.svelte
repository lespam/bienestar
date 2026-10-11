<script lang="ts">
  import { nav } from '../../core/nav.svelte';
  import { avisos } from '../../core/aviso.svelte';
  import { borrarCardio, cardiosRecientes, guardarCardio, type Cardio } from './datos';
  import { fechaCorta3 } from './semana';

  // Cardio aparte de la rutina: eliges qué hiciste y cuántos minutos. Cuenta como sesión.
  const TIPOS = ['Caminata', 'Bicicleta', 'Elíptica', 'Correr', 'Otro'];
  let tipo = $state('Caminata');
  let otro = $state('');
  let min = $state<number | null>(null);
  let nota = $state('');
  let recientes = $state<Cardio[]>([]);

  async function leer() { recientes = await cardiosRecientes(); }
  leer();

  const nombre = $derived(tipo === 'Otro' ? otro.trim() : tipo);
  const minutos = $derived(min == null ? NaN : Number(min));
  const valido = $derived(!!nombre && Number.isFinite(minutos) && minutos >= 1 && minutos <= 600);

  async function guardar() {
    if (!valido) return;
    const id = await guardarCardio(nombre, Math.round(minutos), nota.trim());
    min = null; nota = ''; otro = '';
    await leer();
    avisos.deshacer('Cardio guardado', async () => { await borrarCardio(id); await leer(); });
  }
  async function quitar(r: Cardio) {
    await borrarCardio(r.sesion);
    await leer();
    avisos.mostrar('Cardio quitado');
  }
</script>

<header class="cur-head">
  <button class="back" aria-label="Volver" onclick={() => nav.cerrar()}>‹ Volver</button>
</header>
<div class="screen">
  <div class="tl-head"><h2 tabindex="-1">Cardio</h2></div>
  <p class="seg-help">Anota lo que hiciste. Cuenta como una sesión, igual que tu rutina.</p>

  <section class="notes">
    <h4>¿Qué hiciste?</h4>
    <div class="cardio-tipos" role="radiogroup" aria-label="Tipo de cardio">
      {#each TIPOS as t (t)}<button role="radio" aria-checked={tipo === t} class:on={tipo === t} onclick={() => (tipo = t)}>{t}</button>{/each}
    </div>
  </section>
  <div class="man">
    {#if tipo === 'Otro'}<label for="ca-otro">¿Cuál?</label><input id="ca-otro" type="text" placeholder="Ej. Natación" bind:value={otro} />{/if}
    <label for="ca-min">Minutos</label><input id="ca-min" type="number" inputmode="decimal" placeholder="Ej. 30" bind:value={min} />
    <label for="ca-nota">Nota (opcional)</label><input id="ca-nota" type="text" placeholder="Cómo te sentiste" bind:value={nota} />
  </div>
  <button class="start" disabled={!valido} onclick={guardar}>Guardar cardio</button>

  {#if recientes.length}
    <section class="notes">
      <h4>Tu cardio reciente</h4>
      <div class="cardio-lista">
        {#each recientes as r (r.sesion)}
          <div class="fila"><span>{r.nombre} · {r.min} min<small>{fechaCorta3(r.fecha)}{r.nota ? ' · ' + r.nota : ''}</small></span>
            <button aria-label={'Quitar ' + r.nombre + ' del ' + fechaCorta3(r.fecha)} onclick={() => quitar(r)}>×</button></div>
        {/each}
      </div>
    </section>
  {/if}
</div>
