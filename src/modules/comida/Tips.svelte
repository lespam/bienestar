<script lang="ts">
  import type { ItemMenu, Receta } from '../../core/db';
  import { avisos } from '../../core/aviso.svelte';
  import { nav } from '../../core/nav.svelte';
  import { cap, fechaDe } from './calculos';
  import { AnfitrionIA, iaLista, pedirIA, tipsGenerales } from '../ia';
  import { guardarTips, leerTips, listarRecetas, menuDe, sembrarRecetas } from './datos';
  import { fechasDeSemana } from './semana';
  import { COMBINACIONES, diasEnMenu, recetasDe, tipsVacios, tipsVisibles, yLista, type FilaTip } from './tips';

  const hoy = fechaDe(0);
  let pestana = $state<'tips' | 'comb'>('tips');
  let g = $state(tipsVacios());
  let recetas = $state<Receta[]>([]);
  let menu = $state<ItemMenu[]>([]);
  let agregando = $state(false);
  let nuevo = $state('');

  const guardar = () => guardarTips($state.snapshot(g));

  (async () => {
    await sembrarRecetas();
    [g, recetas, menu] = await Promise.all([leerTips(), listarRecetas(), menuDe(fechasDeSemana(0))]);
    // Cada semana llega un tip nuevo: se cuenta desde la primera vez que abres esta pantalla.
    if (!g.inicio) { g.inicio = hoy; guardar(); }
  })();

  const filas = $derived(tipsVisibles(g, hoy));
  const porProbar = $derived(filas.filter((x) => !x.ok));
  const practicados = $derived(filas.filter((x) => x.ok));

  function cambiar(x: FilaTip, ok: boolean) {
    const poner = (v: boolean) => {
      if (x.mio) { const m = g.mios.find((y) => y.id === x.id); if (m) m.ok = v; }
      else g.ok = v ? [...new Set([...g.ok, x.id])] : g.ok.filter((i) => i !== x.id);
      guardar();
    };
    poner(ok);
    avisos.deshacer(ok ? 'Movido a «Ya los practicas»' : 'Movido a «Por probar»', () => poner(!ok));
  }
  function agregarTip() {
    const v = nuevo.trim();
    if (!v) { avisos.mostrar('Escribe tu tip'); return; }
    const t = { id: 'm' + Date.now().toString(36), t: cap(v), ok: false };
    g.mios.unshift(t);
    agregando = false;
    nuevo = '';
    guardar();
    avisos.deshacer('Tip agregado', () => { g.mios = g.mios.filter((y) => y.id !== t.id); guardar(); });
  }
  /** Un tip general de la IA: no se envía nada tuyo. Lo guardas solo si quieres. */
  function pedirTip() {
    pedirIA({
      fn: 'tips', titulo: 'Ayuda con IA', envia: 'solo una petición de ideas generales de cocina; no se envía nada tuyo',
      ejecutar: async (clave) => ({
        intro: 'Ideas generales para cocinar con menos esfuerzo.',
        items: (await tipsGenerales(clave)).map((t) => ({
          t, act: 'Guardar como mi tip',
          aplicar: () => {
            const nuevoTip = { id: 'm' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5), t, ok: false, ia: true as const };
            g.mios.unshift(nuevoTip);
            guardar();
            avisos.deshacer('Tip agregado', () => { g.mios = g.mios.filter((y) => y.id !== nuevoTip.id); guardar(); });
          }
        }))
      })
    });
  }
  function verReceta(r: Receta) { nav.abrir('receta', { id: r.id }); }
</script>

<header class="cur-head">
  <button class="back" aria-label="Volver" onclick={() => nav.cerrar()}>‹ Volver</button>
</header>
<div class="screen">
  <div class="tl-head">
    <h2 tabindex="-1">Tips y combinaciones</h2>
    <div class="seg seg2" role="tablist" aria-label="Qué ver">
      <button role="tab" class:on={pestana === 'tips'} aria-selected={pestana === 'tips'} onclick={() => { pestana = 'tips'; agregando = false; }}>Tips</button>
      <button role="tab" class:on={pestana === 'comb'} aria-selected={pestana === 'comb'} onclick={() => { pestana = 'comb'; agregando = false; }}>Combinaciones</button>
    </div>
  </div>
  <div class="tp-body">
    {#snippet fila(x: FilaTip)}
      <label class="wu-it">
        <input type="checkbox" checked={x.ok} onchange={(e) => cambiar(x, e.currentTarget.checked)} />
        <span><b>{x.t}</b><small>{x.w}</small></span>
        {#if !x.ok}{#if x.mio}<i class="tag t">Tuyo</i>{:else if x.nuevo}<i class="tag s">Nuevo</i>{/if}{/if}
        {#if x.ia}<i class="ai-tag">Sugerido por IA</i>{/if}
      </label>
    {/snippet}
    {#if pestana === 'tips'}
      <p class="seg-help">Ideas para cocinar y comer con más calma. Cada semana se suma una nueva y puedes agregar las tuyas.</p>
      <section class="tp-sec" aria-labelledby="tp-h1">
        <h4 id="tp-h1">Por probar · {porProbar.length}</h4>
        <p class="tp-hint">Marca la casilla de los que ya son parte de tu rutina.</p>
        <div class="group tp-g">
          {#each porProbar as x (x.id)}{@render fila(x)}{:else}<p class="tp-none">Ya practicas todos. Pronto llega uno nuevo.</p>{/each}
          {#if agregando}
            <div class="pf-add tp-add">
              <input type="text" aria-label="Escribe tu tip" placeholder="Ej. Lavar la fruta al llegar" bind:value={nuevo} onkeydown={(e) => { if (e.key === 'Enter') { e.preventDefault(); agregarTip(); } }} />
              <button onclick={agregarTip}>Agregar</button>
            </div>
          {:else}
            <button class="add tp-add" onclick={() => (agregando = true)}>+ Agregar un tip</button>
          {/if}
          {#if iaLista('tips')}<button class="ghost tp-add" onclick={pedirTip}>Pedir un tip con IA</button>{/if}
        </div>
      </section>
      <section class="tp-sec" aria-labelledby="tp-h2">
        <h4 id="tp-h2">Ya los practicas · {practicados.length}</h4>
        <div class="group tp-g">
          {#each practicados as x (x.id)}{@render fila(x)}{:else}<p class="tp-none">Aquí aparecen los que marques.</p>{/each}
        </div>
      </section>
    {:else}
      <p class="seg-help">Alimentos que juntos aportan más nutrientes, con recetas de tu recetario que ya los usan.</p>
      {#each COMBINACIONES as c, ci (c.t)}
        {@const rs = recetasDe(c, recetas)}
        {@const ds = diasEnMenu(rs.map((r) => r.id), menu)}
        <article class="cb-card" aria-labelledby={'cb-h' + ci}>
          <small class="cb-ben">{c.b}</small>
          <h3 class="cb-t" id={'cb-h' + ci}>{c.t}</h3>
          <p>{c.x}</p>
          {#if ds.length}
            <p class="cb-menu"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg><span>En tu menú esta semana: {yLista(ds)}</span></p>
          {/if}
          {#if rs.length}
            <div class="cb-rc"><span>En tu recetario</span>{#each rs as r (r.id)}<button class="in-more" onclick={() => verReceta(r)}>{r.n} ›</button>{/each}</div>
          {/if}
        </article>
      {/each}
    {/if}
  </div>
  <p class="tool-note">Son ideas generales, no consejos médicos. Si tienes dudas, consulta a tu nutrióloga.</p>
</div>

<AnfitrionIA />
