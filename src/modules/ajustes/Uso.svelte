<script lang="ts">
  import { avisos } from '../../core/aviso.svelte';
  import { entregarArchivo } from '../../core/archivos';
  import { nav } from '../../core/nav.svelte';
  import { activarUso, borrarUso, exportarUso, leerUso, restaurarUso, type DatosUso } from '../../core/uso';
  import Interruptor from '../../core/Interruptor.svelte';
  import { resumirUso } from './resumenUso';

  // «Cómo uso la app»: solo cuenta. Sin metas, sin rachas que se pierdan.
  let datos = $state<DatosUso>(leerUso());
  const r = $derived(resumirUso(datos));
  const veces = (n: number) => n + (n === 1 ? ' vez' : ' veces');
  const lista = (x: [string, number][]) => x.map(([n, v]) => n + ' (' + v + ')').join(', ');

  async function alternar() {
    await activarUso(!datos.activo);
    datos = leerUso();
  }
  async function exportar() {
    const hoy = new Date().toISOString().slice(0, 10);
    const t = await entregarArchivo('uso-bienestar-' + hoy + '.json', new TextEncoder().encode(exportarUso(hoy)), 'application/json');
    if (t !== 'cancelado') avisos.mostrar(t === 'compartido' ? 'Listo. Es un archivo pequeño, solo con números.' : 'Listo. Se descargó el archivo, solo con números.');
  }
  async function borrar() {
    const antes = leerUso();
    await borrarUso();
    datos = leerUso();
    avisos.deshacer('Borré tus contadores', async () => { await restaurarUso(antes); datos = leerUso(); });
  }
</script>

<header class="cur-head">
  <button class="back" aria-label="Volver" onclick={() => nav.cerrar()}>‹ Volver</button>
</header>
<div class="screen">
  <div class="tl-head">
    <h2 tabindex="-1">Cómo uso la app</h2>
    <p class="seg-help">Es solo información para ti. No hay nada que cumplir.</p>
  </div>

  <section class="pf-card" aria-label="Medir mi uso">
    <Interruptor id="us-sw" encendido={datos.activo} titulo="Medir mi uso" detalle="Cuenta pantallas abiertas y funciones usadas por semana. Sin texto ni fotos, solo en tu teléfono." onchange={alternar} />
  </section>

  {#if !r.activo && !Object.keys(datos.semanas).length}
    <p class="seg-help">Con el interruptor apagado no se cuenta nada. Si lo enciendes, aquí verás lo que más usas.</p>
  {:else}
    <section class="pf-card" aria-labelledby="us-h1">
      <h4 id="us-h1">Esta semana</h4>
      {#if r.esta.pantallas.length || r.esta.funciones.length}
        {#if r.esta.pantallas.length}<p class="us-l">Abriste: {lista(r.esta.pantallas)}.</p>{/if}
        {#if r.esta.funciones.length}<p class="us-l">Usaste: {lista(r.esta.funciones)}.</p>{/if}
      {:else}
        <p class="seg-help">Todavía no hay nada contado esta semana.</p>
      {/if}
      {#if r.racha >= 2}<p class="seg-help">Llevas {r.racha} semanas seguidas usando la app.</p>{/if}
      {#if r.semanasPlaneadas}<p class="seg-help">Has planeado tu menú en {r.semanasPlaneadas} {r.semanasPlaneadas === 1 ? 'semana' : 'semanas'}.</p>{/if}
    </section>

    {#if r.masUsado.length}
      <section class="pf-card" aria-labelledby="us-h2">
        <h4 id="us-h2">Lo que más usas</h4>
        <p class="seg-help">En las últimas 4 semanas.</p>
        <ol class="us-top">
          {#each r.masUsado as [n, v] (n)}<li><span>{n}</span><b>{veces(v)}</b></li>{/each}
        </ol>
      </section>
    {/if}

    {#if r.diasMidiendo >= 7 && r.sinAbrir.length}
      <section class="pf-card" aria-labelledby="us-h3">
        <h4 id="us-h3">Lo que no has abierto</h4>
        <p class="seg-help">{r.sinAbrir.join(', ')}. Quizá no lo necesitas ahora; sirve para saber qué quitar o qué recordarte.</p>
      </section>
    {/if}

    {#if r.sugerencias.length}
      <section class="pf-card" aria-labelledby="us-h4">
        <h4 id="us-h4">Ideas de la app</h4>
        <ul class="us-top">
          {#each r.sugerencias as s (s.nombre)}<li><span>{s.nombre}</span><b>{s.si} aceptadas · {s.no} rechazadas</b></li>{/each}
        </ul>
      </section>
    {/if}

    <section class="pf-card" aria-labelledby="us-h5">
      <h4 id="us-h5">Tus contadores</h4>
      <p class="seg-help">{datos.desde ? 'Cuentan desde el ' + datos.desde + '. ' : ''}Exportarlos crea un archivo pequeño que puedes subir a una conversación para un análisis. Nada se envía solo.</p>
      <button class="ghost" onclick={exportar} disabled={!Object.keys(datos.semanas).length}>Exportar contadores (JSON)</button>
      <button class="ghost" onclick={borrar} disabled={!Object.keys(datos.semanas).length}>Borrar mis contadores</button>
    </section>
  {/if}
  <p class="tool-note">La app no mide qué escribes ni qué fotos tienes. Solo cuántas veces abres cada cosa.</p>
</div>
