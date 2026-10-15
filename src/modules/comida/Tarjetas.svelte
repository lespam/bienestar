<script lang="ts">
  import { tick } from 'svelte';
  import type { ItemMenu, LugarMenu, PerfilComida, Receta } from '../../core/db';
  import { avisos } from '../../core/aviso.svelte';
  import { nav } from '../../core/nav.svelte';
  import { CAT_COLOR, fechaDe, pasaFiltros, type UsoReceta } from './calculos';
  import { leerPerfiles, listarRecetas, menuDe, ponerEnMenu, ponerVariosEnMenu, reponerMenu, sembrarRecetas, usoDeRecetas } from './datos';
  import { filtros, numerosVisibles, tarjetas } from './estado.svelte';
  import { LETRA_DIA, NOMBRE_LUGAR, etiquetaFecha, fechasDeSemana, indexar, itemDos, llave, nombreDia, numeroDia, platoTxt } from './semana';
  import { CATS_TARJETA, cuentaTarjetas, elegidasTxt, mazoDe } from './tarjetas';
  import FiltrosRecetas from './FiltrosRecetas.svelte';
  import Plato from './Plato.svelte';

  const hoy = fechaDe(0);
  // 0: esta semana. -1: la próxima (así cuenta fechasDeSemana).
  let semanaK = $state(nav.pantalla?.datos?.k === -1 ? -1 : 0);
  const dias = $derived(fechasDeSemana(semanaK));
  const BOWL = 'M4 11h16a8 8 0 0 1-16 0zM9 4v4M12 3v5M15 4v4';

  let recetas = $state<Receta[]>([]);
  let items = $state<ItemMenu[]>([]);
  let listo = $state(false);
  let uso = $state<Record<string, UsoReceta>>({});
  let perfiles = $state<Record<'les' | 'jeff', Pick<PerfilComida, 'no'>>>({ les: { no: [] }, jeff: { no: [] } });

  const cargarMenu = async () => { items = await menuDe(dias); };
  async function cambiarSemana(k: number) { semanaK = k; await cargarMenu(); }
  (async () => {
    await sembrarRecetas();
    [recetas, perfiles, uso] = await Promise.all([listarRecetas(), leerPerfiles(), usoDeRecetas(), cargarMenu()]);
    listo = true;
  })();

  const porId = $derived(new Map(recetas.map((r) => [r.id, r])));
  const mazo = $derived(mazoDe(recetas.filter((r) => pasaFiltros(r, { ...filtros, foto: 'todo' }, perfiles, uso)), tarjetas.liked, tarjetas.passed, tarjetas.cat, uso));
  const visibles = $derived(mazo.slice(0, 3));
  const indice = $derived(indexar(items));
  const ver = $derived(numerosVisibles());
  const elegidas = $derived(tarjetas.liked.map((id) => porId.get(id)).filter((r): r is Receta => !!r));
  const noElegidas = $derived(tarjetas.passed.map((id) => porId.get(id)).filter((r): r is Receta => !!r));
  const sel = $derived(tarjetas.sel ? porId.get(tarjetas.sel) : undefined);

  // «Acomodar» es una capa más de la pila: el gesto atrás de Android vuelve al mazo antes de salir.
  const acomodando = $derived(nav.hojaAbierta('tj-acomodar'));
  function atras() { tarjetas.sel = null; nav.cerrar(); }
  function verMenu() {
    if (nav.pila.some((c) => c.tipo === 'pantalla' && c.id === 'menu')) nav.cerrarHasta('menu');
    else { nav.cerrar(); nav.reemplazar('menu', semanaK ? { k: semanaK } : undefined); }
  }

  // ---------- El mazo ----------
  const sinMovimiento = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
  // Mientras la carta sale volando, un segundo toque no decide dos veces la misma.
  let decidiendo = false;
  async function decidir(dir: 'yes' | 'no') {
    const r = mazo[0];
    if (!r || decidiendo) return;
    decidiendo = true;
    try { await decidirUna(r, dir); } finally { decidiendo = false; }
  }
  async function decidirUna(r: Receta, dir: 'yes' | 'no') {
    const carta = document.querySelector<HTMLElement>('.tj-card[data-pos="0"]');
    if (carta && !sinMovimiento()) {
      carta.style.transition = 'transform .22s ease-out, opacity .22s';
      carta.style.transform = 'translateX(' + (dir === 'yes' ? 460 : -460) + 'px) rotate(' + (dir === 'yes' ? 22 : -22) + 'deg)';
      carta.style.opacity = '0';
      await new Promise((ok) => setTimeout(ok, 200));
    }
    (dir === 'yes' ? tarjetas.liked : tarjetas.passed).push(r.id);
    tarjetas.hist.push({ id: r.id, dir });
    await tick();
    document.querySelector<HTMLElement>('.tj-card[tabindex]')?.focus({ preventScroll: true });
  }
  function deshacerUna() {
    const h = tarjetas.hist.pop();
    if (!h) return;
    const lista = h.dir === 'yes' ? tarjetas.liked : tarjetas.passed;
    lista.splice(lista.indexOf(h.id), 1);
  }
  function consideraDeNuevo(id: string) {
    tarjetas.passed = tarjetas.passed.filter((x) => x !== id);
    tarjetas.hist = tarjetas.hist.filter((h) => h.id !== id);
  }

  // Deslizar la carta de arriba
  let inicioX = 0, dx = 0, arrastrando = false;
  function abajo(e: PointerEvent) {
    const c = e.currentTarget as HTMLElement;
    arrastrando = true; dx = 0; inicioX = e.clientX;
    c.setPointerCapture(e.pointerId);
    c.style.transition = 'none';
  }
  function mueve(e: PointerEvent) {
    if (!arrastrando) return;
    const c = e.currentTarget as HTMLElement;
    dx = e.clientX - inicioX;
    c.style.transform = 'translateX(' + dx + 'px) rotate(' + dx / 18 + 'deg)';
    (c.querySelector('.yes') as HTMLElement).style.opacity = String(Math.max(0, Math.min(1, dx / 90)));
    (c.querySelector('.no') as HTMLElement).style.opacity = String(Math.max(0, Math.min(1, -dx / 90)));
  }
  function suelta(e: PointerEvent) {
    if (!arrastrando) return;
    arrastrando = false;
    const c = e.currentTarget as HTMLElement;
    if (Math.abs(dx) > 90) decidir(dx > 0 ? 'yes' : 'no');
    else {
      c.style.transition = 'transform .2s';
      c.style.transform = '';
      (c.querySelector('.yes') as HTMLElement).style.opacity = '0';
      (c.querySelector('.no') as HTMLElement).style.opacity = '0';
    }
  }
  function tecla(e: KeyboardEvent) {
    if (e.key === 'ArrowRight') { e.preventDefault(); decidir('yes'); }
    else if (e.key === 'ArrowLeft') { e.preventDefault(); decidir('no'); }
  }

  // ---------- Acomodar en la semana ----------
  // Un día a la vez, con sus tiempos de comida como en el registro. Cada tiempo tiene «Agregar»:
  // vuelve a las tarjetas y lo que digas que sí va a ese tiempo, del día elegido en adelante.
  const LUGARES: LugarMenu[] = ['d', 'a', 'c', 'p', 'n'];
  const lugares = $derived(semanaK < 0 ? LUGARES.filter((l) => l !== 'a' && l !== 'p') : LUGARES);
  const primerDia = (ds: string[]) => ds.find((f) => f >= hoy) ?? ds[0];
  let dia = $state('');
  $effect(() => { if (!dias.includes(dia)) dia = primerDia(dias); });
  const pasado = $derived(dia < hoy);
  const delDia = $derived(items.filter((m) => m.fecha === dia));
  /** Un plato ya puesto que tocaste para moverlo a otro lugar o a otro día. */
  let moviendo = $state<{ f: string; l: LugarMenu } | null>(null);

  async function colocar(id: string, f: string, l: LugarMenu) {
    const r = porId.get(id);
    if (!r || f < hoy) return;
    const antes = structuredClone($state.snapshot(items.filter((m) => m.fecha === f))) as ItemMenu[];
    await ponerEnMenu(itemDos(f, l, r));
    await cargarMenu();
    tarjetas.sel = null;
    avisos.deshacer(r.n + ': ' + nombreDia(f).toLowerCase() + ', ' + NOMBRE_LUGAR[l].toLowerCase(), async () => { await reponerMenu([f], antes); await cargarMenu(); });
  }
  /** Mueve un plato puesto; si el lugar de destino tiene algo, se intercambian. */
  async function mover(de: { f: string; l: LugarMenu }, f: string, l: LugarMenu) {
    moviendo = null;
    if (f < hoy || de.f < hoy || (de.f === f && de.l === l)) return;
    const m = indice.get(llave(de.f, de.l));
    if (!m) return;
    const fechas = [...new Set([de.f, f])];
    const antes = structuredClone($state.snapshot(items.filter((x) => fechas.includes(x.fecha)))) as ItemMenu[];
    const otro = indice.get(llave(f, l));
    const quedan = antes.filter((x) => !(x.fecha === de.f && x.lugar === de.l) && !(x.fecha === f && x.lugar === l));
    const nuevos = [...quedan, { ...structuredClone($state.snapshot(m)), fecha: f, lugar: l } as ItemMenu];
    if (otro) nuevos.push({ ...structuredClone($state.snapshot(otro)), fecha: de.f, lugar: de.l } as ItemMenu);
    await reponerMenu(fechas, nuevos);
    await cargarMenu();
    avisos.deshacer(platoTxt(m) + ': ' + nombreDia(f).toLowerCase() + ', ' + NOMBRE_LUGAR[l].toLowerCase(), async () => { await reponerMenu(fechas, antes); await cargarMenu(); });
  }
  function tocaCelda(f: string, l: LugarMenu) {
    if (moviendo) { mover(moviendo, f, l); return; }
    if (tarjetas.sel) { colocar(tarjetas.sel, f, l); return; }
    if (indice.get(llave(f, l))) { moviendo = { f, l }; return; }
    avisos.mostrar('Toca «Agregar» o primero una de tus elegidas');
  }
  async function reiniciarDia() {
    const f = dia;
    const antes = structuredClone($state.snapshot(items.filter((m) => m.fecha === f))) as ItemMenu[];
    if (!antes.length || f < hoy) return;
    moviendo = null;
    await reponerMenu([f], []);
    await cargarMenu();
    avisos.deshacer(nombreDia(f) + ' quedó libre para planear', async () => { await reponerMenu([f], antes); await cargarMenu(); });
  }
  /** «Agregar» en un tiempo de comida: vuelve a las tarjetas de ese tipo. */
  function agregar(l: LugarMenu) {
    tarjetas.destino = { l, f: dia, desde: tarjetas.liked.length };
    tarjetas.cat = l === 'd' ? 'Desayuno' : l === 'c' ? 'Comida' : l === 'n' ? 'Cena' : 'todo';
    tarjetas.sel = null; moviendo = null;
    nav.cerrar();
  }
  const nuevasDestino = $derived(tarjetas.destino ? tarjetas.liked.slice(tarjetas.destino.desde).map((id) => porId.get(id)).filter((r): r is Receta => !!r) : []);
  /** Pone las que dijiste que sí en ese tiempo de comida, en los días libres desde el elegido. */
  async function ponerDestino() {
    const d = tarjetas.destino, nuevas = nuevasDestino;
    if (!d) return;
    tarjetas.destino = null;
    const libres = dias.filter((f) => f >= d.f && f >= hoy && !indice.get(llave(f, d.l)));
    const filas = nuevas.slice(0, libres.length).map((r, i) => itemDos(libres[i], d.l, r));
    const antes = structuredClone($state.snapshot(items)) as ItemMenu[];
    if (filas.length) await ponerVariosEnMenu(filas);
    await cargarMenu();
    dia = d.f;
    nav.abrirHoja('tj-acomodar');
    const sobran = nuevas.length - filas.length;
    if (filas.length) avisos.deshacer(filas.length + (filas.length === 1 ? ' receta puesta en ' : ' recetas puestas en ') + NOMBRE_LUGAR[d.l].toLowerCase() + (sobran ? '. ' + sobran + ' quedaron en tus elegidas' : ''), async () => { await reponerMenu(dias, antes.filter((m) => dias.includes(m.fecha))); await cargarMenu(); });
    else avisos.mostrar('No hay ' + NOMBRE_LUGAR[d.l].toLowerCase() + ' libre desde ese día. Quedaron en tus elegidas.');
  }
  const colorDe = (m: ItemMenu | undefined) => {
    if (!m) return '';
    if (m.t === 'takeout') return 'var(--rose)';
    const r = porId.get(m.r ?? m.rl ?? '');
    return r ? CAT_COLOR[r.cat] : 'var(--muted)';
  };

  // Arrastrar (con dedo o ratón) una elegida a un lugar, o un plato puesto a otro lugar o a otro día.
  // Sin arrastre, un toque selecciona.
  let st: { x: number; y: number; id?: string; de?: { f: string; l: LugarMenu }; chip: HTMLElement; movido: boolean } | null = null;
  let fantasma: HTMLElement | null = null;
  let caliente: Element | null = null;
  const destinoEn = (x: number, y: number) => {
    const c = document.elementFromPoint(x, y)?.closest('.tj-cell, .tj-dia') as HTMLButtonElement | null;
    if (!c || c.disabled) return null;
    if (c.classList.contains('tj-dia') && !st?.de) return null;
    return c;
  };
  function chipAbajo(e: PointerEvent) {
    const chip = (e.target as HTMLElement).closest<HTMLElement>('.tj-chip, .tj-asa');
    if (!chip) return;
    const de = chip.dataset.mf ? { f: chip.dataset.mf, l: chip.dataset.ml as LugarMenu } : undefined;
    st = { x: e.clientX, y: e.clientY, id: chip.dataset.id, de, chip, movido: false };
    chip.setPointerCapture(e.pointerId);
  }
  function chipMueve(e: PointerEvent) {
    if (!st) return;
    if (!st.movido && Math.hypot(e.clientX - st.x, e.clientY - st.y) > 6) {
      st.movido = true;
      fantasma = document.createElement('div');
      fantasma.className = 'tj-ghost';
      fantasma.textContent = st.chip.dataset.n ?? st.chip.textContent;
      fantasma.style.setProperty('--c', st.chip.style.getPropertyValue('--c'));
      document.body.appendChild(fantasma);
    }
    if (!st.movido || !fantasma) return;
    fantasma.style.left = e.clientX + 'px';
    fantasma.style.top = e.clientY + 'px';
    const c = destinoEn(e.clientX, e.clientY);
    if (caliente && caliente !== c) caliente.classList.remove('hot');
    caliente = c;
    c?.classList.add('hot');
  }
  function chipSuelta(e: PointerEvent) {
    if (!st) return;
    const s = st;
    const c = s.movido ? destinoEn(e.clientX, e.clientY) : null;
    st = null;
    fantasma?.remove(); fantasma = null;
    caliente?.classList.remove('hot'); caliente = null;
    if (s.movido) {
      if (!c) return;
      if (s.de) mover(s.de, c.dataset.f!, (c.dataset.l as LugarMenu) ?? s.de.l);
      else if (s.id) colocar(s.id, c.dataset.f!, c.dataset.l as LugarMenu);
    } else if (s.de) moviendo = moviendo && moviendo.f === s.de.f && moviendo.l === s.de.l ? null : s.de;
    else if (s.id) alternar(s.id);
  }
  function chipCancela() { st = null; fantasma?.remove(); fantasma = null; caliente?.classList.remove('hot'); }
  async function alternar(id: string) {
    moviendo = null;
    tarjetas.sel = tarjetas.sel === id ? null : id;
    await tick();
    document.querySelector<HTMLElement>('.tj-chip[data-id="' + id + '"]')?.focus();
  }
  function chipTecla(e: KeyboardEvent) {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    const chip = (e.target as HTMLElement).closest<HTMLElement>('.tj-chip');
    if (!chip) return;
    e.preventDefault();
    alternar(chip.dataset.id!);
  }
  function tocaDia(f: string) { dia = f; }
  const ayudaAcomodar = $derived(
    moviendo ? 'Toca otro lugar o cambia de día para mover «' + platoTxt(indice.get(llave(moviendo.f, moviendo.l))!) + '».'
    : sel ? 'Toca el lugar para «' + sel.n + '».'
    : 'Toca «Agregar» en un tiempo de comida para elegir con tarjetas. Arrastra un plato por ⠿ para moverlo de lugar o de día.'
  );

  const ingTxt = (r: Receta) => r.ing.slice(0, 3).map((x) => x[2]).join(', ');
  const metaTxt = (r: Receta) => r.y + (r.y > 1 ? ' porciones' : ' porción') + (r.t ? ' · ' + r.t : '') + (ver && r.k != null ? ' · ' + Math.round(r.k) + ' kcal aprox.' : '');
