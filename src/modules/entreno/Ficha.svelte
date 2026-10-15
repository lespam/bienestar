<script lang="ts">
  import { onMount } from 'svelte';
  import Hoja from '../../core/Hoja.svelte';
  import { nav } from '../../core/nav.svelte';
  import { avisos } from '../../core/aviso.svelte';
  import { mantenerEncendida } from '../../core/pantalla';
  import { prefs } from '../ajustes';
  import { dondeQuedaste, textoSeries } from './calculos';
  import { cargarContexto, datosDeEjercicio, type Contexto } from './contexto';
  import { agregarTip, guardarFicha, leerFicha } from './datos';
  import { AnfitrionIA, pedirIA, tipsDeEjercicios } from '../ia';
  import { buscarEjercicio, enlaceSeguro, type Ejercicio } from './programa';
  import { cuerpoSVG, MOVIMIENTO, MUSCULOS } from './musculos';
  import { fechaCorta3 } from './semana';
  import type { FichaPropia } from '../../core/db';
  import Animacion from './Animacion.svelte';

  const clave = String(nav.pantalla?.datos?.clave ?? '');
  let c = $state<Contexto | null>(null);
  let ficha = $state<FichaPropia>({ clave });
  let info = $state<{ k: string; principal: boolean } | null>(null);
  let pantalla = $state<HTMLElement>();
  // Campos de las hojas
  let vTitulo = $state(''), vUrl = $state('');
  let fNombre = $state(''), fPagina = $state('');
  let fTipo = $state<'faciles' | 'dificiles'>('faciles');
  let eCancion = $state(''), eLetra = $state(''), eTips = $state('');
  let eArchivo = $state<File | null>(null);
  let quitarAnim = $state(false);

  const hallado = $derived(c ? buscarEjercicio(c.p, clave) : null);
  const e = $derived<Ejercicio | null>(hallado?.ejercicio ?? null);
  const mov = $derived(e?.anim ? MOVIMIENTO[e.anim] : undefined);
  const dato = $derived(c && e ? datosDeEjercicio(c, e) : null);
  const oculto = $derived(prefs.ocultarEntreno);
  const rx = $derived(e ? `${e.series} ${e.series === 1 ? 'serie' : 'series'} × ${/^[\d-]+$/.test(e.rango) ? e.rango + ' reps' : e.rango}` : '');

  onMount(() => {
    let suelta: (() => void) | null = null;
    (async () => {
      c = await cargarContexto();
      ficha = await leerFicha(clave);
      if (c?.hoy?.estado === 'abierta') suelta = mantenerEncendida();
    })();
    return () => suelta?.();
  });

  const SECCIONES = [['fi-tec', 'Técnica'], ['fi-mus', 'Músculos'], ['fi-vid', 'Videos'], ['fi-son', 'Canción'], ['fi-tip', 'Tips'], ['fi-var', 'Variaciones']];
  function ir(id: string) {
    const t = document.getElementById(id);
    if (!pantalla || !t) return;
    const reducir = matchMedia('(prefers-reduced-motion: reduce)').matches;
    pantalla.scrollTo({ top: t.offsetTop - 64, behavior: reducir ? 'auto' : 'smooth' });
  }

  async function guardar(cambios: Partial<FichaPropia>) {
    const nueva: FichaPropia = { ...$state.snapshot(ficha), ...cambios, clave };
    ficha = nueva;
    await guardarFicha($state.snapshot(nueva) as FichaPropia);
  }

  function tipsIA() {
    if (!e) return;
    const ej = { clave: e.clave, nombre: e.nombre, series: rx, casa: !e.gym };
    pedirIA({
      fn: 'entreno', titulo: 'Tips con IA', envia: 'el nombre del ejercicio, sus series y repeticiones',
      ejecutar: async (k) => ({
        intro: 'Tres ideas de técnica para «' + ej.nombre + '». Revísalas con el libro antes de guardarlas.',
        items: (await tipsDeEjercicios(k, [ej])).map((x) => ({ t: x.tip, act: 'Guardar en la ficha', aplicar: async () => { ficha = await agregarTip(clave, x.tip, true); avisos.mostrar('Tip guardado'); } }))
      })
    });
  }

  function abrirVideo() { vTitulo = ''; vUrl = ''; nav.abrirHoja('video'); }
  async function agregarVideo() {
    const u = enlaceSeguro(vUrl);
    if (!u) { avisos.mostrar('Escribe un link que empiece con https://'); return; }
    await guardar({ videos: [...(ficha.videos ?? []), { t: vTitulo.trim() || 'Video de ' + (e?.nombre ?? 'este ejercicio'), u }] });
    nav.cerrar();
  }
  async function quitarVideo(i: number) {
    const videos = (ficha.videos ?? []).filter((_, j) => j !== i);
    await guardar({ videos });
    avisos.mostrar('Video quitado');
  }
  function abrirVariacion(tipo: 'faciles' | 'dificiles') { fTipo = tipo; fNombre = ''; fPagina = ''; nav.abrirHoja('facil'); }
  async function agregarVariacion() {
    if (!fNombre.trim()) return;
    await guardar({ [fTipo]: [...(ficha[fTipo] ?? []), { n: fNombre.trim(), p: fPagina.trim() }] });
    nav.cerrar();
  }
  async function quitarVariacion(tipo: 'faciles' | 'dificiles', i: number) { await guardar({ [tipo]: (ficha[tipo] ?? []).filter((_, j) => j !== i) }); }

  function abrirEditar() {
    eCancion = ficha.cancion ?? ''; eLetra = ficha.letra ?? ''; eTips = (ficha.tips ?? []).join('\n');
    eArchivo = null; quitarAnim = false;
    nav.abrirHoja('editar');
  }
  async function guardarEdicion() {
    const cancion = eCancion.trim() ? enlaceSeguro(eCancion) : null;
    if (eCancion.trim() && !cancion) { avisos.mostrar('El link de la canción debe empezar con https://'); return; }
    const cambios: Partial<FichaPropia> = { cancion: cancion ?? undefined, letra: eLetra.trim() || undefined, tips: eTips.split('\n').map((t) => t.trim()).filter(Boolean) };
    cambios.tipsIA = (ficha.tipsIA ?? []).filter((t) => cambios.tips!.includes(t));
    if (eArchivo) cambios.animacion = eArchivo;
    else if (quitarAnim) cambios.animacion = undefined;
    await guardar(cambios);
    nav.cerrar();
    avisos.mostrar('Guardado');
  }
