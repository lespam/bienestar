<script lang="ts">
  import type { PerfilComida, Receta } from '../../core/db';
  import Hoja from '../../core/Hoja.svelte';
  import { visor } from '../../core/visor.svelte';
  import { avisos } from '../../core/aviso.svelte';
  import { reducirFoto } from '../../core/imagen';
  import { nav } from '../../core/nav.svelte';
  import { alGusto, escalarReceta, factorAncla, pctTxt, etiquetasCalculadas, norm, lineaIng, aplicarCambio, ajustar, alcanzaTxt, fmtQ, cantidadTxt, efectoTxt, notaConflictos, porTxt, porcionDe, r1 } from './calculos';
  import { guardarReceta, leerPerfiles, quitarReceta, verReceta } from './datos';
  import { eleccion, numerosVisibles, vista } from './estado.svelte';
  import { NOMBRE_LUGAR, COMIDAS_MENU, etiquetaFecha, fechasDeSemana, indexar, itemCada, itemDos, llave, lugarDe, nombreDia, numeroDia, LETRA_DIA, platoTxt, rangoSemana } from './semana';
  import { fechaDe } from './calculos';
  import { guardarFijos, itemDeMenu, leerFijos, menuDe, nuevoFijo, ponerEnMenu, quitarDelMenu, semanasDeReceta } from './datos';
  import type { Fijo, SemanasDe } from './fijos';
  import type { ItemMenu, LugarMenu } from '../../core/db';
  import FormReceta from './FormReceta.svelte';
  import { AnfitrionIA, cambiosDeIngredientes, cargarGemini, geminiLista, HojaImagen, iaLista, pedirIA, tipsDeReceta } from '../ia';
  import { nombreImagen, sePuedeGenerar } from './imagen';

  const id = String(nav.pantalla?.datos?.id ?? '');
  let r = $state<Receta | null>(null);
  let perfiles = $state<Record<'les' | 'jeff', PerfilComida> | null>(null);
  let y = $state(1);
  let tipoNota = $state<'tip' | 'nota'>('tip');
  let textoNota = $state('');
  let archivo: HTMLInputElement | undefined = $state();

  // Cuántas semanas aparece en tu menú y en lo que registras, y si es de tus fijos.
  let fijos = $state<Fijo[]>([]);
  let semanas = $state<SemanasDe>({ plan: 0, comido: 0 });

  (async () => {
    perfiles = await leerPerfiles();
    const x = await verReceta(id);
    if (x) { r = x; y = x.y; } else nav.cerrar();
    [fijos, semanas] = await Promise.all([leerFijos(), semanasDeReceta(id, fechaDe(0))]);
  })();

  const esFijo = $derived(fijos.some((f) => f.r === id));
  async function ponerFijos(lista: Fijo[]) { fijos = lista; await guardarFijos($state.snapshot(lista) as Fijo[]); }
  async function alternarFijo() {
    const antes = $state.snapshot(fijos) as Fijo[];
    const quita = antes.some((f) => f.r === id);
    await ponerFijos(quita ? antes.filter((f) => f.r !== id) : [...antes, await nuevoFijo(id, fechaDe(0))]);
    avisos.deshacer(quita ? 'Salió de mis fijos' : 'Quedó en mis fijos', () => ponerFijos(antes));
  }

  const ver = $derived(numerosVisibles());
  const les = $derived(r && perfiles ? porcionDe(r, 'les', perfiles) : 1);
  const jeff = $derived(r && perfiles ? porcionDe(r, 'jeff', perfiles) : 1);
  const nota = $derived(r && perfiles ? notaConflictos(r, perfiles) : '');
  // Cambiar un ingrediente reescala toda la receta (sin guardarla). `ancla` es el factor; el contador de porciones lo quita.
  let ancla = $state<number | null>(null);
  const f = $derived(ancla ?? (r ? y / r.y : 1));
  const yEf = $derived(ancla != null && r ? Math.round(r.y * ancla * 100) / 100 : y);
  let aI = $state(0);
  let aValor = $state('');
  const aNum = $derived(parseFloat(aValor.replace(',', '.')));
  function abrirAncla(i: number) { aI = i; aValor = String(r!.ing[i][0] ?? ''); nav.abrirHoja('rc-ancla'); }
  function aplicarAncla() {
    const fa = factorAncla(r!.ing[aI][0], aNum);
    if (fa == null) { avisos.mostrar('Escribe una cantidad mayor que cero'); return; }
    ancla = Math.abs(fa - 1) < 1e-9 ? null : fa;
    nav.cerrar();
  }
  async function guardarMiVersion() {
    if (ancla == null || !r) return;
    const antes = copia(), x = escalarReceta(copia(), ancla);
    x.orig = r.orig ?? JSON.stringify({ ...$state.snapshot(r), img: undefined, page: undefined, nts: undefined, por: undefined });
    ancla = null;
    await poner(x); y = x.y;
    avisos.deshacer('Guardaste tu versión', async () => { await poner(antes); y = antes.y; });
  }
  let fotoUrl = $state('');
  $effect(() => {
    if (!r?.img) { fotoUrl = ''; return; }
    const u = URL.createObjectURL(r.img);
    fotoUrl = u;
    return () => URL.revokeObjectURL(u);
  });

  /** Guarda la receta tal como quedó y la deja en pantalla. */
  async function poner(x: Receta) {
    r = x;
    await guardarReceta($state.snapshot(x) as Receta);
  }
  let etqNueva = $state('');
  function agregarEtq() {
    const t = etqNueva.trim().toLowerCase();
    if (!t || !r) return;
    const x = copia();
    if (!(x.etq ?? []).some((e) => norm(e) === norm(t)) && !etiquetasCalculadas(x).some((e) => norm(e) === norm(t))) x.etq = [...(x.etq ?? []), t.charAt(0).toUpperCase() + t.slice(1)];
    etqNueva = '';
    poner(x);
  }
  function quitarEtq(e: string) { const x = copia(); x.etq = (x.etq ?? []).filter((y) => y !== e); poner(x); }
  const copia = () => structuredClone($state.snapshot(r!)) as Receta;
  const gr = (v: number | null) => (v == null ? '–' : r1(v) + ' g');

  async function guardada(nueva: Receta) {
    const antes = copia();
    nav.cerrar();
    await poner(nueva);
    y = nueva.y;
    avisos.deshacer('Cambios guardados', async () => { await poner(antes); y = antes.y; });
  }
  async function quitarPorciones() {
    const antes = copia(), x = copia();
    delete x.por;
    await poner(x);
    avisos.deshacer('Volvieron las porciones de sus perfiles', () => poner(antes));
  }
  async function volverOriginal() {
    const antes = copia();
    const orig = JSON.parse(r!.orig!) as Receta;
    orig.img = r!.img; orig.page = r!.page; orig.nts = r!.nts; orig.por = r!.por;
    await poner(orig);
    y = orig.y;
    avisos.deshacer('Volviste a la receta original', async () => { await poner(antes); y = antes.y; });
  }
  async function quitarDelRecetario() {
    const antes = copia();
    await quitarReceta(id);
    nav.cerrar();
    avisos.deshacer('Se quitó «' + antes.n + '»', async () => { await guardarReceta(antes); vista.cambio++; });
  }

  // ---------- Notas, tips y foto ----------
  async function agregarNota() {
    const t = textoNota.trim();
    if (!t) { document.getElementById('rc-nt-t')?.focus(); avisos.mostrar('Escribe algo primero'); return; }
    const antes = copia(), k = tipoNota;
    const x = copia();
    x.nts = [...(x.nts ?? []), { k, t }];
    textoNota = '';
    await poner(x);
    document.getElementById('rc-nt-t')?.focus();
    avisos.deshacer(k === 'tip' ? 'Tip agregado' : 'Nota agregada', () => poner(antes));
  }
  // ---------- Ideas con IA (opcional) ----------
  const ingTxt = () => (r?.ing ?? []).map(lineaIng);
  async function guardarSugerida(k: 'tip' | 'nota', t: string) {
    const antes = copia(), x = copia();
    x.nts = [...(x.nts ?? []), { k, t, ia: true }];
    await poner(x);
    avisos.deshacer(k === 'tip' ? 'Tip agregado' : 'Nota agregada', () => poner(antes));
  }
  function tipsIA() {
    if (!r) return;
    const nombre = r.n, ing = ingTxt();
    pedirIA({
      fn: 'tips', titulo: 'Ayuda con IA', envia: 'el nombre y los ingredientes de la receta',
      ejecutar: async (clave) => ({ intro: 'Tres ideas para preparar «' + nombre + '».', items: (await tipsDeReceta(clave, nombre, ing)).map((t) => ({ t, act: 'Guardar como tip', aplicar: () => guardarSugerida('tip', t) })) })
    });
  }
  function ingredientesIA() {
    if (!r) return;
    const nombre = r.n, ing = ingTxt();
    pedirIA({
      fn: 'ing', titulo: 'Ayuda con IA', envia: 'el nombre y los ingredientes de la receta',
      ejecutar: async (clave) => ({
        intro: 'Cambios posibles en «' + nombre + '».',
        items: (await cambiosDeIngredientes(clave, nombre, ing)).map((c) => ({ t: 'Si no tienes ' + c.ing.toLowerCase() + ': ' + c.alt, sub: 'Revisa cómo cambia el sabor y tus porciones.', act: 'Guardar como nota', aplicar: () => guardarSugerida('nota', 'Cambio posible: ' + c.ing + ' → ' + c.alt) }))
      })
    });
  }
  async function quitarNota(i: number) {
    const antes = copia(), x = copia();
    const [fuera] = x.nts!.splice(i, 1);
    await poner(x);
    avisos.deshacer('Se quitó la ' + (fuera.k === 'tip' ? 'tip' : 'nota'), () => poner(antes));
  }
  async function elegirFoto(e: Event) {
    const input = e.target as HTMLInputElement, archivo = input.files?.[0];
    if (!archivo) return;
    const antes = copia(), x = copia();
    x.img = await reducirFoto(archivo, 800);
    x.img_tipo = undefined;
    input.value = '';
    await poner(x);
    avisos.deshacer('Foto guardada', () => poner(antes));
  }

  const imagenNombre = $derived(r ? nombreImagen(r) : 'Foto del platillo');
  // Generar imagen con Gemini (opcional, con tu propia clave): se revisa en una hoja y solo se guarda si tú lo decides.
  cargarGemini();
  async function guardarGenerada(foto: Blob) {
    const antes = copia(), x = copia();
    x.img = foto;
    x.img_tipo = 'generada';
    await poner(x);
    avisos.deshacer('Ilustración guardada', () => poner(antes));
  }

  // ---------- Agregar al menú, o elegir para un lugar del menú ----------
  const hoyIso = fechaDe(0);
  const dias = fechasDeSemana(0);
  const eligiendo = $derived(eleccion.actual);
  let amDia = $state(hoyIso);
  let amLugar = $state<LugarMenu>('c');
  let amAhora = $state('');
  $effect(() => {
    void amDia; void amLugar;
    itemDeMenu(amDia, amLugar).then((m) => { amAhora = m ? platoTxt(m) : ''; });
  });
  async function principal() {
    if (!r) return;
    if (eligiendo) { await elegirAqui(); return; }
    amLugar = lugarDe(r.cat);
    const ocupados = indexar(await menuDe(dias));
    amDia = dias.find((f) => f >= hoyIso && !ocupados.has(llave(f, amLugar))) ?? hoyIso;
    nav.abrirHoja('rc-am');
  }
  async function guardarEnMenu(item: ItemMenu, mensaje: string) {
    const previo = await itemDeMenu(item.fecha, item.lugar);
    await ponerEnMenu(item);
    avisos.deshacer(mensaje, async () => { if (previo) await ponerEnMenu(previo); else await quitarDelMenu(item.fecha, item.lugar); });
  }
  async function agregarAlMenu() {
    if (!r) return;
    const item = itemDos(amDia, amLugar, r), dia = nombreDia(amDia).toLowerCase();
    nav.cerrar();
    await guardarEnMenu(item, 'Agregado al menú: ' + dia + ', ' + NOMBRE_LUGAR[amLugar].toLowerCase());
  }
  async function elegirAqui() {
    const e = eleccion.actual;
    if (!r || !e) return;
    if (e.modo === 'les') {
      eleccion.actual = { ...e, modo: 'jeff', les: { id: r.id, n: r.n } };
      nav.cerrar();
      avisos.mostrar('Listo tu plato. Ahora elige el de Jeff');
      return;
    }
    const previo = await itemDeMenu(e.fecha, e.lugar);
    const item = e.modo === 'jeff' && e.les ? itemCada(e.fecha, e.lugar, e.les, r) : itemDos(e.fecha, e.lugar, r);
    await ponerEnMenu(item);
    eleccion.actual = null;
    nav.cerrarHasta('menu');
    avisos.deshacer((previo ? 'Cambiado: ' : 'Agregado: ') + NOMBRE_LUGAR[e.lugar].toLowerCase() + ' del ' + nombreDia(e.fecha).toLowerCase(), async () => {
      if (previo) await ponerEnMenu(previo); else await quitarDelMenu(e.fecha, e.lugar);
    });
  }

  // ---------- Ajustar a una referencia ----------
  let aQuien = $state<'les' | 'jeff'>('les');
  let aQue = $state<'k' | 'p'>('k');
  let aRef = $state<string | number>('');
  const aOpc = $derived.by(() => {
    if (!r || !perfiles) return null;
    return ajustar(r, aQue, Number(String(aRef).replace(',', '.')) || 0, aQuien === 'les' ? les : jeff);
  });
  function ponerRef() {
    const p = perfiles?.[aQuien];
    const v = aQue === 'k' ? p?.mk : p?.mp;
    aRef = v == null ? '' : String(v);
  }
  function abrirAjustar() { aQuien = 'les'; aQue = 'k'; ponerRef(); nav.abrirHoja('rc-aj'); }
  const unidadAj = (x: number) => (aQue === 'k' ? 'unas ' + Math.round(x) + ' kcal aprox.' : 'unos ' + Math.round(x) + ' g de proteína');

  async function usarPorcion(fac: number) {
    const antes = copia(), x = copia(), w = aQuien;
    x.por = { ...(x.por ?? {}) };
    if (fac === perfiles![w].por) delete x.por[w]; else x.por[w] = fac;
    if (!Object.keys(x.por).length) delete x.por;
    nav.cerrar();
    await poner(x);
    avisos.deshacer((w === 'les' ? 'Para ti' : 'Para Jeff') + ' en esta receta: ' + porTxt(fac), () => poner(antes));
  }
  async function aplicar(i: number) {
    const antes = copia();
    const x = aplicarCambio(copia(), i);
    nav.cerrar();
    await poner(x);
    avisos.deshacer('Cambio aplicado a la receta', () => poner(antes));
  }
