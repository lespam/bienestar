<script lang="ts">
  import type { Alimento, PerfilComida, Receta } from '../../core/db';
  import Hoja from '../../core/Hoja.svelte';
  import { avisos } from '../../core/aviso.svelte';
  import { nav } from '../../core/nav.svelte';
  import { guardar, prefs } from '../ajustes';
  import { COMIDAS, DIAS_ATRAS, barra, diaBreve, etiquetaDia, fechaDe, fmtN, fraseDia, kRango, macroLinea, porTxt, porcionDe, r1, recientes, sinRepetir, sumas, type Plato } from './calculos';
  import { agregarAlimentos, alimentosDe, guardarAlimento, leerPerfiles, listarRecetas, quitarAlimento, reponerDia, sembrarRecetas, ultimosRegistrados } from './datos';
  import { reiniciarVista } from './estado.svelte';

  // Al volver a Comida, los números que mostraste con "Mostrar" vuelven a taparse.
  reiniciarVista();

  const MAX_ADELANTE = 0;
  let off = $state(0);
  let items = $state<Alimento[]>([]);
  let anterior = $state<Alimento[]>([]);
  let perfil = $state<PerfilComida | null>(null);
  let perfiles = $state<Record<'les' | 'jeff', PerfilComida> | null>(null);
  let macros = $state(false);
  const fecha = $derived(fechaDe(off));
  const ver = $derived(!prefs.ocultarComida);

  leerPerfiles().then((p) => { perfiles = p; perfil = p.les; });

  let tanda = 0;
  async function cargar() {
    const mia = ++tanda, f = fecha, previo = fechaDe(off - 1);
    const [hoy, ayer] = await Promise.all([alimentosDe(f), alimentosDe(previo)]);
    if (mia === tanda) { items = hoy; anterior = ayer; }
  }
  $effect(() => { void fecha; cargar(); });

  const porComida = $derived([0, 1, 2, 3].map((i) => items.filter((x) => x.comida === i)));
  const total = $derived(sumas(items));
  const comidas = $derived(porComida.filter((l) => l.length).length);

  function ir(paso: number) {
    const n = off + paso;
    if (n > MAX_ADELANTE || n < -DIAS_ATRAS) return;
    off = n;
  }

  // ---------- Agregar ----------
  let cual = $state<0 | 1 | 2 | 3>(3);
  let pestaña = $state<'rec' | 'rcp' | 'man'>('rec');
  let ultimos = $state<Alimento[]>([]);
  let recetas = $state<Receta[]>([]);
  let manual = $state<Record<'n' | 'por' | 'k' | 'p' | 'c' | 'g', string | number>>({ n: '', por: '', k: '', p: '', c: '', g: '' });

  async function abrirAgregar(c: 0 | 1 | 2 | 3) {
    cual = c; pestaña = 'rec';
    ultimos = await ultimosRegistrados();
    await sembrarRecetas();
    recetas = await listarRecetas();
    nav.abrirHoja('fd-add');
  }
  const lista = $derived(recientes(ultimos));
  const num = (t: string | number) => { const s = String(t ?? '').trim(); return s === '' ? null : Number(s.replace(',', '.')); };

  /** Una receta como alimento: una porción tuya, con los números aproximados de la receta. */
  function comoPlato(r: Receta): Plato {
    const f = perfiles ? porcionDe(r, 'les', perfiles) : 1;
    return { n: r.n, por: porTxt(f), k: r.k == null ? null : Math.round(r.k * f), p: r1((r.p || 0) * f), c: r1((r.c || 0) * f), g: r1((r.g || 0) * f), receta: r.id };
  }
  async function poner(p: Plato) {
    const c = cual;
    await agregarAlimentos([{ fecha, comida: c, n: p.n, por: p.por, k: p.k, p: p.p, c: p.c, g: p.g, ...(p.receta ? { receta: p.receta } : {}) }]);
    nav.cerrar();
    await cargar();
    avisos.mostrar('Agregado a ' + COMIDAS[c]);
  }
  async function agregarManual() {
    const n = String(manual.n).trim();
    if (!n) { document.getElementById('mn-name')?.focus(); avisos.mostrar('Escribe el nombre del alimento'); return; }
    await poner({ n, por: String(manual.por).trim() || '1 porción', k: num(manual.k), p: num(manual.p) || 0, c: num(manual.c) || 0, g: num(manual.g) || 0 });
    manual = { n: '', por: '', k: '', p: '', c: '', g: '' };
  }

  // ---------- Editar o quitar ----------
  let editando = $state<Alimento | null>(null);
  let aDonde = $state<0 | 1 | 2 | 3>(0);
  let campos = $state<Record<'n' | 'por' | 'k' | 'p' | 'c' | 'g', string | number>>({ n: '', por: '', k: '', p: '', c: '', g: '' });

  function abrirEditar(a: Alimento) {
    editando = structuredClone($state.snapshot(a)) as Alimento;
    aDonde = a.comida;
    campos = { n: a.n, por: a.por, k: a.k == null ? '' : Math.round(a.k), p: a.p || '', c: a.c || '', g: a.g || '' };
    nav.abrirHoja('fd-edit');
  }
  const instantanea = () => structuredClone($state.snapshot(items)) as Alimento[];
  async function restaurar(f: string, filas: Alimento[]) { await reponerDia(f, filas); await cargar(); }

  async function guardarCambios() {
    const a = editando, n = String(campos.n).trim();
    if (!a) return;
    if (!n) { document.getElementById('fi-name')?.focus(); avisos.mostrar('Escribe el nombre del alimento'); return; }
    const antes = instantanea(), f = fecha, movido = aDonde !== a.comida;
    await guardarAlimento({ ...a, comida: aDonde, n, por: String(campos.por).trim() || '1 porción', k: ver ? num(campos.k) : a.k, p: ver ? num(campos.p) || 0 : a.p, c: ver ? num(campos.c) || 0 : a.c, g: ver ? num(campos.g) || 0 : a.g });
    nav.cerrar();
    await cargar();
    avisos.deshacer(movido ? 'Movido a ' + COMIDAS[aDonde] : 'Cambios guardados', () => restaurar(f, antes));
  }
  async function quitar() {
    const a = editando;
    if (!a?.id) return;
    const antes = instantanea(), f = fecha;
    await quitarAlimento(a.id);
    nav.cerrar();
    await cargar();
    avisos.deshacer('Quitado: ' + a.n, () => restaurar(f, antes));
  }

  // ---------- Copiar a otros días ----------
  let copiando = $state<0 | 1 | 2 | 3>(0);
  let destinos = $state<number[]>([]);
  let ocupados = $state<number[]>([]);
  const OFFS = $derived(Array.from({ length: 15 }, (_, i) => -i).filter((o) => o !== off));
  const planos = (l: Alimento[]): Plato[] => l.map(({ n, por, k, p, c, g, receta }) => ({ n, por, k, p, c, g, ...(receta ? { receta } : {}) }));

  function abrirCopiar(c: 0 | 1 | 2 | 3) { copiando = c; destinos = []; ocupados = []; nav.abrirHoja('fd-copy'); }
  async function alternarDestino(o: number) {
    destinos = destinos.includes(o) ? destinos.filter((x) => x !== o) : [...destinos, o];
    const ocup: number[] = [];
    for (const d of destinos) if ((await alimentosDe(fechaDe(d))).some((x) => x.comida === copiando)) ocup.push(d);
    ocupados = ocup;
  }
  async function copiar() {
    const c = copiando, fuente = planos(porComida[c]), previos: [string, Alimento[]][] = [];
    for (const d of destinos) {
      const f = fechaDe(d), hoy = await alimentosDe(f);
      previos.push([f, hoy]);
      const nuevos = sinRepetir(hoy.filter((x) => x.comida === c), fuente);
      if (nuevos.length) await agregarAlimentos(nuevos.map((x) => ({ fecha: f, comida: c, ...x })));
    }
    const cuantos = destinos.length;
    nav.cerrar();
    await cargar();
    avisos.deshacer('Copiado a ' + cuantos + (cuantos === 1 ? ' día' : ' días'), async () => { for (const [f, filas] of previos) await reponerDia(f, filas); await cargar(); });
  }
  async function copiarDelAnterior(c: 0 | 1 | 2 | 3) {
    const antes = instantanea(), f = fecha;
    const nuevos = sinRepetir(porComida[c], planos(anterior.filter((x) => x.comida === c)));
    if (nuevos.length) await agregarAlimentos(nuevos.map((x) => ({ fecha: f, comida: c, ...x })));
    await cargar();
    avisos.deshacer('Copiado del día anterior: ' + COMIDAS[c].toLowerCase(), () => restaurar(f, antes));
  }

  function tecla(e: KeyboardEvent, a: Alimento) {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    e.preventDefault();
    abrirEditar(a);
  }
  const ref = $derived(perfil);
