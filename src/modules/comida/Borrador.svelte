<script lang="ts">
  import { untrack } from 'svelte';
  import type { ItemMenu, Receta } from '../../core/db';
  import { avisos } from '../../core/aviso.svelte';
  import { iaLista, pedirIA, proponerComidas, type ComidaIA, type TiempoIA } from '../ia';
  import { contarSugerencia } from '../../core/uso';
  import { descartar, exclusionesDe, textoExclusiones } from './seguro';
  import { etiquetaFecha, itemDos, NOMBRE_LUGAR } from './semana';
  import { candidatas, cobertura, MOTIVO_TXT, sugerirMenu, type EntradaSugerir, type Propuesta } from './sugerir';

  // Un borrador de comidas: se ve, se cambia y se quita lo que quieras. Nada pasa al menú hasta «Usar este borrador».
  let { entrada, alUsar, faltaALista, accion = 'Usar este borrador', textoIA = 'Algo diferente' }: {
    entrada: EntradaSugerir;
    alUsar: (filas: ItemMenu[]) => Promise<void> | void;
    faltaALista?: (nombres: string[]) => Promise<void> | void;
    accion?: string;
    /** El texto del botón secundario: con IA activada se le agrega «con IA». */
    textoIA?: string;
  } = $props();

  type Fila = Propuesta & { ia?: boolean; nota?: string };
  let lista = $state<Fila[]>(untrack(() => sugerirMenu(entrada)));
  const porId = $derived(Object.fromEntries(entrada.recetas.map((r) => [r.id, r])) as Record<string, Receta>);
  const copia = () => structuredClone($state.snapshot(lista)) as Fila[];

  function poner(i: number, r: Receta, extra: Partial<Fila> = {}) {
    const c = cobertura(r, entrada.hay ?? []);
    const p = lista[i];
    lista[i] = { ...p, r, usa: c.usa, falta: c.falta, otras: [...p.otras.filter((id) => id !== r.id), p.r.id], motivo: 'variar', ia: undefined, nota: undefined, ...extra };
  }
  /** «Cambiar esta comida»: la siguiente mejor opción. */
  function cambiar(i: number) {
    const sig = lista[i].otras.map((id) => porId[id]).find(Boolean);
    if (!sig) { avisos.mostrar('No hay otra opción para este lugar'); return; }
    const antes = copia();
    poner(i, sig);
    avisos.deshacer('Cambié ' + NOMBRE_LUGAR[antes[i].l].toLowerCase(), () => { lista = antes; });
  }
  function quitar(i: number) {
    const antes = copia();
    lista = lista.filter((_, j) => j !== i);
    avisos.deshacer('Quité «' + antes[i].r.n + '»', () => { lista = antes; });
  }
  function otraPorReglas() {
    const antes = copia();
    lista = sugerirMenu({ ...entrada, evitar: antes.map((x) => x.r.id) });
    avisos.deshacer('Armé otro borrador', () => { lista = antes; });
  }

  const TIEMPO_IA: Record<string, TiempoIA> = { d: 'desayuno', c: 'comida', n: 'cena', a: 'colacion', p: 'colacion' };
  /** «Algo diferente»: con IA solo si ya la activaste; recibe exclusiones y hasta 15 candidatas, y todo pasa por el doble seguro. */
  function diferente() {
    if (!iaLista('huecos')) { otraPorReglas(); return; }
    const ex = exclusionesDe(entrada.perfiles);
    const actuales = lista.map((x) => x.r.id);
    const cands = candidatas({ ...entrada, evitar: actuales }, 15);
    const hay = entrada.hay ?? [];
    pedirIA({
      fn: 'huecos', titulo: 'Algo diferente', envia: 'los ingredientes que hay, tus exclusiones y los nombres de hasta 15 recetas',
      manual: { texto: 'Armar otro borrador sin IA', hacer: otraPorReglas },
      ejecutar: async (clave) => {
        const r = await proponerComidas(clave, {
          disponibles: hay.map((h) => h.n), urgentes: hay.filter((h) => h.urgente).map((h) => h.n), exclusiones: textoExclusiones(ex),
          candidatas: cands.map((c) => ({ id: c.id, n: c.n })), tiempos: [...new Set(lista.map((x) => TIEMPO_IA[x.l]))]
        }, (c) => {
          const rec = porId[c.receta_id];
          return rec ? descartar({ nombre: rec.n, ingredientes: rec.ing.map((i) => i[2]), textos: [c.adaptacion ?? '', ...c.usa, ...c.falta] }, ex) : 'no es una candidata';
        });
        // Cada idea va al siguiente lugar de su tiempo que todavía no cambió.
        const tomados: number[] = [];
        const asignadas = r.comidas.flatMap((c) => {
          const i = lista.findIndex((x, j) => TIEMPO_IA[x.l] === c.tiempo && !tomados.includes(j));
          if (i < 0) return [];
          tomados.push(i);
          return [{ i, c }];
        });
        if (!asignadas.length) throw new Error('sin lugar');
        const aplicar = ({ i, c }: { i: number; c: ComidaIA }) => poner(i, porId[c.receta_id], { ia: true, usa: c.usa, falta: c.falta, motivo: 'variar', ...(c.adaptacion ? { nota: 'Adaptación sugerida por IA: ' + c.adaptacion } : {}) });
        const intro = r.nota || 'Estas ideas usan solo tus recetas y respetan lo que no comen. Elige cuáles quieres en el borrador.';
        return {
          intro,
          items: asignadas.map((a) => ({
            t: porId[a.c.receta_id].n, sub: etiquetaFecha(lista[a.i].f) + ' · ' + NOMBRE_LUGAR[lista[a.i].l] + (a.c.usa.length ? ' · usa: ' + a.c.usa.join(', ') : '') + (a.c.falta.length ? ' · te falta: ' + a.c.falta.join(', ') : '') + (a.c.adaptacion ? ' · ' + a.c.adaptacion : ''),
            act: 'Usar en el borrador', aplicar: () => { contarSugerencia('menu-ia', true); aplicar(a); }
          })),
          todos: { act: 'Usar todas', aplicar: () => { contarSugerencia('menu-ia', true); for (const a of asignadas) aplicar(a); } }
        };
      }
    });
  }

  async function usar() {
    if (!lista.length) return;
    const filas = lista.map((p) => itemDos(p.f, p.l, p.r, p.nota));
    contarSugerencia('menu', true);
    await alUsar(filas);
  }
  async function agregarFalta(i: number) {
    await faltaALista?.(lista[i].falta);
  }
  const faltas = $derived([...new Set(lista.flatMap((p) => p.falta))]);
  async function agregarTodas() { await faltaALista?.(faltas); }
