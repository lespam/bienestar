<script lang="ts">
  import type { ItemMenu, Receta } from '../../core/db';
  import { avisos } from '../../core/aviso.svelte';
  import { nav } from '../../core/nav.svelte';
  import { cap, fechaDe } from './calculos';
  import { AnfitrionIA, ideaDeUsual, iaLista, masCombinaciones, pedirIA, tipsGenerales } from '../ia';
  import { contarSugerencia } from '../../core/uso';
  import { agregarFaltantes, guardarTips, guardarUsuales, leerPerfiles, leerTips, leerUsuales, listarRecetas, menuDe, perfilInicial, quitarFaltantes, sembrarRecetas } from './datos';
  import { combosVisibles, enOrdenDeTuPlan, motivoDeOcultar, prohibidasDe, type ComboGuardado } from './combos';
  import { descartar, exclusionesDe, textoExclusiones } from './seguro';
  import { fechasDeSemana } from './semana';
  import { COMBINACIONES, diasEnMenu, recetasDe, tipsVacios, tipsVisibles, yLista, type Combinacion, type FilaTip } from './tips';
  import { DIAS_AHORA_NO, siguienteIdea, usualesVacios, type IdeaUsual } from './usuales';
  import type { PerfilComida } from '../../core/db';

  const hoy = fechaDe(0);
  let pestana = $state<'tips' | 'comb' | 'usu'>('tips');
  let g = $state(tipsVacios());
  let recetas = $state<Receta[]>([]);
  let menu = $state<ItemMenu[]>([]);
  let perfiles = $state<Record<'les' | 'jeff', PerfilComida>>({ les: perfilInicial('les'), jeff: perfilInicial('jeff') });
  let usu = $state(usualesVacios());
  let agregando = $state(false);
  let nuevo = $state('');

  const guardar = () => guardarTips($state.snapshot(g));

  (async () => {
    await sembrarRecetas();
    [g, recetas, menu, perfiles, usu] = await Promise.all([leerTips(), listarRecetas(), menuDe(fechasDeSemana(0)), leerPerfiles(), leerUsuales()]);
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

  // ---------- Combinaciones: acordes a lo que no comen ----------
  const ex = $derived(exclusionesDe(perfiles));
  const catalogo = $derived(combosVisibles(COMBINACIONES, ex));
  const ocultas = $derived(COMBINACIONES.length - catalogo.length);
  const deIA = $derived(combosVisibles(g.comb ?? [], ex));
  const delPlan = (c: Combinacion) => diasEnMenu(recetasDe(c, recetas).map((r) => r.id), menu).length > 0;
  const catalogoOrdenado = $derived(enOrdenDeTuPlan(catalogo, delPlan));
  /** Ingredientes de las recetas del menú de esta semana (para que las ideas sean acordes a tu plan). */
  const ingDelPlan = $derived([...new Set(menu.flatMap((m) => [m.r, m.rl, m.rj]).filter((x): x is string => !!x).flatMap((id) => recetas.find((r) => r.id === id)?.ing.map((i) => i[2]) ?? []))].slice(0, 25));
  function pedirCombos() {
    const conocidas = [...COMBINACIONES.map((c) => c.t), ...(g.comb ?? []).map((c) => c.t)];
    const prohibidas = prohibidasDe(COMBINACIONES, ex);
    pedirIA({
      fn: 'combos', titulo: 'Más combinaciones', envia: 'tus exclusiones, los ingredientes de tu menú de la semana y las combinaciones que ya conoces',
      ejecutar: async (clave) => {
        const nuevas = await masCombinaciones(clave, { exclusiones: textoExclusiones(ex), plan: ingDelPlan, conocidas, prohibidas: prohibidas.map(([a, b]) => a + ' + ' + b) },
          (c) => motivoDeOcultar(c, ex, prohibidas) ?? descartar({ nombre: c.t, ingredientes: c.partes, textos: [c.x] }, ex, prohibidas));
        const guardarNuevas = (cs: typeof nuevas) => {
          const antes = structuredClone($state.snapshot(g.comb ?? [])) as ComboGuardado[];
          g.comb = [...antes, ...cs.filter((c) => !antes.some((a) => a.t === c.t)).map((c) => ({ b: c.b, t: c.t, x: c.x, ia: true as const }))];
          guardar2();
          contarSugerencia('combo-ia', true);
          avisos.deshacer(cs.length === 1 ? 'Combinación guardada' : 'Combinaciones guardadas', () => { g.comb = antes; guardar2(); });
        };
        return {
          intro: 'Combinaciones que respetan lo que no comen y usan lo de tu menú. Guarda las que quieras: no se piden otra vez.',
          items: nuevas.map((c) => ({ t: c.t, sub: c.x, act: 'Guardar', aplicar: () => guardarNuevas([c]) })),
          todos: { act: 'Guardar todas', aplicar: () => guardarNuevas(nuevas) }
        };
      }
    });
  }
  const guardar2 = () => guardarTips($state.snapshot(g));
  function quitarCombo(t: string) {
    const antes = structuredClone($state.snapshot(g.comb ?? [])) as ComboGuardado[];
    g.comb = antes.filter((c) => c.t !== t);
    guardar2();
    avisos.deshacer('Quité «' + t + '»', () => { g.comb = antes; guardar2(); });
  }

  // ---------- Mis usuales ----------
  const hoyUsu = fechaDe(0);
  const guardarUsu = () => guardarUsuales($state.snapshot(usu));
  let nuevoUsual = $state('');
  function agregarUsual(n = nuevoUsual) {
    const v = cap(n.trim());
    if (!v) { avisos.mostrar('Escribe un ingrediente'); document.getElementById('us-n')?.focus(); return; }
    if (usu.items.some((x) => x.toLowerCase() === v.toLowerCase())) { avisos.mostrar('Ya está en tus usuales'); return; }
    const antes = $state.snapshot(usu.items) as string[];
    usu.items = [...antes, v];
    nuevoUsual = '';
    guardarUsu();
    avisos.deshacer('«' + v + '» está en tus usuales', () => { usu.items = antes; guardarUsu(); });
  }
  function quitarUsual(n: string) {
    const antes = $state.snapshot(usu.items) as string[];
    usu.items = antes.filter((x) => x !== n);
    guardarUsu();
    avisos.deshacer('«' + n + '» salió de tus usuales', () => { usu.items = antes; guardarUsu(); });
  }
  /** Una idea por reglas: sale del catálogo y no repite lo que ya viste. */
  function pedirIdea() {
    const i = siguienteIdea($state.snapshot(usu) as typeof usu, ex, recetas, hoyUsu);
    if (!i) { avisos.mostrar('Por ahora no tengo otra idea. Puedes agregar la tuya arriba.'); return; }
    usu.idea = i;
    guardarUsu();
  }
  function pedirIdeaIA() {
    pedirIA({
      fn: 'usuales', titulo: 'Un ingrediente nuevo', envia: 'tus ingredientes usuales, tus exclusiones, lo que ya rechazaste y los nombres de hasta 15 recetas',
      ejecutar: async (clave) => {
        const cands = recetas.filter((r) => r.vis !== 'guardada').slice(0, 15).map((r) => ({ id: r.id, n: r.n }));
        const i = await ideaDeUsual(clave, { usuales: $state.snapshot(usu.items) as string[], exclusiones: textoExclusiones(ex), rechazados: $state.snapshot(usu.rechazados) as string[], recetas: cands },
          (x) => descartar({ nombre: x.n, ingredientes: [x.n], textos: [x.por, x.adaptacion ?? '', x.paso] }, ex) ?? (usu.items.concat(usu.rechazados).some((y) => y.toLowerCase() === x.n.toLowerCase()) ? 'ya la conoces' : null));
        const idea: IdeaUsual = { n: i.n, por: i.por, recetas: i.recetaIds, ...(i.adaptacion && !i.recetaIds.length ? { adaptacion: i.adaptacion } : {}), paso: i.paso, ia: true };
        return {
          intro: 'Una idea para tus usuales. Respeta lo que no comen. Tú decides.',
          items: [{ t: i.n, sub: i.por, act: 'Verla en Mis usuales', aplicar: () => { usu.idea = idea; guardarUsu(); contarSugerencia('usual-ia', true); } }]
        };
      }
    });
  }
  function responderIdea(r: 'si' | 'ahora' | 'no') {
    const i = usu.idea;
    if (!i) return;
    const antes = structuredClone($state.snapshot(usu)) as typeof usu;
    usu.idea = null;
    if (r === 'si') usu.items = [...antes.items, i.n];
    else if (r === 'ahora') usu.ahoraNo = { ...antes.ahoraNo, [i.n]: hoyUsu };
    else usu.rechazados = [...antes.rechazados, i.n];
    guardarUsu();
    contarSugerencia(i.ia ? 'usual-ia' : 'usual', r === 'si');
    avisos.deshacer(r === 'si' ? '«' + i.n + '» está en tus usuales' : r === 'ahora' ? 'Te la propongo en ' + DIAS_AHORA_NO + ' días' : 'No te la vuelvo a proponer', () => { usu = antes; guardarUsu(); });
  }
  async function pasoALista(i: IdeaUsual) {
    const nuevos = await agregarFaltantes([i.n], hoyUsu);
    if (!nuevos.length) { avisos.mostrar('Ya está en tu lista de compras'); return; }
    avisos.deshacer('«' + i.n + '» está en tu lista de compras', () => quitarFaltantes(nuevos, hoyUsu));
  }
  const recetasDeIdea = $derived(usu.idea ? usu.idea.recetas.map((id) => recetas.find((r) => r.id === id)).filter((r): r is Receta => !!r) : []);
</script>

<header class="cur-head">
  <button class="back" aria-label="Volver" onclick={() => nav.cerrar()}>‹ Volver</button>
</header>
<div class="screen">
  <div class="tl-head">
    <h2 tabindex="-1">Tips y combinaciones</h2>
    <div class="seg" role="tablist" aria-label="Qué ver">
      <button role="tab" class:on={pestana === 'tips'} aria-selected={pestana === 'tips'} onclick={() => { pestana = 'tips'; agregando = false; }}>Tips</button>
      <button role="tab" class:on={pestana === 'comb'} aria-selected={pestana === 'comb'} onclick={() => { pestana = 'comb'; agregando = false; }}>Combinaciones</button>
      <button role="tab" class:on={pestana === 'usu'} aria-selected={pestana === 'usu'} onclick={() => { pestana = 'usu'; agregando = false; }}>Mis usuales</button>
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
    {:else if pestana === 'comb'}
      <p class="seg-help">Alimentos que juntos aportan más nutrientes, con recetas de tu recetario que ya los usan. Primero van las de tu menú de esta semana.</p>
      {#if ocultas}<p class="tp-hint">{ocultas === 1 ? 'No se muestra 1 combinación que incluye' : 'No se muestran ' + ocultas + ' combinaciones que incluyen'} algo que alguno de los dos no come.</p>{/if}
      {#each catalogoOrdenado as c, ci (c.t)}
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
      {#each deIA as c, ci (c.t)}
        <article class="cb-card" aria-labelledby={'cb-ia' + ci}>
          <small class="cb-ben">{c.b}</small>
          <h3 class="cb-t" id={'cb-ia' + ci}>{c.t}</h3>
          <p>{c.x}</p>
          <div class="cb-rc"><i class="ai-tag">Sugerido por IA</i><button class="in-more" aria-label={'Quitar la combinación ' + c.t} onclick={() => quitarCombo(c.t)}>Quitar</button></div>
        </article>
      {/each}
      {#if iaLista('combos')}<button class="ghost tp-add" onclick={pedirCombos}>Pedir más combinaciones</button>{/if}
    {:else}
      <p class="seg-help">Lo que tienes siempre en casa o quieres tener. Te propongo de a uno un ingrediente nuevo; tú decides.</p>
      <section class="tp-sec" aria-labelledby="us-h1">
        <h4 id="us-h1">Mis usuales · {usu.items.length}</h4>
        <div class="group tp-g">
          {#each usu.items as n (n)}
            <div class="us-it"><span>{n}</span><button class="hg-q" aria-label={'Quitar de mis usuales: ' + n} onclick={() => quitarUsual(n)}>Quitar</button></div>
          {:else}<p class="tp-none">Aún no hay ninguno. Agrega lo que siempre tienes en la alacena o el refri.</p>{/each}
          <div class="pf-add tp-add">
            <input id="us-n" type="text" aria-label="Agregar un ingrediente usual" placeholder="Ej. limones, yogur natural" autocomplete="off" bind:value={nuevoUsual} onkeydown={(e) => { if (e.key === 'Enter') { e.preventDefault(); agregarUsual(); } }} />
            <button onclick={() => agregarUsual()}>Agregar</button>
          </div>
        </div>
      </section>
      <section class="tp-sec" aria-labelledby="us-h2">
        <h4 id="us-h2">Una idea</h4>
        {#if usu.idea}
          <article class="cb-card" aria-live="polite">
            <h3 class="cb-t">{usu.idea.n}</h3>
            <p>{usu.idea.por}</p>
            {#if recetasDeIdea.length}
              <div class="cb-rc"><span>Ya cabe en tus recetas</span>{#each recetasDeIdea as r (r.id)}<button class="in-more" onclick={() => verReceta(r)}>{r.n} ›</button>{/each}</div>
            {:else if usu.idea.adaptacion}<p>{usu.idea.adaptacion}</p>{/if}
            {#if usu.idea.ia}<i class="ai-tag">Sugerido por IA</i>{/if}
            <p><b>Siguiente paso:</b> {usu.idea.paso}</p>
            <button class="ghost" onclick={() => pasoALista(usu.idea as IdeaUsual)}>Agregar {usu.idea.n.toLowerCase()} a la lista de compras</button>
            <button class="start" onclick={() => responderIdea('si')}>Agregar a usuales</button>
            <div class="two"><button class="ghost" onclick={() => responderIdea('ahora')}>Ahora no</button><button class="ghost" onclick={() => responderIdea('no')}>No me interesa</button></div>
          </article>
        {:else}
          <p class="tp-hint">Una idea a la vez. «Ahora no» vuelve en {DIAS_AHORA_NO} días; «No me interesa» no vuelve.</p>
          <button class="start" onclick={pedirIdea}>Pedir una idea</button>
          {#if iaLista('usuales')}<button class="ghost" onclick={pedirIdeaIA}>Pedir una idea nueva con IA</button>{/if}
        {/if}
      </section>
    {/if}
  </div>
  <p class="tool-note">Son ideas generales, no consejos médicos. Si tienes dudas, consulta a tu nutrióloga.</p>
</div>

<AnfitrionIA />
