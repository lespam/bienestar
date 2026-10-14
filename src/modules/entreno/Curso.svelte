<script lang="ts">
  import { onMount } from 'svelte';
  import Icono from '../../core/Icono.svelte';
  import { nav } from '../../core/nav.svelte';
  import { avisos } from '../../core/aviso.svelte';
  import { mantenerEncendida } from '../../core/pantalla';
  import { prefs } from '../ajustes';
  import { columnas, conSaltados, llave, pasosDeGrupo, pasoActual, reloj, textoSeries, ordenDeGrupos, armarPlan } from './calculos';
  import { cargarContexto, datosDeEjercicio, type Contexto } from './contexto';
  import { borrarSerie, guardarSerie, guardarSustituto, ponerNota, ponerSaltado, quitarSustituto, saltadosDe, terminarSesion } from './datos';
  import { borrador, limpiarBorrador, llaveBorrador } from './borrador.svelte';
  import { gruposDeRutina, type CampoReg, type Ejercicio, type Grupo, type Letra } from './programa';
  import type { Serie } from '../../core/db';
  import SustitutoHoja from './SustitutoHoja.svelte';

  /** Una sesión que ya terminó y se abre para agregar o corregir series. No se reabre: sigue terminada. */
  const revisar = typeof nav.pantalla?.datos?.revisar === 'number' ? (nav.pantalla.datos.revisar as number) : null;
  let c = $state<Contexto | null>(null);
  let series = $state<Record<string, Serie>>({});
  let saltados = $state<string[]>([]);
  let mostrado = $state(0);
  let ahora = $state(Date.now());
  let nota = $state('');
  let notaEstado = $state('Se guardan solas mientras escribes.');
  let editando = $state<Ejercicio | null>(null);
  let temporizador: ReturnType<typeof setTimeout> | undefined;

  const sesion = $derived(c?.hoy?.sesion);
  const grupos = $derived<Grupo[]>(c && sesion ? ordenDeGrupos(armarPlan(c.grupos, sesion.modo, sesion.primero)) : []);
  /** Lo que ya no hay que hacer: las series guardadas y las de los ejercicios que saltaste. */
  const hechas = $derived(conSaltados(Object.keys(series), grupos, saltados));
  const oculto = $derived(prefs.ocultarEntreno);
  const unidad = $derived(prefs.unidad);

  onMount(() => {
    const suelta = mantenerEncendida();
    const reloj = setInterval(() => { ahora = Date.now(); }, 1000);
    leer();
    return () => { suelta(); clearInterval(reloj); clearTimeout(temporizador); };
  });

  async function leer() {
    let x = await cargarContexto();
    if (revisar != null) {
      const r = x?.todas.find((t) => t.sesion.id === revisar)?.sesion;
      if (!x || !r || r.abierta || !r.rutina) { nav.cerrar(); return; }
      const letra = r.rutina as Letra;
      x = { ...x, hoy: { sesion: r, estado: 'hecha' }, letra, grupos: gruposDeRutina(x.p, letra) };
    } else if (!x?.hoy || x.hoy.estado !== 'abierta') { nav.cerrar(); return; }
    c = x;
    nota = x.hoy!.sesion.nota;
    const propias = x.todas.find((t) => t.sesion.id === x.hoy!.sesion.id)?.series ?? [];
    series = Object.fromEntries(propias.map((s) => [llave(s.clave, s.n), s]));
    saltados = await saltadosDe(x.hoy!.sesion.id!);
    const ord = ordenDeGrupos(armarPlan(x.grupos, x.hoy!.sesion.modo, x.hoy!.sesion.primero));
    const sig = pasoActual(ord, conSaltados(Object.keys(series), ord, saltados));
    mostrado = sig ? sig.g : Math.max(0, ord.length - 1);
  }

  const grupo = $derived<Grupo | undefined>(grupos[mostrado]);
  const pasos = $derived(grupo ? pasosDeGrupo(grupo) : []);
  const indice = $derived(grupo ? pasos.findIndex((p) => !hechas.has(llave(grupo.ejercicios[p.e].clave, p.s))) : -1);
  const completo = $derived(!!grupo && indice < 0);
  /** El paso que sigue al actual, sin contar los de ejercicios saltados. */
  const siguientePaso = $derived(grupo && indice >= 0 ? pasos.slice(indice + 1).find((p) => !hechas.has(llave(grupo.ejercicios[p.e].clave, p.s))) ?? null : null);
  const paso = $derived(indice >= 0 ? pasos[indice] : null);
  const ultimoGrupo = $derived(mostrado >= grupos.length - 1);

  const nombreSust = (e: Ejercicio) => (sesion?.modo === 'casa' && e.gym ? c?.sustitutos[e.clave]?.nombre : undefined);
  const falta = (e: Ejercicio) => sesion?.modo === 'casa' && e.gym && !c?.sustitutos[e.clave];
  const titulo = $derived(!grupo ? '' : grupo.tipo === 'superserie' ? (grupo.etiqueta ?? '').split(' · ')[0] : 'Series normales');
  const ronda = $derived.by(() => {
    if (!grupo) return '';
    if (completo) return grupo.tipo === 'superserie' ? titulo + ' completa' : 'Listo';
    if (grupo.tipo === 'superserie') return `Ronda ${paso!.s + 1} de ${Math.max(...grupo.ejercicios.map((x) => x.series))}`;
    return `${grupo.ejercicios[paso!.e].nombre} · serie ${paso!.s + 1} de ${grupo.ejercicios[paso!.e].series}`;
  });
  const regla = $derived(!grupo ? '' : grupo.tipo === 'superserie'
    ? `Haz 1 serie de ${grupo.ejercicios[0].codigo} e inmediatamente 1 serie de ${grupo.ejercicios[1]?.codigo ?? grupo.ejercicios[0].codigo}. Descansa 30 a 90 segundos. Repite hasta completar las series.`
    : 'Haz todas las series de este ejercicio, una a la vez. Descansa entre series.');

  /** Después: los grupos que faltan, juntando las series normales. */
  const despues = $derived.by(() => {
    const out: { t: string; texto: string }[] = [];
    let sueltos: string[] = [];
    const cierra = () => { if (sueltos.length) { out.push({ t: 'Series normales', texto: sueltos.join(' · ') }); sueltos = []; } };
    for (const g of grupos.slice(mostrado + 1)) {
      if (g.tipo === 'superserie') { cierra(); out.push({ t: (g.etiqueta ?? '').split(' · ')[0], texto: g.ejercicios.map((e) => (e.codigo ? e.codigo + ' ' : '') + e.nombre).join(' · ') }); }
      else sueltos.push(...g.ejercicios.map((e) => e.nombre));
    }
    cierra();
    return out;
  });

  function etiquetaPaso(g: Grupo, p: { e: number; s: number }) {
    const e = g.ejercicios[p.e];
    return (e.codigo || e.nombre) + ' · serie ' + (p.s + 1);
  }

  const boton = $derived.by(() => {
    if (!grupo) return '';
    if (completo) return ultimoGrupo ? 'Terminar sesión' : 'Seguir con ' + (grupos[mostrado + 1].tipo === 'superserie' ? (grupos[mostrado + 1].etiqueta ?? '').split(' · ')[0].toLowerCase().replace(/^./, (x) => x.toUpperCase()) : 'las series normales').replace('Superserie', 'la superserie');
    const siguiente = siguientePaso;
    if (!siguiente) return grupo.tipo === 'superserie' ? 'Guardar y terminar ' + titulo.toLowerCase() : 'Guardar y terminar';
    if (grupo.tipo === 'superserie' && siguiente.e !== paso!.e && siguiente.s === paso!.s) return 'Guardar y pasar a ' + grupo.ejercicios[siguiente.e].codigo;
    return 'Guardar y descansar';
  });

  const previa = (e: Ejercicio) => datosDeEjercicio(c!, e, nombreSust(e));
  const valorPrevio = (e: Ejercicio, n: number, campo: CampoReg) => previa(e).ultima?.series.find((s) => s.n === n)?.v[campo] ?? null;

  function leerCampos(e: Ejercicio, n: number): Serie['v'] {
    const v: Serie['v'] = {};
    for (const { campo } of columnas(e.registro, unidad)) {
      const txt = (borrador.v[llaveBorrador(e.clave, n, campo)] ?? '').trim().replace(',', '.');
      v[campo] = txt !== '' && Number.isFinite(Number(txt)) ? Number(txt) : valorPrevio(e, n, campo);
    }
    return v;
  }

  async function guardar() {
    if (!c || !sesion || !grupo) return;
    if (completo) {
      if (ultimoGrupo) { await terminar(); return; }
      mostrado += 1;
      document.querySelector<HTMLElement>('.view .screen')?.scrollTo({ top: 0 });
      return;
    }
    const p = paso!, e = grupo.ejercicios[p.e];
    if (falta(e)) { editando = e; nav.abrirHoja('sust'); return; }
    // Lo que sigue se calcula antes de guardar, porque al guardar el paso actual avanza.
    const g = grupo, sig = siguientePaso;
    const cierraRonda = !!sig && (g.tipo === 'superserie' ? sig.s !== p.s : true);
    const v = leerCampos(e, p.s), sust = nombreSust(e), k = llave(e.clave, p.s);
    const id = await guardarSerie(sesion.id!, e.clave, p.s, v, sust);
    series[k] = { id, sesion: sesion.id!, clave: e.clave, n: p.s, v, sust, unidad: prefs.unidad, hora: Date.now() };
    limpiarBorrador(e.clave, p.s);
    avisos.deshacer('Serie guardada', async () => {
      await borrarSerie(sesion.id!, e.clave, p.s);
      delete series[k];
      for (const [campo, val] of Object.entries(v)) if (val != null) borrador.v[llaveBorrador(e.clave, p.s, campo)] = String(val);
      if (nav.pantalla?.id === 'descanso') nav.cerrar();
    });
    if (cierraRonda && sig && revisar == null) nav.abrir('descanso', { siguiente: etiquetaPaso(g, sig), automatico: true, sesion: sesion.id, despues: etiquetaPaso(g, p) });
  }

  async function saltar(e: Ejercicio) {
    if (!sesion) return;
    await ponerSaltado(sesion.id!, e.clave, true);
    saltados = [...saltados, e.clave];
    avisos.deshacer('Ejercicio saltado', () => incluir(e));
  }
  async function incluir(e: Ejercicio) {
    if (!sesion) return;
    await ponerSaltado(sesion.id!, e.clave, false);
    saltados = saltados.filter((k) => k !== e.clave);
  }

  async function editarGuardada(e: Ejercicio, n: number) {
    const k = llave(e.clave, n), previaS = series[k];
    if (!previaS || !sesion) return;
    const v = leerCampos(e, n);
    const id = await guardarSerie(sesion.id!, e.clave, n, v, previaS.sust);
    series[k] = { ...previaS, id, v, hora: Date.now() };
    limpiarBorrador(e.clave, n);
  }

  async function terminar() {
    if (!sesion) return;
    clearTimeout(temporizador);
    await ponerNota(sesion.id!, nota);
    if (revisar == null) await terminarSesion(sesion.id!);
    nav.reemplazar('fin', { sesion: sesion.id });
  }

  function escribirNota() {
    notaEstado = 'Guardando…';
    clearTimeout(temporizador);
    temporizador = setTimeout(async () => { if (sesion) { await ponerNota(sesion.id!, nota); notaEstado = 'Guardado.'; } }, 500);
  }

  async function guardarSust(nombre: string, pagina?: string) {
    if (!c || !editando) return;
    const s = { clave: editando.clave, nombre, pagina };
    await guardarSustituto(s);
    c.sustitutos[editando.clave] = s;
    nav.cerrar();
  }
  async function quitarSust() {
    if (!c || !editando) return;
    await quitarSustituto(editando.clave);
    delete c.sustitutos[editando.clave];
    nav.cerrar();
  }

  const dia = $derived(c?.anterior ? c.anterior.replace(/^el /, '').split(' ')[0] : '');
  function dif(e: Ejercicio, n: number, campo: CampoReg): { t: string; sube: boolean } {
    const s = series[llave(e.clave, n)], pv = valorPrevio(e, n, campo);
    const a = s?.v[campo];
    if (oculto || a == null || pv == null) return { t: '', sube: false };
    return a > pv ? { t: `+${Math.round((a - pv) * 10) / 10} vs. ${dia}`, sube: true } : a === pv ? { t: 'igual', sube: false } : { t: '', sube: false };
  }
  const reloj_ = $derived(sesion ? reloj(Math.max(0, Math.floor(((sesion.fin ?? ahora) - sesion.inicio) / 1000))) : '0:00');
