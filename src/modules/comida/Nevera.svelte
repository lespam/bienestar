<script lang="ts">
  import { onDestroy } from 'svelte';
  import Hoja from '../../core/Hoja.svelte';
  import { reducirFoto } from '../../core/imagen';
  import { avisos } from '../../core/aviso.svelte';
  import { nav } from '../../core/nav.svelte';
  import { contarFuncion } from '../../core/uso';
  import type { ItemMenu, LugarMenu, PerfilComida, Receta } from '../../core/db';
  import { AnfitrionIA, aBase64, iaLista, leerRefri, pedirIA } from '../ia';
  import { fechaDe, type UsoReceta } from './calculos';
  import { agregarFaltantes, guardarHay, leerFijos, leerHay, leerPerfiles, listarRecetas, menuDe, perfilInicial, ponerVariosEnMenu, quitarFaltantes, reponerMenu, sembrarRecetas, usoDeRecetas } from './datos';
  import type { Fijo } from './fijos';
  import { DIAS_VIGENTE, leerTextoHay, mezclarHay, resumenHay, vigente } from './nevera';
  import { llave, nombreDia, numeroDia, indexar } from './semana';
  import type { EntradaSugerir, Hay } from './sugerir';
  import Borrador from './Borrador.svelte';

  const hoy = fechaDe(0);

  let recetas = $state<Receta[]>([]);
  let perfiles = $state<Record<'les' | 'jeff', PerfilComida>>({ les: perfilInicial('les'), jeff: perfilInicial('jeff') });
  let uso = $state<Record<string, UsoReceta>>({});
  let fijos = $state<Fijo[]>([]);
  let hay = $state<Hay[]>([]);
  let listo = $state(false);
  (async () => {
    await sembrarRecetas();
    let g;
    [recetas, perfiles, uso, fijos, g] = await Promise.all([listarRecetas(), leerPerfiles(), usoDeRecetas(), leerFijos(), leerHay()]);
    hay = vigente(g, hoy);
    listo = true;
  })();

  // Lo que hay se guarda como «Lo que hay hoy» cada vez que lo cambias: lo que ves es lo que se usa.
  const guardar = () => guardarHay({ fecha: hoy, items: $state.snapshot(hay) as Hay[] });
  function poner(nueva: Hay[]) { hay = nueva; guardar(); plan = null; }

  // ---------- 1. Escribir lo que hay ----------
  let texto = $state('');
  function agregarTexto() {
    const nuevos = leerTextoHay(texto);
    if (!nuevos.length) { avisos.mostrar('Escribe qué tienes. Por ejemplo: pollo, 3 jitomates, medio aguacate'); document.getElementById('nv-txt')?.focus(); return; }
    const antes = structuredClone($state.snapshot(hay)) as Hay[];
    poner(mezclarHay(antes, nuevos));
    texto = '';
    avisos.deshacer('Agregué ' + nuevos.length + (nuevos.length === 1 ? ' alimento' : ' alimentos'), () => poner(antes));
  }

  // ---------- Fotos (se quedan en el teléfono; solo se envían si pides leerlas con IA) ----------
  let fotos = $state<{ blob: Blob; url: string }[]>([]);
  async function elegirFoto(e: Event) {
    const input = e.target as HTMLInputElement, archivos = [...(input.files ?? [])];
    input.value = '';
    for (const a of archivos) {
      if (fotos.length >= 4) { avisos.mostrar('Hasta 4 fotos por vez'); break; }
      const blob = await reducirFoto(a, 1024);
      fotos = [...fotos, { blob, url: URL.createObjectURL(blob) }];
    }
  }
  function quitarFoto(i: number) { URL.revokeObjectURL(fotos[i].url); fotos = fotos.filter((_, j) => j !== i); }
  onDestroy(() => fotos.forEach((f) => URL.revokeObjectURL(f.url)));
  function leerFotos() {
    if (!fotos.length) return;
    const blobs = fotos.map((f) => f.blob), nota = texto;
    pedirIA({
      fn: 'nevera', titulo: 'Leer mis fotos', envia: blobs.length === 1 ? 'la foto reducida y lo que escribiste' : 'las ' + blobs.length + ' fotos reducidas y lo que escribiste',
      manual: { texto: 'Escribirlo a mano', hacer: () => document.getElementById('nv-txt')?.focus() },
      ejecutar: async (clave) => {
        const imgs = await Promise.all(blobs.map(async (b) => ({ tipo: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(b.type) ? b.type : 'image/jpeg', base64: await aBase64(b) })));
        const hallazgos = await leerRefri(clave, imgs, nota);
        const agrega = (hs: Hay[]) => { const antes = structuredClone($state.snapshot(hay)) as Hay[]; poner(mezclarHay(antes, hs)); };
        return {
          intro: 'Esto es lo que parece haber. Revísalo: puedes quitar o cambiar cualquier cosa después de agregarlo.',
          items: hallazgos.map((h) => ({ t: h.n + (h.q ? ' · ' + h.q : ''), sub: h.urgente ? 'Parece que conviene usarlo pronto' : undefined, act: 'Agregar', aplicar: () => agrega([{ n: h.n, ...(h.q ? { q: h.q } : {}), ...(h.urgente ? { urgente: true } : {}) }]) })),
          todos: { act: 'Agregar todo', aplicar: () => agrega(hallazgos.map((h) => ({ n: h.n, ...(h.q ? { q: h.q } : {}), ...(h.urgente ? { urgente: true } : {}) }))) }
        };
      }
    });
  }

  // ---------- 2. Revisar la lista ----------
  let editando = $state<number | null>(null);
  let eN = $state(''), eQ = $state(''), eU = $state(false);
  function abrirEditar(i: number) { editando = i; eN = hay[i].n; eQ = hay[i].q ?? ''; eU = !!hay[i].urgente; nav.abrirHoja('nv-edit'); }
  function guardarEditar() {
    const i = editando, n = eN.trim();
    if (i == null) return;
    if (!n) { document.getElementById('nv-en')?.focus(); avisos.mostrar('Escribe el nombre'); return; }
    const antes = structuredClone($state.snapshot(hay)) as Hay[];
    const nueva = antes.map((h, j) => (j === i ? { n, ...(eQ.trim() ? { q: eQ.trim() } : {}), ...(eU ? { urgente: true } : {}) } : h));
    nav.cerrar();
    poner(nueva);
    avisos.deshacer('Cambios guardados', () => poner(antes));
  }
  function quitarUno() {
    const i = editando;
    if (i == null) return;
    const antes = structuredClone($state.snapshot(hay)) as Hay[];
    nav.cerrar();
    poner(antes.filter((_, j) => j !== i));
    avisos.deshacer('Quité «' + antes[i].n + '»', () => poner(antes));
  }
  function vaciar() {
    const antes = structuredClone($state.snapshot(hay)) as Hay[];
    poner([]);
    avisos.deshacer('Vacié la lista', () => poner(antes));
  }
  function marcarPronto(i: number) { poner(hay.map((h, j) => (j === i ? { ...h, urgente: !h.urgente } : h))); }

  // ---------- 3. Armar el plan (por reglas) ----------
  let dias = $state(3);
  let tiempos = $state<LugarMenu[]>(['d', 'c', 'n']);
  const NOMBRE_T: [LugarMenu, string][] = [['d', 'Desayuno'], ['c', 'Comida'], ['n', 'Cena']];
  function alternarT(l: LugarMenu) { const a = tiempos.includes(l) ? tiempos.filter((x) => x !== l) : NOMBRE_T.map(([x]) => x).filter((x) => x === l || tiempos.includes(x)); tiempos = a; plan = null; }
  let plan = $state.raw<EntradaSugerir | null>(null);
  let usado = $state<{ n: number; fechas: string[] } | null>(null);
  async function armar() {
    if (!hay.length) { avisos.mostrar('Agrega primero lo que tienes'); document.getElementById('nv-txt')?.focus(); return; }
    if (!tiempos.length) { avisos.mostrar('Elige al menos un tiempo de comida'); return; }
    const fechas = Array.from({ length: dias }, (_, i) => fechaDe(i));
    const items = await menuDe(fechas);
    const idx = indexar(items);
    contarFuncion('nevera');
    usado = null;
    plan = {
      recetas, perfiles, uso, fijos, dias: fechas, tiempos: [...tiempos], hoy, hay: $state.snapshot(hay) as Hay[], nevera: true,
      ocupado: (f, l) => idx.has(llave(f, l)),
      yaEnMenu: items.flatMap((m) => [m.r, m.rl, m.rj]).filter((x): x is string => !!x)
    };
  }
  async function usarPlan(filas: ItemMenu[]) {
    if (!filas.length) return;
    const fechas = [...new Set(filas.map((x) => x.fecha))];
    const antes = await menuDe(fechas);
    await ponerVariosEnMenu(filas);
    usado = { n: filas.length, fechas };
    avisos.deshacer(filas.length + (filas.length === 1 ? ' comida puesta' : ' comidas puestas') + ' en el menú', async () => { await reponerMenu(fechas, antes); usado = null; });
  }
  async function faltaALista(nombres: string[]) {
    const nuevos = await agregarFaltantes(nombres, hoy);
    if (!nuevos.length) { avisos.mostrar('Eso ya está en tu lista de compras'); return; }
    avisos.deshacer('Agregué ' + nuevos.length + (nuevos.length === 1 ? ' cosa' : ' cosas') + ' a tu lista de compras', () => quitarFaltantes(nuevos, hoy));
  }
