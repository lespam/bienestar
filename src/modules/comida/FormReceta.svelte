<script lang="ts">
  import { untrack } from 'svelte';
  import type { Receta } from '../../core/db';
  import Hoja from '../../core/Hoja.svelte';
  import { avisos } from '../../core/aviso.svelte';
  import { leerIngrediente, leerReceta, lineaIng, type Borrador } from './calculos';
  import { numerosVisibles } from './estado.svelte';
  import { reducirFoto } from '../../core/imagen';
  import { aBase64, AnfitrionIA, iaLista, leerRecetaDeFoto, pedirIA } from '../ia';

  // Agregar o editar una receta. Pegar separa el texto en partes; siempre revisas antes de guardar.
  // La pestaña Foto lee con IA (opcional, con tu propia clave): siempre revisas antes de guardar.
  let { receta, alGuardar }: { receta: Receta | null; alGuardar: (r: Receta, nueva: boolean) => void } = $props();

  type Pestaña = 'foto' | 'pegar' | 'escribir';
  // Los campos se llenan una sola vez con la receta que llega.
  const inicial = untrack(() => receta);
  const edita = inicial != null;
  let pestaña = $state<Pestaña>(edita ? 'escribir' : 'pegar');
  let texto = $state('');
  let pegada = $state(false);
  let leidaIA = $state(false);
  let foto = $state<File | null>(null);
  let fotoUrl = $state('');
  let nombre = $state(inicial?.n ?? '');
  let cat = $state<Receta['cat']>(inicial?.cat ?? 'Comida');
  let rinde = $state<string | number>(inicial ? String(inicial.y) : '');
  let tiempo = $state(inicial?.t ?? '');
  let ing = $state(inicial ? inicial.ing.map(lineaIng).join('\n') : '');
  let pasos = $state(inicial ? inicial.steps.join('\n') : '');
  let nums = $state<Record<'k' | 'p' | 'c' | 'g', string | number>>({ k: txt(inicial?.k), p: txt(inicial?.p), c: txt(inicial?.c), g: txt(inicial?.g) });
  const ver = numerosVisibles();
  let contenedor: HTMLElement | undefined = $state();

  function txt(v: number | null | undefined) { return v == null ? '' : String(v); }
  const num = (t: string | number | null | undefined) => { const s = String(t ?? '').trim(); return s === '' ? null : Number(s.replace(',', '.')); };
  const lineas = (t: string) => t.split('\n').map((x) => x.trim()).filter(Boolean);

  function llenar(d: Borrador) {
    nombre = d.n; cat = d.cat; rinde = d.y === '' ? '' : String(d.y); tiempo = d.t;
    ing = d.ing.map(lineaIng).join('\n'); pasos = d.steps.join('\n');
    nums = { k: txt(d.k), p: txt(d.p), c: txt(d.c), g: txt(d.g) };
  }
  const EJEMPLO = '# Enfrijoladas de pollo\nRinde: 4 porciones · 35 min\n\nIngredientes:\n- 400 g de pechuga de pollo cocida\n- 2 tazas de frijoles negros cocidos\n- 12 tortillas de maíz\n- 100 g de queso fresco\n- ½ cebolla\n- 1 chile chipotle\n\nPreparación:\n1. Licúa los frijoles con el chipotle y un poco de su caldo.\n2. Calienta la salsa en una olla.\n3. Pasa las tortillas por la salsa y rellénalas con el pollo.\n4. Sirve con el queso y la cebolla.\n\nPor porción: 500 kcal · proteína 45 g · carbohidratos 50 g · grasa 12 g';

  function elegirFoto(e: Event) {
    const input = e.currentTarget as HTMLInputElement;
    const f = input.files?.[0];
    input.value = '';
    if (!f) return;
    if (fotoUrl) URL.revokeObjectURL(fotoUrl);
    foto = f; fotoUrl = URL.createObjectURL(f);
  }
  function otraFoto() { if (fotoUrl) URL.revokeObjectURL(fotoUrl); foto = null; fotoUrl = ''; }
  function leerConIA() {
    const f = foto;
    if (!f) return;
    pedirIA({
      fn: 'foto', titulo: 'Leer la receta', envia: 'la imagen de la receta',
      manual: { texto: 'Pegar o escribir la receta', hacer: () => (pestaña = 'pegar') },
      ejecutar: async (clave) => {
        const b = await reducirFoto(f, 1600);
        const tipo = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(b.type) ? b.type : 'image/jpeg';
        const d = await leerRecetaDeFoto(clave, { tipo, base64: await aBase64(b) });
        nombre = d.n; cat = d.cat; rinde = String(d.y); tiempo = d.t;
        ing = d.ing.join('\n'); pasos = d.steps.join('\n');
        nums = { k: txt(d.k), p: txt(d.p), c: txt(d.c), g: txt(d.g) };
        leidaIA = true; pegada = false; pestaña = 'escribir';
        return { intro: '', items: [], cerrar: true };
      }
    });
  }
  function separar() {
    if (!texto.trim()) { document.getElementById('rs-text')?.focus(); avisos.mostrar('Pega una receta o usa el ejemplo'); return; }
    llenar(leerReceta(texto));
    pegada = true;
    pestaña = 'escribir';
    contenedor?.closest('.sheet')?.scrollTo(0, 0);
  }
  function guardar() {
    const n = nombre.trim();
    if (!n) { document.getElementById('rs-name')?.focus(); avisos.mostrar('Escribe el nombre de la receta'); return; }
    const base: Receta = inicial ? structuredClone($state.snapshot(inicial)) as Receta : { id: 'r' + Date.now(), n, cat, y: 1, t: '', src: leidaIA ? 'Leída con IA de una foto · revísala' : pegada ? 'Pegada de tus documentos' : '', u1: '', k: null, p: null, c: null, g: null, ing: [], steps: [], sw: [] };
    if (inicial) { base.img = inicial.img; base.page = inicial.page; }
    const nueva: Receta = {
      ...base, n, cat, y: Math.max(1, Math.round(num(rinde) || 1)), t: tiempo.trim(),
      ing: lineas(ing).map((l) => leerIngrediente(l)).filter((x) => x != null),
      steps: lineas(pasos).map((x) => x.replace(/^\d+\s*[.)-]?\s*/, '')),
      // Si los números están ocultos, lo que la receta ya traía se conserva.
      ...(ver ? { k: num(nums.k), p: num(nums.p), c: num(nums.c), g: num(nums.g) } : inicial ? {} : { k: num(nums.k), p: num(nums.p), c: num(nums.c), g: num(nums.g) })
    };
    alGuardar(nueva, !edita);
  }
