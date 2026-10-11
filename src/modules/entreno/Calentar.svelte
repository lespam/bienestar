<script lang="ts">
  import Icono from '../../core/Icono.svelte';
  import { SvelteSet } from 'svelte/reactivity';
  import { nav } from '../../core/nav.svelte';
  import { iso } from '../../core/fechas';
  import { cargarContexto } from './contexto';
  import { calentadosDe, marcarCalentado, marcarVarios } from './datos';
  import type { Calentamiento, Letra, Programa } from './programa';

  // Calentamiento del libro. Es opcional: marcas lo que haces y se guarda por día.
  const letraInicial = String(nav.pantalla?.datos?.letra ?? 'A') as Letra;
  const hoy = iso(new Date());
  let p = $state<Programa | null>(null);
  let cual = $state(0);
  let abierto = $state(0);
  const hechos = new SvelteSet<string>();

  const lista = $derived<Calentamiento[]>(p?.calentamientos ?? []);
  const actual = $derived(lista[cual]);
  const clave = (bi: number, ii: number) => `${cual}-${bi}-${ii}`;
  const total = $derived(actual ? actual.bloques.reduce((a, b) => a + b.elementos.length, 0) : 0);
  const hechosAhora = $derived(actual ? actual.bloques.reduce((a, b, bi) => a + b.elementos.filter((_, ii) => hechos.has(clave(bi, ii))).length, 0) : 0);

  (async () => {
    const c = await cargarContexto();
    p = c?.p ?? null;
    const i = p?.calentamientos?.findIndex((w) => w.para.includes(letraInicial)) ?? 0;
    cual = Math.max(0, i);
    for (const k of await calentadosDe(hoy)) hechos.add(k);
  })();

  const etiqueta = (w: Calentamiento) => 'Para ' + w.para.join(' y ');

  async function marcar(k: string, puesto: boolean) {
    if (puesto) hechos.add(k); else hechos.delete(k);
    await marcarCalentado(hoy, k, puesto);
  }
  async function bloque(bi: number) {
    const claves = actual.bloques[bi].elementos.map((_, ii) => clave(bi, ii));
    const todos = claves.every((k) => hechos.has(k));
    for (const k of claves) { if (todos) hechos.delete(k); else hechos.add(k); }
    if (!todos && bi + 1 < actual.bloques.length) abierto = bi + 1;
    await marcarVarios(hoy, claves, !todos);
  }
</script>

<header class="cur-head">
  <button class="back" aria-label="Volver" onclick={() => nav.cerrar()}>‹ Volver</button>
  <span class="rest-next">{hechosAhora} de {total}</span>
</header>
<div class="screen">
  <div class="tl-head">
    <h2 tabindex="-1">Calentamiento</h2>
    {#if lista.length > 1}
      <div class="seg seg2" role="radiogroup" aria-label="Calentamiento">
        {#each lista as w, i (i)}<button class:on={cual === i} role="radio" aria-checked={cual === i} onclick={() => { cual = i; abierto = 0; }}>{etiqueta(w)}</button>{/each}
      </div>
    {/if}
    {#if actual}<p class="seg-help">Calentamiento para las rutinas {actual.para.join(' y ')} (p. {actual.paginas}).</p>{/if}
  </div>
  {#if !actual}
    <p class="seg-help">Carga tu contenido personal para ver tu calentamiento.</p>
  {:else}
    <div class="wu-bar" aria-hidden="true"><i style:width="{total ? (hechosAhora / total) * 100 : 0}%"></i></div>
    <div class="wu-blocks">
      {#each actual.bloques as b, bi (bi)}
        {@const n = b.elementos.filter((_, ii) => hechos.has(clave(bi, ii))).length}
        <div class="wu-b" class:open={abierto === bi}>
          <button class="wu-bh" aria-expanded={abierto === bi} onclick={() => (abierto = abierto === bi ? -1 : bi)}><b>{b.nombre}</b><span class:full={n === b.elementos.length}>{n} de {b.elementos.length}</span><Icono nombre="abajo" /></button>
          {#if abierto === bi}
            <div class="wu-items">
              {#each b.elementos as it, ii (ii)}
                {@const k = clave(bi, ii)}
                <label class="wu-it" class:done={hechos.has(k)}><input type="checkbox" checked={hechos.has(k)} onchange={(ev) => marcar(k, ev.currentTarget.checked)} /><span>{it.nombre}</span>{#if it.pagina}<small>p. {it.pagina}</small>{/if}</label>
              {/each}
              <button class="wu-all" onclick={() => bloque(bi)}>{n === b.elementos.length ? 'Desmarcar bloque' : 'Marcar bloque completo'}</button>
            </div>
          {/if}
        </div>
      {/each}
    </div>
  {/if}
  <button class="start" onclick={() => nav.cerrar()}>Ir a la rutina</button>
  <p class="tool-note">Es opcional. Haz los bloques que te sirvan hoy.</p>
</div>
