<script lang="ts">
  import type { AreaAlma, SemanaAlma } from '../../core/db';
  import Hoja from '../../core/Hoja.svelte';
  import { avisos } from '../../core/aviso.svelte';
  import { nav } from '../../core/nav.svelte';
  import { guardarAreas, guardarSemana, leerAreas, leerSemana } from './datos';
  import { colorDe, copiarAreas, DIAS, diaCompleto, diaDePlan, estaVacia, lunesDeSemana, nombreSemana, numeroDeDia, rangoCorto, SEMANA_MAX, SEMANA_MIN, semanaVacia } from './semanas';

  const datos = nav.pantalla?.datos as { k?: number; dia?: number } | undefined;
  let k = $state(Math.max(SEMANA_MIN, Math.min(SEMANA_MAX, datos?.k ?? 0)));
  let modo = $state<'lejos' | 'editar'>('lejos');
  let areas = $state<AreaAlma[]>([]);
  let semana = $state<SemanaAlma>(semanaVacia(''));
  let cargada = $state(false);
  let guardado = $state(false);

  const hoy = new Date();
  const hoyDia = diaDePlan(hoy);
  const lunes = $derived(lunesDeSemana(k));
  const vacia = $derived(cargada && estaVacia(semana, areas));
  const limpio = <T,>(x: T): T => $state.snapshot(x) as T;

  async function cargar() {
    const l = lunes;
    const s = await leerSemana(l);
    if (l === lunesDeSemana(k)) { semana = s; cargada = true; }
  }
  (async () => {
    areas = await leerAreas();
    await cargar();
    if (datos?.dia != null && datos.dia >= 0 && datos.dia < 5) abrirEscribir('d', datos.dia);
  })();

  function ir(n: number) {
    const nuevo = k + n;
    if (nuevo < SEMANA_MIN || nuevo > SEMANA_MAX) return;
    k = nuevo; guardado = false; cargada = false;
    cargar();
  }
  async function guardar() { await guardarSemana(limpio(semana)); guardado = true; }
  function escribirDia(i: number, v: string) { semana.dias[i] = v; guardar(); }
  function escribirArea(id: number, v: string) { semana.areas[id] = v; guardar(); }

  // ---------- Escribir en un recuadro (vista de lejos) ----------
  let abierto = $state<{ t: 'd' | 'a'; i: number } | null>(null);
  function abrirEscribir(t: 'd' | 'a', i: number) { abierto = { t, i }; guardado = false; nav.abrirHoja('al-escribir'); }
  const tituloEscribir = $derived(!abierto ? '' : abierto.t === 'd' ? diaCompleto(lunes, abierto.i) : (areas.find((a) => a.id === abierto!.i)?.nombre ?? ''));
  const valorAbierto = $derived(!abierto ? '' : abierto.t === 'd' ? semana.dias[abierto.i] : (semana.areas[abierto.i] ?? ''));
  function alEscribir(v: string) { if (!abierto) return; if (abierto.t === 'd') escribirDia(abierto.i, v); else escribirArea(abierto.i, v); }

  // ---------- Copiar las áreas de la semana pasada ----------
  async function copiar() {
    const origen = await leerSemana(lunesDeSemana(k - 1));
    const antes = limpio(semana.areas);
    const nueva = copiarAreas(origen, semana, areas);
    if (!nueva) { avisos.mostrar('La semana anterior no tiene nada en las áreas'); return; }
    semana = nueva;
    await guardar();
    avisos.deshacer('Copiaste las áreas de la semana anterior', async () => { semana = { ...semana, areas: antes }; await guardar(); });
  }

  // ---------- Editar áreas ----------
  interface Borrador { id?: number; clave: number; nombre: string; corto: string; color: number; quitar: boolean }
  let borrador = $state<Borrador[]>([]);
  let claveNueva = 1;
  function abrirAreas() {
    borrador = areas.map((a, n) => ({ id: a.id, clave: n + 1000, nombre: a.nombre, corto: a.corto, color: a.color, quitar: false }));
    nav.abrirHoja('al-areas');
  }
  function agregarArea() {
    const color = Math.max(-1, ...borrador.map((b) => b.color)) + 1;
    borrador.push({ clave: claveNueva++, nombre: '', corto: '', color, quitar: false });
  }
  function quitarArea(b: Borrador) { b.quitar = true; avisos.mostrar('Se quita al guardar. Lo que escribiste en semanas pasadas no se borra.'); }
  async function guardarEdicionAreas() {
    const sal: AreaAlma[] = [];
    for (const b of borrador) {
      if (b.quitar) continue;
      const anterior = areas.find((a) => a.id === b.id);
      const nombre = b.nombre.trim() || anterior?.nombre || '';
      if (!nombre) continue;
      sal.push({ ...(b.id != null ? { id: b.id } : {}), nombre, corto: b.corto.trim(), color: b.color });
    }
    if (!sal.length) { avisos.mostrar('Deja al menos un área'); return; }
    await guardarAreas(sal);
    areas = await leerAreas();
    nav.cerrar();
    avisos.mostrar('Áreas guardadas');
  }
  const visibles = $derived(borrador.filter((b) => !b.quitar));

  const coach = $derived(modo === 'lejos' ? 'Semana en blanco. Toca un recuadro para escribir, o usa «Editar semana» arriba para llenar todo.' : k > 0 ? 'Aquí puedes dejar lista la próxima semana. Todo es opcional.' : 'Semana en blanco. Puedes empezar por lo que quieres lograr en cada área.');