</script>

<Hoja titulo={edita ? 'Editar receta' : 'Agregar receta'}>
  <div bind:this={contenedor}>
    {#if !edita}
      <div class="seg" role="tablist" aria-label="Cómo agregarla">
        {#if iaLista('foto')}<button class:on={pestaña === 'foto'} role="tab" aria-selected={pestaña === 'foto'} onclick={() => (pestaña = 'foto')}>Foto</button>{/if}
        <button class:on={pestaña === 'pegar'} role="tab" aria-selected={pestaña === 'pegar'} onclick={() => (pestaña = 'pegar')}>Pegar</button>
        <button class:on={pestaña === 'escribir'} role="tab" aria-selected={pestaña === 'escribir'} onclick={() => (pestaña = 'escribir')}>Escribir</button>
      </div>
    {/if}

    {#if pestaña === 'foto'}
      <div class="man">
        {#if !foto}
          <div class="to-pick">
            <label><svg aria-hidden="true" focusable="false" viewBox="0 0 24 24"><path d="M4 8h3l2-3h6l2 3h3v11H4z" /><circle cx="12" cy="13" r="3.5" /></svg>Tomar foto<input type="file" accept="image/*" capture="environment" onchange={elegirFoto} /></label>
            <label><svg aria-hidden="true" focusable="false" viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="16" rx="3" /><circle cx="9" cy="10" r="2" /><path d="M21 16l-5-5-8 8" /></svg>Elegir de la galería<input type="file" accept="image/*" onchange={elegirFoto} /></label>
          </div>
        {:else}
          <div class="rs-prev"><img src={fotoUrl} alt="Foto de tu receta" /><button class="link-btn" onclick={otraFoto}>Tomar otra foto</button></div>
        {/if}
        <p class="tool-note left">Toma la foto de una receta escrita: de tu libro, tus notas o una captura. La foto se envía a Anthropic para leerla, con tu clave de IA. La app separa el nombre, los ingredientes y los pasos. Antes de guardar, tú revisas todo.</p>
        <button class="start" disabled={!foto} onclick={leerConIA}>Leer la receta</button>
        <button class="ghost" onclick={() => (pestaña = 'pegar')}>Pegar o escribir la receta</button>
      </div>
    {:else if pestaña === 'pegar'}
      <div class="man">
        <label for="rs-text">Pega tu receta</label>
        <textarea id="rs-text" rows="8" placeholder="Cópiala de Obsidian, de tus notas o de un documento, con su nombre, ingredientes y pasos." bind:value={texto}></textarea>
        <button class="link-btn" onclick={() => (texto = EJEMPLO)}>Usar una receta de ejemplo</button>
        <p class="tool-note left">La app separa el nombre, las porciones, los ingredientes y los pasos. Si la receta trae calorías o macros, también los lee. Antes de guardar, revisas todo.</p>
        <button class="start" onclick={separar}>Separar en partes</button>
      </div>
    {:else}
      <div class="man">
        {#if leidaIA}<p class="rs-ok" role="status">Leída con IA. Revisa cada parte y cambia lo que haga falta.</p>{:else if pegada}<p class="rs-ok">Listo. Revisa cada parte y cambia lo que haga falta.</p>{/if}
        <label for="rs-name">Nombre</label><input id="rs-name" type="text" placeholder="Ej. Tinga de pollo" bind:value={nombre} />
        <span class="sh-lbl">Tipo</span>
        <div class="m-chips" role="radiogroup" aria-label="Tipo de comida">
          {#each ['Desayuno', 'Comida', 'Cena', 'Colación'] as c (c)}<button class:on={cat === c} role="radio" aria-checked={cat === c} onclick={() => (cat = c as Receta['cat'])}>{c}</button>{/each}
        </div>
        <div class="rs-2">
          <span><label for="rs-y">Rinde (porciones)</label><input id="rs-y" type="number" inputmode="numeric" min="1" bind:value={rinde} /></span>
          <span><label for="rs-t">Tiempo (opcional)</label><input id="rs-t" type="text" placeholder="Ej. 40 min" bind:value={tiempo} /></span>
        </div>
        <label for="rs-ing">Ingredientes, uno por línea</label>
        <textarea id="rs-ing" rows="6" placeholder="Ej. 500 g de pechuga de pollo" bind:value={ing}></textarea>
        <label for="rs-steps">Pasos, uno por línea</label>
        <textarea id="rs-steps" rows="5" placeholder="Ej. Cuece el pollo y deshébralo." bind:value={pasos}></textarea>
        {#if ver}
          <div class="man">
            <span class="sh-lbl">Por porción, aprox. (opcional)</span>
            <div class="man4">
              <span><label for="rs-k">kcal</label><input id="rs-k" type="number" inputmode="numeric" bind:value={nums.k} /></span>
              <span><label for="rs-p">Prot g</label><input id="rs-p" type="number" inputmode="decimal" bind:value={nums.p} /></span>
              <span><label for="rs-c">Carb g</label><input id="rs-c" type="number" inputmode="decimal" bind:value={nums.c} /></span>
              <span><label for="rs-g">Grasa g</label><input id="rs-g" type="number" inputmode="decimal" bind:value={nums.g} /></span>
            </div>
            <p class="tool-note left">Puedes dejarlos vacíos.</p>
          </div>
        {:else}
          <p class="tool-note left">Los números están ocultos. Si la receta los trae, se guardan igual.</p>
        {/if}
        <button class="start" onclick={guardar}>{edita ? 'Guardar cambios' : 'Guardar receta'}</button>
      </div>
    {/if}
  </div>
</Hoja>
<AnfitrionIA />
