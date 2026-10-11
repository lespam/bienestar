<script lang="ts">
  import { onDestroy } from 'svelte';
  import type { ItemColeccion, Meta } from '../../core/db';
  import Hoja from '../../core/Hoja.svelte';
  import Icono from '../../core/Icono.svelte';
  import { avisos } from '../../core/aviso.svelte';
  import { reducirFoto } from '../../core/imagen';
  import { nav } from '../../core/nav.svelte';
  import { agregarItem, agregarMeta, devolverItem, devolverMeta, guardarItem, guardarMeta, ICONOS_META, listarColeccion, listarMetas, otraFrase, quitarItem, quitarMeta, TIPOS, urlSegura, type TipoColeccion } from './datos';
  import { mensajeDelDia } from './mensaje';

  const inicial = (nav.pantalla?.datos as { tab?: 'col' | 'vis' } | undefined)?.tab;
  let pestana = $state<'col' | 'vis'>(inicial ?? 'col');
  let filtro = $state<TipoColeccion | 'todo'>('todo');
  let items = $state<ItemColeccion[]>([]);
  let metas = $state<Meta[]>([]);
  let mensaje = $state<ItemColeccion | null>(null);
  let listo = $state(false);
  let urls = $state<Record<string, string>>({});

  function soltarUrls() { for (const u of Object.values(urls)) URL.revokeObjectURL(u); urls = {}; }
  onDestroy(soltarUrls);

  async function leer() {
    const [c, m, d] = await Promise.all([listarColeccion(), listarMetas(), mensajeDelDia()]);
    items = c; metas = m; mensaje = d;
    soltarUrls();
    const nuevas: Record<string, string> = {};
    for (const x of c) if (x.imagen) nuevas['i' + x.id] = URL.createObjectURL(x.imagen);
    for (const x of m) if (x.imagen) nuevas['m' + x.id] = URL.createObjectURL(x.imagen);
    urls = nuevas;
    listo = true;
  }
  leer();

  const vistos = $derived(filtro === 'todo' ? items : items.filter((x) => x.tipo === filtro));
  const cuenta = (t: TipoColeccion | 'todo') => (t === 'todo' ? items.length : items.filter((x) => x.tipo === t).length);
  const tono = (id?: number) => 't' + (((id ?? 0) % 3) + 1);
  const SUB: Record<string, string> = { imagen: 'Imagen · también en descansos', video: 'Video · YouTube', cancion: 'Canción · Apple Music' };
  const limpio = <T,>(x: T): T => $state.snapshot(x) as T;

  // ---------- Mensaje del día ----------
  async function otra() {
    const it = await otraFrase(mensaje?.id);
    if (!it) { avisos.mostrar('Agrega una frase para verla aquí'); return; }
    mensaje = it;
  }

  // ---------- Agregar ----------
  let tipo = $state<TipoColeccion>('frase');
  let fTexto = $state(''), fQuien = $state(''), fTitulo = $state(''), fUrl = $state('');
  let fImagen = $state<Blob | null>(null);
  let fNombre = $state('');
  function abrirAgregar() {
    tipo = 'frase'; fTexto = ''; fQuien = ''; fTitulo = ''; fUrl = ''; fImagen = null; fNombre = '';
    nav.abrirHoja('me-agregar');
  }
  async function elegirImagen(e: Event, alElegir: (b: Blob, n: string) => void) {
    const input = e.currentTarget as HTMLInputElement;
    const f = input.files?.[0];
    input.value = '';
    if (!f) return;
    alElegir(await reducirFoto(f), f.name);
  }
  async function guardarNuevo() {
    let it: Omit<ItemColeccion, 'id'>;
    if (tipo === 'frase') {
      const t = fTexto.trim();
      if (!t) { avisos.mostrar('Escribe la frase primero'); return; }
      it = { tipo, texto: t, origen: fQuien.trim() };
    } else if (tipo === 'imagen') {
      if (!fImagen) { avisos.mostrar('Elige una imagen primero'); return; }
      it = { tipo, texto: fTitulo.trim() || 'Imagen nueva', origen: '', imagen: fImagen };
    } else {
      const u = urlSegura(fUrl);
      if (u === null) { avisos.mostrar('Ese link no parece válido'); return; }
      it = { tipo, texto: fTitulo.trim() || (tipo === 'video' ? 'Video nuevo' : 'Canción nueva'), origen: '', url: u };
    }
    const id = await agregarItem(it);
    filtro = 'todo';
    nav.cerrar();
    await leer();
    avisos.deshacer('Guardado en tu colección', async () => { const x = items.find((y) => y.id === id); if (x) await quitarItem(limpio(x)); await leer(); });
  }

  // ---------- Editar ----------
  let ed = $state<ItemColeccion | null>(null);
  let eTexto = $state(''), eQuien = $state(''), eUrl = $state('');
  function abrirEditar(x: ItemColeccion) {
    ed = limpio(x); eTexto = x.texto; eQuien = x.tipo === 'frase' ? x.origen : ''; eUrl = x.url ?? '';
    nav.abrirHoja('me-editar');
  }
  const tituloEditar = $derived(!ed ? 'Editar' : ed.tipo === 'frase' ? 'Editar frase' : ed.tipo === 'imagen' ? 'Editar imagen' : ed.tipo === 'video' ? 'Editar video' : 'Editar canción');
  async function guardarEdicion() {
    if (!ed) return;
    const antes = limpio(ed);
    const nuevo: ItemColeccion = { ...ed };
    const t = eTexto.trim();
    if (!t) { avisos.mostrar(ed.tipo === 'frase' ? 'Escribe la frase primero' : 'Escribe un título'); return; }
    nuevo.texto = t;
    if (ed.tipo === 'frase') nuevo.origen = eQuien.trim();
    else if (ed.tipo === 'video' || ed.tipo === 'cancion') {
      const u = urlSegura(eUrl);
      if (u === null) { avisos.mostrar('Ese link no parece válido'); return; }
      nuevo.url = u;
    }
    await guardarItem(nuevo);
    nav.cerrar();
    await leer();
    avisos.deshacer('Cambios guardados', async () => { await guardarItem(antes); await leer(); });
  }
  async function cambiarImagen(b: Blob) {
    if (!ed) return;
    ed = { ...ed, imagen: b };
    await guardarItem(limpio(ed));
    await leer();
    avisos.mostrar('Imagen cambiada');
  }
  async function quitar() {
    if (!ed) return;
    const x = limpio(ed);
    await quitarItem(x);
    nav.cerrar();
    await leer();
    avisos.deshacer('Quitado de tu colección', async () => { await devolverItem(x); await leer(); });
  }

  // ---------- Tablero de visión ----------
  let meta = $state<Meta | null>(null);
  let nueva = $state(false);
  let mDeseo = $state(''), mRes = $state(''), mObs = $state(''), mPlan = $state('');
  let mIcono = $state('vision');
  let mImagen = $state<Blob | null>(null);
  let mUrl = $state('');
  function soltarMUrl() { if (mUrl) URL.revokeObjectURL(mUrl); mUrl = ''; }
  onDestroy(soltarMUrl);
  function abrirMeta(m: Meta | null) {
    nueva = !m;
    meta = m ? limpio(m) : null;
    mDeseo = m?.titulo ?? ''; mRes = m?.resultado ?? ''; mObs = m?.obstaculo ?? ''; mPlan = m?.plan ?? '';
    mIcono = m?.icono ?? 'vision'; mImagen = null; soltarMUrl();
    nav.abrirHoja('me-meta');
  }
  /** Mientras escribes, lo escrito se guarda solo (en una meta que ya existe). */
  async function autoMeta() {
    if (!meta || nueva) return;
    meta = { ...meta, titulo: mDeseo.trim() || meta.titulo, resultado: mRes, obstaculo: mObs, plan: mPlan };
    await guardarMeta(limpio(meta));
    metas = metas.map((x) => (x.id === meta!.id ? limpio(meta!) : x));
  }
  async function guardarNueva() {
    const w = mDeseo.trim();
    if (!w) { avisos.mostrar('Escribe tu deseo primero'); return; }
    const m: Omit<Meta, 'id'> = { titulo: w, icono: mIcono, resultado: mRes.trim(), obstaculo: mObs.trim(), plan: mPlan.trim(), destino: 'alma', ...(mImagen ? { imagen: mImagen } : {}) };
    const id = await agregarMeta(m);
    nav.cerrar();
    await leer();
    avisos.deshacer('Meta agregada: ' + w, async () => { await quitarMeta(id); await leer(); });
  }
  async function imagenDeMeta(b: Blob) {
    if (nueva) { mImagen = b; soltarMUrl(); mUrl = URL.createObjectURL(b); return; }
    if (!meta) return;
    meta = { ...meta, imagen: b };
    await guardarMeta(limpio(meta));
    await leer();
    soltarMUrl(); mUrl = URL.createObjectURL(b);
    avisos.mostrar('Imagen cambiada');
  }
  async function quitarDeTablero() {
    if (!meta) return;
    const m = limpio(meta);
    await quitarMeta(m.id!);
    nav.cerrar();
    await leer();
    avisos.deshacer('Meta quitada del tablero', async () => { await devolverMeta(m); await leer(); });
  }
  function verDestino() {
    const d = meta?.destino ?? 'alma';
    nav.cerrar();
    if (d === 'rutina') { nav.irTab('rutina'); } else nav.abrir('alma');
  }
  const urlMeta = $derived(mUrl || (meta?.id != null ? urls['m' + meta.id] : '') || '');
