<script lang="ts">
  import { tick } from 'svelte';
  import type { ItemMenu, LugarMenu, Receta } from '../../core/db';
  import { avisos } from '../../core/aviso.svelte';
  import { nav } from '../../core/nav.svelte';
  import { CAT_COLOR, fechaDe } from './calculos';
  import { listarRecetas, menuDe, ponerEnMenu, reponerMenu, sembrarRecetas } from './datos';
  import { numerosVisibles, tarjetas } from './estado.svelte';
  import { LETRA_DIA, NOMBRE_LUGAR, fechasDeSemana, indexar, itemDos, llave, nombreDia, numeroDia, platoTxt } from './semana';
  import { CATS_TARJETA, cuentaTarjetas, elegidasTxt, mazoDe } from './tarjetas';
  import Plato from './Plato.svelte';

  const hoy = fechaDe(0);
  const dias = fechasDeSemana(0);
  const filasSemana: { l: LugarMenu; rot: string }[] = [{ l: 'd', rot: 'Des' }, { l: 'c', rot: 'Com' }, { l: 'n', rot: 'Cen' }];
  const BOWL = 'M4 11h16a8 8 0 0 1-16 0zM9 4v4M12 3v5M15 4v4';

  let recetas = $state<Receta[]>([]);
  let items = $state<ItemMenu[]>([]);
  let listo = $state(false);

  const cargarMenu = async () => { items = await menuDe(dias); };
  (async () => {
    await sembrarRecetas();
    [recetas] = await Promise.all([listarRecetas(), cargarMenu()]);
    listo = true;
  })();

  const porId = $derived(new Map(recetas.map((r) => [r.id, r])));
  const mazo = $derived(mazoDe(recetas, tarjetas.liked, tarjetas.passed, tarjetas.cat));
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
    else { nav.cerrar(); nav.reemplazar('menu'); }
  }

  // ---------- El mazo ----------
  const sinMovimiento = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
  async function decidir(dir: 'yes' | 'no') {
    const r = mazo[0];
    if (!r) return;
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
  async function colocar(id: string, f: string, l: LugarMenu) {
    const r = porId.get(id);
    if (!r || f < hoy) return;
    const antes = structuredClone($state.snapshot(items.filter((m) => m.fecha === f))) as ItemMenu[];
    await ponerEnMenu(itemDos(f, l, r));
    await cargarMenu();
    tarjetas.sel = null;
    avisos.deshacer(r.n + ': ' + nombreDia(f).toLowerCase() + ', ' + NOMBRE_LUGAR[l].toLowerCase(), async () => { await reponerMenu([f], antes); await cargarMenu(); });
  }
  function tocaCelda(f: string, l: LugarMenu) {
    if (!tarjetas.sel) { avisos.mostrar('Primero toca una tarjeta'); return; }
    colocar(tarjetas.sel, f, l);
  }
  const colorDe = (m: ItemMenu | undefined) => {
    if (!m) return '';
    if (m.t === 'takeout') return 'var(--rose)';
    const r = porId.get(m.r ?? m.rl ?? '');
    return r ? CAT_COLOR[r.cat] : 'var(--muted)';
  };

  // Arrastrar una tarjeta a su lugar (con dedo o ratón); sin arrastre, un toque la selecciona
  let st: { x: number; y: number; id: string; chip: HTMLElement; movido: boolean } | null = null;
  let fantasma: HTMLElement | null = null;
  let caliente: Element | null = null;
  const celdaEn = (x: number, y: number) => {
    const c = document.elementFromPoint(x, y)?.closest('.tj-cell') as HTMLButtonElement | null;
    return c && !c.disabled ? c : null;
  };
  function chipAbajo(e: PointerEvent) {
    const chip = (e.target as HTMLElement).closest<HTMLElement>('.tj-chip');
    if (!chip) return;
    st = { x: e.clientX, y: e.clientY, id: chip.dataset.id!, chip, movido: false };
    chip.setPointerCapture(e.pointerId);
  }
  function chipMueve(e: PointerEvent) {
    if (!st) return;
    if (!st.movido && Math.hypot(e.clientX - st.x, e.clientY - st.y) > 6) {
      st.movido = true;
      fantasma = document.createElement('div');
      fantasma.className = 'tj-ghost';
      fantasma.textContent = st.chip.textContent;
      fantasma.style.setProperty('--c', st.chip.style.getPropertyValue('--c'));
      document.body.appendChild(fantasma);
    }
    if (!st.movido || !fantasma) return;
    fantasma.style.left = e.clientX + 'px';
    fantasma.style.top = e.clientY + 'px';
    const c = celdaEn(e.clientX, e.clientY);
    if (caliente && caliente !== c) caliente.classList.remove('hot');
    caliente = c;
    c?.classList.add('hot');
  }
  function chipSuelta(e: PointerEvent) {
    if (!st) return;
    const s = st;
    st = null;
    fantasma?.remove(); fantasma = null;
    caliente?.classList.remove('hot');
    if (s.movido) {
      const c = celdaEn(e.clientX, e.clientY);
      caliente = null;
      if (c) colocar(s.id, c.dataset.f!, c.dataset.l as LugarMenu);
    } else alternar(s.id);
  }
  function chipCancela() { st = null; fantasma?.remove(); fantasma = null; caliente?.classList.remove('hot'); }
  async function alternar(id: string) {
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
    <div class="m-chips tj-cats" aria-label="Tipo de receta">
      {#each [['todo', 'Todas'], ...CATS_TARJETA.map((c) => [c, c])] as [k, t] (k)}
        <button class:on={tarjetas.cat === k} aria-pressed={tarjetas.cat === k} onclick={() => (tarjetas.cat = k)}>{t}</button>
      {/each}
    </div>
    <div class="tj-stack">
      {#if listo && !mazo.length}
        <div class="tj-empty">
          <b>No quedan tarjetas{tarjetas.cat === 'todo' ? '' : ' de este tipo'}.</b>
          <p>{tarjetas.liked.length ? 'Ya puedes acomodar las que elegiste en la semana.' : 'Puedes cambiar el tipo o volver a ver las que dijiste que no.'}</p>
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
    <button class="ghost" disabled={!tarjetas.liked.length} onclick={() => nav.abrirHoja('tj-acomodar')}>{elegidasTxt(tarjetas.liked.length)}</button>
    <p class="tool-note">El tipo es opcional: unas quesadillas de cena también pueden ser desayuno. Con «Todas» ves todo. Elegir una receta aquí no cambia el menú hasta que la acomodas.</p>
  </div>
{:else}
  <div class="screen">
    <div class="tl-head">
      <h2 tabindex="-1">Acomoda la semana</h2>
      <p class="seg-help" aria-live="polite">{sel ? 'Toca el lugar para «' + sel.n + '».' : elegidas.length ? 'Arrastra una tarjeta a su lugar, o tócala y luego toca el lugar. Cada tipo de receta puede ir en cualquier comida.' : 'Elige tarjetas primero.'}</p>
    </div>
    <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
    <div class="tj-pool" role="group" aria-label="Tus tarjetas elegidas" onpointerdown={chipAbajo} onpointermove={chipMueve} onpointerup={chipSuelta} onpointercancel={chipCancela} onkeydown={chipTecla}>
      {#each elegidas as r (r.id)}
        {@const on = tarjetas.sel === r.id}
        <button class="tj-chip" class:on data-id={r.id} aria-pressed={on} style:--c={CAT_COLOR[r.cat]}><i></i>{r.n}</button>
      {:else}
        <p class="seg-help">Aún no elegiste ninguna.</p>
      {/each}
    </div>
    <div class="wk-grid tj-grid" aria-label="Semana: toca o suelta una tarjeta en un lugar">
      <span></span>
      {#each dias as f, i (f)}<span class="tj-dh" class:past={f < hoy}>{LETRA_DIA[i]}<b>{numeroDia(f)}</b></span>{/each}
      {#each filasSemana as r (r.l)}
        <span class="wl" aria-hidden="true">{r.rot}</span>
        {#each dias as f (f)}
          {@const m = indice.get(llave(f, r.l))}
          <button class="tj-cell" class:f={!!m} data-f={f} data-l={r.l} disabled={f < hoy} style:--c={colorDe(m)} aria-label={nombreDia(f) + ' ' + numeroDia(f) + ', ' + NOMBRE_LUGAR[r.l].toLowerCase() + ': ' + (m ? platoTxt(m) : 'libre')} onclick={() => tocaCelda(f, r.l)}><i></i></button>
        {/each}
      {/each}
    </div>
    <div class="wk-key"><span><i class="wk-dot f"></i>Ya hay algo</span><span><i class="wk-dot"></i>Libre</span></div>
    {#if noElegidas.length}
      <h4 class="pat-sub">Las que dijiste que no</h4>
      <div class="group">
        {#each noElegidas as r (r.id)}
          <div class="tj-pr"><span>{r.n}</span><button onclick={() => consideraDeNuevo(r.id)}>Considerar otra vez</button></div>
        {/each}
      </div>
    {/if}
    <button class="ghost" onclick={verMenu}>Ver el menú de la semana</button>
  </div>
{/if}