</script>

<header class="cur-head">
  <button class="back" aria-label="Volver" onclick={() => nav.cerrar()}>‹ Volver</button>
  <span class="rest-next">Comida</span>
</header>
<div class="screen">
  <div class="tl-head">
    <h2 tabindex="-1">Con lo que tengo</h2>
    <p class="seg-help">Dime qué hay en casa y armo un plan con tus recetas. Primero uso lo que se echa a perder antes. Nada entra a tu menú hasta que lo aceptes.</p>
  </div>

  <section class="cq" aria-label="Lo que hay">
    <label for="nv-txt"><b>Escribe lo que hay</b></label>
    <textarea id="nv-txt" class="nv-txt" rows="2" placeholder="Ej. pollo, 3 jitomates, medio aguacate, yogurt" bind:value={texto}></textarea>
    <button class="start" onclick={agregarTexto}>Agregar a la lista</button>
    <b id="nv-fotos-t">O toma fotos del refri y la alacena</b>
    <div class="to-pick" role="group" aria-labelledby="nv-fotos-t">
      <label><svg aria-hidden="true" focusable="false" viewBox="0 0 24 24"><path d="M4 8h3l2-3h6l2 3h3v11H4z" /><circle cx="12" cy="13" r="3.5" /></svg>Tomar foto<input type="file" accept="image/*" capture="environment" onchange={elegirFoto} /></label>
      <label><svg aria-hidden="true" focusable="false" viewBox="0 0 24 24"><path d="M21 12l-8.5 8.5a5 5 0 0 1-7-7L14 5a3.5 3.5 0 0 1 5 5l-8.5 8.5a2 2 0 0 1-3-3L15 8" /></svg>Adjuntar fotos<input type="file" accept="image/*" multiple onchange={elegirFoto} /></label>
    </div>
    {#if fotos.length}
      <div class="nv-fotos">
        {#each fotos as f, i (f.url)}
          <div class="nv-foto"><span class="th" style:background-image={'url(' + f.url + ')'} role="img" aria-label={'Foto ' + (i + 1)}></span><button class="link-btn" onclick={() => quitarFoto(i)} aria-label={'Quitar la foto ' + (i + 1)}>Quitar</button></div>
        {/each}
      </div>
      {#if iaLista('nevera')}
        <button class="ghost" onclick={leerFotos}>Leer las fotos con IA</button>
        <p class="seg-help">Se envían las fotos reducidas y lo que escribiste. Tú revisas lo que encuentra antes de usarlo.</p>
      {:else}
        <p class="seg-help">Leer fotos necesita la IA con tu clave (Ajustes). Mientras, escribe lo que ves en las fotos.</p>
      {/if}
    {/if}
  </section>

  <section aria-labelledby="nv-hay-t" class="nv-hay">
    <h3 id="nv-hay-t" class="pat-sub">Lo que hay hoy{hay.length ? ' (' + hay.length + ')' : ''}</h3>
    {#if hay.length}
      <ul class="nv-chips">
        {#each hay as h, i (h.n)}
          <li class:pronto={h.urgente}>
            <button class="nv-chip" onclick={() => abrirEditar(i)} aria-label={'Cambiar: ' + resumenHay(h)}>{h.n}{#if h.q}<small>{h.q}</small>{/if}</button>
            <button class="nv-pr" aria-pressed={!!h.urgente} onclick={() => marcarPronto(i)} aria-label={'Usar pronto: ' + h.n}>{h.urgente ? 'Usar pronto' : 'Pronto'}</button>
          </li>
        {/each}
      </ul>
      <button class="link-btn" onclick={vaciar}>Vaciar la lista</button>
      <p class="seg-help">Esta lista también se usa en tu lista de compras: lo que ya tienes no se pide dos veces. Vale por {DIAS_VIGENTE} días.</p>
    {:else}
      <p class="seg-help">{listo ? 'Aún no hay nada. Escribe o fotografía lo que tienes.' : 'Cargando…'}</p>
    {/if}
  </section>

  <section class="cq" aria-label="Armar el plan">
    <b id="nv-dias-t">¿Para cuántos días?</b>
    <div class="m-chips" role="radiogroup" aria-labelledby="nv-dias-t">
      {#each [1, 2, 3, 4, 5, 6, 7] as n (n)}<button class="nv-n" role="radio" aria-checked={dias === n} class:on={dias === n} onclick={() => { dias = n; plan = null; }}>{n}</button>{/each}
    </div>
    <b id="nv-t-t">¿Qué tiempos?</b>
    <div class="m-chips" role="group" aria-labelledby="nv-t-t">
      {#each NOMBRE_T as [l, n] (l)}<button class:on={tiempos.includes(l)} aria-pressed={tiempos.includes(l)} onclick={() => alternarT(l)}>{n}</button>{/each}
    </div>
    <button class="start" disabled={!hay.length || !listo} onclick={armar}>Armar un plan con lo que tengo</button>
  </section>

  {#if plan}
    <section aria-labelledby="nv-plan-t" aria-live="polite">
      <h3 id="nv-plan-t" class="pat-sub">Tu plan de {dias === 1 ? 'hoy' : dias + ' días'}</h3>
      {#if usado}
        <p class="seg-help">Listo: puse {usado.n} {usado.n === 1 ? 'comida' : 'comidas'} en tu menú ({usado.fechas.map((f) => nombreDia(f).slice(0, 3) + ' ' + numeroDia(f)).join(', ')}).</p>
        <button class="start" onclick={() => nav.abrir('tarjetas', { acomodar: 1 })}>Verlo en Acomoda la semana</button>
        <button class="ghost" onclick={() => nav.abrir('compras')}>Ver mi lista de compras</button>
      {:else}
        {#key plan}
          <Borrador entrada={plan} alUsar={usarPlan} {faltaALista} accion="Usar este plan" textoIA="Ideas con lo que hay" />
        {/key}
      {/if}
    </section>
  {/if}
</div>

{#if nav.hojaAbierta('nv-edit')}
  <Hoja titulo="Cambiar">
    <div class="man"><label for="nv-en">Nombre</label><input id="nv-en" type="text" autocomplete="off" bind:value={eN} /></div>
    <div class="man"><label for="nv-eq">Cantidad (opcional)</label><input id="nv-eq" type="text" placeholder="Ej. 3 piezas, medio paquete" autocomplete="off" bind:value={eQ} /></div>
    <div class="m-chips" role="group" aria-label="Cuándo usarlo"><button class:on={eU} aria-pressed={eU} onclick={() => (eU = !eU)}>Usar pronto</button></div>
    <button class="start" onclick={guardarEditar}>Guardar</button>
    <button class="ghost" onclick={quitarUno}>Quitar de la lista</button>
  </Hoja>
{/if}

<AnfitrionIA />
