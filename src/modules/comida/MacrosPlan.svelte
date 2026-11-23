<script lang="ts">
  import type { ItemMenu, PerfilComida, Receta } from '../../core/db';
  import Hoja from '../../core/Hoja.svelte';
  import { nav } from '../../core/nav.svelte';
  import { numerosVisibles, vista } from './estado.svelte';
  import { PERSONAS, barraKcal, barraMacro, gramosTxt, hayReferencia, kcalTxt, promedio, rangoTxt, referenciaDe, resumenDia, sinNumerosTxt, textoBarra } from './macros';
  import { nombreDia, numeroDia } from './semana';

  // Lo que suma el menú de un día (y de la semana) para cada quien, junto a la referencia que escribieron ustedes.
  // Con «Ocultar números» no hay barras ni cifras. Sin rojos, sin «te falta»: es información.
  let { fecha, dias, items, recetas, perfiles }: { fecha: string; dias: string[]; items: ItemMenu[]; recetas: Receta[]; perfiles: Record<'les' | 'jeff', PerfilComida> } = $props();

  const porId = $derived(new Map(recetas.map((r) => [r.id, r])));
  const ver = $derived(numerosVisibles());
  const delDia = (f: string) => items.filter((m) => m.fecha === f);
  const resumen = (f: string, w: 'les' | 'jeff') => resumenDia(delDia(f), w, porId, perfiles);

  const hoy = $derived(PERSONAS.map(({ w, n }) => ({ w, n, d: resumen(fecha, w), ref: referenciaDe(perfiles[w]) })));
  const sinDato = $derived(Math.max(...hoy.map((x) => x.d.sinDato)));
  const hayAlgo = $derived(hoy.some((x) => x.d.conDato > 0));
  const semana = $derived(PERSONAS.map(({ w, n }) => {
    const filas = dias.map((f) => ({ f, d: resumen(f, w) }));
    return { w, n, ref: referenciaDe(perfiles[w]), filas, prom: promedio(filas.map((x) => x.d)) };
  }));
  const haySemana = $derived(semana.some((x) => x.prom));
</script>

<section class="mc" aria-labelledby="mc-t">
  <div class="mc-h">
    <h3 id="mc-t">Lo que suma este día</h3>
    {#if ver}<p>Aproximado, con la porción de cada quien.</p>{/if}
  </div>
  {#if !ver}
    <div class="pf-hid"><span>Calorías y macros ocultos.</span><button class="ghost w-btn" onclick={() => (vista.ver = true)}>Mostrar</button></div>
  {:else if !hayAlgo}
    <p class="mc-nota">Este día todavía no tiene comidas con números. Cuando elijas recetas con calorías y macros, aquí se ve lo que suman.</p>
  {:else}
    {#each hoy as x (x.w)}
      {@const b = barraKcal(x.d.k, x.ref.k)}
      <div class="mc-p">
        <div class="mc-top"><b>{x.n}</b><span>Planeado {kcalTxt(x.d.k)}{x.ref.k ? ' · tu referencia ' + rangoTxt(x.ref.k) : ''}</span></div>
        <div class="mc-bar {x.w}" role="img" aria-label={textoBarra(x.n, x.d, x.ref)}>
          {#if x.ref.k}<span class="mc-band" style:left={b.bandaDesde + '%'} style:width={b.bandaAncho + '%'}></span>{/if}
          <i style:width={b.relleno + '%'}></i>
        </div>
        {#each [['Proteína', x.d.p, x.ref.p], ['Carbohidratos', x.d.c, x.ref.c], ['Grasa', x.d.g, x.ref.g]] as [nombre, v, r] (nombre)}
          {@const m = barraMacro(v as number, r as number | null)}
          <div class="mc-m">
            <span>{nombre}</span>
            <div class="mc-mbar {x.w}" aria-hidden="true"><i style:width={(r ? m.relleno : 0) + '%'}></i>{#if m.marca != null}<em style:left={m.marca + '%'}></em>{/if}</div>
            <span>{gramosTxt(v as number)}{r ? ' · ref. ' + r : ''}</span>
          </div>
        {/each}
      </div>
    {/each}
    {#if sinDato}<p class="mc-nota">{sinNumerosTxt(sinDato)}: no se suman.</p>{/if}
    {#if hoy.every((x) => !hayReferencia(x.ref))}
      <p class="mc-nota">Si quieres ver tu barra, escribe una referencia en tu perfil. La app no la calcula.</p>
    {:else}
      <p class="mc-nota">La franja es la referencia que escribieron ustedes o su nutrióloga; la marca de cada macro, la suya. La app no las calcula ni las juzga.</p>
    {/if}
    {#if haySemana}<button class="ghost" onclick={() => nav.abrirHoja('mn-mac')}>Ver la semana</button>{/if}
  {/if}
</section>

{#if nav.hojaAbierta('mn-mac')}
  <Hoja titulo="Macros de la semana">
    <p class="seg-help">Cada día contra la referencia de cada quien. Un día sin menú queda vacío: no cuenta como poco.</p>
    {#each semana as x (x.w)}
      <div class="mc-sem">
        <b class="mc-quien">{x.n}</b>
        {#each x.filas as { f, d } (f)}
          {@const b = barraKcal(d.k, x.ref.k)}
          <div class="mc-dia">
            <span class="mc-dn"><b>{nombreDia(f).slice(0, 3)}</b> {numeroDia(f)}</span>
            <div class="mc-bar {x.w}" role="img" aria-label={textoBarra(x.n + ' · ' + nombreDia(f), d, x.ref)}>
              {#if x.ref.k}<span class="mc-band" style:left={b.bandaDesde + '%'} style:width={b.bandaAncho + '%'}></span>{/if}
              <i style:width={(d.conDato ? b.relleno : 0) + '%'}></i>
            </div>
            <span class="mc-dk">{d.conDato ? kcalTxt(d.k) : d.hayMenu ? 'Sin números' : 'Sin menú'}</span>
          </div>
        {/each}
        {#if x.prom}
          <p class="mc-prom">Promedio de {x.prom.dias === 1 ? 'su día planeado' : 'sus ' + x.prom.dias + ' días planeados'}: {kcalTxt(x.prom.k)} · proteína {gramosTxt(x.prom.p)} · carbohidratos {gramosTxt(x.prom.c)} · grasa {gramosTxt(x.prom.g)}</p>
        {/if}
      </div>
    {/each}
  </Hoja>
{/if}