</script>

<div class="screen">
  <div class="fd-head">
    <h2 tabindex="-1">Comida</h2>
    <button class="ghost w-btn" aria-pressed={ver} onclick={() => guardar('ocultarComida', !prefs.ocultarComida)}>{ver ? 'Ocultar números' : 'Ver números'}</button>
  </div>
  <div class="fd-date">
    <button class="cal-nav" aria-label="Día anterior" disabled={off <= -DIAS_ATRAS} onclick={() => ir(-1)}>‹</button>
    <b aria-live="polite">{etiquetaDia(off)}</b>
    <button class="cal-nav" aria-label="Día siguiente" disabled={off >= MAX_ADELANTE} onclick={() => ir(1)}>›</button>
  </div>

  <section class="fd-sum" class:compact={ver} aria-label="Resumen del día">
    {#if ver}
      <div class="kc"><b>{fmtN(Math.round(total.k))}</b><span>kcal aprox. {off ? 'ese día' : 'hoy'}</span></div>
      {#if ref?.k}<div class="kc-ref">Referencia de tu perfil: {kRango(ref.k)}</div>{/if}
      <button class="link-btn fd-mtg" aria-expanded={macros} aria-controls="fd-macros" onclick={() => (macros = !macros)}>{macros ? 'Ocultar macros' : 'Ver macros'}</button>
      <div class="macros" id="fd-macros" hidden={!macros}>
        {#each [['p', '', 'Proteína'], ['c', 'c', 'Carbohidratos'], ['g', 'g', 'Grasa']] as [k, clase, rotulo] (k)}
          {@const v = total[k as 'p' | 'c' | 'g']}
          {@const r = ref?.[k as 'p' | 'c' | 'g'] ?? null}
          {@const b = barra(v, r)}
          <div class="mac">
            <div class="mac-top"><span>{rotulo}</span><span>{Math.round(v)} g{r ? ' · referencia ' + r + ' g' : ''}</span></div>
            <div class="bar {clase}"><i style:width={b.w + '%'}></i>{#if b.marca != null}<em style:left={b.marca + '%'}></em>{/if}</div>
          </div>
        {/each}
      </div>
    {:else}
      <div class="sum-soft"><b>{comidas} de 4 comidas registradas</b><span>Los números están ocultos. Siguen guardados para tus patrones.</span></div>
    {/if}
  </section>
  <p class="coach">{fraseDia(off, comidas)}</p>

  <div class="meals" class:hide-nums={!ver}>
    {#each COMIDAS as nombre, mi (nombre)}
      {@const lista = porComida[mi]}
      <div class="meal">
        <div class="meal-h"><b>{nombre}</b><span>{lista.length ? Math.round(sumas(lista).k) + ' kcal aprox.' : ''}</span></div>
        {#each lista as a (a.id)}
          <div class="food" role="button" tabindex="0" aria-label={'Editar o quitar ' + a.n} onclick={() => abrirEditar(a)} onkeydown={(e) => tecla(e, a)}>
            <span class="fn">{a.n}</span><span class="fk">{a.k != null ? Math.round(a.k) : '–'}</span><small>{macroLinea(a)}</small>
          </div>
        {:else}
          <p class="meal-empty">Aún no registras nada aquí.</p>
        {/each}
        <div class="meal-acts">
          <button class="add" onclick={() => abrirAgregar(mi as 0 | 1 | 2 | 3)}>+ Agregar</button>
          {#if lista.length}
            <button class="add" aria-label={'Copiar ' + nombre + ' a otro día'} onclick={() => abrirCopiar(mi as 0 | 1 | 2 | 3)}>Copiar a otro día</button>
          {:else if off > -DIAS_ATRAS && anterior.some((x) => x.comida === mi)}
            <button class="add" aria-label={'Copiar ' + nombre + ' del día anterior'} onclick={() => copiarDelAnterior(mi as 0 | 1 | 2 | 3)}>Copiar del día anterior</button>
          {/if}
        </div>
      </div>
    {/each}
  </div>
  {#if items.length}<p class="tool-note left">Toca un alimento para editarlo o quitarlo.</p>{/if}

  <section class="tools">
    <h4>Para planear</h4>
    <div class="quick q3">
      <button onclick={() => nav.abrir('recetas')}><svg aria-hidden="true" focusable="false" viewBox="0 0 24 24"><path d="M2 4h6a4 4 0 0 1 4 4v12a3 3 0 0 0-3-3H2zM22 4h-6a4 4 0 0 0-4 4v12a3 3 0 0 1 3-3h7z" /></svg>Recetario</button>
      <button onclick={() => nav.abrir('perfiles')}><svg aria-hidden="true" focusable="false" viewBox="0 0 24 24"><circle cx="9" cy="8" r="3" /><path d="M3 20a6 6 0 0 1 12 0" /><circle cx="17" cy="9" r="2.5" /><path d="M16 14.1a5 5 0 0 1 5 4.9" /></svg>Perfiles</button>
    </div>
  </section>
  <p class="tool-note">Las referencias de tu perfil las defines tú o con tu nutrióloga. La app no da consejos médicos.</p>
</div>

{#if nav.hojaAbierta('fd-add')}
  <Hoja titulo={'Agregar a ' + COMIDAS[cual]}>
    <div class="seg" role="tablist">
      <button class:on={pestaña === 'rec'} role="tab" aria-selected={pestaña === 'rec'} onclick={() => (pestaña = 'rec')}>Recientes</button>
      <button class:on={pestaña === 'rcp'} role="tab" aria-selected={pestaña === 'rcp'} onclick={() => (pestaña = 'rcp')}>Recetas</button>
      <button class:on={pestaña === 'man'} role="tab" aria-selected={pestaña === 'man'} onclick={() => (pestaña = 'man')}>Escribir</button>
    </div>
    <div class="hide-nums-scope" class:hide-nums={!ver}>
      {#if pestaña === 'rec'}
        <div class="sh-panel">
          {#each lista as a (a.id)}
            <button class="pick" onclick={() => poner({ n: a.n, por: a.por, k: a.k, p: a.p, c: a.c, g: a.g, ...(a.receta ? { receta: a.receta } : {}) })}>
              <span class="fn">{a.n}</span><small>{a.k != null ? a.k + ' kcal aprox. · ' : ''}{macroLinea(a)}</small><span class="plus">+</span>
            </button>
          {:else}
            <p class="tool-note left">Aquí aparece lo que ya registraste, para repetirlo con un toque.</p>
          {/each}
        </div>
      {:else if pestaña === 'rcp'}
        <div class="sh-panel">
          {#each recetas.slice().sort((a, b) => a.n.localeCompare(b.n, 'es')) as r (r.id)}
            {@const pl = comoPlato(r)}
            <button class="pick" onclick={() => poner(pl)}>
              <span class="fn">{r.n}</span><small>{pl.k != null ? pl.k + ' kcal aprox. · ' : ''}{macroLinea(pl)}</small><span class="plus">+</span>
            </button>
          {:else}
            <p class="tool-note left">Todavía no hay recetas.</p>
          {/each}
          <button class="add" onclick={() => { nav.cerrar(); nav.abrir('recetas'); }}>Abrir recetario</button>
        </div>
      {:else}
        <div class="sh-panel">
          <div class="man">
            <label for="mn-name">Alimento</label><input id="mn-name" type="text" placeholder="Ej. Quesadilla de champiñones" bind:value={manual.n} />
            <label for="mn-por">Porción</label><input id="mn-por" type="text" placeholder="Ej. 2 piezas" bind:value={manual.por} />
            <div class="man4">
              <span><label for="mn-k">kcal</label><input id="mn-k" type="number" inputmode="numeric" bind:value={manual.k} /></span>
              <span><label for="mn-p">Prot g</label><input id="mn-p" type="number" inputmode="decimal" bind:value={manual.p} /></span>
              <span><label for="mn-c">Carb g</label><input id="mn-c" type="number" inputmode="decimal" bind:value={manual.c} /></span>
              <span><label for="mn-g">Grasa g</label><input id="mn-g" type="number" inputmode="decimal" bind:value={manual.g} /></span>
            </div>
            <p class="tool-note left">Puedes dejar los números vacíos y registrar solo lo que comiste.</p>
            <button class="start" onclick={agregarManual}>Agregar</button>
          </div>
        </div>
      {/if}
    </div>
  </Hoja>
{/if}

{#if editando && nav.hojaAbierta('fd-edit')}
  <Hoja titulo="Editar alimento">
    <div class="man">
      <label for="fi-name">Alimento</label><input id="fi-name" type="text" bind:value={campos.n} />
      <label for="fi-por">Porción</label><input id="fi-por" type="text" bind:value={campos.por} />
      <span class="sh-lbl">Va en</span>
      <div class="m-chips" role="radiogroup" aria-label="Va en">
        {#each COMIDAS as nombre, mi (nombre)}<button class:on={aDonde === mi} role="radio" aria-checked={aDonde === mi} onclick={() => (aDonde = mi as 0 | 1 | 2 | 3)}>{nombre}</button>{/each}
      </div>
      {#if ver}
        <div class="fi-nums">
          <div class="man4">
            <span><label for="fi-k">kcal</label><input id="fi-k" type="number" inputmode="numeric" bind:value={campos.k} /></span>
            <span><label for="fi-p">Prot g</label><input id="fi-p" type="number" inputmode="decimal" bind:value={campos.p} /></span>
            <span><label for="fi-c">Carb g</label><input id="fi-c" type="number" inputmode="decimal" bind:value={campos.c} /></span>
            <span><label for="fi-g">Grasa g</label><input id="fi-g" type="number" inputmode="decimal" bind:value={campos.g} /></span>
          </div>
          <p class="tool-note left">Los números son aproximados. Puedes dejarlos vacíos.</p>
        </div>
      {/if}
      <button class="start" onclick={guardarCambios}>Guardar cambios</button>
      <button class="ghost" onclick={quitar}>Quitar de mi registro</button>
    </div>
  </Hoja>
{/if}

{#if nav.hojaAbierta('fd-copy')}
  <Hoja titulo={'Copiar ' + COMIDAS[copiando].toLowerCase() + ' a otro día'}>
    <p class="tool-note left">{porComida[copiando].map((i) => i.n).join(' + ')}</p>
    <span class="sh-lbl">A qué días</span>
    <div class="m-chips" aria-label="Días">
      {#each OFFS as o (o)}<button aria-pressed={destinos.includes(o)} class:on={destinos.includes(o)} onclick={() => alternarDestino(o)}>{diaBreve(o)}</button>{/each}
    </div>
    {#if ocupados.length}
      <p class="tool-note left">Ya hay algo en {COMIDAS[copiando].toLowerCase()} de {ocupados.map((o) => diaBreve(o)).join(', ')}. Se suma, sin repetir lo que sea igual.</p>
    {/if}
    <button class="start" disabled={!destinos.length} onclick={copiar}>{destinos.length ? 'Copiar a ' + destinos.length + (destinos.length === 1 ? ' día' : ' días') : 'Copiar'}</button>
  </Hoja>
{/if}
