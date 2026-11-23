<script lang="ts">
  import { contarSugerencia } from '../../core/uso';
  import type { HistCompra, ItemMenu, PerfilComida, Receta } from '../../core/db';
  import Hoja from '../../core/Hoja.svelte';
  import { AnfitrionIA } from '../ia';
  import ComprasAnteriores from './ComprasAnteriores.svelte';
  import { avisos } from '../../core/aviso.svelte';
  import { nav } from '../../core/nav.svelte';
  import { fechaDe, norm } from './calculos';
  import { RX_PESADO, SECCIONES, armarLista, comprasVacias, conteos, marcada, plantillaMarcada, repartir, seccionDe, sugerencias, textoCompartir, type Extra, type FilaCompra, type Pestana } from './compras';
  import { anotarCompra, guardarCompras, guardarLugares, guardarPrecio, leerPrecios, leerSilenciadasAhorro, silenciarAhorro, leerCompras, leerHay, leerHistorial, leerLugares, leerPerfiles, leerSilenciadas, listarRecetas, menuDe, quitarCompra, sembrarRecetas, silenciarCompra } from './datos';
  import { COLORES_LUGAR, MAX_LUGARES, anotarMovimiento, cortoLugar, idNuevo, lugarDe, lugaresIniciales, nombreLugar, ponerReglaIng, ponerReglaSec, quitarLugar, quitarReglaIng } from './lugares';
  import { entregarIcs } from '../../core/ics';
  import { ideaDeAhorro } from './ahorro';
  import { yaToca } from './frecuencia';
  import { tengo, vigente } from './nevera';
  import type { Hay } from './sugerir';
  import { NOMBRE_LUGAR, etiquetaFecha, fechasDeSemana, llave, platoTxt, rangoSemana, tituloSemana } from './semana';

  let semana = $state((nav.pantalla?.datos as { k?: number } | undefined)?.k ?? 0);
  const dias = $derived(fechasDeSemana(semana));
  const lunes = $derived(dias[0]);

  let items = $state<ItemMenu[]>([]);
  let recetas = $state<Receta[]>([]);
  let estado = $state(comprasVacias());
  let perfiles = $state<Record<'les' | 'jeff', PerfilComida> | undefined>(undefined);
  let listo = $state(false);
  let pestana = $state<Pestana>('enfrente');
  let lugares = $state(lugaresIniciales());
  // Si quitaste el lugar de la pestaña que tenías, vuelve al primero.
  const pest = $derived<Pestana>(pestana === 'todo' || lugarDe(lugares, pestana) ? pestana : lugares.lista[0].id);
  const guardarLug = () => guardarLugares($state.snapshot(lugares));
  // «Con lo que tengo»: lo que ya hay en casa no se pide dos veces (se puede volver a pedir con «Lo necesito»).
  let hayHoy = $state<Hay[]>([]);
  let verTengo = $state(false);

  (async () => {
    await sembrarRecetas();
    let g;
    [items, recetas, estado, perfiles, g, lugares] = await Promise.all([menuDe(dias), listarRecetas(), leerCompras(lunes), leerPerfiles(), leerHay(), leerLugares()]);
    hayHoy = vigente(g, fechaDe(0));
    listo = true;
  })();

  // Comprar lo mínimo: solo lo de las comidas de los próximos días (lo que agregas a mano sale siempre).
  const RANGOS = [['semana', 'Toda la semana'], ['0', 'Hoy'], ['1', 'Hoy y mañana'], ['3', 'Próximos 3 días'], ['elegir', 'Elegir comidas']] as const;
  type Rango = (typeof RANGOS)[number][0];
  let rango = $state<Rango>('semana');
  const hoyIso = fechaDe(0);
  const delRango = $derived(
    rango === 'elegir' ? items.filter((m) => sel.includes(llave(m.fecha, m.lugar)))
      : semana !== 0 || rango === 'semana' ? items
      : items.filter((m) => m.fecha >= hoyIso && m.fecha <= fechaDe(Number(rango)))
  );

  // ---------- Otra semana y «Elegir comidas» ----------
  // Las comidas que sí entran a la lista se guardan con la semana, así que se conservan al cambiar de vista.
  const aporta = (m: ItemMenu) => m.t === 'dos' || m.t === 'cada' || m.t === 'col';
  const entran = $derived(items.filter(aporta));
  const sel = $derived(estado.sel ?? entran.map((m) => llave(m.fecha, m.lugar)));
  const SEMANAS = $derived([...new Set([0, -1, -2, semana])].sort((a, b) => b - a).map((k) => [k, k < -1 ? 'En ' + -k + ' semanas' : tituloSemana(k)] as const));
  async function irASemana(k: number) {
    if (k === semana) return;
    const d = fechasDeSemana(k);
    const [i, e] = await Promise.all([menuDe(d), leerCompras(d[0])]);
    semana = k; items = i; estado = e;
    if (rango !== 'elegir') rango = 'semana';
  }
  function elegirRango(v: Rango) {
    rango = v;
    if (v === 'elegir') nav.abrirHoja('cp-com');
  }
  function alternarComida(k: string) {
    estado.sel = sel.includes(k) ? sel.filter((x) => x !== k) : [...sel, k];
    guardar();
  }
  function alternarDia(f: string, todas: boolean) {
    const del = entran.filter((m) => m.fecha === f).map((m) => llave(m.fecha, m.lugar));
    estado.sel = todas ? [...sel.filter((x) => !del.includes(x)), ...del] : sel.filter((x) => !del.includes(x));
    guardar();
  }
  const lista = $derived(repartir(armarLista(delRango, recetas, perfiles), estado, lugares));
  const yaTengo = $derived(lista.filas.filter((f) => !f.extra && !estado.nec?.[f.n] && tengo(f.n, hayHoy)));
  const filas = $derived(lista.filas.filter((f) => !yaTengo.includes(f)));
  const cuenta = $derived(conteos(filas, estado, lugares));
  // ---------- Filtros de la lista ----------
  let fSec = $state<number | null>(null);
  let fReceta = $state('');
  let fQuien = $state<'' | 'les' | 'jeff'>('');
  let fPronto = $state(false);
  let fPesado = $state(false);
  const hayFiltros = $derived(fSec !== null || !!fReceta || !!fQuien || fPronto || fPesado);
  function pasaFiltros(f: FilaCompra) {
    if (fSec !== null && f.sec !== fSec) return false;
    if (fReceta && !f.para.includes(fReceta)) return false;
    if (fQuien && !f.quien?.includes(fQuien)) return false;
    if (fPronto && f.urg !== 'pronto') return false;
    if (fPesado && !RX_PESADO.test(norm(f.n))) return false;
    return true;
  }
  const recetasDeLaLista = $derived([...new Set(filas.flatMap((f) => f.para))].sort((a, b) => a.localeCompare(b, 'es')));
  const resumenFiltros = $derived([
    fSec !== null ? SECCIONES[fSec] : '', fReceta, fQuien === 'les' ? 'Les' : fQuien === 'jeff' ? 'Jeff' : '', fPronto ? 'Se acaba pronto' : '', fPesado ? 'Pesado' : ''
  ].filter(Boolean).join(' · '));
  function limpiarFiltros() { fSec = null; fReceta = ''; fQuien = ''; fPronto = false; fPesado = false; }

  const visibles = $derived(filas.filter((f) => (pest === 'todo' || f.dest === pest) && pasaFiltros(f)));
  const guardar = () => guardarCompras(lunes, $state.snapshot(estado));

  // ---------- Marcar y mover ----------
  function marcar(f: FilaCompra, v: boolean) {
    if (f.extra) { const e = estado.extras.find((x) => x.n === f.n); if (e) e.chk = v; }
    else estado.chk[f.n] = v;
    guardar();
    // Lo que marcas como comprado alimenta el historial («ya toca»).
    (v ? anotarCompra(f.n, hoyIso, f.dest, f.q) : quitarCompra(f.n, hoyIso)).then(cargarHist);
  }

  function loNecesito(n: string) {
    estado.nec = { ...(estado.nec ?? {}), [n]: true };
    guardar();
    avisos.deshacer(n + ' vuelve a tu lista', () => { estado.nec = Object.fromEntries(Object.entries(estado.nec ?? {}).filter(([k]) => k !== n)); guardar(); });
  }

  // ---------- Ya toca (por frecuencia, sin IA) ----------
  let hist = $state<HistCompra[]>([]);
  let silencio = $state<string[]>([]);
  async function cargarHist() { [hist, silencio] = await Promise.all([leerHistorial(), leerSilenciadas()]); }
  cargarHist();
  const toca = $derived(yaToca(hist, hoyIso, filas.map((f) => f.n), silencio, 3));
  // ---------- Una idea para ahorrar (por reglas, una por visita) ----------
  let precios = $state<Record<string, number>>({});
  let silencioAhorro = $state<string[]>([]);
  Promise.all([leerPrecios(), leerSilenciadasAhorro()]).then(([p, s]) => { precios = p; silencioAhorro = s; });
  // Una idea por visita: si la silencias, no sale otra hasta la próxima vez.
  let ahorroTerminada = $state(false);
  const ahorro = $derived(ahorroTerminada ? null : ideaDeAhorro(hist, hoyIso, filas.map((f) => f.n), silencioAhorro, precios));
  let precioAhorro = $state('');
  async function noMeInteresaAhorro(art: string) { await silenciarAhorro(art); contarSugerencia('ahorro', false); silencioAhorro = [...silencioAhorro, art]; ahorroTerminada = true; }
  async function anotarPrecio(art: string) {
    const v = Number(precioAhorro.replace(',', '.').replace(/[^0-9.]/g, ''));
    if (!precioAhorro.trim() || !Number.isFinite(v) || v <= 0) { avisos.mostrar('Escribe cuánto cuesta una pieza, por ejemplo 48'); document.getElementById('ah-p')?.focus(); return; }
    await guardarPrecio(art, v);
    precios = { ...precios, [art]: v };
    precioAhorro = '';
    contarSugerencia('ahorro', true);
  }
  function agregarToca(n: string) { if (agregar(n)) { contarSugerencia('ya-toca', true); cargarHist(); } }
  async function tocaAlCalendario(t: { n: string; art: string; texto: string }) {
    const r = await entregarIcs('ya-toca-' + t.art.replace(/\s+/g, '-'), [{ id: 'ya-toca-' + t.art.replace(/\s+/g, '-') + '-' + hoyIso, titulo: 'Comprar ' + t.n.toLowerCase(), fecha: fechaDe(1), nota: t.texto }]);
    if (r === 'descargado') avisos.mostrar('Descargué el recordatorio. Ábrelo para ponerlo en tu calendario.');
  }
  async function noMeInteresa(art: string) { await silenciarCompra(art); contarSugerencia('ya-toca', false); await cargarHist(); }
  // ---------- Mover de lugar ----------
  let moviendo = $state<FilaCompra | null>(null);
  let siempre = $state(false);
  function mover(f: FilaCompra) {
    if (lugares.lista.length === 2) { moverA(f, lugares.lista.find((l) => l.id !== f.dest)!.id); return; }
    moviendo = f; siempre = false;
    nav.abrirHoja('cp-mvh');
  }
  function moverA(f: FilaCompra, a: string, dejarlo = false) {
    const antes = estado.dest[f.n];
    const previos = $state.snapshot(lugares);
    estado.dest[f.n] = a;
    guardar();
    const { datos, pregunta } = anotarMovimiento(previos, f.n, a);
    lugares = dejarlo ? ponerReglaIng(datos, f.n, a) : datos;
    guardarLug();
    const corto = cortoLugar(nombreLugar(lugares, a));
    const deshacerMov = () => {
      if (antes) estado.dest[f.n] = antes; else delete estado.dest[f.n];
      guardar();
      lugares = previos;
      guardarLug();
    };
    if (dejarlo) avisos.deshacer(f.n + ' va siempre a ' + corto, deshacerMov);
    else if (pregunta) avisos.deshacer('Pasaste ' + f.n + ' a ' + corto + ' dos veces. ¿Que siempre vaya ahí?', () => { lugares = ponerReglaIng(lugares, f.n, a); guardarLug(); avisos.mostrar(f.n + ' irá siempre a ' + corto); }, 'Sí, siempre');
    else avisos.deshacer(f.n + ' pasó a ' + corto, deshacerMov);
  }
  function elegirLugar(a: string) {
    const f = moviendo;
    if (!f) return;
    nav.cerrar();
    moverA(f, a, siempre);
  }

  // ---------- Mis lugares y reglas de reparto ----------
  let nuevoLugar = $state('');
  function renombrar(id: string, v: string) {
    const l = lugares.lista.find((x) => x.id === id);
    if (!l) return;
    const t = v.trim();
    if (!t) { avisos.mostrar('El lugar necesita un nombre'); lugares = { ...lugares }; return; }
    l.n = t;
    guardarLug();
  }
  function colorear(id: string, c: string) {
    const l = lugares.lista.find((x) => x.id === id);
    if (l) { l.color = c; guardarLug(); }
  }
  function agregarLugar() {
    const t = nuevoLugar.trim();
    if (!t) { avisos.mostrar('Escribe el nombre del lugar'); return; }
    if (lugares.lista.some((l) => norm(l.n) === norm(t))) { avisos.mostrar('Ya tienes ese lugar'); return; }
    if (lugares.lista.length >= MAX_LUGARES) { avisos.mostrar('Son muchos lugares. Quita uno para agregar otro'); return; }
    const previos = $state.snapshot(lugares);
    lugares.lista.push({ id: idNuevo(lugares), n: t, color: COLORES_LUGAR[lugares.lista.length % COLORES_LUGAR.length] });
    nuevoLugar = '';
    guardarLug();
    avisos.deshacer('«' + t + '» es un lugar de compra', () => { lugares = previos; guardarLug(); });
  }
  function borrarLugar(id: string) {
    const l = lugarDe(lugares, id);
    if (!l || lugares.lista.length <= 1) return;
    const previos = $state.snapshot(lugares);
    lugares = quitarLugar(lugares, id);
    guardarLug();
    avisos.deshacer('«' + l.n + '» salió de tus lugares. Lo suyo pasa al reparto de fábrica.', () => { lugares = previos; guardarLug(); });
  }
  function reglaSeccion(sec: number, a: string) { lugares = ponerReglaSec(lugares, sec, a); guardarLug(); }
  function sinRegla(clave: string) { lugares = quitarReglaIng(lugares, clave); guardarLug(); }
  const reglasIng = $derived(Object.entries(lugares.ing).sort(([a], [b]) => a.localeCompare(b, 'es')));

  // ---------- Falta o se acaba ----------
  let nombre = $state('');
  let urg = $state<'falta' | 'pronto'>('falta');
  const sug = $derived(sugerencias(nombre, filas.map((f) => f.n)));
  function agregar(n: string, q = '', sec?: number) {
    n = n.trim();
    if (!n) { avisos.mostrar('Escribe qué falta'); return false; }
    if (filas.some((f) => norm(f.n) === norm(n))) { avisos.mostrar('Ya está en la lista'); return false; }
    const e: Extra = { n: n.charAt(0).toUpperCase() + n.slice(1), q: q.trim(), sec: sec ?? seccionDe(n), urg, chk: false };
    estado.extras.push(e);
    guardar();
    avisos.deshacer('Agregado: ' + n, () => { estado.extras = estado.extras.filter((x) => x.n !== e.n); guardar(); });
    return true;
  }

  // ---------- Agregar algo más ----------
  let aN = $state(''), aQ = $state(''), aSec = $state(SECCIONES.length - 1);
  function abrirAgregar() { aN = ''; aQ = ''; aSec = SECCIONES.length - 1; nav.abrirHoja('cp-add'); }
  function guardarAgregar() {
    const antes = urg;
    urg = 'falta';
    const ok = agregar(aN, aQ, aSec);
    urg = antes;
    if (ok) nav.cerrar();
  }

  // ---------- Compartir ----------
  let cDest = $state<Pestana>('enfrente');
  let cTodo = $state(false);
  const texto = $derived(textoCompartir(filas, estado, cDest, cTodo, lugares));
  function abrirCompartir() { cDest = pest; cTodo = false; nav.abrirHoja('cp-share'); }
  async function compartir() {
    const t = texto;
    if (!t) return;
    try {
      if (navigator.share) { await navigator.share({ text: t }); nav.cerrar(); avisos.mostrar('Lista compartida'); }
      else if (navigator.clipboard) { await navigator.clipboard.writeText(t); nav.cerrar(); avisos.mostrar('Lista copiada. Pégala en WhatsApp o mensajes.'); }
      else { nav.cerrar(); avisos.mostrar('En el teléfono se abre WhatsApp o mensajes'); }
    } catch { /* si cancelas el menú de compartir, no pasa nada */ }
  }

  // ---------- Imprimir ----------
  const esc = (t: string) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  function imprimir(html: string) {
    let area = document.getElementById('print-area');
    if (!area) { area = document.createElement('div'); area.id = 'print-area'; document.body.appendChild(area); }
    area.innerHTML = html;
    try { window.print(); } catch { avisos.mostrar('Para imprimir, comparte la lista y imprímela desde el teléfono'); }
  }
  function imprimirLista() {
    let h = '<h1>Lista de compras</h1>';
    for (const l of lugares.lista) {
      if (pest !== 'todo' && pest !== l.id) continue;
      const cuerpo = SECCIONES.map((s, si) => {
        const its = filas.filter((f) => f.sec === si && (f.dest ?? lugares.lista[0].id) === l.id);
        return its.length ? '<h2>' + esc(s) + '</h2><ul>' + its.map((f) => '<li>☐ ' + esc(f.n) + (f.q ? ' (' + esc(f.q) + ')' : '') + '</li>').join('') + '</ul>' : '';
      }).join('');
      if (cuerpo) h += '<h2 style="font-size:15pt">' + esc(l.n) + '</h2>' + cuerpo;
    }
    imprimir(h);
  }
  function imprimirPlantilla() {
    const { columnas, otros } = plantillaMarcada(estado.extras);
    const cols = columnas.map((c) => '<div><h2>' + esc(c.titulo) + '</h2><ul>' + c.its.map((i) => '<li><span class="pt-n' + (i.y ? ' y' : '') + '">' + (i.y ? 'N' : '') + '</span>' + esc(i.n) + '</li>').join('') + '</ul></div>').join('');
    const ex = otros.length ? '<h2>Otros</h2><ul>' + otros.map((n) => '<li><span class="pt-n y">N</span>' + esc(n) + '</li>').join('') + '</ul>' : '';
    imprimir('<h1>Fresh</h1><div class="pt-cols">' + cols + '</div>' + ex);
  }

  const vacia = $derived(listo && !cuenta.todo);