</script>

<header class="cur-head">
  <button class="back" aria-label="Volver" onclick={atras}>‹ Volver</button>
  {#if !acomodando}
    <span class="tj-sw"><span id="tj-sw-l">Fotos</span><button class="sw" role="switch" aria-checked={tarjetas.fotos} aria-labelledby="tj-sw-l" onclick={() => (tarjetas.fotos = !tarjetas.fotos)}><i></i></button></span>
  {/if}
</header>

{#if !acomodando}
  <div class="screen">
    <div class="tl-head">
      <h2 tabindex="-1">Elegir con tarjetas</h2>
      <p class="seg-help">Derecha: sí. Izquierda: no. También hay botones.</p>
    </div>
    {#if tarjetas.destino}
      <div class="rc-pick"><span><small>Eliges para</small><b>{NOMBRE_LUGAR[tarjetas.destino.l]} · desde el {nombreDia(tarjetas.destino.f).toLowerCase()} {numeroDia(tarjetas.destino.f)}</b><em>Lo que digas que sí va a ese tiempo, en los días libres.</em></span><button onclick={() => (tarjetas.destino = null)}>Cancelar</button></div>
    {/if}
    <div class="m-chips tj-cats" aria-label="Tipo de receta">
      {#each [['todo', 'Todas'], ...CATS_TARJETA.map((c) => [c, c === 'Base' ? 'Bases' : c])] as [k, t] (k)}
        <button class:on={tarjetas.cat === k} aria-pressed={tarjetas.cat === k} onclick={() => (tarjetas.cat = k)}>{t}</button>
      {/each}
    </div>
    <FiltrosRecetas {recetas} {perfiles} />
    <div class="tj-stack">
      {#if listo && !mazo.length}
        <div class="tj-empty">
          <b>No quedan tarjetas{tarjetas.cat === 'todo' && filtros.origen === 'todo' && !filtros.sinLes && !filtros.sinJeff && filtros.uso === 'todo' ? '' : ' con estos filtros'}.</b>
          <p>{tarjetas.liked.length ? 'Ya puedes acomodar las que elegiste en la semana.' : 'Puedes cambiar los filtros o volver a ver las que dijiste que no.'}</p>
        </div>
      {/if}
      {#each [...visibles].reverse() as r (r.id)}
        {@const pos = visibles.indexOf(r)}
        <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
        <article
          class="tj-card"
          data-pos={pos}
          style:--c={CAT_COLOR[r.cat]}
          tabindex={pos === 0 ? 0 : undefined}
          aria-label={pos === 0 ? r.n + ', ' + r.cat.toLowerCase() + '. Flecha derecha para sí, flecha izquierda para no.' : undefined}
          aria-hidden={pos === 0 ? undefined : 'true'}
          onpointerdown={pos === 0 ? abajo : undefined}
          onpointermove={pos === 0 ? mueve : undefined}
          onpointerup={pos === 0 ? suelta : undefined}
          onpointercancel={pos === 0 ? suelta : undefined}
          onkeydown={pos === 0 ? tecla : undefined}
        >
          {#if tarjetas.fotos}
            <div class="tj-img"><Plato receta={r} /></div>
          {:else}
            <div class="tj-img tj-ico"><svg viewBox="0 0 24 24" aria-hidden="true"><path d={BOWL} /></svg></div>
          {/if}
          <div class="tj-info">
            <span class="rc-ty">{r.cat}</span>
            <b>{r.n}</b>
            <small>{metaTxt(r)}</small>
            <small>Lleva: {ingTxt(r)}</small>
          </div>
          <span class="tj-stamp yes" aria-hidden="true">SÍ</span><span class="tj-stamp no" aria-hidden="true">NO</span>
        </article>
      {/each}
    </div>
    <p class="tj-count" aria-live="polite">{cuentaTarjetas(tarjetas.liked.length, tarjetas.passed.length, mazo.length)}</p>
    <div class="tj-btns">
      <button class="tj-b no" disabled={!mazo.length} onclick={() => decidir('no')}>No</button>
      <button class="link-btn" disabled={!tarjetas.hist.length} onclick={deshacerUna}>Deshacer</button>
      <button class="tj-b yes" disabled={!mazo.length} onclick={() => decidir('yes')}>Sí</button>
    </div>
    {#if tarjetas.destino}
      <button class="start" onclick={ponerDestino}>{nuevasDestino.length ? 'Poner en ' + NOMBRE_LUGAR[tarjetas.destino.l].toLowerCase() + ' (' + nuevasDestino.length + ')' : 'Volver sin agregar'}</button>
    {:else}
      <button class="ghost" onclick={() => nav.abrirHoja('tj-acomodar')}>{elegidasTxt(tarjetas.liked.length)}</button>
    {/if}
    <p class="tool-note">El tipo es opcional: unas quesadillas de cena también pueden ser desayuno. Con «Todas» ves todo. Elegir una receta aquí no cambia el menú hasta que la acomodas.</p>
  </div>
{:else}
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div class="screen" onpointerdown={chipAbajo} onpointermove={chipMueve} onpointerup={chipSuelta} onpointercancel={chipCancela} onkeydown={chipTecla}>
    <div class="tl-head">
      <h2 tabindex="-1">Acomoda la semana</h2>
      <div class="m-chips" role="radiogroup" aria-label="Qué semana">
        {#each [[0, 'Esta semana'], [-1, 'Próxima semana']] as const as [k, t] (k)}<button role="radio" aria-checked={semanaK === k} class:on={semanaK === k} onclick={() => cambiarSemana(k)}>{t}</button>{/each}
      </div>
      <p class="seg-help" aria-live="polite">{ayudaAcomodar}</p>
    </div>
    <div class="tj-dias" role="radiogroup" aria-label="Día">
      {#each dias as f, i (f)}
        {@const n = items.filter((m) => m.fecha === f).length}
        <button class="tj-dia" role="radio" aria-checked={dia === f} class:on={dia === f} class:past={f < hoy} data-f={f} aria-label={nombreDia(f) + ' ' + numeroDia(f) + (n ? ', ' + n + (n === 1 ? ' comida' : ' comidas') : ', libre')} onclick={() => tocaDia(f)}>{LETRA_DIA[i]}<b>{numeroDia(f)}</b><i class:f={n > 0}></i></button>
      {/each}
    </div>
    <h3 class="tj-dia-t">{etiquetaFecha(dia)}{dia === hoy ? ' · hoy' : ''}</h3>
    <div class="group tj-dia-lista">
      {#each lugares as l (l)}
        {@const m = indice.get(llave(dia, l))}
        {@const mov = !!moviendo && moviendo.f === dia && moviendo.l === l}
        <div class="tj-slot" style:--c={colorDe(m)}>
          <span class="tj-lug">{NOMBRE_LUGAR[l]}</span>
          <div class="tj-slot-r">
            {#if m && !pasado}<span class="tj-asa" data-mf={dia} data-ml={l} data-n={platoTxt(m)} style:--c={colorDe(m)} aria-hidden="true">⠿</span>{/if}
            <button class="tj-cell" class:f={!!m} class:on={mov} data-f={dia} data-l={l} disabled={pasado} aria-pressed={m ? mov : undefined} aria-label={nombreDia(dia) + ' ' + numeroDia(dia) + ', ' + NOMBRE_LUGAR[l].toLowerCase() + ': ' + (m ? platoTxt(m) : 'libre')} onclick={() => tocaCelda(dia, l)}><i></i><span>{m ? platoTxt(m) : 'Libre'}</span></button>
            {#if !pasado}<button class="tj-add" aria-label={'Agregar a ' + NOMBRE_LUGAR[l].toLowerCase() + ' con tarjetas'} onclick={() => agregar(l)}>Agregar</button>{/if}
          </div>
        </div>
      {/each}
    </div>
    {#if delDia.length && !pasado}<button class="link-btn" onclick={reiniciarDia}>Volver a planear el {nombreDia(dia).toLowerCase()}</button>{/if}
    <h4 class="pat-sub">Tus elegidas</h4>
    <div class="tj-pool" role="group" aria-label="Tus tarjetas elegidas">
      {#each elegidas as r (r.id)}
        {@const on = tarjetas.sel === r.id}
        <button class="tj-chip" class:on data-id={r.id} aria-pressed={on} style:--c={CAT_COLOR[r.cat]}><i></i>{r.n}</button>
      {:else}
        <p class="seg-help">Aún no elegiste ninguna. Toca «Agregar» en un tiempo de comida.</p>
      {/each}
    </div>
    {#if noElegidas.length}
      <h4 class="pat-sub">Las que dijiste que no</h4>
      <div class="group">
        {#each noElegidas as r (r.id)}
          <div class="tj-pr"><span>{r.n}</span><button onclick={() => consideraDeNuevo(r.id)}>Considerar otra vez</button></div>
        {/each}
      </div>
    {/if}
    <button class="ghost" onclick={verMenu}>Ver el menú de {semanaK ? 'la próxima semana' : 'la semana'}</button>
  </div>
{/if}
