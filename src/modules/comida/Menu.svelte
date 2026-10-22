<script lang="ts">
  import type { ItemMenu, LugarMenu, PerfilComida, Receta } from '../../core/db';
  import Hoja from '../../core/Hoja.svelte';
  import Inspiracion from './Inspiracion.svelte';
  import { avisos } from '../../core/aviso.svelte';
  import { reducirFoto } from '../../core/imagen';
  import { nav } from '../../core/nav.svelte';
  import { fechaDe, norm, notaConflictos, porTxt, porcionDe } from './calculos';
  import { leerPerfiles, listarRecetas, menuDe, ponerEnMenu, quitarDelMenu, reponerMenu, sembrarRecetas } from './datos';
  import { eleccion, menuFoco, vista } from './estado.svelte';
  import { COLACION, colacionTxt } from './colacion';
  import { AnfitrionIA, iaLista, ideasDeMenu, pedirIA } from '../ia';
  import { COMIDAS_MENU, LETRA_DIA, NOMBRE_LUGAR, SEMANAS_ATRAS, dinero, etiquetaFecha, fechasDeSemana, indexar, itemDecidir, itemDos, itemTakeout, llave, nombreDia, numeroDia, platoTxt, puntoDe, rangoSemana, takeoutTxt, takeouts, tipoTxt, tituloSemana } from './semana';

  // Al llegar al menú ya no estás eligiendo receta.
  eleccion.actual = null;
  const hoyIso = fechaDe(0);
  const k0 = typeof nav.pantalla?.datos?.k === 'number' ? (nav.pantalla.datos.k as number) : 0;
  let k = $state(k0);
  let sel = $state(k0 === 0 ? hoyIso : fechasDeSemana(k0)[0]);
  let abierto = $state<LugarMenu | ''>(k0 === 0 ? 'c' : '');
  if (menuFoco.fecha && fechasDeSemana(k0).includes(menuFoco.fecha)) { sel = menuFoco.fecha; abierto = menuFoco.lugar; }
  menuFoco.fecha = ''; menuFoco.lugar = '';
  let items = $state<ItemMenu[]>([]);
  let recetas = $state<Receta[]>([]);
  let perfiles = $state<Record<'les' | 'jeff', PerfilComida> | null>(null);
  let listo = $state(false);

  const dias = $derived(fechasDeSemana(k));
  const indice = $derived(indexar(items));
  const porId = $derived(new Map(recetas.map((r) => [r.id, r])));
  const pasadaVista = $derived(k > 0);
  const proxima = $derived(k < 0);
  const rows: { l: LugarMenu; rot: string }[] = [{ l: 'd', rot: 'Des' }, { l: 'a', rot: 'Col' }, { l: 'c', rot: 'Com' }, { l: 'p', rot: 'Col' }, { l: 'n', rot: 'Cen' }];
  const filas = $derived(proxima ? rows.filter((r) => r.l !== 'a' && r.l !== 'p') : rows);

  let tanda = 0;
  async function cargar() {
    const mia = ++tanda, ahora = await menuDe(dias);
    if (mia === tanda) items = ahora;
  }
  (async () => {
    await sembrarRecetas();
    [perfiles, recetas] = await Promise.all([leerPerfiles(), listarRecetas()]);
    await cargar();
    listo = true;
  })();
  $effect(() => { void dias; cargar(); });

  function irSemana(n: number) {
    if (n > SEMANAS_ATRAS || n < -1) return;
    k = n;
    sel = n === 0 ? hoyIso : fechasDeSemana(n)[0];
    abierto = n === 0 ? 'c' : '';
  }

  const itemsDe = (f: string) => items.filter((m) => m.fecha === f);
  const instantanea = (fechas: string[]) => structuredClone($state.snapshot(items.filter((m) => fechas.includes(m.fecha)))) as ItemMenu[];
  /** Hace un cambio en el menú y deja un Deshacer que vuelve esos días a como estaban. */
  async function cambiar(fechas: string[], hacer: () => Promise<void>, mensaje: string) {
    const antes = instantanea(fechas);
    await hacer();
    await cargar();
    avisos.deshacer(mensaje, async () => { await reponerMenu(fechas, antes); await cargar(); });
  }

  // ---------- Lo que se ve de cada lugar ----------
  const rec = (m: ItemMenu) => (m.r ? porId.get(m.r) : undefined);
  function notaDe(m: ItemMenu): string {
    const partes: string[] = [];
    const r = rec(m);
    if (m.t === 'dos' && r && perfiles) { const c = notaConflictos(r, perfiles); if (c) partes.push(c); }
    if (m.t === 'takeout') partes.push(m.ticket ? 'Ticket guardado: ' + dinero(m.costo ?? 0) + '.' : m.costo ? 'Costó ' + dinero(m.costo) + '.' : '');
    if (m.nota && m.t !== 'decidir') partes.push(m.nota);
    return partes.filter(Boolean).join(' ');
  }
  const porcion = (m: ItemMenu, w: 'les' | 'jeff') => {
    const r = rec(m);
    return porTxt(r && perfiles ? porcionDe(r, w, perfiles) : perfiles?.[w].por ?? 1);
  };
  const colacionesJuntas = (f: string, l: LugarMenu) => itemsDe(f).filter((m) => m.t === 'col' && m.col?.junto === l);

  // ---------- Elegir receta (en el Recetario) ----------
  function elegir(l: LugarMenu, modo: 'dos' | 'les') {
    eleccion.actual = { fecha: sel, lugar: l, modo };
    menuFoco.fecha = sel; menuFoco.lugar = l;
    vista.q = ''; vista.cat = ({ d: 'Desayuno', c: 'Comida', n: 'Cena' } as Record<string, string>)[l] ?? 'todo';
    nav.abrir('recetas');
  }
  function verReceta(id?: string) {
    if (!id || !porId.has(id)) { avisos.mostrar('Esta comida no está en el recetario'); return; }
    nav.abrir('receta', { id });
  }

  // ---------- Ideas con IA (opcional) ----------
  /** Un solo pedido por día: ideas para cada desayuno, comida o cena que esté libre. */
  const CAT_DE: Record<string, string> = { d: 'Desayuno', c: 'Comida', n: 'Cena' };
  const libresIA = $derived((['d', 'c', 'n'] as LugarMenu[]).filter((l) => !indice.get(llave(sel, l)) && recetas.some((r) => r.cat === CAT_DE[l])));
  function ideasIA() {
    const fecha = sel, lugares = libresIA;
    if (!lugares.length) return;
    const usadas = new Set(items.flatMap((m) => (m.t === 'dos' || m.t === 'cada' ? [m.r, m.rl, m.rj] : [])).filter((x): x is string => !!x));
    pedirIA({
      fn: 'idea', titulo: 'Ayuda con IA', envia: 'los nombres de tus recetas y qué comidas están libres',
      ejecutar: async (clave) => {
        const res = await Promise.allSettled(lugares.map(async (l) => {
          const candidatas = recetas.filter((r) => r.cat === CAT_DE[l]);
          const ids = await ideasDeMenu(clave, NOMBRE_LUGAR[l], candidatas.map((r) => ({ id: r.id, n: r.n })), candidatas.filter((r) => usadas.has(r.id)).map((r) => r.n));
          return ids.map((i) => porId.get(i)).filter((r): r is Receta => !!r).sort((a, b) => Number(usadas.has(a.id)) - Number(usadas.has(b.id))).map((r) => ({ l, r }));
        }));
        // Si una comida no tuvo ideas, se muestran las de las otras; solo falla si ninguna tuvo.
        const ok = res.filter((x) => x.status === 'fulfilled');
        if (!ok.length) throw (res[0] as PromiseRejectedResult).reason;
        const porLugar = ok.map((x) => (x as PromiseFulfilledResult<{ l: LugarMenu; r: Receta }[]>).value);
        return {
          intro: 'Ideas de tu Recetario para lo libre del ' + nombreDia(fecha).toLowerCase() + '. Las que no están en tu menú esta semana van primero.',
          items: porLugar.flat().map(({ l, r }) => ({
            t: r.n, sub: NOMBRE_LUGAR[l] + (usadas.has(r.id) ? ' · ya está en tu menú esta semana' : ''), act: 'Poner en ' + NOMBRE_LUGAR[l].toLowerCase(),
            aplicar: () => cambiar([fecha], () => ponerEnMenu(itemDos(fecha, l, r)), r.n + ': ' + nombreDia(fecha).toLowerCase() + ', ' + NOMBRE_LUGAR[l].toLowerCase())
          }))
        };
      }
    });
  }

  // ---------- Por decidir, libre ----------
  const quitarLugar = (l: LugarMenu, mensaje: string) => cambiar([sel], () => quitarDelMenu(sel, l), mensaje);

  // ---------- Colaciones ----------
  let colLugar = $state<'a' | 'p'>('a');
  let colSel = $state({ base: '', fruta: '', extra: '' });
  let juntando = $state<LugarMenu | ''>('');
  const colOpc = (l: 'a' | 'p') => (l === 'a' ? 0 : 1);
  function abrirColacion(l: 'a' | 'p') {
    colLugar = l;
    const c = indice.get(llave(sel, l))?.col;
    colSel = c ? { base: c.base, fruta: c.fruta, extra: c.extra } : { base: '', fruta: '', extra: '' };
    nav.abrirHoja('mn-col');
  }
  function elegirParte(parte: 'base' | 'fruta' | 'extra', v: string) {
    colSel[parte] = parte !== 'base' && colSel[parte] === v ? '' : v;
  }
  async function guardarColacion() {
    if (!colSel.base) return;
    const l = colLugar, previo = indice.get(llave(sel, l));
    const item: ItemMenu = { fecha: sel, lugar: l, t: 'col', n: colacionTxt(colSel), col: { ...colSel, junto: previo?.col?.junto ?? null } };
    nav.cerrar();
    abierto = l;
    await cambiar([sel], () => ponerEnMenu(item), previo ? 'Colación cambiada' : 'Colación agregada');
  }
  async function juntarCon(l: 'a' | 'p', con: LugarMenu | null) {
    const m = indice.get(llave(sel, l));
    if (!m?.col) return;
    juntando = '';
    await cambiar([sel], () => ponerEnMenu({ ...structuredClone($state.snapshot(m)) as ItemMenu, col: { ...m.col!, junto: con as 'd' | 'c' | 'n' | null } }),
      con ? 'Colación junto con ' + ({ d: 'el desayuno', c: 'la comida', n: 'la cena' } as Record<string, string>)[con] : 'Colación separada otra vez');
  }
  const articulo = (l: string) => ({ d: 'el desayuno', c: 'la comida', n: 'la cena' } as Record<string, string>)[l] ?? '';

  // ---------- Próxima semana: elegir comida por comida ----------
  let npLugar = $state<LugarMenu>('d');
  let npNota = $state('');
  let npQ = $state('');
  function abrirNp(l: LugarMenu) {
    npLugar = l;
    const m = indice.get(llave(sel, l));
    npNota = m?.t === 'decidir' ? m.nota ?? '' : '';
    npQ = '';
    nav.abrirHoja('mn-np');
  }
  const npLista = $derived.by(() => {
    const q = norm(npQ.trim()), quiere = npLugar === 'd' ? 'Desayuno' : npLugar === 'n' ? 'Cena' : 'Comida';
    return recetas.filter((r) => !q || norm(r.n).includes(q)).sort((a, b) => Number(b.cat === quiere) - Number(a.cat === quiere) || a.n.localeCompare(b.n, 'es')).slice(0, 40);
  });
  async function npPoner(item: ItemMenu | null, mensaje: string) {
    nav.cerrar();
    await cambiar([sel], () => (item ? ponerEnMenu(item) : quitarDelMenu(sel, npLugar)), mensaje);
  }

  // ---------- Planear: un solo camino, a Acomoda la semana ----------
  const planear = () => nav.abrir('tarjetas', { acomodar: 1, ...(proxima ? { k: -1 } : {}) });

  // ---------- Takeout ----------
  let tk = $state({ lugar: '', total: '' as string | number, comida: 'n' as LugarMenu, quien: '2' as '2' | 'l' | 'j' });
  let ticket = $state<Blob | null>(null);
  let ticketUrl = $state('');
  $effect(() => {
    if (!ticket) { ticketUrl = ''; return; }
    const u = URL.createObjectURL(ticket);
    ticketUrl = u;
    return () => URL.revokeObjectURL(u);
  });
  function abrirTakeout() { tk = { lugar: '', total: '', comida: 'n', quien: '2' }; ticket = null; nav.abrirHoja('mn-to'); }
  async function elegirTicket(e: Event) {
    const input = e.target as HTMLInputElement, f = input.files?.[0];
    if (!f) return;
    ticket = await reducirFoto(f, 1280);
    input.value = '';
  }
  async function guardarTakeout() {
    const lugar = tk.lugar.trim();
    if (!lugar) { document.getElementById('to-place')?.focus(); avisos.mostrar('Escribe el lugar'); return; }
    const costo = Number(String(tk.total).replace(',', '.')) || 0;
    const item = itemTakeout(sel, tk.comida, lugar, { costo, quien: tk.quien, ...(ticket ? { ticket } : {}) });
    nav.cerrar();
    await cambiar([sel], () => ponerEnMenu(item), 'Takeout guardado' + (ticket ? ' con su ticket' : ''));
  }

  const resumenTk = $derived(takeoutTxt(takeouts(items)));
  const planeadasLibres = $derived(items.filter((m) => m.t === 'decidir').length);