</script>

<header class="cur-head">
  <button class="back" aria-label="Volver" onclick={() => nav.cerrar()}>‹ Volver</button>
  <span class="rest-next">Menú {rangoSemana(dias)}</span>
</header>
<div class="screen">
  <div class="tl-head">
    <h2 tabindex="-1">Lista de compras</h2>
    <p class="seg-help">Se arma sola con el menú de la semana, para ti y Jeff.</p>
  </div>
  <div class="seg" class:seg-n={lugares.lista.length > 3} id="cp-tabs" role="radiogroup" aria-label="Dónde comprar" style:grid-template-columns={lugares.lista.length > 3 ? undefined : 'repeat(' + (lugares.lista.length + 1) + ', minmax(0, 1fr))'}>
    {#each lugares.lista as l (l.id)}
      <button role="radio" class:on={pest === l.id} aria-checked={pest === l.id} onclick={() => (pestana = l.id)}><i class="cp-dot" style:--c={l.color} aria-hidden="true"></i>{cortoLugar(l.n)} · {cuenta[l.id]}</button>
    {/each}
    <button role="radio" class:on={pest === 'todo'} aria-checked={pest === 'todo'} onclick={() => (pestana = 'todo')}>Todo · {cuenta.todo}</button>
  </div>
  <div class="cp-tools">
    <button class="link-btn" aria-expanded={hayFiltros} onclick={() => nav.abrirHoja('cp-fil')}>{hayFiltros ? 'Filtros: ' + resumenFiltros : 'Filtrar la lista'}</button>
    {#if hayFiltros}<button class="link-btn" onclick={limpiarFiltros}>Quitar filtros</button>{/if}
    <button class="link-btn" onclick={() => nav.abrirHoja('cp-lug')}>Mis lugares y reglas</button>
    <button class="link-btn" onclick={() => nav.abrirHoja('cp-hist')}>Anotar compras de antes</button>
  </div>
  <div class="m-chips" role="radiogroup" aria-label="Qué semana">
    {#each SEMANAS as [k, t] (k)}<button role="radio" class:on={semana === k} aria-checked={semana === k} onclick={() => irASemana(k)}>{t}</button>{/each}
  </div>
  <div class="m-chips" role="radiogroup" aria-label="Para cuándo">
    {#each RANGOS.filter(([v]) => semana === 0 || v === 'semana' || v === 'elegir') as [v, t] (v)}<button role="radio" class:on={rango === v} aria-checked={rango === v} onclick={() => elegirRango(v)}>{t}</button>{/each}
  </div>
  {#if rango === 'elegir'}
    <p class="seg-help">{sel.length ? 'Con ' + sel.length + (sel.length === 1 ? ' comida' : ' comidas') + ' del menú.' : 'No elegiste ninguna comida.'} <button class="link-btn" onclick={() => nav.abrirHoja('cp-com')}>Cambiar</button></p>
  {/if}
  {#if toca.length}
    <section class="cq" aria-label="Ya toca">
      <b>Ya toca</b>
      {#each toca as t (t.art)}
        <div class="yt-row">
          <p>{t.texto}</p>
          <div class="yt-b"><button class="ghost" aria-label={'Agregar ' + t.n + ' a la lista'} onclick={() => agregarToca(t.n)}>Agregar a la lista</button><button class="link-btn" aria-label={'Recordarme ' + t.n + ' en el calendario'} onclick={() => tocaAlCalendario(t)}>Al calendario</button><button class="link-btn" aria-label={'No me interesa: ' + t.n} onclick={() => noMeInteresa(t.art)}>No me interesa</button></div>
        </div>
      {/each}
    </section>
  {/if}
  {#if ahorro}
    <section class="cq" aria-label="Una idea para ahorrar">
      <b>Una idea para ahorrar</b>
      <p class="seg-help">{ahorro.texto}</p>
      {#if !ahorro.precio}
        <div class="cq-row">
          <input id="ah-p" type="text" inputmode="decimal" aria-label={'Cuánto cuesta ' + ahorro.n.toLowerCase() + ' (una pieza)'} placeholder="Precio de una pieza, ej. 48" autocomplete="off" bind:value={precioAhorro} onkeydown={(e) => { if (e.key === 'Enter') { e.preventDefault(); anotarPrecio(ahorro.art); } }} />
          <button class="ghost" onclick={() => anotarPrecio(ahorro.art)}>Anotar precio</button>
        </div>
      {/if}
      <div class="yt-b"><button class="link-btn" aria-label={'No me interesa: ahorrar en ' + ahorro.n} onclick={() => noMeInteresaAhorro(ahorro.art)}>No me interesa</button></div>
    </section>
  {/if}
  {#if yaTengo.length}
    <section class="cq" aria-label="Ya tienes en casa">
      <button class="link-btn" aria-expanded={verTengo} aria-controls="cp-tengo" onclick={() => (verTengo = !verTengo)}>Ya tienes en casa ({yaTengo.length}) {verTengo ? '▴' : '▾'}</button>
      <div id="cp-tengo" hidden={!verTengo}>
        {#each yaTengo as f (f.n)}
          <div class="yt-row"><p>{f.n}{f.q ? ' · ' + f.q : ''}</p><button class="link-btn" aria-label={'Lo necesito: ' + f.n} onclick={() => loNecesito(f.n)}>Lo necesito</button></div>
        {/each}
        <p class="seg-help">Lo tomé de «Con lo que tengo». Si necesitas comprar más, toca «Lo necesito».</p>
      </div>
    </section>
  {/if}
  <section class="cq" aria-label="Falta o se acaba">
    <label for="cq-n"><b>Falta o se acaba</b></label>
    <div class="cq-row">
      <input id="cq-n" type="text" placeholder="Ej. leche, Treats" autocomplete="off" bind:value={nombre} onkeydown={(e) => { if (e.key === 'Enter') { e.preventDefault(); if (agregar(nombre)) nombre = ''; } }} />
      <button class="start" onclick={() => { if (agregar(nombre)) nombre = ''; }}>Agregar</button>
    </div>
    <div class="m-chips" role="radiogroup" aria-label="Qué tan pronto">
      <button role="radio" class:on={urg === 'falta'} aria-checked={urg === 'falta'} onclick={() => (urg = 'falta')}>Ya falta</button>
      <button role="radio" class:on={urg === 'pronto'} aria-checked={urg === 'pronto'} onclick={() => (urg = 'pronto')}>Se acaba pronto</button>
    </div>
    {#if sug.length}
      <div class="m-chips" aria-label="Sugerencias de tu plantilla">
        {#each sug as s (s)}<button onclick={() => { if (agregar(s)) nombre = ''; }}>{s}</button>{/each}
      </div>
    {/if}
    {#if lista.pasadas.length}<p class="tool-note left">Jeff carga poco: pasé {lista.pasadas.join(', ')} a {cortoLugar(nombreLugar(lugares, 'walmart'))}. Puedes cambiarlo.</p>{/if}
  </section>
  <div class="cp-top">
    <div class="wu-bar"><i style="width:{cuenta.todo ? (cuenta.hechas / cuenta.todo) * 100 : 0}%"></i></div>
    <small class="seg-help" aria-live="polite">{!cuenta.todo ? 'Tu lista está vacía' : cuenta.hechas ? 'Llevas ' + cuenta.hechas + ' de ' + cuenta.todo : cuenta.todo + ' cosas para esta semana'}</small>
  </div>
  <div class="tool" id="cp-list">
    {#if !visibles.length}
      <p class="tool-note">{vacia ? 'Aún no hay comidas en el menú. Cuando elijas recetas, aquí aparece lo que necesitas comprar.' : listo ? (hayFiltros ? 'Nada de la lista cumple esos filtros.' : pest === 'todo' ? 'No hay nada por ahora.' : 'No hay nada para ' + cortoLugar(nombreLugar(lugares, pest)) + ' por ahora.') : 'Armando tu lista…'}</p>
    {/if}
    {#each SECCIONES as sec, si (sec)}
      {@const rows = visibles.filter((f) => f.sec === si)}
      {#if rows.length}
        <section class="cp-sec">
          <h3>{sec}</h3>
          {#each rows as f (f.n + '|' + (f.extra ? 'x' : 'm'))}
            {@const otra = lugares.lista.length === 2 ? cortoLugar(lugares.lista.find((l) => l.id !== f.dest)!.n) : 'otro lugar'}
            {@const hecho = marcada(estado, f)}
            <div class="cp-row">
              <label class="wu-it" class:done={hecho}>
                <input type="checkbox" checked={hecho} onchange={(e) => marcar(f, e.currentTarget.checked)} />
                <span><b>{f.n}</b><small>{pest === 'todo' ? cortoLugar(nombreLugar(lugares, f.dest)) + ' · ' : ''}{f.extra ? f.why : 'Para: ' + f.para.join(', ') + (f.crudo ? ' · en crudo' : '')}</small></span>
                <em>{f.q}</em>
              </label>
              <button class="cp-mv" aria-label={lugares.lista.length === 2 ? 'Pasar ' + f.n + ' a ' + otra : 'Cambiar de lugar: ' + f.n} onclick={() => mover(f)}>Mover</button>
            </div>
          {/each}
        </section>
      {/if}
    {/each}
  </div>
  <button class="ghost" onclick={abrirAgregar}>+ Agregar algo más</button>
  <button class="start" onclick={abrirCompartir}>Compartir con Jeff</button>
  <div class="cp-prt"><button class="ghost" onclick={imprimirLista}>Imprimir lista</button><button class="ghost" onclick={imprimirPlantilla}>Imprimir plantilla</button></div>
  <p class="tool-note">Si cambias el menú, la lista se actualiza. Lo que ya tienes en casa lo puedes marcar o quitar.</p>
</div>

{#if nav.hojaAbierta('cp-add')}
  <Hoja titulo="Agregar a la lista">
    <div class="man">
      <label for="cpa-n">Qué falta</label><input id="cpa-n" type="text" placeholder="Ej. Café" bind:value={aN} />
      <label for="cpa-q">Cantidad (opcional)</label><input id="cpa-q" type="text" placeholder="Ej. 1 paquete" bind:value={aQ} />
    </div>
    <span class="sh-lbl">Sección</span>
    <div class="m-chips" role="radiogroup" aria-label="Sección">
      {#each SECCIONES as s, i (s)}<button role="radio" class:on={aSec === i} aria-checked={aSec === i} onclick={() => (aSec = i)}>{s}</button>{/each}
    </div>
    <button class="start" onclick={guardarAgregar}>Agregar</button>
  </Hoja>
{/if}

{#if nav.hojaAbierta('cp-share')}
  <Hoja titulo="Compartir con Jeff">
    <span class="sh-lbl">Qué lista</span>
    <div class="m-chips" role="radiogroup" aria-label="Qué lista">
      {#each lugares.lista as l (l.id)}<button role="radio" class:on={cDest === l.id} aria-checked={cDest === l.id} onclick={() => (cDest = l.id)}>{cortoLugar(l.n)}</button>{/each}
      <button role="radio" class:on={cDest === 'todo'} aria-checked={cDest === 'todo'} onclick={() => (cDest = 'todo')}>{lugares.lista.length === 2 ? 'Las dos' : 'Todas'}</button>
    </div>
    <div class="seg seg2" role="radiogroup" aria-label="Qué compartir">
      <button role="radio" class:on={!cTodo} aria-checked={!cTodo} onclick={() => (cTodo = false)}>Solo lo que falta</button>
      <button role="radio" class:on={cTodo} aria-checked={cTodo} onclick={() => (cTodo = true)}>Toda la lista</button>
    </div>
    <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
    <pre class="cps-prev" tabindex="0" aria-label="Texto que se va a compartir">{texto || 'Ya tienes todo. No falta nada.'}</pre>
    <p class="tool-note left">Se abre WhatsApp o mensajes con este texto. Tú eliges a quién enviarlo.</p>
    <button class="start" disabled={!texto} onclick={compartir}>Compartir</button>
  </Hoja>
{/if}

{#if nav.hojaAbierta('cp-com')}
  <Hoja titulo="Elegir comidas">
    <p class="seg-help">Marca las comidas del menú para las que quieres comprar. Lo que marques se queda al cambiar de vista.</p>
    {#each dias as f (f)}
      {@const delDia = entran.filter((m) => m.fecha === f)}
      {#if delDia.length}
        <section class="cp-dia" aria-label={etiquetaFecha(f)}>
          <div class="cp-dh">
            <b>{etiquetaFecha(f)}</b>
            <button class="link-btn" onclick={() => alternarDia(f, !delDia.every((m) => sel.includes(llave(m.fecha, m.lugar))))}>{delDia.every((m) => sel.includes(llave(m.fecha, m.lugar))) ? 'Quitar el día' : 'Todo el día'}</button>
          </div>
          {#each delDia as m (m.lugar)}
            <label class="cp-chk"><input type="checkbox" checked={sel.includes(llave(m.fecha, m.lugar))} onchange={() => alternarComida(llave(m.fecha, m.lugar))} /> <span>{NOMBRE_LUGAR[m.lugar]}: {platoTxt(m)}</span></label>
          {/each}
        </section>
      {/if}
    {:else}
      <p class="tool-note">Esta semana aún no tiene comidas que lleven compras.</p>
    {/each}
    <button class="start" onclick={() => nav.cerrar()}>Ver la lista</button>
  </Hoja>
{/if}

{#if nav.hojaAbierta('cp-mvh') && moviendo}
  <Hoja titulo={'¿A dónde va ' + moviendo.n + '?'}>
    <div class="m-chips" role="radiogroup" aria-label="Lugar de compra">
      {#each lugares.lista as l (l.id)}
        <button role="radio" class:on={moviendo.dest === l.id} aria-checked={moviendo.dest === l.id} onclick={() => elegirLugar(l.id)}><i class="cp-dot" style:--c={l.color} aria-hidden="true"></i>{l.n}</button>
      {/each}
    </div>
    <label class="cp-chk"><input type="checkbox" bind:checked={siempre} /> <span>Que siempre vaya al lugar que elija</span></label>
    <p class="seg-help">Es solo para esta semana, salvo que marques la casilla. Tus reglas se ven en «Mis lugares y reglas».</p>
  </Hoja>
{/if}

{#if nav.hojaAbierta('cp-fil')}
  <Hoja titulo="Filtrar la lista">
    <span class="sh-lbl" id="fl-sec">Sección del súper</span>
    <div class="m-chips" role="radiogroup" aria-labelledby="fl-sec">
      <button role="radio" class:on={fSec === null} aria-checked={fSec === null} onclick={() => (fSec = null)}>Todas</button>
      {#each SECCIONES as sec, i (sec)}<button role="radio" class:on={fSec === i} aria-checked={fSec === i} onclick={() => (fSec = i)}>{sec}</button>{/each}
    </div>
    <span class="sh-lbl" id="fl-q">Persona</span>
    <div class="m-chips" role="radiogroup" aria-labelledby="fl-q">
      {#each [['', 'Las dos'], ['les', 'Les'], ['jeff', 'Jeff']] as [v, t] (v)}<button role="radio" class:on={fQuien === v} aria-checked={fQuien === v} onclick={() => (fQuien = v as typeof fQuien)}>{t}</button>{/each}
    </div>
    <div class="man">
      <label for="fl-r">Receta</label>
      <select id="fl-r" class="cp-sel" bind:value={fReceta}>
        <option value="">Todas</option>
        {#each recetasDeLaLista as r (r)}<option value={r}>{r}</option>{/each}
      </select>
    </div>
    <span class="sh-lbl" id="fl-o">Otros</span>
    <div class="m-chips" role="group" aria-labelledby="fl-o">
      <button aria-pressed={fPronto} class:on={fPronto} onclick={() => (fPronto = !fPronto)}>Se acaba pronto</button>
      <button aria-pressed={fPesado} class:on={fPesado} onclick={() => (fPesado = !fPesado)}>Pesado</button>
    </div>
    <p class="seg-help">«Persona» usa lo que el menú tiene para cada quien. Lo que agregas a mano no tiene persona. El lugar lo eliges arriba, en las pestañas.</p>
    <button class="start" onclick={() => nav.cerrar()}>Ver la lista</button>
    {#if hayFiltros}<button class="ghost" onclick={limpiarFiltros}>Quitar filtros</button>{/if}
  </Hoja>
{/if}

{#if nav.hojaAbierta('cp-lug')}
  <Hoja titulo="Mis lugares y reglas">
    <p class="seg-help">Tú decides dónde compras. Cada lugar tiene nombre y color.</p>
    <div class="lg-list">
      {#each lugares.lista as l, i (l.id)}
        <div class="lg-row">
          <input class="lg-n" type="text" aria-label={'Nombre del lugar ' + (i + 1)} value={l.n} maxlength="30" onchange={(e) => renombrar(l.id, e.currentTarget.value)} />
          <div class="lg-col" role="radiogroup" aria-label={'Color de ' + l.n}>
            {#each COLORES_LUGAR as c, ci (c)}
              <button role="radio" aria-checked={l.color === c} aria-label={['Lila', 'Rosa', 'Menta', 'Ámbar', 'Cielo', 'Coral'][ci]} class:on={l.color === c} style:--c={c} onclick={() => colorear(l.id, c)}></button>
            {/each}
          </div>
          <button class="link-btn" disabled={lugares.lista.length <= 1} aria-label={'Quitar el lugar ' + l.n} onclick={() => borrarLugar(l.id)}>Quitar</button>
        </div>
      {/each}
    </div>
    <div class="man">
      <label for="lg-nuevo">Agregar un lugar</label>
      <div class="cq-row">
        <input id="lg-nuevo" type="text" placeholder="Ej. Mercado, Costco" autocomplete="off" maxlength="30" bind:value={nuevoLugar} onkeydown={(e) => { if (e.key === 'Enter') { e.preventDefault(); agregarLugar(); } }} />
        <button class="start" onclick={agregarLugar}>Agregar</button>
      </div>
    </div>
    <span class="sh-lbl">Reglas por sección</span>
    <p class="seg-help">Lo de esa sección va a ese lugar, salvo que muevas algo. «De fábrica» deja el reparto que ya tenía la app.</p>
    <div class="lg-sec">
      {#each SECCIONES as sec, si (sec)}
        <label for={'rg-' + si}>{sec}</label>
        <select id={'rg-' + si} class="cp-sel" value={lugares.sec[String(si)] ?? ''} onchange={(e) => reglaSeccion(si, e.currentTarget.value)}>
          <option value="">De fábrica</option>
          {#each lugares.lista as l (l.id)}<option value={l.id}>{l.n}</option>{/each}
        </select>
      {/each}
    </div>
    <span class="sh-lbl">Reglas por ingrediente</span>
    {#if reglasIng.length}
      <ul class="lg-ing">
        {#each reglasIng as [k, id] (k)}
          <li><span>{k.charAt(0).toUpperCase() + k.slice(1)} → <b>{cortoLugar(nombreLugar(lugares, id))}</b></span><button class="link-btn" aria-label={'Quitar la regla de ' + k} onclick={() => sinRegla(k)}>Quitar</button></li>
        {/each}
      </ul>
    {:else}
      <p class="seg-help">Aún no hay. Al mover algo de lugar puedes marcar «Que siempre vaya ahí», y si lo mueves dos veces al mismo lugar te pregunto una vez.</p>
    {/if}
  </Hoja>
{/if}

<ComprasAnteriores {lugares} alTerminar={cargarHist} />
<AnfitrionIA />
