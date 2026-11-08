<script lang="ts">
  import Interruptor from '../../core/Interruptor.svelte';
  import { avisos } from '../../core/aviso.svelte';
  import { cargarIA, claveValida, FUNCIONES, guardarClave, ia, leerUso, NUNCA_SE_ENVIA, ponerFuncion, ponerUsarIA, quitarClave, type FnIA } from './estado.svelte';
  import { dolares, type UsoIA } from './uso';
  import { iso } from '../../core/fechas';

  let clave = $state('');
  let uso = $state<UsoIA | null>(null);
  cargarIA();
  leerUso().then((u) => (uso = u));
  const mes = iso(new Date()).slice(0, 7);
  const desdeTxt = (f: string) => new Date(f + 'T12:00').toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' });
  const pedidos = (n: number) => n + (n === 1 ? ' pedido' : ' pedidos');

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
      <div class="aj-row ai-uso"><span><b>Consumo de esta app</b>{#if uso}<small>Este mes: {dolares(uso.meses[mes]?.usd ?? 0)} aprox. · {pedidos(uso.meses[mes]?.pedidos ?? 0)}</small><small>Desde el {desdeTxt(uso.desde)}: {dolares(uso.total.usd)} aprox. · {pedidos(uso.total.pedidos)}</small>{:else}<small>Aún no hay pedidos contados.</small>{/if}</span></div>
      <p class="tp-hint">Es una estimación con los precios de Anthropic y solo cuenta lo que pide esta app desde que empezó a contarlo. El cobro real y lo que usaste antes están en la consola de Anthropic.</p>
      <a class="ghost aj-link" href="https://console.anthropic.com/" target="_blank" rel="noopener">Abrir la consola de Anthropic</a>
      <p class="tp-hint">Tu clave se guarda solo en este teléfono. Crea una clave exclusiva para esta app y ponle un límite de gasto en tu cuenta de Anthropic.</p>
      <p class="tp-hint">{NUNCA_SE_ENVIA} La IA da ideas, no consejos médicos ni de dieta.</p>
    {/if}
  </div>
</section>
