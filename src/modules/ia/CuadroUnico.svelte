<script lang="ts">
  import { avisos } from '../../core/aviso.svelte';
  import { contarFuncion } from '../../core/uso';
  import { ejecutar, entender, entenderConIA, intenciones, type Entendido, type Resultado } from './cuadro';
  import { iaLista } from './estado.svelte';
  import { pedirIA } from './pedir.svelte';
  import { escuchar, hayVoz } from './voz';

  // Un solo lugar para decir lo que quieres hacer. Las reglas entienden casi todo sin IA; siempre confirmas antes de guardar.
  let texto = $state('');
  let propuesta = $state<Entendido[] | null>(null);
  let sinEntender = $state(false);
  let trabajando = $state(false);
  let oyendo = $state(false);
  let problemaVoz = $state('');
  let detener: (() => void) | null = null;
  const voz = hayVoz();
  const NOTA_VOZ = 'El navegador procesa el audio (en Chrome de Android, Google). La app no lo guarda.';

  async function enviar() {
    const t = texto.trim();
    if (!t) { avisos.mostrar('Escribe o di lo que quieres hacer'); document.getElementById('cj-t')?.focus(); return; }
    trabajando = true; sinEntender = false; propuesta = null;
    const es = await entender(t);
    trabajando = false;
    if (es.length) propuesta = es; else sinEntender = true;
  }
  function corregir() { propuesta = null; sinEntender = false; document.getElementById('cj-t')?.focus(); }
  const unir = (rs: (Resultado | void)[]) => {
    const avisosTxt = rs.map((r) => r?.aviso).filter(Boolean) as string[];
    const deshacer = rs.map((r) => r?.deshacer).filter(Boolean) as (() => void | Promise<void>)[];
    return { texto: avisosTxt.join(' · ') || 'Listo', deshacer: deshacer.length ? async () => { for (const d of deshacer.reverse()) await d(); } : null };
  };
  async function confirmar(es: Entendido[]) {
    const rs: (Resultado | void)[] = [];
    propuesta = null; sinEntender = false;
    for (const e of es) rs.push(await ejecutar(e));
    contarFuncion('cuadro');
    texto = '';
    const u = unir(rs);
    if (u.deshacer) avisos.deshacer(u.texto, u.deshacer); else avisos.mostrar(u.texto);
  }
  function ayudaIA() {
    const frase = texto.trim();
    pedirIA({
      fn: 'caja', titulo: 'Entender tu frase', envia: 'solo la frase que escribiste y la lista de acciones de la app',
      manual: { texto: 'Corregir mi frase', hacer: corregir },
      ejecutar: async (clave) => {
        const es = await entenderConIA(clave, frase);
        if (!es.length) throw new Error('sin acción');
        return { intro: 'Esto fue lo que entendí de tu frase. Nada se guarda hasta que lo confirmes.', items: es.map((e) => ({ t: e.resumen, act: 'Confirmar', aplicar: () => confirmar([e]) })) };
      }
    });
  }

  function hablar() {
    if (oyendo) { detener?.(); return; }
    problemaVoz = ''; oyendo = true; sinEntender = false; propuesta = null;
    detener = escuchar((t, final) => { texto = t; if (final) detener = null; }, (p) => {
      oyendo = false; detener = null;
      if (p) problemaVoz = p;
      else if (texto.trim()) void enviar();
    });
  }
  const ejemplos = $derived(intenciones().flatMap((i) => i.ejemplos.slice(0, 1)).slice(0, 3));
</script>

<section class="cj" aria-label="Escribe o di lo que quieres hacer">
  <label class="cj-l" for="cj-t">¿Qué quieres hacer?</label>
  <div class="cj-row">
    <input id="cj-t" type="text" autocomplete="off" enterkeyhint="send" placeholder={ejemplos[0] ? 'Ej. ' + ejemplos[0] : 'Escribe o di lo que quieres hacer'} bind:value={texto} oninput={() => { propuesta = null; sinEntender = false; }} onkeydown={(e) => { if (e.key === 'Enter') { e.preventDefault(); void enviar(); } }} />
    {#if voz}<button class="cj-mic" class:on={oyendo} aria-pressed={oyendo} aria-describedby="cj-voz-nota" aria-label={oyendo ? 'Dejar de escuchar' : 'Hablar'} onclick={hablar}>{oyendo ? 'Escuchando…' : 'Hablar'}</button>{/if}
    <button class="cj-go" onclick={enviar} disabled={trabajando}>Enviar</button>
  </div>
  <div class="cj-live" role="status" aria-live="polite">
  {#if oyendo}<p class="cj-sm">Escuchando… {NOTA_VOZ}</p>{/if}
  {#if problemaVoz}<p class="cj-sm">{problemaVoz}</p>{/if}
  {#if propuesta}
    <div class="cj-ok">
      <b>Entendí:</b>
      {#each propuesta as p, i (i)}
        {#if p.opciones}
          <p>{p.resumen}</p>
          <div class="cj-opc">{#each p.opciones as o, j (j)}<button class="ghost" onclick={() => confirmar([o])}>{o.resumen}</button>{/each}</div>
        {:else}<p>{p.resumen}</p>{/if}
      {/each}
      <div class="cj-two">
        {#if !propuesta.some((p) => p.opciones)}<button class="start" onclick={() => confirmar(propuesta ?? [])}>Confirmar</button>{/if}
        <button class="ghost" onclick={corregir}>Corregir</button>
      </div>
    </div>
  {:else if sinEntender}
    <div class="cj-ok">
      <p>No entendí esa frase con mis reglas. Puedes corregirla o probar con algo como: {intenciones().flatMap((i) => i.ejemplos.slice(0, 1)).slice(0, 3).map((e) => '«' + e + '»').join(', ')}.</p>
      <div class="cj-two">
        {#if iaLista('caja')}<button class="start" onclick={ayudaIA}>Pedir ayuda a la IA</button>{/if}
        <button class="ghost" onclick={corregir}>Corregir</button>
      </div>
    </div>
  {/if}
  </div>
  {#if voz}<span id="cj-voz-nota" class="sr-only">{NOTA_VOZ}</span>{/if}
</section>