</script>

<header class="cur-head">
  <button class="back" aria-label="Volver" onclick={() => nav.cerrar()}>‹ Volver</button>
  {#if r}<button class="edit" onclick={() => nav.abrirHoja('rc-form')}>Editar</button>{/if}
</header>
<div class="screen">
  {#if r && perfiles}
    <div class="fi-title">
      <span class="fi-code">{r.cat}{r.src ? ' · ' + r.src : ''}</span>
      <h2 tabindex="-1">{r.n}</h2>
      <p>Rinde {r.y}{r.y > 1 ? ' porciones' : ' porción'}{r.t ? ' · ' + r.t : ''}</p>
      {#if r.orig}<span class="tag f rc-ver">Tu versión</span>{/if}
    </div>

    <section class="rc-sec" aria-labelledby="rc-hf">
      <h4 id="rc-hf">En tus semanas</h4>
      <p class="seg-help">{semanas.plan || semanas.comido ? 'En tu menú ' + semanas.plan + ' de las últimas 8 semanas. La registraste en ' + semanas.comido + '.' : 'Todavía no aparece en tu menú ni en lo que registras.'}</p>
      <button class="add" aria-pressed={esFijo} onclick={alternarFijo}>{esFijo ? 'Quitar de mis fijos' : 'Agregar a mis fijos'}</button>
    </section>

    <section class="rc-num" aria-label="Por porción">
      {#if ver}
        <div class="rc-nh"><h4>Por porción</h4><span class="example">aprox.</span></div>
        <div class="rc-n4">
          <div class="stat"><span>kcal</span><b>{r.k == null ? '–' : Math.round(r.k)}</b></div>
          <div class="stat"><span>Prot</span><b>{gr(r.p)}</b></div>
          <div class="stat"><span>Carb</span><b>{gr(r.c)}</b></div>
          <div class="stat"><span>Grasa</span><b>{gr(r.g)}</b></div>
        </div>
      {:else}
        <div class="pf-hid"><span>Calorías y macros ocultos.</span><button class="ghost w-btn" onclick={() => (vista.ver = true)}>Mostrar</button></div>
      {/if}
    </section>

    <section class="rc-sec" aria-labelledby="rc-h1">
      <h4 id="rc-h1">Para los dos</h4>
      <div class="who"><div class="ls"><small>Tú</small><span>{porTxt(les)}</span></div><div class="jf"><small>Jeff</small><span>{porTxt(jeff)}</span></div></div>
      {#if nota}<p class="slot-note">{nota}</p>{/if}
      <p class="seg-help">{r.por ? 'Cambiaste ' + (r.por.les != null && r.por.jeff != null ? 'las porciones' : 'una porción') + ' solo en esta receta.' : 'Salen de sus perfiles.'}{r.u1 ? ' 1 porción = ' + r.u1 + '.' : ''}</p>
      {#if r.por}<button class="in-more" onclick={quitarPorciones}>Volver a las de sus perfiles</button>{:else}<button class="in-more" onclick={() => nav.abrir('perfiles')}>Ver perfiles ›</button>{/if}
    </section>

    <section class="rc-sec" aria-labelledby="rc-h2">
      <h4 id="rc-h2">Ingredientes</h4>
      <div class="rc-yield">
        <span>Porciones</span>
        <div class="stepper">
          <button aria-label="Menos porciones" disabled={y <= 1} onclick={() => { ancla = null; y--; }}>−</button>
          <b aria-live="polite">{y}</b>
          <button aria-label="Más porciones" disabled={y >= 12} onclick={() => { ancla = null; y++; }}>+</button>
        </div>
      </div>
      <p class="rc-fit">{alcanzaTxt(yEf, les, jeff)}</p>
      {#if ancla != null}
        <p class="seg-help" aria-live="polite">Cantidades al {pctTxt(ancla)}. Equivale a {yEf} porciones de las {r.y} de la receta. La receta guardada no cambia.</p>
        <div class="rc-ancla"><button class="ghost" onclick={guardarMiVersion}>Guardar como mi versión</button><button class="link-btn" onclick={() => (ancla = null)}>Quitar el cambio</button></div>
      {:else if y !== r.y}<p class="seg-help">Cantidades para {y}{y > 1 ? ' porciones' : ' porción'}. La receta guardada no cambia.</p>{/if}
      {#if r.ing.length}
        <div class="rc-ing">{#each r.ing as it, i (i)}<div><span>{it[2]}</span>{#if it[0] != null}<button class="rc-q" aria-label={'Cambiar la cantidad de ' + it[2].toLowerCase() + ': ' + cantidadTxt(it, f)} onclick={() => abrirAncla(i)}>{ancla != null && alGusto(it[2]) ? 'al gusto' : cantidadTxt(it, f)}</button>{:else}<span>{cantidadTxt(it, f)}</span>{/if}</div>{/each}</div>
      {:else}<p class="seg-help">Sin ingredientes. Agrégalos con Editar.</p>{/if}
    </section>

    <section class="rc-sec" aria-labelledby="rc-h3">
      <h4 id="rc-h3">Pasos</h4>
      {#if r.steps.length}<ol class="steps">{#each r.steps as x, i (i)}<li><span>{x}</span></li>{/each}</ol>{:else}<p class="seg-help">Sin pasos. Agrégalos con Editar.</p>{/if}
      {#if r.acomp?.length}<p class="seg-help">Acompaña con: {Array.isArray(r.acomp) ? r.acomp.join(' · ') : r.acomp}</p>{/if}
      {#if r.nota}<p class="seg-help">{r.nota}</p>{/if}
    </section>

    <section class="rc-sec" aria-labelledby="rc-h5">
      <h4 id="rc-h5">{imagenNombre}</h4>
      {#if fotoUrl}<button class="link-btn ampliable" aria-label="Ver la imagen en grande" onclick={() => visor.abrir([{ src: fotoUrl, alt: imagenNombre }])}><img class="rc-page" src={fotoUrl} alt={imagenNombre} /></button>{:else}<p class="seg-help">Aún no tiene. Se ve en las tarjetas si activas las fotos.</p>{/if}
      <button class="add" onclick={() => archivo?.click()}>{r.img ? 'Cambiar foto' : '+ Agregar foto'}</button>
      {#if geminiLista() && sePuedeGenerar(r)}<button class="add" onclick={() => nav.abrirHoja('rc-img')}>{r.img ? 'Generar otra imagen' : 'Generar imagen'}</button>{/if}
      <input bind:this={archivo} type="file" accept="image/*" hidden onchange={elegirFoto} aria-label="Elegir la foto del platillo" />
    </section>

    <section class="rc-sec" aria-labelledby="rc-h6">
      <h4 id="rc-h6">Etiquetas</h4>
      <div class="pf-chips">
        {#each etiquetasCalculadas(r) as e (e)}<span class="pf-chip" style="padding-right:14px">{e}</span>{/each}
        {#each r.etq ?? [] as e (e)}<span class="pf-chip">{e}<button aria-label={'Quitar etiqueta ' + e} onclick={() => quitarEtq(e)}>×</button></span>{/each}
      </div>
      <div class="pf-add">
        <input type="text" aria-label="Nueva etiqueta" placeholder="Ej. Para recibir" bind:value={etqNueva} onkeydown={(e) => { if (e.key === 'Enter') { e.preventDefault(); agregarEtq(); } }} />
        <button onclick={agregarEtq}>Agregar</button>
      </div>
    </section>

    <section class="rc-sec" aria-labelledby="rc-h4">
      <h4 id="rc-h4">Notas y tips</h4>
      {#if r.nts?.length}
        <div class="rc-nts">
          {#each r.nts as x, i (i)}
            <div class="rc-nt"><span class="tag {x.k === 'tip' ? 'f' : 's'}">{x.k === 'tip' ? 'Tip' : 'Nota'}</span><p>{x.t}{#if x.ia}<span class="ai-tag">Sugerido por IA</span>{/if}</p><button aria-label={'Quitar esta ' + (x.k === 'tip' ? 'tip' : 'nota')} onclick={() => quitarNota(i)}>×</button></div>
          {/each}
        </div>
      {:else}<p class="seg-help">Aún no tiene. Una nota es algo tuyo (por ejemplo, cómo le quedó a Jeff). Un tip es algo que la mejora.</p>{/if}
      <div class="m-chips" role="radiogroup" aria-label="Qué vas a agregar">
        <button class:on={tipoNota === 'tip'} role="radio" aria-checked={tipoNota === 'tip'} onclick={() => (tipoNota = 'tip')}>Tip</button>
        <button class:on={tipoNota === 'nota'} role="radio" aria-checked={tipoNota === 'nota'} onclick={() => (tipoNota = 'nota')}>Nota</button>
      </div>
      <label class="sr-only" for="rc-nt-t">Escribe una {tipoNota}</label>
      <textarea id="rc-nt-t" rows="2" placeholder={tipoNota === 'tip' ? 'Ej. Deshebra el pollo caliente' : 'Ej. A Jeff le gusta más picante'} bind:value={textoNota}></textarea>
      <button class="add" onclick={agregarNota}>+ Agregar</button>
    </section>

    {#if iaLista('tips') || iaLista('ing')}
      <section class="rc-sec" aria-labelledby="rc-h6">
        <h4 id="rc-h6">Ideas con IA</h4>
        <div class="ai-acts">{#if iaLista('tips')}<button class="ai-btn" onclick={tipsIA}>Tips para prepararla</button>{/if}{#if iaLista('ing')}<button class="ai-btn" onclick={ingredientesIA}>Cambiar un ingrediente</button>{/if}</div>
        <p class="seg-help">Se envía a Anthropic: el nombre y los ingredientes de esta receta.</p>
      </section>
    {/if}

    <button class="pr-btn" onclick={abrirAjustar}>
      <svg aria-hidden="true" focusable="false" viewBox="0 0 24 24"><path d="M4 6h9M17 6h3M4 12h3M11 12h9M4 18h11M19 18h1" /><circle cx="15" cy="6" r="2" /><circle cx="9" cy="12" r="2" /><circle cx="17" cy="18" r="2" /></svg>
      <span><b>Ajustar a una referencia</b><small>Cambia el tamaño de una porción o algunos ingredientes</small></span>
    </button>
    {#if r.orig}<button class="link-btn" onclick={volverOriginal}>Volver a la receta original</button>{/if}
    <button class="link-btn" onclick={quitarDelRecetario}>Quitar del recetario</button>
    <p class="tool-note">Calorías y macros aproximados. Para cambiarlos, toca Editar.</p>
  {/if}
</div>

{#if r && nav.hojaEnPila('rc-form')}<FormReceta receta={r} alGuardar={guardada} />{/if}
<AnfitrionIA />

{#if r && nav.hojaAbierta('rc-aj')}
  <Hoja titulo="Ajustar la receta">
    {#if !ver}
      <div class="pf-hid"><span>Esta herramienta usa calorías y macros, y están ocultos.</span><button class="ghost w-btn" onclick={() => (vista.ver = true)}>Mostrar</button></div>
    {:else}
      <div class="aj-body">
        <p class="seg-help">Elige para quién y qué referencia usar. Tú decides si aplicas algún cambio.</p>
        <span class="sh-lbl">Para</span>
        <div class="seg seg2" role="radiogroup" aria-label="Para quién">
          <button class:on={aQuien === 'les'} role="radio" aria-checked={aQuien === 'les'} onclick={() => { aQuien = 'les'; ponerRef(); }}>Tú</button>
          <button class:on={aQuien === 'jeff'} role="radio" aria-checked={aQuien === 'jeff'} onclick={() => { aQuien = 'jeff'; ponerRef(); }}>Jeff</button>
        </div>
        <span class="sh-lbl">Referencia</span>
        <div class="seg seg2" role="radiogroup" aria-label="Qué referencia">
          <button class:on={aQue === 'k'} role="radio" aria-checked={aQue === 'k'} onclick={() => { aQue = 'k'; ponerRef(); }}>Calorías</button>
          <button class:on={aQue === 'p'} role="radio" aria-checked={aQue === 'p'} onclick={() => { aQue = 'p'; ponerRef(); }}>Proteína</button>
        </div>
        <div class="man">
          <label for="aj-ref">Para una comida</label>
          <div class="aj-in"><input id="aj-ref" type="number" inputmode="numeric" bind:value={aRef} /><span>{aQue === 'k' ? 'kcal aprox.' : 'g de proteína'}</span></div>
          <p class="tool-note left">Sale de {aQuien === 'les' ? 'tu perfil' : 'el perfil de Jeff'}. Si la cambias aquí, el perfil no cambia.</p>
        </div>
        <div class="aj-res" aria-live="polite">
          {#if r[aQue] == null}
            <p class="seg-help">{aQue === 'k' ? 'Esta receta no tiene calorías guardadas. Agrégalas con Editar.' : 'Esta receta no tiene proteína guardada. Agrégala con Editar.'}</p>
          {:else if !aOpc}
            <p class="seg-help">Escribe una referencia para ver opciones.</p>
          {:else if aOpc.cerca}
            <div class="aj-opt"><b>Ya está cerca</b><p>Con {porTxt(aQuien === 'les' ? les : jeff)} {aQuien === 'les' ? 'llegas' : 'Jeff llega'} a {unidadAj(aOpc.ahora)}{aQue === 'k' ? ' ' : '. '}No hace falta cambiar nada.</p></div>
          {:else}
            {#if aOpc.porcion != null}
              <div class="aj-opt">
                <b>Cambiar el tamaño de {aQuien === 'les' ? 'tu' : 'su'} porción</b>
                <p>Con {porTxt(aOpc.porcion)}{aQuien === 'les' ? ' llegas' : ', Jeff llega'} a {unidadAj(aOpc.porcion * (r[aQue] ?? 0))}{aQue === 'k' ? '' : '.'}</p>
                <button class="ghost" onclick={() => usarPorcion(aOpc.porcion!)}>Usar {porTxt(aOpc.porcion)}</button>
              </div>
            {/if}
            <div class="aj-opt">
              <b>{aOpc.porcion != null ? 'O cambiar ingredientes' : 'Cambiar ingredientes'}</b>
              {#each aOpc.cambios as c (c.i)}
                <div class="aj-sw"><span>{c.texto}<small>{efectoTxt(c.efecto, aQue === 'k')} por porción</small></span><button class="pt-btn" onclick={() => aplicar(c.i)}>Aplicar</button></div>
              {:else}
                <p class="seg-help">No hay cambios de ingredientes guardados para esta referencia.</p>
              {/each}
            </div>
          {/if}
        </div>
        <p class="tool-note">Son ideas de cocina, no consejos médicos. Si tienes dudas, consulta a tu nutrióloga.</p>
      </div>
    {/if}
  </Hoja>
{/if}

{#if r}
  <div class="cur-foot"><button class="start" onclick={principal}>{eligiendo ? (eligiendo.modo === 'les' ? 'Elegir para mí' : eligiendo.modo === 'jeff' ? 'Elegir para Jeff' : 'Elegir para los dos') : 'Agregar al menú'}</button></div>
{/if}

{#if r && nav.hojaAbierta('rc-am')}
  <Hoja titulo="Agregar al menú">
    <p class="seg-help">{r.n} · semana del {rangoSemana(dias)}</p>
    <span class="sh-lbl">Día</span>
    <div class="am-days" role="radiogroup" aria-label="Día">
      {#each dias as f, i (f)}
        <button class:on={f === amDia} role="radio" aria-checked={f === amDia} aria-label={etiquetaFecha(f)} disabled={f < hoyIso} onclick={() => (amDia = f)}>{LETRA_DIA[i]}<b>{numeroDia(f)}</b></button>
      {/each}
    </div>
    <span class="sh-lbl">Comida</span>
    <div class="seg" role="radiogroup" aria-label="Comida">
      {#each COMIDAS_MENU as c (c.l)}<button class:on={amLugar === c.l} role="radio" aria-checked={amLugar === c.l} onclick={() => (amLugar = c.l)}>{c.n}</button>{/each}
    </div>
    <p class="am-now" aria-live="polite">{amAhora ? 'Ahí está ' + amAhora + '. Se cambia por esta receta y puedes deshacerlo.' : 'Ese lugar está libre.'} Porciones: tú {fmtQ(les)}, Jeff {fmtQ(jeff)}.</p>
    <button class="start" onclick={agregarAlMenu}>Agregar</button>
  </Hoja>
{/if}

{#if nav.hojaAbierta('rc-ancla') && r}
  <Hoja titulo="Cambiar una cantidad">
    <p class="seg-help">Escribe cuánto tienes de «{r.ing[aI][2].toLowerCase()}» y toda la receta se ajusta. No cambia la receta guardada.</p>
    <label class="pf-lbl" for="rc-anc-v">Cantidad{r.ing[aI][1] ? ' (' + r.ing[aI][1] + ')' : ''}</label>
    <input id="rc-anc-v" type="text" inputmode="decimal" bind:value={aValor} onkeydown={(e) => { if (e.key === 'Enter') { e.preventDefault(); aplicarAncla(); } }} />
    {#if factorAncla(r.ing[aI][0], aNum) != null}<p class="seg-help">Todo quedaría al {pctTxt(factorAncla(r.ing[aI][0], aNum)!)}.</p>{/if}
    <button class="start" onclick={aplicarAncla}>Ajustar la receta</button>
  </Hoja>
{/if}

{#if nav.hojaAbierta('rc-img') && r}
  <HojaImagen nombre={r.n} ingredientes={r.ing.map((it) => it[2])} alGuardar={guardarGenerada} conFoto={() => archivo?.click()} />
{/if}
