<script lang="ts">
  import type { DiaHogar, TareaHogar } from '../../core/db';
  import Hoja from '../../core/Hoja.svelte';
  import { avisos } from '../../core/aviso.svelte';
  import { iso } from '../../core/fechas';
  import { contarFuncion } from '../../core/uso';
  import { nav } from '../../core/nav.svelte';
  import { agregarTarea, guardarDia, guardarTarea, leerDia, listarTareas, quitarTarea } from './datos';
  import { ENERGIAS, MAXIMO_HOY, TIEMPOS, entendi, haceCuanto, interpretar, mismaZona, minutosMinima, noCaben, ordenar, previsiones, type Capacidad, type Energia, type Frase } from './reglas';

  // Hogar: lo que cabe hoy en tu tiempo y energía. Todo por reglas; nada de lo que no haces es una falla.
  const hoy = iso(new Date());
  let tareas = $state<TareaHogar[]>([]);
  let dia = $state<DiaHogar>({ fecha: hoy, hoy: [], hechas: [], despues: [] });
  let listo = $state(false);
  Promise.all([listarTareas(), leerDia(hoy)]).then(([t, d]) => { tareas = t; dia = d; listo = true; });

  const limpio = <T,>(x: T): T => $state.snapshot(x) as T;
  async function ponerDia(d: DiaHogar) { dia = d; await guardarDia(limpio(d)); }

  const cap = $derived<Capacidad | null>(dia.energia && dia.tiempo ? { energia: dia.energia, tiempo: dia.tiempo } : null);
  const porId = $derived(Object.fromEntries(tareas.map((t) => [t.id, t])) as Record<number, TareaHogar>);
  const elegidas = $derived(dia.hoy.map((id) => porId[id]).filter(Boolean));
  const apartadas = $derived([...dia.hoy, ...dia.hechas, ...dia.despues]);
  const mazo = $derived(cap ? ordenar(tareas, cap, hoy, new Set(apartadas), elegidas) : []);
  const actual = $derived(mazo[0]);
  const siguiente = $derived(mazo[1]);
  const sinCupo = $derived(dia.hoy.length >= MAXIMO_HOY);
  const fuera = $derived(cap ? noCaben(tareas, cap, hoy, new Set(apartadas)) : 0);
  const adelante = $derived(cap ? previsiones(tareas, cap, hoy) : []);
  const juntas = $derived(mismaZona(elegidas));
  const cosas = (n: number) => n + (n === 1 ? ' cosa' : ' cosas');

  // ---------- Capacidad ----------
  function ponerCap(c: { energia?: Energia; tiempo?: number }) { ponerDia({ ...limpio(dia), ...c }); }

  // ---------- Elegir ----------
  function paraHoy(t: TareaHogar) {
    if (sinCupo) { avisos.mostrar('Ya tienes ' + MAXIMO_HOY + ' para hoy. Cuando hagas una, entra otra.'); return; }
    const antes = limpio(dia);
    ponerDia({ ...antes, hoy: [...antes.hoy, t.id!], despues: antes.despues.filter((x) => x !== t.id) });
  }
  function paraDespues(t: TareaHogar) {
    const antes = limpio(dia);
    ponerDia({ ...antes, hoy: antes.hoy.filter((x) => x !== t.id), despues: [...antes.despues.filter((x) => x !== t.id), t.id!] });
    avisos.deshacer('«' + t.n + '» queda para después', () => ponerDia(antes));
  }
  function quitarDeHoy(t: TareaHogar) {
    const antes = limpio(dia);
    ponerDia({ ...antes, hoy: antes.hoy.filter((x) => x !== t.id) });
  }
  async function yaLaHice(t: TareaHogar) {
    const antesT = limpio(t), antesD = limpio(dia);
    const nueva: TareaHogar = { ...antesT, ult: hoy };
    contarFuncion('hogar-hecha');
    tareas = tareas.map((x) => (x.id === t.id ? nueva : x));
    await guardarTarea(nueva);
    await ponerDia({ ...antesD, hoy: antesD.hoy.filter((x) => x !== t.id), despues: antesD.despues.filter((x) => x !== t.id), hechas: [...antesD.hechas.filter((x) => x !== t.id), t.id!] });
    avisos.deshacer('Hecho: ' + t.n, async () => {
      tareas = tareas.map((x) => (x.id === t.id ? antesT : x));
      await guardarTarea(antesT);
      await ponerDia(antesD);
    });
  }
  /** Sin culpa: lo que no hiciste pasa a «después» y lo hecho solo suma. */
  function cerrarElDia() {
    const antes = limpio(dia);
    ponerDia({ ...antes, hoy: [], despues: [...antes.despues, ...antes.hoy] });
    avisos.deshacer(antes.hechas.length ? 'Lo que quedó pasa a después. Hoy hiciste ' + cosas(antes.hechas.length) + '.' : 'Lo que quedó pasa a después.', () => ponerDia(antes));
  }

  // ---------- Deslizar ----------
  let dx = $state(0), dy = $state(0), arrastrando = false, x0 = 0, y0 = 0;
  function abajo(e: PointerEvent) { arrastrando = true; x0 = e.clientX; y0 = e.clientY; (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); }
  function mover(e: PointerEvent) { if (arrastrando) { dx = e.clientX - x0; dy = e.clientY - y0; } }
  function soltar() {
    if (!arrastrando) return;
    arrastrando = false;
    const t = actual?.t, ax = Math.abs(dx), ay = Math.abs(dy);
    if (t && ax > ay && ax > 80) { if (dx > 0) paraHoy(t); else paraDespues(t); }
    else if (t && ay > ax && dy < -80) yaLaHice(t);
    dx = 0; dy = 0;
  }
  const pista = $derived(Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'Hoy' : 'Después') : dy < -40 ? 'Ya la hice' : '');

  // ---------- Una frase ----------
  let frase = $state('');
  let propuesta = $state<Frase | null>(null);
  let noEntendi = $state(false);
  function entender() {
    noEntendi = false;
    const f = interpretar(frase, limpio(tareas));
    if (!f) { propuesta = null; noEntendi = true; return; }
    propuesta = f;
  }
  async function confirmar(t?: TareaHogar) {
    const f = propuesta;
    if (!f) return;
    propuesta = null;
    if (f.tipo === 'capacidad') ponerCap({ energia: f.energia ?? dia.energia, tiempo: f.tiempo ?? dia.tiempo });
    else if (f.tipo === 'agregar') await nueva({ n: f.n, zona: 'Casa', min: f.min ?? 10, e: 1, cada: f.cada ?? 7 });
    else if (t ?? f.candidatas[0]) await yaLaHice((t ?? f.candidatas[0]) as TareaHogar);
    frase = '';
  }
  function corregir() { propuesta = null; document.getElementById('hg-frase')?.focus(); }

  async function nueva(t: Omit<TareaHogar, 'id'>) {
    const id = (await agregarTarea(t)) as number;
    tareas = [...tareas, { ...t, id }];
    avisos.deshacer('Agregué «' + t.n + '»', async () => { await quitarTarea(id); tareas = tareas.filter((x) => x.id !== id); });
  }

  // ---------- Mis tareas ----------
  const zonas = $derived([...new Set(tareas.map((t) => t.zona))].sort());
  let ed = $state<TareaHogar>({ n: '', zona: '', min: 10, e: 1, cada: 7 });
  let edNueva = $state(true);
  function abrirEditar(t?: TareaHogar) {
    edNueva = !t;
    ed = t ? limpio(t) : { n: '', zona: zonas[0] ?? 'Casa', min: 10, e: 1, cada: 7 };
    nav.abrirHoja('hg-edit');
  }
  async function guardarEd() {
    const t = limpio(ed);
    t.n = t.n.trim();
    if (!t.n) { document.getElementById('hg-n')?.focus(); return; }
    t.zona = t.zona.trim() || 'Casa';
    t.min = Math.max(1, Math.round(Number(t.min) || 10));
    t.cada = Math.max(1, Math.round(Number(t.cada) || 7));
    if (t.minima?.trim()) { t.minima = t.minima.trim(); t.minMin = Math.max(1, Math.round(Number(t.minMin) || minutosMinima(t))); }
    else { delete t.minima; delete t.minMin; }
    if (!t.ult) delete t.ult;
    if (edNueva) {
      const id = (await agregarTarea(t)) as number;
      tareas = [...tareas, { ...t, id }];
    } else {
      await guardarTarea(t);
      tareas = tareas.map((x) => (x.id === t.id ? t : x));
    }
    nav.cerrar();
  }
  async function quitarEd() {
    const t = limpio(ed);
    if (t.id == null) return;
    const antesD = limpio(dia);
    await quitarTarea(t.id);
    tareas = tareas.filter((x) => x.id !== t.id);
    dia = { ...antesD, hoy: antesD.hoy.filter((x) => x !== t.id), hechas: antesD.hechas.filter((x) => x !== t.id), despues: antesD.despues.filter((x) => x !== t.id) };
    nav.cerrar();
    avisos.deshacer('Quité «' + t.n + '»', async () => { await guardarTarea(t); tareas = [...tareas, t]; await ponerDia(antesD); });
  }
  const energiaTxt = (e: number) => ['', 'Poca', 'Media', 'Mucha'][e];
