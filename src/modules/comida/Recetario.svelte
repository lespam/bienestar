<script lang="ts">
  import type { PerfilComida, Receta } from '../../core/db';
  import { avisos } from '../../core/aviso.svelte';
  import { nav } from '../../core/nav.svelte';
  import { CATEGORIAS, CAT_COLOR, CAT_PLURAL, avisoConflicto, norm, pasaFiltros, usoTxt, type UsoReceta } from './calculos';
  import { guardarReceta, leerPerfiles, listarRecetas, quitarReceta, sembrarRecetas, usoDeRecetas } from './datos';
  import { eleccion, filtros, numerosVisibles, vista } from './estado.svelte';
  import { NOMBRE_LUGAR, nombreDia, platoTxt } from './semana';
  import { itemDeMenu } from './datos';
  import FiltrosRecetas from './FiltrosRecetas.svelte';
  import FormReceta from './FormReceta.svelte';
  import Plato from './Plato.svelte';

  let recetas = $state<Receta[]>([]);
  let perfiles = $state<Record<'les' | 'jeff', Pick<PerfilComida, 'no'>>>({ les: { no: [] }, jeff: { no: [] } });
  let listo = $state(false);

  let uso = $state<Record<string, UsoReceta>>({});
  async function cargar() { [recetas, uso] = await Promise.all([listarRecetas(), usoDeRecetas()]); }
  $effect(() => { if (vista.cambio) cargar(); });
  (async () => {
    await sembrarRecetas();
    perfiles = await leerPerfiles();
    await cargar();
    listo = true;
  })();

  // Si vienes del menú a elegir una receta, arriba se ve para qué lugar y qué hay ahora.
  const eligiendo = $derived(eleccion.actual);
  let ahora = $state('');
  $effect(() => {
    const e = eleccion.actual;
    if (!e) { ahora = ''; return; }
    if (e.modo === 'jeff') { ahora = 'Tú: ' + (e.les?.n ?? '') + '. Ahora elige la de Jeff.'; return; }
    itemDeMenu(e.fecha, e.lugar).then((m) => { ahora = m ? 'Ahora: ' + platoTxt(m) : 'Ahora está libre'; });
  });
  const queEliges = $derived(eligiendo ? (eligiendo.modo === 'les' ? 'Para ti · ' : eligiendo.modo === 'jeff' ? 'Para Jeff · ' : 'Para los dos · ') + NOMBRE_LUGAR[eligiendo.lugar].toLowerCase() + ' del ' + nombreDia(eligiendo.fecha).toLowerCase() : '');
  function volver() { eleccion.actual = null; nav.cerrar(); }

  const BOWL = 'M4 11h16a8 8 0 0 1-16 0zM9 4v4M12 3v5M15 4v4';
  const ver = $derived(numerosVisibles());
  const cats = $derived(CATEGORIAS.filter((c) => recetas.some((r) => r.cat === c)));
  const cat = $derived(vista.cat !== 'todo' && !cats.includes(vista.cat as never) ? 'todo' : vista.cat);
  const q = $derived(norm(vista.q.trim()));
  const filas = $derived(
    recetas
      .filter((r) => (cat === 'todo' || r.cat === cat) && pasaFiltros(r, filtros, perfiles, uso) && (!q || norm(r.n).includes(q) || r.ing.some((it) => norm(it[2]).includes(q))))
      .sort((a, b) => a.n.localeCompare(b.n, 'es'))
  );

  // Saltar a una letra: la lista es larga (cientos de recetas).
  const letraDe = (r: Receta) => { const l = norm(r.n).charAt(0).toUpperCase(); return /[A-Z]/.test(l) ? l : '#'; };
  const primeras = $derived.by(() => {
    const m: Record<string, string> = {};
    for (const r of filas) { const l = letraDe(r); if (!(l in m)) m[l] = r.id; }
    return m;
  });
  const conLetras = $derived(filas.length > 20 && Object.keys(primeras).length > 1);
  function saltar(l: string) {
    const id = primeras[l];
    const el = id ? document.getElementById('rc-' + id) : null;
    if (!el) return;
    el.scrollIntoView({ block: 'start' });
    el.focus({ preventScroll: true });
  }

  const meta = (r: Receta) => r.cat + ' · ' + r.y + (r.y > 1 ? ' porciones' : ' porción') + (r.t ? ' · ' + r.t : '');
  const usoDe = (r: Receta) => usoTxt(uso[r.id]);
  const notas = (r: Receta) => (r.nts?.length ? ' · ' + r.nts.length + (r.nts.length === 1 ? ' nota' : ' notas y tips') : '');

  async function guardada(r: Receta, nueva: boolean) {
    await guardarReceta(r);
    await cargar();
    nav.cerrar();
    if (!nueva) return;
    nav.abrir('receta', { id: r.id });
    avisos.deshacer('Receta guardada', async () => { await quitarReceta(r.id); nav.cerrar(); });
  }