</script>

<div class="bd">
  {#if lista.length}
    <ul class="bd-list">
      {#each lista as p, i (p.f + p.l)}
        <li class="bd-it">
          <small>{etiquetaFecha(p.f)} · {NOMBRE_LUGAR[p.l]}</small>
          <b>{p.r.n}</b>
          <span class="bd-why">{p.ia ? 'Sugerido por IA' : MOTIVO_TXT[p.motivo]}</span>
          {#if p.usa.length}<span class="bd-us">Usa: {p.usa.join(', ')}</span>{/if}
          {#if p.falta.length}<span class="bd-us">Te falta: {p.falta.join(', ')}</span>{/if}
          {#if p.nota}<span class="bd-us">{p.nota}</span>{/if}
          <span class="bd-acts">
            <button class="ai-btn" onclick={() => cambiar(i)} aria-label={'Cambiar ' + NOMBRE_LUGAR[p.l].toLowerCase() + ' del ' + etiquetaFecha(p.f)}>Cambiar</button>
            <button class="ai-btn" onclick={() => quitar(i)} aria-label={'Quitar ' + NOMBRE_LUGAR[p.l].toLowerCase() + ' del ' + etiquetaFecha(p.f)}>Quitar</button>
            {#if faltaALista && p.falta.length}<button class="ai-btn" onclick={() => agregarFalta(i)} aria-label={'Agregar a la lista lo que falta para ' + p.r.n}>Agregar a la lista</button>{/if}
          </span>
        </li>
      {/each}
    </ul>
    <button class="start" onclick={usar}>{accion}</button>
    {#if faltaALista && faltas.length}<button class="ghost" onclick={agregarTodas}>Agregar a la lista lo que falta ({faltas.length})</button>{/if}
    <button class="ghost" onclick={diferente}>{textoIA}{iaLista('huecos') ? ' con IA' : ''}</button>
    <p class="seg-help">Es un borrador: nada cambia en tu menú hasta que lo uses. Solo llena lugares libres.</p>
  {:else}
    <p class="seg-help">No encontré recetas para llenar esos lugares. Prueba con otros días o tiempos, o quita el límite de tiempo.</p>
  {/if}
</div>
