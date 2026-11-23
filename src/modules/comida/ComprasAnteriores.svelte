<script lang="ts">
  import { onDestroy } from 'svelte';
  import Hoja from '../../core/Hoja.svelte';
  import { reducirFoto } from '../../core/imagen';
  import { avisos } from '../../core/aviso.svelte';
  import { nav } from '../../core/nav.svelte';
  import { aBase64, iaLista, leerTicket, pedirIA, unirNombres } from '../ia';
  import { fechaDe, norm } from './calculos';
  import { guardarCompraAnterior, guardarUnidos, leerUnidos, quitarComprasAnotadas } from './datos';
  import { leerLineas, nombreUnido, unir, yaSeUne, type Articulo } from './articulos';
  import { cortoLugar, type DatosLugares } from './lugares';

  // Compras de antes: un ticket, una captura de un pedido o lo que escribes. Se revisa todo antes de guardar.
  // Sin IA se escribe a mano. Con IA y tu clave se lee la foto; los nombres que ya se unieron no se vuelven a preguntar.
  let { lugares, alTerminar }: { lugares: DatosLugares; alTerminar?: () => void } = $props();

  interface Fila { id: number; incluir: boolean; crudo: string; n: string; q: string; precio: string }
  let filas = $state<Fila[]>([]);
  let siguiente = 1;
  let fecha = $state(fechaDe(0));
  let lugar = $state('');
  let texto = $state('');
  let unidos = $state<Record<string, string>>({});
  leerUnidos().then((u) => (unidos = u));

  const hoy = fechaDe(0);
  function aFilas(arts: Articulo[]): Fila[] {
    return arts.map((a) => ({ id: siguiente++, incluir: true, crudo: a.crudo, n: a.n, q: a.q ?? '', precio: a.precio != null ? String(a.precio) : '' }));
  }
  function revisarTexto() {
    const arts = unir(leerLineas(texto), unidos);
    if (!arts.length) { avisos.mostrar('Escribe una compra por línea. Por ejemplo: Leche 2 L $38'); document.getElementById('ca-txt')?.focus(); return; }
    filas = [...filas, ...aFilas(arts)];
    texto = '';
  }

  // ---------- Foto de un ticket o de una captura ----------
  let foto = $state<{ blob: Blob; url: string } | null>(null);
  async function elegirFoto(e: Event) {
    const input = e.target as HTMLInputElement, a = input.files?.[0];
    input.value = '';
    if (!a) return;
    if (foto) URL.revokeObjectURL(foto.url);
    const blob = await reducirFoto(a, 1400);
    foto = { blob, url: URL.createObjectURL(blob) };
  }
  function quitarFoto() { if (foto) URL.revokeObjectURL(foto.url); foto = null; }
  onDestroy(() => { if (foto) URL.revokeObjectURL(foto.url); });
  function leerFoto() {
    if (!foto) return;
    const blob = foto.blob;
    pedirIA({
      fn: 'ticket', titulo: 'Leer el ticket', envia: 'la foto reducida y los nombres de los artículos que aún no se reconocen',
      manual: { texto: 'Escribirlo a mano', hacer: () => document.getElementById('ca-txt')?.focus() },
      ejecutar: async (clave) => {
        const img = { tipo: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(blob.type) ? blob.type : 'image/jpeg', base64: await aBase64(blob) };
        const leido = await leerTicket(clave, img);
        // Solo lo que no se sabe unir se le pregunta a la IA, una sola vez.
        const nuevos = [...new Set(leido.items.map((i) => i.n).filter((n) => !yaSeUne(n, unidos)))];
        let propuestos: Record<string, string> = {};
        if (nuevos.length) { try { propuestos = await unirNombres(clave, nuevos); } catch { propuestos = {}; } }
        const conocidos = { ...unidos, ...Object.fromEntries(Object.entries(propuestos).map(([k, v]) => [norm(k), v])) };
        const arts: Articulo[] = leido.items.map((i) => ({ crudo: i.n, n: nombreUnido(i.n, conocidos), ...(i.q ? { q: i.q } : {}), ...(i.precio != null ? { precio: i.precio } : {}) }));
        const agrega = (as: Articulo[]) => {
          filas = [...filas, ...aFilas(as)];
          if (leido.fecha && leido.fecha <= hoy) fecha = leido.fecha;
        };
        return {
          intro: 'Esto leí del ticket' + (leido.lugar ? ' de ' + leido.lugar : '') + '. Lo revisas y corriges abajo antes de guardar.',
          items: arts.map((a) => ({ t: a.n + (a.q ? ' · ' + a.q : '') + (a.precio != null ? ' · $' + a.precio : ''), act: 'Agregar', aplicar: () => agrega([a]) })),
          todos: { act: 'Agregar todo', aplicar: () => agrega(arts) }
        };
      }
    });
  }

  // ---------- Revisar y guardar ----------
  const elegidas = $derived(filas.filter((f) => f.incluir && f.n.trim()));
  const precioDe = (t: string) => { const v = Number(t.replace(',', '.').replace(/[^0-9.]/g, '')); return t.trim() && Number.isFinite(v) ? v : undefined; };
  async function guardar() {
    if (!elegidas.length) { avisos.mostrar('Marca al menos un artículo'); return; }
    if (fecha > hoy) { avisos.mostrar('La fecha no puede ser de mañana'); return; }
    const aGuardar = elegidas.map((f) => ({ n: f.n.trim(), crudo: f.crudo, q: f.q.trim() || undefined, precio: precioDe(f.precio) }));
    // Lo que corregiste queda como nombre unido: la próxima vez no se pregunta.
    const nuevos: Record<string, string> = {};
    for (const a of aGuardar) if (a.crudo && !yaSeUne(a.crudo, unidos) && a.crudo.toLowerCase() !== a.n.toLowerCase()) nuevos[norm(a.crudo)] = a.n;
    const ids = await guardarCompraAnterior(aGuardar.map((a) => ({ n: a.n, fecha, ...(lugar ? { lugar } : {}), ...(a.q ? { q: a.q } : {}), ...(a.precio != null ? { precio: a.precio } : {}) })));
    if (Object.keys(nuevos).length) { await guardarUnidos(nuevos); unidos = { ...unidos, ...nuevos }; }
    filas = [];
    quitarFoto();
    alTerminar?.();
    nav.cerrar();
    avisos.deshacer(ids.length ? 'Guardé ' + ids.length + (ids.length === 1 ? ' compra' : ' compras') + ' en tu historial' : 'Esas compras ya estaban en tu historial', async () => { await quitarComprasAnotadas(ids); alTerminar?.(); });
  }
