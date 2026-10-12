<script lang="ts">
  import Hoja from '../../core/Hoja.svelte';
  import { nav } from '../../core/nav.svelte';
  import { ErrorIA } from './api';
  import { cargarIA, FUNCIONES, ia, leerClave, marcarAvisada, NUNCA_SE_ENVIA } from './estado.svelte';
  import { pedido, type ItemIA, type PedidoIA } from './pedir.svelte';

  // Una sola hoja para toda la ayuda con IA: avisa qué se envía, deja cancelar, muestra la respuesta para revisar.
  const p = pedido.actual as PedidoIA;
  type Fase = 'revisando' | 'apagada' | 'internet' | 'aviso' | 'pensando' | 'listo' | 'error';
  let fase = $state<Fase>('revisando');
  let intro = $state('');
  let items = $state<ItemIA[]>([]);
  let todos = $state<{ act: string; aplicar: () => void | Promise<void> } | undefined>();
  let falla = $state('');
  let vivo = true;
  $effect(() => () => { vivo = false; });

  const esFoto = p.fn === 'foto';
  const MENSAJE: Record<string, string> = {
    internet: 'Sin internet. La IA no está disponible ahora y no se perdió nada.',
    clave: 'Anthropic no aceptó tu clave. Revisa que esté bien escrita en Ajustes.',
    limite: 'Anthropic pide esperar un momento o revisar el límite de tu cuenta. Intenta de nuevo más tarde.',
    otro: 'No pude obtener una respuesta. No se perdió nada. Puedes intentarlo otra vez o hacerlo a mano.'
  };
  const aviso = $derived(p.envia ?? FUNCIONES[p.fn][1]);
  const porque = $derived(!ia.on ? 'La IA está apagada. Puedes activarla en Ajustes con tu propia clave.' : !ia.tieneClave ? 'Falta tu clave de Anthropic. Se guarda solo en este teléfono.' : 'Esta ayuda está apagada en Ajustes.');
  const anuncio = $derived(fase === 'pensando' ? (esFoto ? 'Leyendo la receta…' : 'Pensando…') : fase === 'listo' && items.length ? 'Respuesta lista. Revísala antes de usarla.' : fase === 'listo' ? intro : fase === 'error' ? falla : fase === 'apagada' ? porque : fase === 'internet' ? MENSAJE.internet : '');

  (async () => {
    await cargarIA();
    if (!vivo) return;
    if (!ia.on || !ia.tieneClave || !ia.fn[p.fn]) { fase = 'apagada'; return; }
    if (typeof navigator !== 'undefined' && navigator.onLine === false) { fase = 'internet'; return; }
    if (!ia.vistas[p.fn]) { fase = 'aviso'; return; }
    enviar();
  })();

  async function enviar() {
    fase = 'pensando';
    await marcarAvisada(p.fn);
    try {
      const r = await p.ejecutar(await leerClave());
      if (!vivo) return;
      if (r.cerrar) { nav.cerrar(); return; }
      intro = r.intro; items = r.items; todos = r.todos; fase = 'listo';
    } catch (e) {
      if (!vivo) return;
      const t = e instanceof ErrorIA ? e.tipo : 'otro';
      falla = MENSAJE[t]; fase = t === 'internet' ? 'internet' : 'error';
    }
  }
  async function aplicar(i: ItemIA) {
    await i.aplicar?.();
    quitar(i);
  }
  async function aplicarTodos() {
    await todos?.aplicar();
    nav.cerrar();
  }
  function quitar(i: ItemIA) {
    items = items.filter((x) => x !== i);
    if (!items.length) nav.cerrar();
  }
  function manual() { nav.cerrar(); p.manual?.hacer(); }
  function ajustes() { nav.cerrar(); nav.abrir('ajustes'); }
</script>

<Hoja titulo={p.titulo}>
  <div class="sr-only" role="status" aria-live="polite">{anuncio}</div>
  <div class="ai-body">
    {#if fase === 'apagada'}
      <p>{porque}</p>
      <p class="ai-sm">Mientras tanto, la app funciona igual: puedes hacerlo a mano.</p>
      <button class="start" onclick={ajustes}>Ir a Ajustes</button>
      {#if p.manual}<button class="ghost" onclick={manual}>{p.manual.texto}</button>{/if}
    {:else if fase === 'internet'}
      <p>{MENSAJE.internet}</p>
      {#if p.manual}<button class="ghost" onclick={manual}>{p.manual.texto}</button>{/if}
      <button class="ghost" onclick={() => nav.cerrar()}>Cerrar</button>
    {:else if fase === 'aviso'}
      <p><b>Esto se envía a Anthropic:</b> {aviso}.</p>
      <p class="ai-sm">{NUNCA_SE_ENVIA} Puedes cambiarlo en Ajustes.</p>
      <button class="start" onclick={enviar}>Enviar</button>
      <button class="ghost" onclick={() => nav.cerrar()}>Cancelar</button>
    {:else if fase === 'pensando'}
      <p>{esFoto ? 'Leyendo la receta…' : 'Pensando…'}</p>
    {:else if fase === 'error'}
      <p>{falla}</p>
      <button class="start" onclick={enviar}>Intentar otra vez</button>
      {#if p.manual}<button class="ghost" onclick={manual}>{p.manual.texto}</button>{/if}
    {:else if fase === 'listo'}
      <p>{intro}</p>
      {#if todos && items.length > 1}<button class="start" onclick={aplicarTodos}>{todos.act}</button>{/if}
      {#each items as it, i (i)}
        <div class="ai-it">
          <b>{it.t}</b>{#if it.sub}<small>{it.sub}</small>{/if}
          <span class="ai-tag">Sugerido por IA</span>
          <div class="ai-acts">
            {#if it.act}<button class="ai-btn" onclick={() => aplicar(it)}>{it.act}</button>{/if}
            <button class="ai-btn" onclick={() => quitar(it)}>Descartar</button>
          </div>
        </div>
      {/each}
      {#if items.length}<p class="ai-sm">Son ideas para que decidas tú, no consejos médicos ni de dieta. Revisa antes de usar.</p>{/if}
      {#if !items.length}<button class="ghost" onclick={() => nav.cerrar()}>Cerrar</button>{/if}
    {:else}
      <p>Revisando…</p>
    {/if}
  </div>
</Hoja>