</script>

<header class="cur-head">
  <button class="back" aria-label="Volver a Inicio" onclick={() => nav.cerrar()}>‹ Inicio</button>
  <button class="edit" onclick={() => (pestana === 'vis' ? abrirMeta(null) : abrirAgregar())}>+ {pestana === 'vis' ? 'Agregar meta' : 'Agregar'}</button>
</header>
<div class="screen">
  <div class="tl-head">
    <h2 tabindex="-1">Mente</h2>
    <p class="seg-help">Tus frases, imágenes, videos y canciones. De aquí salen el mensaje del día y lo que ves en los descansos.</p>
  </div>

  {#if mensaje}
    <section class="in-msg" aria-label="Mensaje del día">
      <div class="in-mh"><h4>Mensaje del día</h4><span class="example">de tu colección</span></div>
      <p class="in-quote">“{mensaje.texto}”</p>
      {#if mensaje.mensaje}<p class="im-sub">{mensaje.mensaje}</p>{/if}
      <button class="in-more" onclick={otra}>Mostrar otra frase ›</button>
    </section>
  {/if}

  <div class="seg seg2" role="tablist" aria-label="Partes de Mente">
    <button role="tab" class:on={pestana === 'col'} aria-selected={pestana === 'col'} onclick={() => (pestana = 'col')}>Colección</button>
    <button role="tab" class:on={pestana === 'vis'} aria-selected={pestana === 'vis'} onclick={() => (pestana = 'vis')}>Tablero de visión</button>
  </div>

  {#if pestana === 'col'}
    <section class="me-sec" aria-label="Colección">
      <div class="m-chips">
        {#each TIPOS as [t, n] (t)}
          <button class:on={filtro === t} aria-pressed={filtro === t} onclick={() => (filtro = t)}>{n} · {cuenta(t)}</button>
        {/each}
      </div>
      <div class="group">
        {#each vistos as x (x.id)}
          {@const esLetra = x.tipo !== 'frase' && !!x.semilla}
          <div class="me-it">
            <button class="me-main" aria-label={'Editar: ' + x.texto} onclick={() => abrirEditar(x)}>
              {#if x.tipo === 'imagen'}
                <span class={'me-th tile ' + tono(x.id)}>{#if urls['i' + x.id]}<img src={urls['i' + x.id]} alt="" />{:else}<Icono nombre="imagen" />{/if}</span>
              {:else}
                <span class="me-th"><Icono nombre={x.tipo} /></span>
              {/if}
              <span>
                {#if x.tipo === 'frase' || esLetra}
                  <span class="me-q">“{x.texto}”</span><small>{x.tipo === 'frase' ? 'Frase' + (x.origen && x.origen !== 'Mía' ? ' · ' + x.origen : '') : x.origen}</small>
                {:else}
                  <b>{x.texto}</b><small>{SUB[x.tipo]}</small>
                {/if}
              </span>
            </button>
            {#if x.url}<a class="me-open" href={x.url} target="_blank" rel="noopener" aria-label={'Abrir: ' + x.texto}>Abrir</a>{/if}
          </div>
        {/each}
        {#if listo && !vistos.length}<p class="al-none">Aquí no hay nada todavía. Toca «+ Agregar».</p>{/if}
      </div>
      <p class="tool-note">Toca un elemento para editarlo o quitarlo.</p>
    </section>
  {:else}
    <section class="me-sec" aria-label="Tablero de visión">
      <p class="seg-help">Tus metas, cada una con una imagen. Toca una para escribir tu deseo, el resultado, el obstáculo y tu plan.</p>
      <div class="me-board">
        {#each metas as m (m.id)}
          <button class="me-goal" onclick={() => abrirMeta(m)}>
            <span class={'tile ' + tono(m.id)}>{#if urls['m' + m.id]}<img src={urls['m' + m.id]} alt="" />{:else}<Icono nombre={m.icono} />{/if}</span>
            <b>{m.titulo}</b>
          </button>
        {/each}
        <button class="me-goal add-goal" onclick={() => abrirMeta(null)}>+ Agregar meta</button>
      </div>
    </section>
  {/if}
</div>

{#if nav.hojaAbierta('me-agregar')}
  <Hoja titulo="Agregar a tu colección">
    <div class="me-types" role="radiogroup" aria-label="Qué quieres agregar">
      {#each [['frase', 'Frase'], ['imagen', 'Imagen'], ['video', 'Video'], ['cancion', 'Canción']] as [t, n] (t)}
        <button role="radio" class:on={tipo === t} aria-checked={tipo === t} onclick={() => (tipo = t as TipoColeccion)}><Icono nombre={t} />{n}</button>
      {/each}
    </div>
    {#if tipo === 'frase'}
      <div class="man">
        <label for="me-text">Frase</label>
        <textarea id="me-text" rows="3" placeholder="Escribe la frase" bind:value={fTexto}></textarea>
        <label for="me-who">De quién es (opcional)</label>
        <input id="me-who" type="text" placeholder="Ej. de un libro" bind:value={fQuien} />
        <p class="tool-note">Tus frases entran al mensaje del día.</p>
      </div>
    {:else if tipo === 'imagen'}
      <div class="man">
        <label class="ghost me-file" for="me-img"><input type="file" id="me-img" accept="image/*" onchange={(e) => elegirImagen(e, (b, n) => { fImagen = b; fNombre = n; })} />{fImagen ? 'Imagen elegida: ' + fNombre : 'Elegir una imagen de tu teléfono'}</label>
        <label for="me-imgt">Título</label>
        <input id="me-imgt" type="text" placeholder="Ej. Biblioteca" bind:value={fTitulo} />
        <p class="tool-note">Tus imágenes también aparecen en los descansos.</p>
      </div>
    {:else}
      <div class="man">
        <label for="me-url">{tipo === 'cancion' ? 'Link de Apple Music' : 'Link de YouTube'}</label>
        <input id="me-url" type="url" inputmode="url" placeholder="Pega el link aquí" bind:value={fUrl} />
        <label for="me-lt">Título</label>
        <input id="me-lt" type="text" placeholder={tipo === 'cancion' ? 'Ej. Canción para entrenar' : 'Ej. Video para empezar el día'} bind:value={fTitulo} />
      </div>
    {/if}
    <button class="start" onclick={guardarNuevo}>Guardar</button>
    <p class="tool-note">Se guarda solo en tu teléfono.</p>
  </Hoja>
{/if}

{#if nav.hojaAbierta('me-editar') && ed}
  <Hoja titulo={tituloEditar}>
    {#if ed.tipo === 'frase'}
      <div class="man">
        <label for="mi-text">Frase</label><textarea id="mi-text" rows="3" bind:value={eTexto}></textarea>
        <label for="mi-who">De quién es (opcional)</label><input id="mi-who" type="text" bind:value={eQuien} />
      </div>
    {:else}
      <div class="man">
        <label for="mi-t">Título</label><input id="mi-t" type="text" bind:value={eTexto} />
      </div>
      {#if ed.tipo === 'video' || ed.tipo === 'cancion'}
        <div class="man">
          <label for="mi-url">{ed.tipo === 'cancion' ? 'Link de Apple Music' : 'Link de YouTube'}</label><input id="mi-url" type="url" inputmode="url" placeholder="Pega el link aquí" bind:value={eUrl} />
        </div>
      {/if}
    {/if}
    {#if ed.tipo === 'imagen'}
      <label class="ghost me-file" for="mi-img"><input type="file" id="mi-img" accept="image/*" onchange={(e) => elegirImagen(e, (b) => cambiarImagen(b))} />Elegir otra imagen de tu teléfono</label>
    {/if}
    <button class="start" onclick={guardarEdicion}>Guardar</button>
    <button class="link-btn" onclick={quitar}>Quitar de mi colección</button>
  </Hoja>
{/if}

{#if nav.hojaAbierta('me-meta')}
  <Hoja titulo={nueva ? 'Nueva meta' : (meta?.titulo ?? 'Meta')}>
    <span class={'tile me-big ' + (nueva ? tono(metas.length) : tono(meta?.id))}>{#if urlMeta}<img src={urlMeta} alt="" />{:else}<Icono nombre={nueva ? mIcono : (meta?.icono ?? 'vision')} />{/if}</span>
    {#if nueva}
      <div class="mg-pick">
        <span class="sh-lbl">Imagen</span>
        <div class="m-chips mg-icons" role="radiogroup" aria-label="Imagen de la meta">
          {#each ICONOS_META as k (k)}
            <button role="radio" class:on={mIcono === k} aria-checked={mIcono === k} aria-label={'Imagen ' + k} onclick={() => { mIcono = k; mImagen = null; soltarMUrl(); }}><Icono nombre={k} /></button>
          {/each}
        </div>
        <label class="link-btn me-file" for="mg-file"><input type="file" id="mg-file" accept="image/*" onchange={(e) => elegirImagen(e, (b) => imagenDeMeta(b))} />O elige una imagen de tu teléfono</label>
      </div>
    {/if}
    <p class="seg-help">Cuatro pasos cortos: tu deseo, el mejor resultado, lo que te puede frenar y tu plan para eso.</p>
    <div class="man">
      <label for="mg-wish">1. Deseo</label>
      <input id="mg-wish" type="text" placeholder="Lo que quieres lograr" bind:value={mDeseo} oninput={autoMeta} />
      <label for="mg-out">2. Resultado: lo mejor de lograrlo</label>
      <textarea id="mg-out" rows="2" placeholder="Cómo se vería tu vida y cómo te sentirías" bind:value={mRes} oninput={autoMeta}></textarea>
      <label for="mg-obs">3. Obstáculo: lo que más te puede frenar</label>
      <textarea id="mg-obs" rows="2" placeholder="Algo tuyo, por ejemplo el cansancio o las dudas" bind:value={mObs} oninput={autoMeta}></textarea>
      <label for="mg-plan">4. Plan: si pasa eso, ¿qué haces?</label>
      <textarea id="mg-plan" rows="3" placeholder="Ej.: Si llego con poca energía del trabajo, estudio 15 min en vez de 30" bind:value={mPlan} oninput={autoMeta}></textarea>
      {#if !nueva}<p class="tool-note left">Se guarda mientras escribes.</p>{/if}
    </div>
    {#if nueva}
      <button class="start" onclick={guardarNueva}>Guardar meta</button>
    {:else}
      <button class="ghost" onclick={verDestino}>{meta?.destino === 'rutina' ? 'Ver tu rutina ›' : 'Ver en tu planeador ›'}</button>
      <label class="link-btn me-file" for="mg-file2"><input type="file" id="mg-file2" accept="image/*" onchange={(e) => elegirImagen(e, (b) => imagenDeMeta(b))} />Cambiar imagen</label>
      <button class="link-btn" onclick={quitarDeTablero}>Quitar de mi tablero</button>
    {/if}
  </Hoja>
{/if}