</script>

<header class="cur-head">
  <button class="back" aria-label="Volver" onclick={() => nav.cerrar()}>‹ Volver</button>
  <span class="al-hb">
    <button class="edit" class:on={modo === 'editar'} aria-pressed={modo === 'editar'} onclick={() => { modo = modo === 'editar' ? 'lejos' : 'editar'; guardado = false; }}>{modo === 'editar' ? 'Listo' : 'Editar semana'}</button>
    <button class="edit" onclick={abrirAreas}>Editar áreas</button>
  </span>
</header>
<div class="screen">
  <div class="tl-head">
    <div class="pl-tr"><h2 tabindex="-1">Alma</h2><button class="pl-cmpb" aria-label="Comparar semanas para ver tu progreso" onclick={() => nav.abrir('alma-cmp', { a: k, b: k > SEMANA_MIN ? k - 1 : k + 1 })}>Comparar semanas</button></div>
    <p class="seg-help">Una guía para tu semana, no una lista de pendientes.</p>
  </div>

  <div class="pl-nav">
    <button class="cal-nav" aria-label="Semana anterior" disabled={k <= SEMANA_MIN} onclick={() => ir(-1)}>‹</button>
    <span><b>{rangoCorto(lunes)}</b><small>{nombreSemana(k)}</small></span>
    <button class="cal-nav" aria-label="Semana siguiente" disabled={k >= SEMANA_MAX} onclick={() => ir(1)}>›</button>
  </div>
  {#if vacia}<p class="coach">{coach}</p>{/if}

  {#if modo === 'lejos'}
    <div class="fr-wrap">
      <section class="tp-sec" aria-labelledby="fr-h1"><h4 id="fr-h1">Días</h4>
        <div class="fr-list">
          {#each DIAS as n, i (n)}
            {@const hoyEs = k === 0 && i === hoyDia}
            {@const t = semana.dias[i] ?? ''}
            <button class="fr-cell fr-day" class:today={hoyEs} aria-label={diaCompleto(lunes, i) + (hoyEs ? ', hoy' : '')} onclick={() => abrirEscribir('d', i)}>
              <span class="fr-d">{n.slice(0, 3).toUpperCase()}<b>{numeroDeDia(lunes, i)}</b></span>
              <span class="t" class:none={!t.trim()}>{t.trim() ? t : 'Toca para escribir'}</span>
            </button>
          {/each}
        </div>
      </section>
      <section class="tp-sec" aria-labelledby="fr-h2"><h4 id="fr-h2">Lo que quiero lograr</h4>
        <div class="fr-list">
          {#each areas as a (a.id)}
            {@const t = semana.areas[a.id!] ?? ''}
            <button class="fr-cell fr-area" style:--c={colorDe(a)} aria-label={a.nombre} onclick={() => abrirEscribir('a', a.id!)}>
              <small>{a.nombre}</small>
              <span class="t" class:none={!t.trim()}>{t.trim() ? t : 'Toca para escribir'}</span>
            </button>
          {/each}
        </div>
      </section>
    </div>
  {:else}
    <div class="fr-wrap">
      <section class="tp-sec" aria-labelledby="pl-h1"><h4 id="pl-h1">Días</h4>
        <div class="pl-list">
          {#each DIAS as d, i (d)}
            {@const hoyEs = k === 0 && i === hoyDia}
            <div class="pl-card" class:today={hoyEs}>
              <div class="pl-ch"><label for={'pd-' + i}>{diaCompleto(lunes, i)}</label>{#if hoyEs}<span class="tag s">Hoy</span>{/if}</div>
              <textarea id={'pd-' + i} rows="3" placeholder="Lo que haré, si quiero escribirlo" value={semana.dias[i] ?? ''} oninput={(e) => escribirDia(i, e.currentTarget.value)}></textarea>
            </div>
          {/each}
        </div>
      </section>
      <section class="tp-sec" aria-labelledby="pl-h2"><h4 id="pl-h2">Lo que quiero lograr</h4>
        <div class="pl-list">
          {#each areas as a (a.id)}
            <div class="pl-card" style:--c={colorDe(a)}>
              <div class="pl-ch pl-ar"><label for={'pa-' + a.id}>{a.nombre}</label></div>
              <textarea id={'pa-' + a.id} rows="3" placeholder="Qué quiero lograr esta semana aquí" value={semana.areas[a.id!] ?? ''} oninput={(e) => escribirArea(a.id!, e.currentTarget.value)}></textarea>
            </div>
          {/each}
        </div>
      </section>
      <p class="saved-note" role="status">{guardado ? 'Guardado en tu teléfono.' : 'Se guarda sola mientras escribes.'}</p>
    </div>
  {/if}

  {#if vacia && k > SEMANA_MIN}<button class="ghost" onclick={copiar}>Copiar las áreas de la semana pasada</button>{/if}
  {#if modo === 'editar'}<p class="tool-note">Lo que escribes se guarda solo en tu teléfono.</p>{/if}
</div>

{#if nav.hojaAbierta('al-escribir') && abierto}
  <Hoja titulo={tituloEscribir}>
    <textarea rows="5" aria-label={tituloEscribir} placeholder={abierto.t === 'd' ? 'Lo que haré, si quiero escribirlo' : 'Qué quiero lograr esta semana aquí'} value={valorAbierto} oninput={(e) => alEscribir(e.currentTarget.value)}></textarea>
    <p class="saved-note" role="status">{guardado ? 'Guardado en tu teléfono.' : 'Se guarda sola mientras escribes.'}</p>
  </Hoja>
{/if}

{#if nav.hojaAbierta('al-areas')}
  <Hoja titulo="Editar áreas">
    <p class="seg-help">Cada área es un bloque de tu planeador. Cambia su nombre, agrega o quita bloques.</p>
    <div class="al-edit-list">
      {#each visibles as b, n (b.clave)}
        <div class="al-ed" style:--c={colorDe({ nombre: '', corto: '', color: b.color })}>
          <div class="al-ed-h"><span>Área {n + 1}</span><button onclick={() => quitarArea(b)}>Quitar<span class="sr"> área {n + 1}</span></button></div>
          <div class="man">
            <label for={'ae-n' + b.clave}>Nombre</label><input id={'ae-n' + b.clave} type="text" placeholder="Ej. Aprender a dibujar" bind:value={b.nombre} />
            <label for={'ae-s' + b.clave}>Nombre corto, para Inicio</label><input id={'ae-s' + b.clave} type="text" placeholder="Ej. Dibujo" bind:value={b.corto} />
          </div>
        </div>
      {/each}
    </div>
    <button class="add" onclick={agregarArea}>+ Agregar área</button>
    <button class="start" onclick={guardarEdicionAreas}>Guardar</button>
  </Hoja>
{/if}