</script>

<header class="cur-head">
  <button class="back" aria-label="Volver" onclick={() => nav.cerrar()}>‹ Volver</button>
  <button class="edit" onclick={abrirEditar}>Editar</button>
</header>
<div class="screen fi-screen" bind:this={pantalla}>
  {#if e && hallado}
    <div class="fi-title">
      <span class="fi-code">{e.codigo ? e.codigo + ' · ' : ''}Rutina {hallado.letra} · p. {e.pagina}</span>
      <h2 tabindex="-1">{e.nombre}</h2>
      <p>{rx}</p>
    </div>
    <Animacion anim={e.anim} nombre={e.nombre} propia={ficha.animacion} hl={mov ? { p: mov.principales, s: mov.apoyo } : undefined} />
    {#if dato?.ultima}
      <div class="stats">
        <div class="stat"><span>Última vez · {fechaCorta3(dato.ultima.fecha)}</span><b>{textoSeries(e.registro, dato.ultima.series, oculto)}</b></div>
        <div class="stat"><span>Récord</span><b>{dato.record ? (oculto ? dato.record.tapado : dato.record.texto) : '–'}</b></div>
      </div>
      {#if !oculto}<p class="where">{dondeQuedaste(e, dato.ultima.series)}</p>{/if}
    {:else}
      <p class="where">Aún no hay registros de este ejercicio.</p>
    {/if}
    <nav class="fi-jump" aria-label="Secciones de la ficha">
      {#each SECCIONES as [id, t] (id)}<button onclick={() => ir(id)}>{t}</button>{/each}
    </nav>

    <section class="fi-sec" id="fi-tec">
      <h4>Técnica</h4>
      {#if mov}<p class="fi-how">{mov.como}</p>{/if}
      <p class="fi-note">La técnica exacta, paso a paso, es la de la página {e.pagina} de tu libro.</p>
    </section>

    <section class="fi-sec" id="fi-mus">
      <h4>Músculos</h4>
      {#if mov}
        <div class="muscles">
          {#each mov.principales as k (k)}<button class="main" aria-expanded={info?.k === k} onclick={() => (info = info?.k === k ? null : { k, principal: true })}>{MUSCULOS[k].nombre}</button>{/each}
          {#each mov.apoyo as k (k)}<button aria-expanded={info?.k === k} onclick={() => (info = info?.k === k ? null : { k, principal: false })}>{MUSCULOS[k].nombre}</button>{/each}
        </div>
        <p class="fi-hint">Rosa en la animación: principal. Toca un músculo para ver dónde está en el cuerpo y qué hace.</p>
        {#if info}
          {@const m = MUSCULOS[info.k]}
          <div class="info" role="region" aria-label={m.nombre}>
            <!-- Trazos fijos de musculos.ts, no texto tuyo. -->
            <!-- eslint-disable-next-line svelte/no-at-html-tags -->
            <div class="cuerpo">{@html cuerpoSVG(m.vista, info.k)}</div>
            <div>
              <h3>{m.nombre}</h3>
              <p>{m.que}</p>
              <p><b>Dónde:</b> {m.donde} ({m.vista === 'back' ? 'vista de espalda' : 'vista de frente'})</p>
              <p><b>Qué hace:</b> {m.hace}</p>
            </div>
          </div>
        {/if}
      {:else}
        <p class="where">Los músculos de este ejercicio están en la página {e.pagina} de tu libro.</p>
      {/if}
    </section>

    <section class="fi-sec" id="fi-vid">
      <h4>Videos</h4>
      <div class="links">
        {#each ficha.videos ?? [] as v, i (v.u + i)}
          <div class="link"><span><b>{v.t}</b><small>Tu link</small></span><a class="abrir" href={v.u} target="_blank" rel="noopener">Abrir</a></div>
          <button class="add quitar" onclick={() => quitarVideo(i)} aria-label={'Quitar ' + v.t}>Quitar «{v.t}»</button>
        {/each}
        <button class="add" onclick={abrirVideo}>+ Agregar video</button>
      </div>
    </section>

    <section class="fi-sec" id="fi-son">
      <h4>Canción</h4>
      {#if ficha.cancion}
        <div class="link"><span><b>Tu canción para este ejercicio</b><small>Tu link</small></span><a class="abrir" href={ficha.cancion} target="_blank" rel="noopener">Abrir</a></div>
      {:else}
        <p class="where">Aún no agregas una canción. Puedes ponerla en Editar.</p>
      {/if}
      {#if ficha.letra}
        <div class="lyric"><span>Letra para guiar el ritmo</span><p>{#each ficha.letra.split('\n') as l, i (i)}{#if i}<br />{/if}{l}{/each}</p></div>
      {/if}
    </section>

    <section class="fi-sec" id="fi-tip">
      <h4>Tips</h4>
      {#if ficha.tips?.length}
        <ul class="tips">{#each ficha.tips as t, i (i)}<li>{t}{#if ficha.tipsIA?.includes(t)}<span class="ai-tag">Sugerido por IA</span>{/if}</li>{/each}</ul>
      {:else}
        <p class="where">Aún no hay tips. Agrégalos en Editar.</p>
      {/if}
      <button class="link-btn" onclick={tipsIA}>Pedir tips con IA</button>
    </section>

    <section class="fi-sec" id="fi-var">
      <h4>Variaciones</h4>
      {#each [['faciles', 'Más fácil'], ['dificiles', 'Más difícil']] as const as [tipo, rotulo] (tipo)}
        <div class="var">
          <span class="var-h">{rotulo}</span>
          {#each ficha[tipo] ?? [] as v, i (v.n + i)}
            <div class="var-row"><span>{v.n}</span>{#if v.p}<small>{v.p}</small>{/if}<button class="quitar-mini" aria-label={'Quitar ' + v.n} onclick={() => quitarVariacion(tipo, i)}>×</button></div>
          {/each}
          <button class="add" aria-label={'Agregar variación ' + rotulo.toLowerCase()} onclick={() => abrirVariacion(tipo)}>+ Agregar variación</button>
        </div>
      {/each}
    </section>
  {:else if c}
    <p class="where">No encontré este ejercicio en tu programa.</p>
  {/if}
</div>

{#if nav.hojaAbierta('video')}
  <Hoja titulo="Agregar video">
    <div class="man"><label for="fv-t">Nombre (opcional)</label><input id="fv-t" type="text" placeholder="Ej. Técnica con pausa" bind:value={vTitulo} /><label for="fv-u">Link</label><input id="fv-u" type="url" inputmode="url" placeholder="youtube.com/…" bind:value={vUrl} /></div>
    <button class="start" onclick={agregarVideo}>Agregar</button>
  </Hoja>
{/if}
{#if nav.hojaAbierta('facil')}
  <Hoja titulo={fTipo === 'faciles' ? 'Variación más fácil' : 'Variación más difícil'}>
    <p class="seg-help">Escribe una que tú elijas. Si viene en tu libro, anota la página.</p>
    <div class="man"><label for="fa-n">Ejercicio</label><input id="fa-n" type="text" placeholder="Ej. Glute bridge con pies en el sillón" bind:value={fNombre} /><label for="fa-p">Página (opcional)</label><input id="fa-p" type="text" placeholder="Ej. p. 193" bind:value={fPagina} /></div>
    <button class="start" disabled={!fNombre.trim()} onclick={agregarVariacion}>Agregar</button>
  </Hoja>
{/if}
{#if nav.hojaAbierta('editar')}
  <Hoja titulo="Editar ficha">
    <p class="seg-help">La técnica y los músculos vienen de tu libro (p. {e?.pagina}) y no se editan aquí. Lo demás es tuyo.</p>
    <div class="man">
      <label for="fe-file">Tu animación (imagen o GIF)</label>
      <input id="fe-file" type="file" accept="image/*" onchange={(ev) => (eArchivo = ev.currentTarget.files?.[0] ?? null)} />
      {#if ficha.animacion && !eArchivo}
        <small class="seg-help">Ya tienes una animación guardada.</small>
        <label class="fe-quitar"><input type="checkbox" bind:checked={quitarAnim} /> Quitar mi animación y usar la de la app</label>
      {/if}
      <label for="fe-song">Link de tu canción</label><input id="fe-song" type="url" inputmode="url" placeholder="music.apple.com/…" bind:value={eCancion} />
      <label for="fe-lyr">Letra para guiar el ritmo</label><textarea id="fe-lyr" rows="4" bind:value={eLetra}></textarea>
      <label for="fe-tips">Tips (uno por línea)</label><textarea id="fe-tips" rows="4" bind:value={eTips}></textarea>
    </div>
    <button class="start" onclick={guardarEdicion}>Guardar</button>
  </Hoja>
{/if}

<style>
  .fi-how { margin: 0; font-size: 15px; line-height: 1.5; }
  .fi-hint { margin: 0; font-size: 13px; color: var(--muted); }
  .muscles button { border: 0; border-radius: 99px; padding: 8px 14px; min-height: 44px; font-size: 14px; font-weight: 600; background: var(--soft); color: var(--fg); }
  .muscles button.main { background: var(--accent); color: var(--ink); }
  .muscles button[aria-expanded="true"] { outline: 2px solid var(--fg); outline-offset: 1px; }
  .info { display: grid; grid-template-columns: 110px 1fr; gap: 12px; background: var(--panel); border-radius: 14px; padding: 12px; align-items: start; }
  .info h3 { margin: 0 0 4px; font-size: 15px; }
  .info p { margin: 0 0 6px; font-size: 14px; line-height: 1.45; }
  .info b { color: var(--rose); }
  .cuerpo :global(svg) { width: 110px; height: auto; }
  .cuerpo :global(.bf) { fill: var(--line); }
  .cuerpo :global(.b) { stroke: var(--line); fill: none; stroke-linecap: round; }
  .cuerpo :global(.z) { fill: var(--muted); fill-opacity: .18; }
  .cuerpo :global(.z.on) { fill: var(--rose); fill-opacity: .95; }
  .abrir { border: 0; border-radius: 99px; background: var(--soft); padding: 10px 14px; min-height: 44px; display: inline-grid; place-items: center; font-weight: 700; font-size: 14px; color: var(--fg); text-decoration: none; }
  .quitar { background: none; border: 0; color: var(--muted); font-size: 13px; text-align: left; min-height: 44px; }
  .quitar-mini { border: 0; background: none; color: var(--muted); font-size: 20px; min-width: 44px; min-height: 44px; }
  .fe-quitar { display: flex; gap: 8px; align-items: center; min-height: 44px; font-size: 14px; }
</style>

<AnfitrionIA />