</script>

{#if nav.hojaAbierta('cp-hist')}
  <Hoja titulo="Compras de antes">
    <p class="seg-help">Con tus compras anteriores la app aprende cada cuánto compras algo y te avisa cuándo ya toca. Es solo información.</p>
    <div class="man">
      <label for="ca-f">Fecha de la compra</label>
      <input id="ca-f" type="date" max={hoy} bind:value={fecha} />
    </div>
    <span class="sh-lbl" id="ca-l">Dónde (opcional)</span>
    <div class="m-chips" role="radiogroup" aria-labelledby="ca-l">
      <button role="radio" class:on={lugar === ''} aria-checked={lugar === ''} onclick={() => (lugar = '')}>No importa</button>
      {#each lugares.lista as l (l.id)}<button role="radio" class:on={lugar === l.id} aria-checked={lugar === l.id} onclick={() => (lugar = l.id)}>{cortoLugar(l.n)}</button>{/each}
    </div>

    <div class="man">
      <label for="ca-txt">Escríbelas, una por línea</label>
      <textarea id="ca-txt" rows="4" placeholder="Ej. Leche 2 L $38" bind:value={texto}></textarea>
    </div>
    <button class="ghost" onclick={revisarTexto}>Revisar lo que escribí</button>

    <b id="ca-ft">O usa la foto de un ticket o una captura de tu pedido</b>
    <div class="to-pick" role="group" aria-labelledby="ca-ft">
      <label><svg aria-hidden="true" focusable="false" viewBox="0 0 24 24"><path d="M21 12l-8.5 8.5a5 5 0 0 1-7-7L14 5a3.5 3.5 0 0 1 5 5l-8.5 8.5a2 2 0 0 1-3-3L15 8" /></svg>Adjuntar foto<input type="file" accept="image/*" onchange={elegirFoto} /></label>
    </div>
    {#if foto}
      <div class="rs-prev"><img src={foto.url} alt="Tu ticket o captura" /><button class="link-btn" onclick={quitarFoto}>Quitar la foto</button></div>
      {#if iaLista('ticket')}
        <button class="ghost" onclick={leerFoto}>Leer la foto con IA</button>
        <p class="seg-help">Se envía la foto reducida. Si trae datos tuyos, como tarjeta o dirección, tápalos antes.</p>
      {:else}
        <p class="seg-help">Leer la foto necesita la IA con tu clave (Ajustes). Mientras, escribe los artículos arriba.</p>
      {/if}
    {/if}

    {#if filas.length}
      <span class="sh-lbl">Revisa antes de guardar</span>
      <div class="ca-lista">
        {#each filas as f (f.id)}
          <div class="ca-fila">
            <label class="cp-chk"><input type="checkbox" bind:checked={f.incluir} aria-label={'Guardar ' + f.n} /></label>
            <div class="ca-campos">
              <input type="text" aria-label={'Nombre de ' + (f.crudo || f.n)} bind:value={f.n} maxlength="80" />
              <input type="text" aria-label={'Cantidad de ' + (f.crudo || f.n)} placeholder="Cantidad" bind:value={f.q} maxlength="40" />
              <input type="text" inputmode="decimal" aria-label={'Precio de ' + (f.crudo || f.n)} placeholder="Precio" bind:value={f.precio} maxlength="10" />
            </div>
          </div>
        {/each}
      </div>
      <button class="start" onclick={guardar}>Guardar {elegidas.length === 1 ? '1 compra' : elegidas.length + ' compras'}</button>
      <p class="seg-help">Los nombres que corrijas se recuerdan: la próxima vez «{filas[0].crudo || filas[0].n}» se une solo.</p>
    {/if}
  </Hoja>
{/if}
