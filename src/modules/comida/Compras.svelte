<script lang="ts">
  import type { ItemMenu, Receta } from '../../core/db';
  import Hoja from '../../core/Hoja.svelte';
  import { avisos } from '../../core/aviso.svelte';
  import { nav } from '../../core/nav.svelte';
  import { norm } from './calculos';
  import { NOMBRE_TIENDA, SECCIONES, armarLista, comprasVacias, conteos, marcada, plantillaMarcada, repartir, seccionDe, sugerencias, textoCompartir, type Destino, type Extra, type FilaCompra, type Pestana } from './compras';
  import { guardarCompras, leerCompras, listarRecetas, menuDe, sembrarRecetas } from './datos';
  import { fechasDeSemana, rangoSemana } from './semana';

  const semana = ((nav.pantalla?.datos as { k?: number } | undefined)?.k ?? 0);
  const dias = fechasDeSemana(semana);
  const lunes = dias[0];

  let items = $state<ItemMenu[]>([]);
  let recetas = $state<Receta[]>([]);
  let estado = $state(comprasVacias());
  let listo = $state(false);
  let pestana = $state<Pestana>('enfrente');

  (async () => {
    await sembrarRecetas();
    [items, recetas, estado] = await Promise.all([menuDe(dias), listarRecetas(), leerCompras(lunes)]);
    listo = true;
  })();

  const lista = $derived(repartir(armarLista(items, recetas), estado));
  const filas = $derived(lista.filas);
  const cuenta = $derived(conteos(filas, estado));
  const visibles = $derived(filas.filter((f) => pestana === 'todo' || f.dest === pestana));
  const guardar = () => guardarCompras(lunes, $state.snapshot(estado));

  // ---------- Marcar y mover ----------
  function marcar(f: FilaCompra, v: boolean) {
    if (f.extra) { const e = estado.extras.find((x) => x.n === f.n); if (e) e.chk = v; }
    else estado.chk[f.n] = v;
    guardar();
  }
  function mover(f: FilaCompra) {
    const antes = estado.dest[f.n];
    const a: Destino = f.dest === 'walmart' ? 'enfrente' : 'walmart';
    estado.dest[f.n] = a;
    guardar();
    avisos.deshacer(f.n + ' pasó a ' + (a === 'walmart' ? 'Walmart+' : 'Enfrente'), () => {
      if (antes) estado.dest[f.n] = antes; else delete estado.dest[f.n];
      guardar();
    });
  }

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
  const texto = $derived(textoCompartir(filas, estado, cDest, cTodo));
  function abrirCompartir() { cDest = pestana; cTodo = false; nav.abrirHoja('cp-share'); }
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
    for (const d of ['enfrente', 'walmart'] as Destino[]) {
      if (pestana !== 'todo' && pestana !== d) continue;
      const cuerpo = SECCIONES.map((s, si) => {
        const its = filas.filter((f) => f.sec === si && f.dest === d);
        return its.length ? '<h2>' + esc(s) + '</h2><ul>' + its.map((f) => '<li>☐ ' + esc(f.n) + (f.q ? ' (' + esc(f.q) + ')' : '') + '</li>').join('') + '</ul>' : '';
      }).join('');
      if (cuerpo) h += '<h2 style="font-size:15pt">' + NOMBRE_TIENDA[d] + '</h2>' + cuerpo;
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
  <div class="seg" id="cp-tabs" role="radiogroup" aria-label="Dónde comprar">
    {#each [['enfrente', 'Enfrente'], ['walmart', 'Walmart+'], ['todo', 'Todo']] as [k, t] (k)}
      <button role="radio" class:on={pestana === k} aria-checked={pestana === k} onclick={() => (pestana = k as Pestana)}>{t} · {cuenta[k as Pestana]}</button>
    {/each}
  </div>
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
    {#if lista.pasadas.length}<p class="tool-note left">Jeff carga poco: pasé {lista.pasadas.join(', ')} a Walmart+. Puedes cambiarlo.</p>{/if}
  </section>
  <div class="cp-top">
    <div class="wu-bar"><i style="width:{cuenta.todo ? (cuenta.hechas / cuenta.todo) * 100 : 0}%"></i></div>
    <small class="seg-help" aria-live="polite">{!cuenta.todo ? 'Tu lista está vacía' : cuenta.hechas ? 'Llevas ' + cuenta.hechas + ' de ' + cuenta.todo : cuenta.todo + ' cosas para esta semana'}</small>
  </div>
  <div class="tool" id="cp-list">
    {#if !visibles.length}
      <p class="tool-note">{vacia ? 'Aún no hay comidas en el menú. Cuando elijas recetas, aquí aparece lo que necesitas comprar.' : listo ? 'No hay nada para ' + (pestana === 'walmart' ? 'Walmart+' : 'Enfrente') + ' por ahora.' : 'Armando tu lista…'}</p>
    {/if}
    {#each SECCIONES as sec, si (sec)}
      {@const rows = visibles.filter((f) => f.sec === si)}
      {#if rows.length}
        <section class="cp-sec">
          <h3>{sec}</h3>
          {#each rows as f (f.n + '|' + (f.extra ? 'x' : 'm'))}
            {@const otra = f.dest === 'walmart' ? 'Enfrente' : 'Walmart+'}
            {@const hecho = marcada(estado, f)}
            <div class="cp-row">
              <label class="wu-it" class:done={hecho}>
                <input type="checkbox" checked={hecho} onchange={(e) => marcar(f, e.currentTarget.checked)} />
                <span><b>{f.n}</b><small>{pestana === 'todo' ? (f.dest === 'walmart' ? 'Walmart+ · ' : 'Enfrente · ') : ''}{f.extra ? f.why : 'Para: ' + f.para.join(', ') + (f.crudo ? ' · en crudo' : '')}</small></span>
                <em>{f.q}</em>
              </label>
              <button class="cp-mv" aria-label={'Pasar ' + f.n + ' a ' + otra} onclick={() => mover(f)}>Mover</button>
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
    <div class="seg" role="radiogroup" aria-label="Qué lista">
      {#each [['enfrente', 'Enfrente'], ['walmart', 'Walmart+'], ['todo', 'Las dos']] as [k, t] (k)}
        <button role="radio" class:on={cDest === k} aria-checked={cDest === k} onclick={() => (cDest = k as Pestana)}>{t}</button>
      {/each}
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
