<script lang="ts">
  import type { Alimento, ItemMenu, LugarMenu, PerfilComida, Receta, Tanda } from '../../core/db';
  import Hoja from '../../core/Hoja.svelte';
  import { avisos } from '../../core/aviso.svelte';
  import { nav } from '../../core/nav.svelte';
  import { guardar, prefs } from '../ajustes';
  import { aBase64, AnfitrionIA, estimarComida, estimarDeFoto, pedirIA } from '../ia';
  import { reducirFoto } from '../../core/imagen';
  import type { AlimentoEstimado } from '../ia';
  import { COMIDAS, DIAS_ATRAS, registradoTxt, barra, partes, diaBreve, etiquetaDia, fechaDe, fmtN, fraseDia, kRango, macroLinea, porTxt, porcionDe, r1, recientes, sinRepetir, sumas, type Plato } from './calculos';
  import { agregarAlimentos, alimentosDe, guardarAlimento, leerPerfiles, flexibleDe, leerPrep, listarRecetas, menuDe, quitarAlimento, reponerDia, sembrarRecetas, ultimosRegistrados } from './datos';
  import { filaDeTanda } from './preparacion';
  import { NOMBRE_LUGAR, fechasDeSemana, indexar, llave, nombreDia } from './semana';
  import { eleccion, reiniciarVista, vista } from './estado.svelte';

  // Al volver a Comida, los números que mostraste con "Mostrar" vuelven a taparse.
  reiniciarVista();
  eleccion.actual = null;

  const MAX_ADELANTE = 3;
  const VER_PLAN_ATRAS = 3;
  let off = $state(0);
  let items = $state<Alimento[]>([]);
  let anterior = $state<Alimento[]>([]);
  let perfil = $state<PerfilComida | null>(null);
  let perfiles = $state<Record<'les' | 'jeff', PerfilComida> | null>(null);
  let macros = $state(false);
  const fecha = $derived(fechaDe(off));
  const ver = $derived(!prefs.ocultarComida);

  leerPerfiles().then((p) => { perfiles = p; perfil = p.les; });

  let tandas = $state<Tanda[]>([]);
  let flexHoy = $state(false);
  let plan = $state<ItemMenu[]>([]);
  let recetasPlan = $state<Receta[]>([]);
  let verPasado = $state(false);
  sembrarRecetas().then(listarRecetas).then((r) => { recetasPlan = r; });

  let tanda = 0;
  async function cargar() {
    const mia = ++tanda, f = fecha, previo = fechaDe(off - 1);
    const [hoy, ayer, menu, prep, flex] = await Promise.all([alimentosDe(f), alimentosDe(previo), menuDe([f]), leerPrep(), flexibleDe(fechaDe(0))]);
    if (mia === tanda) { items = hoy; anterior = ayer; plan = menu; tandas = prep; flexHoy = !!flex; }
  }
  $effect(() => { void fecha; void vista.cambio; cargar(); });

  const porComida = $derived([0, 1, 2, 3].map((i) => items.filter((x) => x.comida === i)));
  const total = $derived(sumas(items));
  const comidas = $derived(porComida.filter((l) => l.length).length);

  function ir(paso: number) {
    const n = off + paso;
    if (n > MAX_ADELANTE || n < -DIAS_ATRAS) return;
    off = n;
    verPasado = false;
  }

  // ---------- Lo planeado para ese día (del menú de la semana) ----------
  const COMIDA_DE: Record<LugarMenu, 0 | 1 | 2 | 3> = { d: 0, a: 2, c: 1, p: 2, n: 3 };
  const ORDEN: LugarMenu[] = ['d', 'a', 'c', 'p', 'n'];
  const planIdx = $derived(indexar(plan));
  const filaPrep = $derived(off >= 0 ? filaDeTanda(tandas, fecha, fechaDe(0)) : null);
  const articulo = (l: string) => ({ d: 'el desayuno', c: 'la comida', n: 'la cena' } as Record<string, string>)[l] ?? '';
  const pasado = $derived(off < 0);
  const futuro = $derived(off > 0);
  interface FilaPlan { l: LugarMenu; cabeza: string; titulo: string; subs: string[]; hecho?: boolean; reg?: boolean }
  const filasPlan = $derived.by(() => {
    const filas: FilaPlan[] = [], hechas: string[] = [];
    let alguna = false;
    for (const l of ORDEN) {
      const m = planIdx.get(llave(fecha, l));
      const esCol = l === 'a' || l === 'p';
      if (esCol) {
        if (!m) continue;
        alguna = true;
        if (off === 0 && porComida[2].some((x) => x.n === m.n)) { hechas.push(NOMBRE_LUGAR[l].replace('Colación', 'colación')); continue; }
        const junto = m.col?.junto ?? null;
        filas.push({ l, cabeza: NOMBRE_LUGAR[l], titulo: m.n, subs: junto ? ['Va junto con ' + articulo(junto)] : [], reg: off === 0 && !junto });
        continue;
      }
      if (off === 0 && porComida[COMIDA_DE[l]].length) { hechas.push(NOMBRE_LUGAR[l].toLowerCase()); alguna = true; continue; }
      if (!m) { filas.push({ l, cabeza: NOMBRE_LUGAR[l], titulo: 'Sin plan', subs: [], hecho: true }); continue; }
      alguna = true;
      const r = m.r ? recetasPlan.find((x) => x.id === m.r) : undefined;
      const subs = m.t === 'dos' ? ['Tú: ' + porcionTxt(r, 'les') + ' · Jeff: ' + porcionTxt(r, 'jeff')] : m.t === 'cada' ? ['Jeff: ' + m.nj] : [];
      if (m.nota && m.t !== 'decidir') subs.push(m.nota);
      filas.push({ l, cabeza: NOMBRE_LUGAR[l], titulo: m.t === 'cada' ? m.nl ?? m.n : m.t === 'decidir' ? 'Por decidir' + (m.nota ? ' · ' + m.nota : '') : m.n, subs: m.t === 'decidir' ? [] : subs, reg: off === 0 && m.t !== 'decidir' });
    }
    return { filas, hechas, alguna };
  });
  const porcionTxt = (r: Receta | undefined, w: 'les' | 'jeff') => porTxt(r && perfiles ? porcionDe(r, w, perfiles) : perfiles?.[w].por ?? 1);
  const hechasTxt = $derived.by(() => {
    const L = filasPlan.hechas;
    if (!L.length) return '';
    const t = L.length > 1 ? L.slice(0, -1).join(', ') + ' y ' + L[L.length - 1] : L[0];
    return t.charAt(0).toUpperCase() + t.slice(1);
  });
  const tituloPlan = $derived(off === 0 ? 'Hoy en tu menú' : pasado ? 'Lo que tenías planeado' : off === 1 ? 'Mañana en tu menú' : nombreDia(fecha) + ' en tu menú');

  async function registrarPlan(l: LugarMenu) {
    const m = planIdx.get(llave(fecha, l));
    if (!m) return;
    const rid = m.t === 'cada' ? m.rl : m.r, r = rid ? recetasPlan.find((x) => x.id === rid) : undefined;
    const p: Plato = r ? comoPlato(r) : { n: m.t === 'cada' ? m.nl ?? m.n : m.n, por: '1 porción', k: null, p: 0, c: 0, g: 0 };
    const antes = instantanea(), f = fecha, c = COMIDA_DE[l];
    await agregarAlimentos([{ fecha: f, comida: c, n: p.n, por: p.por, k: p.k, p: p.p, c: p.c, g: p.g, ...(p.receta ? { receta: p.receta } : {}) }]);
    await cargar();
    avisos.deshacer('Agregado a ' + COMIDAS[c], () => restaurar(f, antes));
  }

  // ---------- Agregar ----------
  let cual = $state<0 | 1 | 2 | 3>(3);
  let pestaña = $state<'rec' | 'rcp' | 'man' | 'ia' | 'esc'>('rec');
  let descripcion = $state('');
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
  /** Estimaciones de la IA (texto o foto): se revisa cada alimento antes de agregarlo. */
  function revisarEstimados(fn: 'comida' | 'escaner', titulo: string, envia: string, obtener: (clave: string) => Promise<AlimentoEstimado[]>) {
    const c = cual, f = fecha;
    const fila = (a: AlimentoEstimado) => ({ fecha: f, comida: c, n: a.n, por: a.por + ' · estimado con IA', k: a.k, p: a.p, c: a.c, g: a.g });
    const poner1 = async (a: AlimentoEstimado) => { await agregarAlimentos([fila(a)]); await cargar(); };
    pedirIA({
      fn, titulo, envia,
      manual: { texto: 'Escribirlo yo', hacer: () => (pestaña = 'man') },
      ejecutar: async (clave) => {
        const lista = await obtener(clave);
        return {
          intro: 'Esto entendí. Son estimaciones: cámbialas después si quieres.',
          todos: { act: 'Agregar todo a ' + COMIDAS[c].toLowerCase(), aplicar: async () => { await agregarAlimentos(lista.map(fila)); await cargar(); avisos.mostrar('Agregado a ' + COMIDAS[c]); } },
          items: lista.map((a) => ({ t: a.n, sub: a.por + (ver ? ' · ' + a.k + ' kcal aprox. · P ' + a.p + ' · C ' + a.c + ' · G ' + a.g : ''), act: 'Agregar a ' + COMIDAS[c].toLowerCase(), aplicar: async () => { await poner1(a); avisos.mostrar('Agregado a ' + COMIDAS[c]); } }))
        };
      }
    });
  }
  function describirConIA() {
    const texto = descripcion.trim();
    if (!texto) { document.getElementById('ia-desc')?.focus(); avisos.mostrar('Cuéntame primero qué comiste'); return; }
    revisarEstimados('comida', 'Registrar con IA', 'solo el texto que escribiste sobre lo que comiste', (clave) => estimarComida(clave, texto));
  }

  // ---------- Escáner (IA opcional): la foto no se guarda ----------
  let fotoEscaner = $state<File | null>(null);
  let fotoEscanerUrl = $state('');
  let contexto = $state('');
  function elegirFotoEscaner(e: Event) {
    const input = e.currentTarget as HTMLInputElement;
    const f = input.files?.[0];
    input.value = '';
    if (!f) return;
    if (fotoEscanerUrl) URL.revokeObjectURL(fotoEscanerUrl);
    fotoEscaner = f; fotoEscanerUrl = URL.createObjectURL(f);
  }
  function otraFotoEscaner() { if (fotoEscanerUrl) URL.revokeObjectURL(fotoEscanerUrl); fotoEscaner = null; fotoEscanerUrl = ''; }
  function escanearConIA() {
    const foto = fotoEscaner, ctx = contexto;
    if (!foto) return;
    revisarEstimados('escaner', 'Escáner con IA', 'la foto del plato o la etiqueta y el contexto que escribiste', async (clave) => {
      const b = await reducirFoto(foto, 1280);
      const tipo = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(b.type) ? b.type : 'image/jpeg';
      return estimarDeFoto(clave, { tipo, base64: await aBase64(b) }, ctx);
    });
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
    const c = copiando, fuente = planos(porComida[c]), lista = [...destinos];
    // La hoja se cierra al tocar; el trabajo sigue detrás, para que no parezca trabada.
    nav.cerrar();
    const previos: [string, Alimento[]][] = [];
    for (const d of lista) {
      const f = fechaDe(d), hoy = await alimentosDe(f);
      previos.push([f, hoy]);
      const nuevos = sinRepetir(hoy.filter((x) => x.comida === c), fuente);
      if (nuevos.length) await agregarAlimentos(nuevos.map((x) => ({ fecha: f, comida: c, ...x })));
    }
    const cuantos = lista.length;
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

  {#if off === 0}
    <button class="ghost fd-flexb" onclick={() => nav.abrir('flexible')}>{flexHoy ? 'Hoy es día flexible ✓' : 'Marcar como día flexible'}</button>
    {#if flexHoy}<p class="tool-note left">Un día flexible es parte del plan. Mañana sigues como siempre.</p>{/if}
  {/if}

  {#if off >= -VER_PLAN_ATRAS}
    <section class="pt" aria-labelledby="pt-h">
      <div class="pt-h">
        <h4 id="pt-h">{tituloPlan}</h4>
        {#if pasado}
          <button aria-expanded={verPasado} onclick={() => (verPasado = !verPasado)}>{verPasado ? 'Ocultar' : 'Ver'}</button>
        {:else}
          <button onclick={() => nav.abrir('menu')}>Ver la semana ›</button>
        {/if}
      </div>
      <div class="group" hidden={pasado && !verPasado}>
        {#if hechasTxt}
          <div class="pt-row"><span><small>Registrado</small><b class="pt-done">{hechasTxt}</b></span><span class="pt-ok" aria-hidden="true">✓</span></div>
        {/if}
        {#if !filasPlan.alguna && !filasPlan.filas.some((f) => !f.hecho)}
          <div class="pt-row"><span><b class="pt-done">{pasado ? 'No había nada planeado ese día.' : 'Aún no hay nada planeado.'}</b></span>{#if !pasado}<button class="pt-link" onclick={() => nav.abrir('menu')}>Planear</button>{/if}</div>
        {:else}
          {#each filasPlan.filas as f (f.l)}
            <div class="pt-row">
              <span><small>{f.cabeza}</small><b class:pt-done={f.hecho}>{f.titulo}</b>{#each f.subs as x (x)}<em>{x}</em>{/each}</span>
              {#if f.reg}<button class="pt-btn" aria-label={'Registrar ' + f.cabeza.toLowerCase() + ': ' + f.titulo} onclick={() => registrarPlan(f.l)}>Registrar</button>{/if}
            </div>
          {/each}
        {/if}
        {#if filaPrep}
          <div class="pt-row">
            <span><small>Preparación{filaPrep.hora ? ' · ' + filaPrep.hora : ''}</small><b class:pt-done={filaPrep.lista}>{filaPrep.titulo}</b>{#if filaPrep.mas}<em>{filaPrep.mas}</em>{/if}</span>
            {#if filaPrep.lista}<span class="pt-ok" aria-hidden="true">✓</span>{:else}<button class="pt-link" onclick={() => nav.abrir('prep', { k: fecha > fechasDeSemana(0)[6] ? -1 : 0 })}>Ver</button>{/if}
          </div>
        {/if}
      </div>
    </section>
  {/if}

  {#if !futuro}
  <section class="fd-sum" class:compact={ver} aria-label="Resumen del día">
    {#if ver}
      <div class="kc"><b>{fmtN(Math.round(total.k))}</b><span>kcal aprox. {off ? 'ese día' : 'hoy'}</span></div>
      {#if ref?.k}<div class="kc-ref">Referencia de tu perfil: {kRango(ref.k)}</div>{/if}
      <button class="link-btn fd-mtg" aria-expanded={macros} aria-controls="fd-macros" onclick={() => (macros = !macros)}>{macros ? 'Ocultar macros' : 'Ver macros'}</button>
      <div class="macros" id="fd-macros" hidden={!macros}>
        {#each [['p', '', 'Proteína'], ['c', 'c', 'Carbohidratos'], ['g', 'g', 'Grasa']] as [k, clase, rotulo] (k)}
          {@const v = total[k as 'p' | 'c' | 'g']}
          {@const r = ref?.[k as 'p' | 'c' | 'g'] ?? null}
          {@const b = barra(v, r, partes(total)[k as 'p' | 'c' | 'g'])}
          <div class="mac">
            <div class="mac-top"><span>{rotulo}</span><span>{Math.round(v)} g{r ? ' · referencia ' + r + ' g' : total.k ? ' · ' + Math.round(partes(total)[k as 'p' | 'c' | 'g'] * 100) + ' % de las kcal' : ''}</span></div>
            <div class="bar {clase}"><i style:width={b.w + '%'}></i>{#if b.marca != null}<em style:left={b.marca + '%'}></em>{/if}</div>
          </div>
        {/each}
      </div>
    {:else}
      <div class="sum-soft"><b>{registradoTxt(COMIDAS.filter((_, i) => porComida[i]?.length))}</b><span>Los números están ocultos. Siguen guardados para tus patrones.</span></div>
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
  {/if}

  <section class="tools">
    <h4>Para planear</h4>
    <div class="quick">
      <button onclick={() => nav.abrir('menu')}><svg aria-hidden="true" focusable="false" viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="16" rx="3" /><path d="M3 10h18M8 3v4M16 3v4" /></svg>Menú</button>
      <button onclick={() => nav.abrir('recetas')}><svg aria-hidden="true" focusable="false" viewBox="0 0 24 24"><path d="M2 4h6a4 4 0 0 1 4 4v12a3 3 0 0 0-3-3H2zM22 4h-6a4 4 0 0 0-4 4v12a3 3 0 0 1 3-3h7z" /></svg>Recetario</button>
      <button onclick={() => nav.abrir('perfiles')}><svg aria-hidden="true" focusable="false" viewBox="0 0 24 24"><circle cx="9" cy="8" r="3" /><path d="M3 20a6 6 0 0 1 12 0" /><circle cx="17" cy="9" r="2.5" /><path d="M16 14.1a5 5 0 0 1 5 4.9" /></svg>Perfiles</button>
      <button onclick={() => nav.abrir('tips')}><svg aria-hidden="true" focusable="false" viewBox="0 0 24 24"><path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-3.6 10.8c.7.5 1.1 1.3 1.1 2.2h5c0-.9.4-1.7 1.1-2.2A6 6 0 0 0 12 3z" /></svg>Tips</button>
    </div>
  </section>
  <p class="tool-note">Las referencias de tu perfil las defines tú o con tu nutrióloga. La app no da consejos médicos.</p>
</div>

{#if nav.hojaEnPila('fd-add')}
  <Hoja titulo={'Agregar a ' + COMIDAS[cual]}>
    <div class="seg" role="tablist">
      <button class:on={pestaña === 'rec'} role="tab" aria-selected={pestaña === 'rec'} onclick={() => (pestaña = 'rec')}>Recientes</button>
      <button class:on={pestaña === 'rcp'} role="tab" aria-selected={pestaña === 'rcp'} onclick={() => (pestaña = 'rcp')}>Recetas</button>
      <button class:on={pestaña === 'man'} role="tab" aria-selected={pestaña === 'man'} onclick={() => (pestaña = 'man')}>Escribir</button>
      <button class:on={pestaña === 'ia'} role="tab" aria-selected={pestaña === 'ia'} onclick={() => (pestaña = 'ia')}>Describir</button>
      <button class:on={pestaña === 'esc'} role="tab" aria-selected={pestaña === 'esc'} onclick={() => (pestaña = 'esc')}>Escanear</button>
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
      {:else if pestaña === 'ia'}
        <div class="sh-panel">
          <div class="man">
            <label for="ia-desc">¿Qué comiste?</label>
            <textarea id="ia-desc" rows="3" placeholder="Ej. dos quesadillas de champiñón y un yogur con fruta" bind:value={descripcion}></textarea>
            <p class="tool-note left">La IA (opcional, con tu clave) separa los alimentos y estima porciones y números. Se envía solo lo que escribes aquí. Tú revisas todo antes de agregarlo, y puedes cambiarlo después.</p>
            <button class="start" onclick={describirConIA}>Estimar con IA</button>
          </div>
        </div>
      {:else if pestaña === 'esc'}
        <div class="sh-panel">
          <div class="man">
            {#if !fotoEscaner}
              <div class="to-pick">
                <label><svg aria-hidden="true" focusable="false" viewBox="0 0 24 24"><path d="M4 8h3l2-3h6l2 3h3v11H4z" /><circle cx="12" cy="13" r="3.5" /></svg>Tomar foto<input type="file" accept="image/*" capture="environment" onchange={elegirFotoEscaner} /></label>
                <label><svg aria-hidden="true" focusable="false" viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="16" rx="3" /><circle cx="9" cy="10" r="2" /><path d="M21 16l-5-5-8 8" /></svg>Elegir de la galería<input type="file" accept="image/*" onchange={elegirFotoEscaner} /></label>
              </div>
            {:else}
              <div class="rs-prev"><img src={fotoEscanerUrl} alt="Foto de tu plato o etiqueta" /><button class="link-btn" onclick={otraFotoEscaner}>Tomar otra foto</button></div>
            {/if}
            <label for="esc-ctx">Contexto (opcional)</label>
            <input id="esc-ctx" type="text" placeholder='Ej. "media porción", "sin aderezo"' bind:value={contexto} />
            <p class="tool-note left">Toma la foto de una etiqueta o de un plato. La IA (opcional, con tu clave) estima calorías y macros aproximados. Se envía la foto y el contexto; la foto no se guarda en la app. Tú revisas todo antes de agregarlo.</p>
            <button class="start" disabled={!fotoEscaner} onclick={escanearConIA}>Estimar con IA</button>
          </div>
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
<AnfitrionIA />