</script>

<header class="cur-head">
  <button class="back" aria-label="Volver" onclick={() => nav.cerrar()}>‹ Volver</button>
  <span class="rest-next">{rangoSemana(dias)}</span>
</header>
<div class="screen">
  <div class="tl-head">
    <h2 tabindex="-1">Menú de la semana</h2>
    <p class="seg-help">Toca un día para ver o cambiar sus comidas.</p>
  </div>
  <div class="fd-date mw-nav">
    <button class="cal-nav" aria-label="Semana anterior" disabled={k >= SEMANAS_ATRAS} onclick={() => irSemana(k + 1)}>‹</button>
    <b aria-live="polite">{tituloSemana(k)}</b>
    <button class="cal-nav" aria-label="Semana siguiente" disabled={k <= -1} onclick={() => irSemana(k - 1)}>›</button>
  </div>
  {#if pasadaVista}
    <p class="tool-note left">Es una semana pasada, solo para ver. <button class="link-btn" onclick={() => irSemana(0)}>Volver a esta semana</button></p>
  {/if}

  {#if k === 0}<Inspiracion {recetas} />{/if}

  <div class="wk-grid" aria-label="Semana de un vistazo">
    <span></span>
    {#each dias as f, i (f)}
      <button class="wk-day" class:on={f === sel} class:today={f === hoyIso} aria-label={etiquetaFecha(f)} aria-pressed={f === sel} onclick={() => { sel = f; abierto = k === 0 ? 'c' : ''; }}>{LETRA_DIA[i]}<b>{numeroDia(f)}</b></button>
    {/each}
    {#each filas as r (r.l)}
      <span class="wl" aria-hidden="true">{r.rot}</span>
      {#each dias as f (f)}
        {@const m = indice.get(llave(f, r.l))}
        <i class="wk-dot {puntoDe(m)}" role="img" aria-label={nombreDia(f) + ', ' + NOMBRE_LUGAR[r.l].toLowerCase() + ': ' + (m ? (m.t === 'col' ? 'planeada' : tipoTxt(m)) : 'Libre')}></i>
      {/each}
    {/each}
  </div>
  <div class="wk-key">
    <span><i class="wk-dot f"></i>Los dos</span>
    <span><i class="wk-dot s"></i>Cada quien</span>
    <span><i class="wk-dot t"></i>Takeout</span>
    <span><i class="wk-dot p"></i>Por decidir</span>
    <span><i class="wk-dot"></i>Libre</span>
  </div>

  {#if !pasadaVista}
    <div class="mn-plan">
      <button class="start" onclick={planear}>Planear</button>
    </div>
    {#if planeadasLibres}
      <p class="tool-note left">{planeadasLibres} {planeadasLibres === 1 ? 'comida por decidir' : 'comidas por decidir'}.{proxima ? ' El lunes pasa a ser tu semana actual.' : ' Ábrela y elige cuando quieras.'}</p>
    {:else}
      <p class="tool-note left">{proxima ? 'Toca una comida para elegirla o dejarla por decidir. El lunes pasa a ser tu semana actual.' : 'Lo que no sepas todavía puedes dejarlo "por decidir".'}</p>
    {/if}
  {/if}

  {#snippet comidaPrincipal(l: LugarMenu)}
    {@const m = indice.get(llave(sel, l))}
    {@const id = 'ml-' + l}
    {#if !m}
      {@render libre(l, () => elegir(l, 'dos'))}
    {:else if pasadaVista}
      <section class="ml"><div class="ml-h"><small>{NOMBRE_LUGAR[l]}</small><span class="dish">{m.t === 'takeout' ? m.n + (m.costo ? ' · ' + dinero(m.costo) : '') : platoTxt(m)}</span><span class="tag {m.t === 'takeout' ? 't' : m.t === 'cada' ? 's' : 'f'}">{tipoTxt(m)}</span></div></section>
    {:else}
      {@const abre = abierto === l}
      <section class="ml" class:open={abre}>
        <button class="ml-h" aria-expanded={abre} aria-controls={id} onclick={() => (abierto = abre ? '' : l)}>
          <small>{NOMBRE_LUGAR[l]}</small>
          <span class="dish" style={m.t === 'decidir' ? 'color:var(--accent)' : ''}>{platoTxt(m)}</span>
          <span class="tag {m.t === 'takeout' ? 't' : m.t === 'cada' ? 's' : m.t === 'decidir' ? '' : 'f'}">{tipoTxt(m)}</span>
          <svg aria-hidden="true" focusable="false" viewBox="0 0 24 24"><path d="M6 9l6 6 6-6" /></svg>
        </button>
        <div class="ml-b" {id} hidden={!abre}>
          {#if m.t === 'dos'}
            <div class="who"><div class="ls"><small>Tú</small><span>{porcion(m, 'les')}</span></div><div class="jf"><small>Jeff</small><span>{porcion(m, 'jeff')}</span></div></div>
          {:else if m.t === 'cada'}
            <div class="who"><div class="ls"><small>Tú</small><span>{m.nl}</span></div><div class="jf"><small>Jeff</small><span>{m.nj}</span></div></div>
          {:else if m.t === 'takeout'}
            <p class="slot-note">{m.quien === 'l' ? 'Comiste tú.' : m.quien === 'j' ? 'Comió Jeff.' : 'Comieron los dos.'}</p>
          {/if}
          {#if notaDe(m)}<p class="slot-note">{notaDe(m)}</p>{/if}
          {#each colacionesJuntas(sel, l) as c (c.lugar)}<p class="slot-note">Incluye tu {NOMBRE_LUGAR[c.lugar].replace('Colación', 'colación')}: {c.n}.</p>{/each}
          <div class="ml-acts">
            {#if m.t === 'dos'}<button class="add" onclick={() => verReceta(m.r)}>Ver receta</button>{/if}
            {#if m.t === 'cada'}
              {#each [...new Set([m.rl, m.rj])] as rid (rid)}<button class="add" onclick={() => verReceta(rid)}>Ver receta: {porId.get(rid ?? '')?.n ?? (rid === m.rl ? m.nl : m.nj)}</button>{/each}
            {/if}
            <button class="add" onclick={() => elegir(l, 'dos')}>{m.t === 'dos' || m.t === 'cada' ? 'Cambiar plato' : 'Elegir plato'}</button>
            {#if m.t === 'decidir'}<button class="add" onclick={() => quitarLugar(l, 'Quitado de "por decidir"')}>Quitar "por decidir"</button>{/if}
            {#if m.t !== 'decidir'}<button class="add" onclick={() => quitarLugar(l, 'Comida liberada')}>Dejar libre</button>{/if}
          </div>
          {#if m.t === 'dos' || m.t === 'cada'}{@render pregunta(l, m.t)}{/if}
        </div>
      </section>
    {/if}
  {/snippet}

  <!-- Un tiempo libre es una sola línea, como en Acomoda la semana. -->
  {#snippet libre(l: LugarMenu, agregar: () => void)}
    {#if !pasadaVista}
      <section class="ml ml-empty">
        <div class="ml-h"><small>{NOMBRE_LUGAR[l]}</small><span class="dish" style="color:var(--muted)">Libre</span>{#if sel >= hoyIso}<button class="add ml-add" aria-label={'Agregar a ' + NOMBRE_LUGAR[l].toLowerCase()} onclick={agregar}>Agregar</button>{:else}<span class="tag">—</span>{/if}</div>
      </section>
    {:else}
      <section class="ml ml-empty"><div class="ml-h"><small>{NOMBRE_LUGAR[l]}</small><span class="dish" style="color:var(--muted)">Libre</span><span class="tag">—</span></div></section>
    {/if}
  {/snippet}

  <!-- Solo con un plato ya elegido: «Sí, lo mismo» es lo que ya hay; «No, cada quien» elige dos. -->
  {#snippet pregunta(l: LugarMenu, t: 'dos' | 'cada')}
    <p class="ml-q">¿Comen lo mismo?</p>
    <div class="ml-two" role="group" aria-label="¿Comen lo mismo?">
      <button class="add" aria-pressed={t === 'dos'} onclick={() => t !== 'dos' && elegir(l, 'dos')}>Sí, lo mismo</button>
      <button class="add" aria-pressed={t === 'cada'} onclick={() => t !== 'cada' && elegir(l, 'les')}>No, cada quien</button>
    </div>
  {/snippet}

  {#snippet colacion(l: 'a' | 'p')}
    {@const m = indice.get(llave(sel, l))}
    {#if !m}
      {@render libre(l, () => abrirColacion(l))}
    {:else if pasadaVista}
      <section class="ml"><div class="ml-h"><small>{NOMBRE_LUGAR[l]}</small><span class="dish">{m.n}</span><span class="tag">Colación</span></div></section>
    {:else}
      {@const abre = abierto === l}
      {@const junto = m.col?.junto ?? null}
      <section class="ml" class:open={abre}>
        <button class="ml-h" aria-expanded={abre} aria-controls={'sn-' + l} onclick={() => { abierto = abre ? '' : l; juntando = ''; }}>
          <small>{NOMBRE_LUGAR[l]}</small><span class="dish">{m.n}</span>
          <span class="tag">{junto ? 'Con ' + articulo(junto) : 'Colación'}</span>
          <svg aria-hidden="true" focusable="false" viewBox="0 0 24 24"><path d="M6 9l6 6 6-6" /></svg>
        </button>
        <div class="ml-b" id={'sn-' + l} hidden={!abre}>
          {#if junto}<p class="slot-note">Va junto con {articulo(junto)} de este día. Lo que importa es completar tu día, no cuándo comes cada parte.</p>{/if}
          <div class="ml-acts">
            <button class="add" onclick={() => abrirColacion(l)}>Cambiar</button>
            {#if junto}
              <button class="add" onclick={() => juntarCon(l, null)}>Separar</button>
            {:else}
              <button class="add" aria-expanded={juntando === l} onclick={() => (juntando = juntando === l ? '' : l)}>Juntar con una comida</button>
            {/if}
            <button class="add" onclick={() => quitarLugar(l, 'Colación quitada')}>Quitar</button>
          </div>
          {#if juntando === l}
            <div class="m-chips" role="group" aria-label="Juntar con">
              {#each COMIDAS_MENU.filter((c) => indice.has(llave(sel, c.l))) as c (c.l)}<button onclick={() => juntarCon(l, c.l)}>{c.n}</button>{/each}
            </div>
          {/if}
        </div>
      </section>
    {/if}
  {/snippet}

  <div class="meals">
    <div class="slot-h" id="mn-dia" tabindex="-1" style="padding:0 2px;scroll-margin-top:16px"><b style="font-size:16px;text-transform:none;letter-spacing:0;color:var(--fg)">{etiquetaFecha(sel)}{sel === hoyIso ? ' · hoy' : ''}</b></div>
    {#if proxima}
      {#each COMIDAS_MENU as c (c.l)}
        {@const m = indice.get(llave(sel, c.l))}
        <section class="ml" class:ml-empty={!m}>
          <button class="ml-h" onclick={() => abrirNp(c.l)}>
            <small>{c.n}</small>
            <span class="dish" style={!m ? 'color:var(--muted)' : m.t === 'decidir' ? 'color:var(--accent)' : ''}>{m ? platoTxt(m) : 'Libre'}</span>
            {#if !m}<span class="tag">—</span>{:else}<span class="tag {m.t === 'takeout' ? 't' : m.t === 'cada' ? 's' : m.t === 'decidir' ? '' : 'f'}">{tipoTxt(m)}</span>{/if}
          </button>
        </section>
      {/each}
    {:else if listo}
      {@render comidaPrincipal('d')}
      {@render colacion('a')}
      {@render comidaPrincipal('c')}
      {@render colacion('p')}
      {@render comidaPrincipal('n')}
    {/if}
    {#if !pasadaVista && sel >= hoyIso && libresIA.length && iaLista('idea')}<button class="ai-btn" onclick={ideasIA}>Ideas con IA para lo libre del {nombreDia(sel).toLowerCase()}</button>{/if}
  </div>

  {#if !proxima}
    <div class="to-card">
      <b>{pasadaVista ? 'Takeout esa semana' : 'Takeout esta semana'}</b>
      <small>{resumenTk}</small>
      {#if !pasadaVista}<button class="ghost w-btn" onclick={abrirTakeout}>+ Ticket</button>{/if}
    </div>
  {/if}
  {#if !pasadaVista}
    <h4 class="mn-after">Después de planear</h4>
    <div class="mn-acts">
      <button class="ghost" onclick={() => nav.abrir('compras', { k })}>Lista de compras</button>
      <button class="ghost" onclick={() => nav.abrir('prep', { k })}>Plan de preparación</button>
    </div>
  {/if}
  {#if !pasadaVista}<p class="tool-note">Las porciones salen de los perfiles de cada quien. Puedes cambiarlas en cualquier comida.</p>{/if}
</div>

{#if nav.hojaAbierta('mn-col')}
  <Hoja titulo={NOMBRE_LUGAR[colLugar] + ' · ' + nombreDia(sel).toLowerCase()}>
    <p class="seg-help">Arma tu colación por partes. Cambiar la fruta no cambia lo demás.</p>
    <span class="sh-lbl">Base</span>
    <div class="m-chips" role="radiogroup" aria-label="Base">
      {#each COLACION.base[colOpc(colLugar)] as o (o)}<button class:on={colSel.base === o} role="radio" aria-checked={colSel.base === o} onclick={() => elegirParte('base', o)}>{o}</button>{/each}
    </div>
    <span class="sh-lbl">Fruta (opcional)</span>
    <div class="m-chips" role="radiogroup" aria-label="Fruta">
      {#each COLACION.fruta as o (o)}<button class:on={colSel.fruta === o} role="radio" aria-checked={colSel.fruta === o} onclick={() => elegirParte('fruta', o)}>{o}</button>{/each}
    </div>
    <span class="sh-lbl">Algo más (opcional)</span>
    <div class="m-chips" role="radiogroup" aria-label="Algo más">
      {#each COLACION.extra[colOpc(colLugar)] as o (o)}<button class:on={colSel.extra === o} role="radio" aria-checked={colSel.extra === o} onclick={() => elegirParte('extra', o)}>{o}</button>{/each}
    </div>
    <p class="am-now" aria-live="polite">{colSel.base ? 'Quedaría: ' + colacionTxt(colSel) : 'Elige una base para empezar.'}</p>
    <button class="start" disabled={!colSel.base} onclick={guardarColacion}>Guardar colación</button>
  </Hoja>
{/if}

{#if nav.hojaAbierta('mn-np')}
  <Hoja titulo={etiquetaFecha(sel).split(' ').slice(0, 2).join(' ') + ' · ' + NOMBRE_LUGAR[npLugar].toLowerCase()}>
    <div class="man"><label for="np-note">Por decidir (nota opcional)</label><input id="np-note" type="text" placeholder="Ej. algo con pollo" autocomplete="off" bind:value={npNota} /></div>
    <button class="ghost" onclick={() => npPoner(itemDecidir(sel, npLugar, npNota.trim()), 'Queda por decidir')}>Dejar por decidir</button>
    <label class="sh-lbl" for="np-q">O elige una receta</label>
    <input id="np-q" type="text" placeholder="Buscar en tu Recetario" autocomplete="off" bind:value={npQ} />
    <div class="np-list">
      {#each npLista as r (r.id)}
        <button onclick={() => npPoner({ fecha: sel, lugar: npLugar, t: 'dos', n: r.n, r: r.id }, 'Elegido: ' + r.n)}>{r.n}<small>{r.cat}</small></button>
      {:else}
        <p class="tool-note left">No encontré esa receta. Puedes dejarla por decidir con una nota.</p>
      {/each}
    </div>
    <div class="pl-acts">
      <button class="ghost" onclick={() => npPoner(itemTakeout(sel, npLugar, 'Takeout'), 'Anotado: takeout')}>Takeout o salir a comer</button>
      {#if indice.has(llave(sel, npLugar))}<button class="ghost" onclick={() => npPoner(null, 'Comida liberada')}>Dejar libre</button>{/if}
    </div>
  </Hoja>
{/if}

{#if nav.hojaAbierta('mn-to')}
  <Hoja titulo="Registrar takeout">
    <p class="seg-help">Se anota en {etiquetaFecha(sel)}. El ticket se queda solo en tu teléfono.</p>
    <div class="to-pick">
      <label><svg aria-hidden="true" focusable="false" viewBox="0 0 24 24"><path d="M4 8h3l2-3h6l2 3h3v11H4z" /><circle cx="12" cy="13" r="3.5" /></svg>Tomar foto del ticket<input type="file" accept="image/*" capture="environment" onchange={elegirTicket} /></label>
      <label><svg aria-hidden="true" focusable="false" viewBox="0 0 24 24"><path d="M21 12l-8.5 8.5a5 5 0 0 1-7-7L14 5a3.5 3.5 0 0 1 5 5l-8.5 8.5a2 2 0 0 1-3-3L15 8" /></svg>Adjuntar foto<input type="file" accept="image/*" onchange={elegirTicket} /></label>
    </div>
    {#if ticketUrl}
      <div class="to-tk"><div class="th" style:background-image={'url(' + ticketUrl + ')'}></div><small>Foto guardada. Escribe el lugar y el total.</small></div>
    {/if}
    <div class="man">
      <label for="to-place">Lugar</label><input id="to-place" type="text" placeholder="Ej. Tacos El Güero" bind:value={tk.lugar} />
      <label for="to-total">Total</label><input id="to-total" type="number" inputmode="decimal" bind:value={tk.total} />
    </div>
    <span class="sh-lbl">Comida</span>
    <div class="m-chips" role="radiogroup" aria-label="Comida">
      {#each COMIDAS_MENU as c (c.l)}<button class:on={tk.comida === c.l} role="radio" aria-checked={tk.comida === c.l} onclick={() => (tk.comida = c.l)}>{c.n}</button>{/each}
    </div>
    <span class="sh-lbl">Para</span>
    <div class="m-chips" role="radiogroup" aria-label="Para">
      {#each [['2', 'Los dos'], ['l', 'Tú'], ['j', 'Jeff']] as [v, t] (v)}<button class:on={tk.quien === v} role="radio" aria-checked={tk.quien === v} onclick={() => (tk.quien = v as '2' | 'l' | 'j')}>{t}</button>{/each}
    </div>
    <button class="start" onclick={guardarTakeout}>Guardar</button>
  </Hoja>
{/if}

<AnfitrionIA />