</script>

<header class="cur-head">
  <button class="back" aria-label="Volver" onclick={volver}>‹ Volver</button>
  <button class="edit" onclick={() => nav.abrirHoja('rc-form')}>+ Agregar</button>
</header>
<div class="screen">
  <div class="tl-head">
    <h2 tabindex="-1">Recetario</h2>
    <p class="seg-help">Tus recetas y lo que lleva cada porción. Para pasar las de tus documentos, toca + Agregar y pégalas.</p>
  </div>
  {#if !eligiendo}
    <button class="pr-btn" onclick={() => nav.abrir('tarjetas')}>
      <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="4" width="14" height="16" rx="3" /><path d="M9 2h6M8 20l-2 2M16 20l2 2" /></svg>
      <span><b>Elegir con tarjetas</b><small>Desliza las que sí y acomódalas en la semana</small></span>
    </button>
  {/if}
  {#if eligiendo}
    <div class="rc-pick"><span><small>Eliges</small><b>{queEliges}</b><em>{ahora}</em></span><button onclick={volver}>Cancelar</button></div>
  {/if}
  <label class="rc-search">
    <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="M20 20l-4-4" /></svg>
    <input type="search" placeholder="Buscar receta o ingrediente" aria-label="Buscar receta o ingrediente" bind:value={vista.q} />
  </label>
  <div class="rc-view">
    <span id="rc-vin-l">Ver como viñetas con fotos</span>
    <button class="sw" role="switch" aria-checked={vista.vin} aria-labelledby="rc-vin-l" onclick={() => (vista.vin = !vista.vin)}><i></i></button>
  </div>
  <div class="m-chips" aria-label="Tipo de comida">
    <button class:on={cat === 'todo'} aria-pressed={cat === 'todo'} onclick={() => (vista.cat = 'todo')}>Todas · {recetas.length}</button>
    {#each cats as c (c)}
      {@const on = cat === c}
      <button class:on aria-pressed={on} onclick={() => (vista.cat = c)}>{CAT_PLURAL[c]} · {recetas.filter((r) => r.cat === c).length}</button>
    {/each}
  </div>
  <FiltrosRecetas {recetas} {perfiles} />
  {#if conLetras}
    <nav class="fi-jump rc-abc" aria-label="Ir a la letra">
      {#each Object.keys(primeras) as l (l)}<button onclick={() => saltar(l)} aria-label={'Recetas con ' + l}>{l}</button>{/each}
    </nav>
  {/if}
  <div class="group" class:rc-grid={vista.vin}>
    {#each filas as r (r.id)}
      {@const aviso = avisoConflicto(r, perfiles)}
      {#if vista.vin}
        <button class="rc-card" id={'rc-' + r.id} onclick={() => nav.abrir('receta', { id: r.id })}>
          <span class="rc-ph"><Plato receta={r} /></span>
          <span class="rc-tx"><b>{r.n}</b><small>{meta(r)}{notas(r)}</small><small class="rc-uso">{usoDe(r)}</small>{#if ver && r.k != null}<small>{Math.round(r.k)} kcal aprox. por porción</small>{/if}{#if aviso}<em>{aviso}</em>{/if}</span>
        </button>
      {:else}
        <button class="rc-row" id={'rc-' + r.id} onclick={() => nav.abrir('receta', { id: r.id })}>
          <span class="rc-th" style:--c={CAT_COLOR[r.cat]}><svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d={BOWL} /></svg></span>
          <span><b>{r.n}</b><small>{meta(r)}{notas(r)}</small><small class="rc-uso">{usoDe(r)}</small>{#if ver && r.k != null}<small>{Math.round(r.k)} kcal aprox. por porción</small>{/if}{#if aviso}<em>{aviso}</em>{/if}</span>
          <i aria-hidden="true">›</i>
        </button>
      {/if}
    {:else}
      {#if listo}<p class="rc-empty">{q ? 'No hay recetas con «' + vista.q.trim() + '». Puedes agregarla con + Agregar.' : recetas.length ? 'No hay recetas con estos filtros.' : 'Aún no hay recetas aquí.'}</p>{/if}
    {/each}
  </div>
  <p class="tool-note">Calorías y macros aproximados, por porción.</p>
</div>

{#if nav.hojaEnPila('rc-form')}<FormReceta receta={null} alGuardar={guardada} />{/if}