</script>

<header class="cur-head">
  <button class="back" onclick={() => nav.cerrar()} aria-label={'Volver a Rutina ' + (c?.letra ?? '')}>‹ Rutina {c?.letra ?? ''}</button>
  <a class="mus-btn" href={prefs.enlaces.am} target="_blank" rel="noopener" aria-label="Mi música de entrenar, en Apple Music"><Icono nombre="musica" />Mi música</a>
  <div class="clock"><span>Tiempo</span><b>{reloj_}</b></div>
</header>

<div class="screen">
  {#if grupo && c}
    {#if revisar != null}<p class="seg-help">Estás editando una sesión que ya terminó. Lo que guardes se suma a esa sesión y su duración no cambia.</p>{/if}
    <div class="ss-head">
      <div>
        <h2 tabindex="-1">{titulo}</h2>
        <p>{ronda}</p>
      </div>
      <div class="dots" aria-hidden="true">{#each pasos.keys() as i (i)}<i class:on={indice < 0 || i < indice} class:cur={i === indice}></i>{/each}</div>
    </div>
    <p class="rule">{regla}</p>

    <div class="cards">
      {#each grupo.ejercicios as e, ei (e.clave)}
        {@const ahoraEj = !completo && paso!.e === ei}
        {@const sust = nombreSust(e)}
        {@const pr = previa(e)}
        {@const saltado = saltados.includes(e.clave)}
        {@const algunaHecha = [...Array(e.series).keys()].some((n) => !!series[llave(e.clave, n)])}
        {@const pendiente = [...Array(e.series).keys()].some((n) => !hechas.has(llave(e.clave, n)))}
        <div class="card" class:now={ahoraEj}>
          <div class="card-top">
            <span class="code">{e.codigo}</span>
            <span class="nm">{sust ?? e.nombre}</span>
            <span class="badge" class:wait={!ahoraEj}>{saltado ? 'Saltado' : ahoraEj ? 'Ahora' : completo || !pendiente ? 'Lista' : 'Sigue'}</span>
          </div>
          <div class="card-sub">
            <span>{e.series} × {e.rango}{sust ? ' · en lugar de ' + e.nombre : ''}</span>
            <button onclick={() => nav.abrir('ficha', { clave: e.clave })}>Ver ficha</button>
          </div>
          {#if saltado && !algunaHecha}
            <div class="rec">Hoy no haces este ejercicio. No pasa nada.</div>
            <button class="ghost" onclick={() => incluir(e)}>Incluirlo de nuevo</button>
          {:else if falta(e)}
            <div class="rec">Elige tu sustituto en casa para {e.nombre}.</div>
            <button class="ghost" onclick={() => { editando = e; nav.abrirHoja('sust'); }}>Elegir sustituto</button>
            <button class="ghost" onclick={() => saltar(e)}>Saltar este ejercicio</button>
          {:else}
            {#if pr.ultima}
              <div class="rec">{dia ? dia[0].toUpperCase() + dia.slice(1) : 'Antes'}: <b>{textoSeries(e.registro, pr.ultima.series, oculto)}</b>{#if pr.record} · Récord <b>{oculto ? pr.record.tapado : pr.record.texto}</b>{/if}</div>
            {/if}
            <table class="sets">
              <thead><tr><th>Serie</th>{#each columnas(e.registro, unidad) as col (col.campo)}<th>{col.texto}</th>{/each}</tr></thead>
              <tbody>
                {#each [...Array(e.series).keys()] as n (n)}
                  {@const k = llave(e.clave, n)}
                  {@const hecha = !!series[k]}
                  {@const esActual = ahoraEj && paso!.s === n}
                  <tr class:done={hecha} class:cur={esActual} class:later={!hecha && !esActual}>
                    <td>{hecha ? '✓ ' : ''}{n + 1}</td>
                    {#each columnas(e.registro, unidad) as col (col.campo)}
                      {@const d = dif(e, n, col.campo)}
                      {@const clave = llaveBorrador(e.clave, n, col.campo)}
                      <td>
                        {#if hecha}
                          <input type="number" inputmode="decimal" aria-label={`Serie ${n + 1} ${col.texto}`} value={series[k].v[col.campo] ?? ''} onchange={(ev) => { borrador.v[clave] = ev.currentTarget.value; editarGuardada(e, n); }} />
                        {:else}
                          <input type="number" inputmode="decimal" aria-label={`Serie ${n + 1} ${col.texto}`} placeholder={oculto ? '' : String(valorPrevio(e, n, col.campo) ?? '')} bind:value={() => borrador.v[clave] ?? '', (x) => (borrador.v[clave] = String(x ?? ''))} />
                        {/if}
                        <span class="diff" class:up={d.sube}>{d.t}</span>
                      </td>
                    {/each}
                  </tr>
                {/each}
              </tbody>
            </table>
            {#if pendiente}<button class="ghost" onclick={() => saltar(e)}>Saltar este ejercicio</button>{/if}
          {/if}
        </div>
      {/each}
    </div>

    {#if despues.length}
      <section class="next">
        <h4>Después</h4>
        <div class="next-list">{#each despues as d (d.t + d.texto)}<div><span>{d.t}</span>{d.texto}</div>{/each}</div>
      </section>
    {/if}

    <section class="notes">
      <label for="notas"><h4>Notas de la sesión</h4></label>
      <textarea id="notas" rows="3" placeholder="Cómo te sentiste, ajustes, lo que quieras recordar" bind:value={nota} oninput={escribirNota}></textarea>
      <p class="saved-note" role="status">{notaEstado}</p>
    </section>
    <button class="ghost" onclick={terminar}>Terminar sesión</button>
    <p class="tool-note">Lo que hagas se guarda y cuenta, aunque no hagas todo. La pantalla se queda encendida durante toda la sesión.</p>
  {/if}
</div>
<div class="cur-foot"><button class="start" onclick={guardar} disabled={!grupo}>{boton || 'Guardar serie'}</button></div>

{#if nav.hojaAbierta('sust') && editando}
  <SustitutoHoja nombreOriginal={editando.nombre} actual={c?.sustitutos[editando.clave]} alGuardar={guardarSust} alQuitar={quitarSust} />
{/if}
