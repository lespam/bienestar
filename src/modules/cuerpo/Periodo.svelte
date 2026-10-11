<script lang="ts">
  import { avisos } from '../../core/aviso.svelte';
  import { iso } from '../../core/fechas';
  import { claveDia, diasDelMes, etiquetaFecha, nombreMes, sumarMes } from './calculos';
  import { diasDePeriodo, marcarDia, quitarDia } from './datos';

  // Un calendario con los días que marcas y una nota por día. No calcula ni predice nada.
  const hoy = new Date();
  const hoyIso = iso(hoy);
  const LIMITE_ATRAS = 36;
  let mes = $state({ a: hoy.getFullYear(), m: hoy.getMonth() });
  let dias = $state<Record<string, string>>({});
  let sel = $state(hoyIso);
  let nota = $state('');
  let temporizador: ReturnType<typeof setTimeout> | undefined;

  async function leer() { dias = await diasDePeriodo(); nota = dias[sel] ?? ''; }
  leer();

  const rejilla = $derived(diasDelMes(mes.a, mes.m));
  const esAhora = $derived(mes.a === hoy.getFullYear() && mes.m === hoy.getMonth());
  const atras = $derived((hoy.getFullYear() - mes.a) * 12 + hoy.getMonth() - mes.m);
  const marcado = $derived(sel in dias);
  const futuro = $derived(sel > hoyIso);
  const lista = $derived(Object.keys(dias).sort().reverse().slice(0, 40));

  function ir(delta: number) { mes = sumarMes(mes.a, mes.m, delta); }
  function elegir(k: string) { clearTimeout(temporizador); sel = k; nota = dias[k] ?? ''; }

  async function alternar() {
    clearTimeout(temporizador);
    if (marcado) {
      const previa = dias[sel], dia = sel;
      await quitarDia(dia);
      delete dias[dia]; nota = '';
      avisos.deshacer('Día quitado', async () => { await marcarDia(dia, previa); dias[dia] = previa; if (sel === dia) nota = previa; });
    } else if (!futuro) {
      await marcarDia(sel, '');
      dias[sel] = '';
    }
  }
  function escribir() {
    const dia = sel, texto = nota;
    clearTimeout(temporizador);
    temporizador = setTimeout(async () => { if (dia in dias) { await marcarDia(dia, texto); dias[dia] = texto; } }, 500);
  }
  const etiqueta = (k: string) => etiquetaFecha(k) + (k in dias ? ', marcado' : '');
</script>

<div class="tool" id="b-per">
  <div class="cal-head">
    <button class="cal-nav" aria-label="Mes anterior" disabled={atras >= LIMITE_ATRAS} onclick={() => ir(-1)}>‹</button>
    <b aria-live="polite">{nombreMes(mes.a, mes.m)}</b>
    <button class="cal-nav" aria-label="Mes siguiente" disabled={esAhora} onclick={() => ir(1)}>›</button>
  </div>
  <div class="cal" role="group" aria-label={'Calendario de ' + nombreMes(mes.a, mes.m)}>
    {#each ['L', 'M', 'M', 'J', 'V', 'S', 'D'] as w, i (i)}<span class="wd" aria-hidden="true">{w}</span>{/each}
    {#each [...Array(rejilla.huecos).keys()] as h (h)}<span></span>{/each}
    {#each [...Array(rejilla.dias).keys()] as i (i)}
      {@const k = claveDia(mes.a, mes.m, i + 1)}
      <button class:mk={k in dias} class:note={!!dias[k]} class:sel={k === sel} class:today={k === hoyIso} aria-label={etiqueta(k)} aria-pressed={k === sel} onclick={() => elegir(k)}>{i + 1}</button>
    {/each}
  </div>
  <div class="day-note">
    <div class="dn-head"><b>{etiquetaFecha(sel)}</b><button class="ghost dn-btn" disabled={!marcado && futuro} onclick={alternar}>{marcado ? 'Quitar día' : 'Marcar día'}</button></div>
    <label for="dn-text" class="dn-lab">Nota del día</label>
    <textarea id="dn-text" rows="2" disabled={!marcado} placeholder={marcado ? 'Escribe una nota' : 'Marca el día para escribir una nota'} bind:value={nota} oninput={escribir}></textarea>
  </div>
  <div class="per-list">
    <h4>Fechas registradas</h4>
    <div>
      {#each lista as k (k)}<div class="p-row"><b>{etiquetaFecha(k)}</b><span>{dias[k] || 'Sin nota'}</span></div>{:else}<p class="tool-note left">Aún no hay fechas.</p>{/each}
    </div>
  </div>
</div>
