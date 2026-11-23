<script lang="ts">
  import Hoja from '../../core/Hoja.svelte';
  import { reducirFoto } from '../../core/imagen';
  import { nav } from '../../core/nav.svelte';
  import { ErrorIA } from './api';
  import { generarImagen } from './gemini';
  import { cargarGemini, gem, leerClaveGemini, marcarGeminiAvisado, QUE_ENVIA_GEMINI } from './gemini.svelte';
  import { NUNCA_SE_ENVIA } from './estado.svelte';

  // «Generar imagen» en una receta, con tu propia clave de Gemini. Avisa qué se envía, deja cancelar y muestra la imagen
  // para que la revises: no se guarda nada hasta que tú lo decides.
  let { nombre, ingredientes, alGuardar, conFoto }: { nombre: string; ingredientes: string[]; alGuardar: (foto: Blob) => void | Promise<void>; conFoto?: () => void } = $props();

  type Fase = 'revisando' | 'apagada' | 'internet' | 'aviso' | 'pensando' | 'listo' | 'error';
  let fase = $state<Fase>('revisando');
  let falla = $state('');
  let imagen = $state<Blob | null>(null);
  let url = $state('');
  let guardando = $state(false);
  let vivo = true;
  $effect(() => () => { vivo = false; });
  $effect(() => {
    if (!imagen) { url = ''; return; }
    const u = URL.createObjectURL(imagen);
    url = u;
    return () => URL.revokeObjectURL(u);
  });

  const MENSAJE: Record<string, string> = {
    internet: 'Sin internet. Gemini no está disponible ahora y no se perdió nada.',
    clave: 'Google no aceptó tu clave de Gemini. Revisa que esté bien escrita en Ajustes.',
    limite: 'Google pide esperar un momento o revisar el límite de tu cuenta. Intenta de nuevo más tarde.',
    modelo: 'Google no encontró el modelo de imagen. Revisa su nombre en Ajustes.',
    bloqueada: 'Gemini no hizo una imagen para esta receta. Puedes intentarlo otra vez o agregar tu propia foto.',
    otro: 'No pude obtener una imagen. No se perdió nada. Puedes intentarlo otra vez o agregar tu propia foto.'
  };
  const porque = $derived(!gem.on ? 'Gemini está apagado. Puedes activarlo en Ajustes con tu propia clave de Google.' : 'Falta tu clave de Gemini. Se guarda solo en este teléfono.');
  const anuncio = $derived(fase === 'pensando' ? 'Haciendo la imagen…' : fase === 'listo' ? 'Imagen lista. Revísala antes de guardarla.' : fase === 'error' ? falla : fase === 'apagada' ? porque : fase === 'internet' ? MENSAJE.internet : '');

  (async () => {
    await cargarGemini();
    if (!vivo) return;
    if (!gem.on || !gem.tieneClave) { fase = 'apagada'; return; }
    if (typeof navigator !== 'undefined' && navigator.onLine === false) { fase = 'internet'; return; }
    if (!gem.vista) { fase = 'aviso'; return; }
    enviar();
  })();

  async function enviar() {
    fase = 'pensando';
    imagen = null;
    await marcarGeminiAvisado();
    try {
      const r = await generarImagen({ nombre, ingredientes }, await leerClaveGemini(), gem.modelo);
      if (!vivo) return;
      imagen = r; fase = 'listo';
    } catch (e) {
      if (!vivo) return;
      const m = e instanceof ErrorIA ? (e.message === 'modelo' || e.message === 'bloqueada' ? e.message : e.tipo) : 'otro';
      falla = MENSAJE[m]; fase = m === 'internet' ? 'internet' : 'error';
    }
  }
  async function guardar() {
    if (!imagen || guardando) return;
    guardando = true;
    try {
      await alGuardar(await reducirFoto(imagen, 800));
      nav.cerrar();
    } finally {
      guardando = false;
    }
  }
  function propia() { nav.cerrar(); conFoto?.(); }
  function ajustes() { nav.cerrar(); nav.abrir('ajustes'); }
</script>

<Hoja titulo="Generar imagen">
  <div class="sr-only" role="status" aria-live="polite">{anuncio}</div>
  <div class="ai-body">
    {#if fase === 'apagada'}
      <p>{porque}</p>
      <p class="ai-sm">Mientras tanto, la app funciona igual.</p>
      <button class="start" onclick={ajustes}>Ir a Ajustes</button>
      {#if conFoto}<button class="ghost" onclick={propia}>Agregar mi foto</button>{/if}
    {:else if fase === 'internet'}
      <p>{MENSAJE.internet}</p>
      {#if conFoto}<button class="ghost" onclick={propia}>Agregar mi foto</button>{/if}
      <button class="ghost" onclick={() => nav.cerrar()}>Cerrar</button>
    {:else if fase === 'aviso'}
      <p><b>Esto se envía a Google (Gemini):</b> {QUE_ENVIA_GEMINI}.</p>
      <p class="ai-sm">{NUNCA_SE_ENVIA} Puedes cambiarlo en Ajustes.</p>
      <button class="start" onclick={enviar}>Enviar</button>
      <button class="ghost" onclick={() => nav.cerrar()}>Cancelar</button>
    {:else if fase === 'pensando'}
      <p>Haciendo la imagen…</p>
    {:else if fase === 'error'}
      <p>{falla}</p>
      <button class="start" onclick={enviar}>Intentar otra vez</button>
      {#if conFoto}<button class="ghost" onclick={propia}>Agregar mi foto</button>{/if}
    {:else if fase === 'listo'}
      {#if url}<img class="gm-prev" src={url} alt={'Ilustración de ' + nombre + ', hecha con IA, para que la revises'} />{/if}
      <span class="ai-tag">Hecha con IA</span>
      <p class="ai-sm">Es una ilustración, no una foto real, y puede mostrar ingredientes que la receta no lleva. Revísala antes de guardarla.</p>
      <button class="start" onclick={guardar} disabled={guardando}>Guardar como ilustración</button>
      <button class="ghost" onclick={enviar}>Intentar otra vez</button>
      <button class="ghost" onclick={() => nav.cerrar()}>Descartar</button>
    {:else}
      <p>Revisando…</p>
    {/if}
  </div>
</Hoja>
