<script lang="ts">
  import Interruptor from '../../core/Interruptor.svelte';
  import { avisos } from '../../core/aviso.svelte';
  import { MODELO_IMAGEN } from './gemini';
  import { cargarGemini, claveGeminiValida, gem, guardarClaveGemini, ponerModeloGemini, ponerUsarGemini, QUE_ENVIA_GEMINI, quitarClaveGemini } from './gemini.svelte';
  import { NUNCA_SE_ENVIA } from './estado.svelte';

  let clave = $state('');
  let modelo = $state('');
  cargarGemini().then(() => { modelo = gem.modelo; });

  async function usar() { await ponerUsarGemini(!gem.on); avisos.mostrar('Guardado'); }
  async function guardar() {
    if (!claveGeminiValida(clave)) { avisos.mostrar('La clave de Gemini empieza con AIza'); return; }
    await guardarClaveGemini(clave);
    clave = '';
    avisos.mostrar('Clave guardada en este teléfono');
  }
  async function quitar() { await quitarClaveGemini(); avisos.mostrar('Clave quitada'); }
  async function guardarModelo() { await ponerModeloGemini(modelo); modelo = gem.modelo; avisos.mostrar('Guardado'); }
</script>

<section class="tp-sec"><h4>Imágenes con Gemini</h4>
  <div class="group aj-g" id="aj-gem">
    <Interruptor id="aj-gem-on" encendido={gem.on} titulo="Generar imágenes con Gemini" detalle="Apagado de inicio. Solo funciona con tu propia clave de Google." onchange={usar} />
    {#if gem.on}
      {#if gem.tieneClave}
        <div class="aj-row"><span><b>Clave guardada</b><small>····{gem.fin}</small></span><button class="pf-ed" onclick={quitar}>Quitar<span class="sr-only"> la clave de Gemini</span></button></div>
      {:else}
        <div class="man ai-key">
          <label for="gem-key">Tu clave de Gemini</label>
          <input id="gem-key" type="password" autocomplete="off" placeholder="AIza…" bind:value={clave} />
          <button class="start" onclick={guardar}>Guardar clave de Gemini</button>
        </div>
      {/if}
      <div class="man ai-key">
        <label for="gem-modelo">Modelo de imagen</label>
        <input id="gem-modelo" type="text" autocomplete="off" autocapitalize="none" spellcheck="false" placeholder={MODELO_IMAGEN} bind:value={modelo} />
        <button class="ghost" onclick={guardarModelo}>Guardar modelo</button>
      </div>
      <p class="tp-hint">Google cambia los nombres de sus modelos con el tiempo. Si «Generar imagen» dice que no encuentra el modelo, pon aquí el nombre vigente.</p>
      <a class="ghost aj-link" href="https://aistudio.google.com/apikey" target="_blank" rel="noopener">Abrir Google AI Studio</a>
      <p class="tp-hint">Tu clave se guarda solo en este teléfono y nunca va en el respaldo. Crea una clave exclusiva para esta app. El cobro, si lo hay, es de tu cuenta de Google.</p>
      <p class="tp-hint">Al generar una imagen se envía a Google: {QUE_ENVIA_GEMINI}. {NUNCA_SE_ENVIA} Es una ilustración hecha con IA, no una foto real, y la revisas antes de guardarla.</p>
    {/if}
  </div>
</section>
