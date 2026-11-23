<script lang="ts">
  import Hoja from '../../core/Hoja.svelte';
  import { nav } from '../../core/nav.svelte';
  import { avisos } from '../../core/aviso.svelte';
  import { elegirArchivo } from '../../core/archivos';
  import { aplicar, propuesta, reemplazarTodo, revisarZip, type Decision, type Leido, type Revision } from '../../core/continuidad';
  import { volverACopia } from '../../core/respaldo';
  import { cuandoTxt } from '../../core/fechas';

  // Importar un respaldo o un paquete de continuidad: primero se compara por área y tú confirmas qué se reemplaza,
  // qué se conserva y qué se combina. Antes de cambiar algo se guarda una copia interna, para «Deshacer».
  let { alCambiar }: { alCambiar: () => Promise<void> } = $props();

  let leido = $state.raw<Leido | null>(null);
  let revision = $state<Revision | null>(null);
  let elegido = $state<Record<string, Decision>>({});
  let aplicando = $state(false);

  async function elegir() {
    nav.cerrar();
    const f = await elegirArchivo();
    if (!f) return;
    const r = await revisarZip(f.bytes);
    if (!r) { avisos.mostrar('Este archivo no es un respaldo de la app, o es de una versión más nueva. No cambié nada.'); return; }
    leido = r.leido; revision = r.revision; elegido = propuesta(r.revision);
    nav.abrirHoja('importar-revisar');
  }

  const ETIQUETA: Record<Decision, string> = { reemplazar: 'Usar lo del paquete', conservar: 'Dejar lo de aquí', combinar: 'Combinar los dos' };
  const lugar = $derived(revision?.origen === 'telefono' ? 'el teléfono' : revision?.origen === 'computadora' ? 'la computadora' : 'otro aparato');
  const cambios = $derived(revision ? revision.filas.filter((f) => f.sugerida !== 'igual') : []);
  const iguales = $derived(revision ? revision.filas.filter((f) => f.sugerida === 'igual' && (f.hayAqui || f.hayArchivo)) : []);

  async function confirmar(decisiones: Record<string, Decision>) {
    if (!leido || aplicando) return;
    aplicando = true;
    try {
      const r = await aplicar(leido, decisiones);
      nav.cerrar();
      await alCambiar();
      const partes = [r.reemplazadas.length ? r.reemplazadas.length + (r.reemplazadas.length === 1 ? ' área reemplazada' : ' áreas reemplazadas') : '', r.combinadas.length ? r.combinadas.length + (r.combinadas.length === 1 ? ' área combinada' : ' áreas combinadas') : ''].filter(Boolean);
      avisos.deshacer('Respaldo importado' + (partes.length ? ': ' + partes.join(' y ') : '. No cambió nada'), async () => { await volverACopia(r.copia); await alCambiar(); avisos.mostrar('Volviste a tus datos anteriores'); });
    } finally { aplicando = false; }
  }
</script>

{#if nav.hojaAbierta('importar')}
  <Hoja titulo="Importar respaldo">
    <p class="seg-help">Sirve para volver a un respaldo o para seguir en otro aparato (del teléfono a la computadora y al revés). Antes de cambiar nada te muestro qué se reemplaza y qué se combina, y tú confirmas. También guardo una copia de lo que tienes ahora, por si quieres volver.</p>
    <button class="start" onclick={elegir}>Elegir archivo ZIP</button>
    <button class="ghost" onclick={() => nav.cerrar()}>Cancelar</button>
  </Hoja>
{/if}

{#if nav.hojaAbierta('importar-revisar') && revision}
  <Hoja titulo="Qué trae este paquete">
    <p class="seg-help">
      {#if revision.creado}Se creó {cuandoTxt(revision.creado)} en {lugar}.{:else}No dice cuándo se creó.{/if}
      {#if revision.sinFechas} Es de una versión anterior y no trae fechas por área: propongo traer todo, como antes.{:else} Comparé por área cuándo cambió cada lado. Tú decides.{/if}
    </p>
    {#each cambios as f (f.id)}
      <section class="ip-area" aria-labelledby={'ip-' + f.id}>
        <b id={'ip-' + f.id}>{f.nombre}</b>
        <p class="ip-fechas">Aquí: {f.hayAqui ? (f.aqui ? 'cambió ' + cuandoTxt(f.aqui) : 'sin fecha de cambio') : 'sin datos'} · Paquete: {f.hayArchivo ? (f.archivo ? 'cambió ' + cuandoTxt(f.archivo) : 'sin fecha de cambio') : 'sin datos'}</p>
        <div class="m-chips" role="radiogroup" aria-labelledby={'ip-' + f.id}>
          {#each f.opciones as o (o)}
            <button role="radio" class:on={elegido[f.id] === o} aria-checked={elegido[f.id] === o} onclick={() => (elegido[f.id] = o)}>{ETIQUETA[o]}{f.sugerida === o ? ' · propuesto' : ''}</button>
          {/each}
        </div>
        {#if elegido[f.id] === 'combinar'}<p class="ip-nota">Junta lo de los dos. Si algo cambió en ambos, queda lo más reciente. Lo que quitaste en un lado puede volver.</p>{/if}
      </section>
    {:else}
      <p class="ip-nota">No hay nada que traer: lo de aquí y lo del paquete ya coinciden.</p>
    {/each}
    {#if iguales.length}<p class="ip-nota">Sin cambios: {iguales.map((f) => f.nombre).join(', ')}.</p>{/if}
    <button class="start" disabled={aplicando || !cambios.length} onclick={() => confirmar(elegido)}>Aplicar lo que elegí</button>
    <button class="ghost" disabled={aplicando} onclick={() => confirmar(reemplazarTodo(revision!))}>Reemplazar todo con el paquete</button>
    <button class="ghost" onclick={() => nav.cerrar()}>No cambiar nada</button>
  </Hoja>
{/if}
