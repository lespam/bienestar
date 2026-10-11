<script lang="ts">
  import Interruptor from '../../core/Interruptor.svelte';
  import { avisos } from '../../core/aviso.svelte';
  import { cargarIA, claveValida, FUNCIONES, guardarClave, ia, NUNCA_SE_ENVIA, ponerFuncion, ponerUsarIA, quitarClave, type FnIA } from './estado.svelte';

  let clave = $state('');
  cargarIA();

  async function usar() { await ponerUsarIA(!ia.on); avisos.mostrar('Guardado'); }
  async function funcion(k: FnIA) { await ponerFuncion(k, !ia.fn[k]); avisos.mostrar('Guardado'); }
  async function guardar() {
    if (!claveValida(clave)) { avisos.mostrar('La clave de Anthropic empieza con sk-ant-'); return; }
    await guardarClave(clave);
    clave = '';
    avisos.mostrar('Clave guardada en este teléfono');
  }
  async function quitar() { await quitarClave(); avisos.mostrar('Clave quitada'); }
</script>

<section class="tp-sec"><h4>Asistente con IA</h4>
  <div class="group aj-g" id="aj-ai">
    <Interruptor id="aj-ai-on" encendido={ia.on} titulo="Usar IA" detalle="Apagada de inicio. Solo funciona con tu propia clave." onchange={usar} />
    {#if ia.on}
      {#if ia.tieneClave}
        <div class="aj-row"><span><b>Clave guardada</b><small>····{ia.fin}</small></span><button class="pf-ed" onclick={quitar}>Quitar<span class="sr-only"> la clave</span></button></div>
      {:else}
        <div class="man ai-key">
          <label for="ai-key">Tu clave de Anthropic</label>
          <input id="ai-key" type="password" autocomplete="off" placeholder="sk-ant-…" bind:value={clave} />
          <button class="start" onclick={guardar}>Guardar clave</button>
        </div>
      {/if}
      {#each Object.entries(FUNCIONES) as [k, [titulo, envia]] (k)}
        <Interruptor id={'aj-ai-' + k} encendido={ia.fn[k as FnIA]} {titulo} detalle={'Envía ' + envia + '.'} onchange={() => funcion(k as FnIA)} />
      {/each}
      <p class="tp-hint">Tu clave se guarda solo en este teléfono. Crea una clave exclusiva para esta app y ponle un límite de gasto en tu cuenta de Anthropic.</p>
      <p class="tp-hint">{NUNCA_SE_ENVIA} La IA da ideas, no consejos médicos ni de dieta.</p>
    {/if}
  </div>
</section>