</script>

<header class="cur-head">
  <button class="back" aria-label="Volver" onclick={() => nav.cerrar()}>‹ Volver</button>
</header>
<div class="screen">
  <div class="tl-head">
    <h2 tabindex="-1">Hogar</h2>
    <p class="seg-help">Lo que cabe hoy en tu tiempo y tu energía. Lo que no hagas pasa a «después», sin problema.</p>
  </div>

  {#if listo}
    <section class="hg-card" aria-labelledby="hg-ch">
      <h3 id="hg-ch">Mi capacidad de hoy</h3>
      <span class="hg-l" id="hg-le">Energía</span>
      <div class="seg" role="radiogroup" aria-labelledby="hg-le">
        {#each ENERGIAS as [v, n] (v)}<button role="radio" aria-checked={dia.energia === v} class:on={dia.energia === v} onclick={() => ponerCap({ energia: v })}>{n}</button>{/each}
      </div>
      <span class="hg-l" id="hg-lt">Tiempo</span>
      <div class="seg hg-t" role="radiogroup" aria-labelledby="hg-lt">
        {#each TIEMPOS as m (m)}<button role="radio" aria-checked={dia.tiempo === m} class:on={dia.tiempo === m} onclick={() => ponerCap({ tiempo: m })}>{m} min</button>{/each}
      </div>
    </section>

    {#if elegidas.length}
      <section class="hg-card" aria-labelledby="hg-eh">
        <h3 id="hg-eh">{elegidas.length === 1 ? 'Mi cosa de hoy' : 'Mis ' + elegidas.length + ' cosas de hoy'}</h3>
        <ul class="hg-list">
          {#each elegidas as t (t.id)}
            <li>
              <span><b>{t.n}</b><small>{t.zona} · {t.min} min</small></span>
              <button class="hg-b" onclick={() => yaLaHice(t)} aria-label={'Ya hice: ' + t.n}>Ya la hice</button>
              <button class="hg-q" onclick={() => quitarDeHoy(t)} aria-label={'Quitar de hoy: ' + t.n}>Quitar</button>
            </li>
          {/each}
        </ul>
        {#if juntas}<p class="seg-help">{juntas}</p>{/if}
        <button class="ghost" onclick={cerrarElDia}>Cerrar el día</button>
      </section>
    {/if}

    {#if !cap}
      <p class="seg-help hg-vacio">Elige tu energía y tu tiempo, y te muestro lo que cabe hoy.</p>
    {:else if actual}
      <section class="hg-deck" aria-label="Tareas que caben hoy" aria-live="polite">
        {#if siguiente}<div class="hg-atras" aria-hidden="true"></div>{/if}
        <div
          class="hg-carta"
          role="group"
          aria-roledescription="tarjeta"
          style:transform={'translate(' + dx + 'px,' + Math.min(0, dy) + 'px) rotate(' + dx / 25 + 'deg)'}
          onpointerdown={abajo}
          onpointermove={mover}
          onpointerup={soltar}
          onpointercancel={() => { arrastrando = false; dx = 0; dy = 0; }}
        >
          {#if pista}<span class="hg-pista" aria-hidden="true">{pista}</span>{/if}
          <span class="hg-zona">{actual.t.zona}</span>
          <b class="hg-nom">{actual.t.n}</b>
          <p class="hg-meta">Unos {actual.t.min} min · Energía {energiaTxt(actual.t.e).toLowerCase()}</p>
          <p class="hg-hace">{haceCuanto(actual.t, hoy)}</p>
          {#if actual.cabe === 'minima'}<p class="hg-min">Hoy cabe la versión mínima: {actual.t.minima}</p>
          {:else if actual.t.minima}<p class="hg-min">Si hoy no alcanza: {actual.t.minima}</p>{/if}
        </div>
      </section>
      <div class="hg-acc">
        <button class="ghost" onclick={() => paraDespues(actual.t)}>Después</button>
        <button class="ghost" onclick={() => yaLaHice(actual.t)}>Ya la hice</button>
        <button class="start" disabled={sinCupo} onclick={() => paraHoy(actual.t)}>Hoy</button>
      </div>
      <p class="seg-help hg-gest">También puedes deslizar: a la derecha es «Hoy», a la izquierda «Después» y arriba «Ya la hice».{sinCupo ? ' Ya tienes ' + MAXIMO_HOY + ' para hoy.' : ''}</p>
    {:else}
      <p class="seg-help hg-vacio">Por ahora no hay nada que quepa en {cap.tiempo} min con energía {cap.energia}. Está bien: descansar también cuenta.</p>
    {/if}
    {#if cap && fuera && actual}<p class="seg-help">Hay {fuera} {fuera === 1 ? 'tarea' : 'tareas'} que hoy no caben. Aparecen cuando tengas más tiempo o energía.</p>{/if}

    {#if adelante.length}
      <section class="hg-card" aria-labelledby="hg-ah">
        <h3 id="hg-ah">Mirando adelante</h3>
        {#each adelante as a (a)}<p class="hg-adelante">{a}</p>{/each}
      </section>
    {/if}

    {#if dia.hechas.length}<p class="hg-hecho" role="status">Hoy hiciste {cosas(dia.hechas.length)}.</p>{/if}

    <section class="hg-card" aria-labelledby="hg-fh">
      <h3 id="hg-fh">Escríbelo</h3>
      <p class="seg-help">Por ejemplo: «ya aspiré el cuarto», «agrega regar plantas cada 3 días» o «tengo 20 min y poca energía».</p>
      <form class="pf-add" onsubmit={(e) => { e.preventDefault(); entender(); }}>
        <input type="text" id="hg-frase" aria-label="Escribe lo que hiciste o lo que quieres agregar" autocomplete="off" bind:value={frase} />
        <button type="submit">Entender</button>
      </form>
      {#if noEntendi}<p class="seg-help" role="status">No entendí esa frase. Prueba con uno de los ejemplos.</p>{/if}
      {#if propuesta}
        <div class="hg-entendi" role="status">
          <b>Entendí: {entendi(propuesta)}</b>
          {#if propuesta.tipo === 'hecha' && propuesta.candidatas.length > 1}
            <div class="hg-cands">{#each propuesta.candidatas as c (c.id)}<button class="ghost" onclick={() => confirmar(c)}>{c.n}</button>{/each}</div>
          {:else}
            <button class="ghost" onclick={() => confirmar()}>Confirmar</button>
          {/if}
          <button class="ghost" onclick={corregir}>Corregir</button>
        </div>
      {/if}
    </section>

    <button class="add" onclick={() => nav.abrirHoja('hg-lista')}>Mis tareas ({tareas.length})</button>
  {/if}
</div>

{#if nav.hojaAbierta('hg-lista')}
  <Hoja titulo="Mis tareas">
    <ul class="hg-todas">
      {#each [...tareas].sort((a, b) => a.zona.localeCompare(b.zona) || a.n.localeCompare(b.n)) as t (t.id)}
        <li><button onclick={() => abrirEditar(t)} aria-label={'Editar: ' + t.n}><b>{t.n}</b><small>{t.zona} · {t.min} min · cada {t.cada} {t.cada === 1 ? 'día' : 'días'}</small></button></li>
      {/each}
    </ul>
    <button class="add" onclick={() => abrirEditar()}>+ Agregar tarea</button>
  </Hoja>
{/if}

{#if nav.hojaAbierta('hg-edit')}
  <Hoja titulo={edNueva ? 'Agregar tarea' : 'Editar tarea'}>
    <div class="hg-form">
      <label for="hg-n">Nombre</label>
      <input type="text" id="hg-n" autocomplete="off" placeholder="Ej. Regar las plantas" bind:value={ed.n} />
      <label for="hg-z">Zona</label>
      <input type="text" id="hg-z" list="hg-zonas" autocomplete="off" bind:value={ed.zona} />
      <datalist id="hg-zonas">{#each zonas as z (z)}<option value={z}></option>{/each}</datalist>
      <div class="hg-dos">
        <div><label for="hg-m">Minutos</label><input type="number" id="hg-m" inputmode="numeric" min="1" bind:value={ed.min} /></div>
        <div><label for="hg-c">Cada cuántos días</label><input type="number" id="hg-c" inputmode="numeric" min="1" bind:value={ed.cada} /></div>
      </div>
      <span class="hg-l" id="hg-el">Energía que cuesta</span>
      <div class="seg" role="radiogroup" aria-labelledby="hg-el">
        {#each [1, 2, 3] as v (v)}<button role="radio" aria-checked={ed.e === v} class:on={ed.e === v} onclick={() => (ed.e = v as 1 | 2 | 3)}>{energiaTxt(v)}</button>{/each}
      </div>
      <label for="hg-mi">Versión mínima (opcional)</label>
      <input type="text" id="hg-mi" autocomplete="off" placeholder="Ej. Solo el mostrador" bind:value={ed.minima} />
      {#if ed.minima?.trim()}
        <label for="hg-mm">Minutos de la versión mínima</label>
        <input type="number" id="hg-mm" inputmode="numeric" min="1" bind:value={ed.minMin} />
      {/if}
      <label for="hg-u">Última vez (opcional)</label>
      <input type="date" id="hg-u" max={hoy} bind:value={ed.ult} />
      <button class="start" onclick={guardarEd}>Guardar</button>
      {#if !edNueva}<button class="ghost" onclick={quitarEd}>Quitar esta tarea</button>{/if}
    </div>
  </Hoja>
{/if}
