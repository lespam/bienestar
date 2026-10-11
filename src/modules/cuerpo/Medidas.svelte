<script lang="ts">
  import Hoja from '../../core/Hoja.svelte';
  import Interruptor from '../../core/Interruptor.svelte';
  import Numero from '../../core/Numero.svelte';
  import { nav } from '../../core/nav.svelte';
  import { avisos } from '../../core/aviso.svelte';
  import { iso } from '../../core/fechas';
  import { prefs } from '../ajustes';
  import { armarGrafica, cambio, etiquetaFecha, formatoNum, leerNumero, mismaZona, nombreDeZona, porZona, ultimas, type Medicion } from './calculos';
  import { deshacerDelDia, guardarDelDia, guardarZonas, leerZonas, todasLasMedidas, ultimoPeso, type Zonas } from './datos';
  import type { Medida, Peso } from '../../core/db';

  let zonas = $state<Zonas>({ visibles: [], conocidas: [] });
  let filas = $state<Medida[]>([]);
  let peso = $state<Peso | undefined>();
  let cargado = $state(false);
  let zona = $state('');
  let sel = $state<number | null>(null);
  let verPeso = $state(false);
  let nuevo = $state('');
  let campos = $state<Record<string, string>>({});
  let campoPeso = $state('');

  async function leer() {
    [zonas, filas, peso] = await Promise.all([leerZonas(), todasLasMedidas(), ultimoPeso()]);
    if (!zonas.visibles.some((z) => mismaZona(z, zona))) { zona = zonas.visibles[0] ?? ''; sel = null; }
    cargado = true;
  }
  leer();

  // "Ocultar números" (Comida y cuerpo) tapa las medidas. El botón del peso las muestra un momento.
  const ocultoMedidas = $derived(prefs.ocultarComida && !verPeso);
  const serie = $derived<Medicion[]>(porZona(filas, zona));
  const vista = $derived(ultimas(serie, 6));
  const grafica = $derived(armarGrafica(vista));
  const punto = $derived(sel != null && vista[sel] ? vista[sel] : vista[vista.length - 1]);
  const fechaFilas = $derived(
    zonas.visibles.map((z) => porZona(filas, z)).map((s) => s[s.length - 1]?.fecha).filter(Boolean).sort().pop()
  );

  function elegir(z: string) { zona = z; sel = null; }

  function abrirRegistro() {
    campos = {}; campoPeso = '';
    nav.abrirHoja('medidas');
  }
  async function guardarMedidas() {
    const valores: Record<string, number> = {};
    for (const z of zonas.visibles) {
      const n = leerNumero(campos[z] ?? '', 0, 300);
      if (n != null) valores[z] = n;
    }
    const p = leerNumero(campoPeso, 0, 600);
    const n = Object.keys(valores).length;
    if (!n && p == null) { avisos.mostrar('Escribe al menos una medida'); return; }
    const u = await guardarDelDia(iso(new Date()), valores, p, prefs.unidad);
    nav.cerrar();
    await leer();
    sel = null;
    const texto = n ? n + (n === 1 ? ' medida' : ' medidas') + (p != null ? ' y peso' : '') : 'peso';
    avisos.deshacer('Guardado: ' + texto, async () => { await deshacerDelDia(u); await leer(); });
  }

  async function cambiarZona(z: string, encendida: boolean) {
    if (encendida && zonas.visibles.length < 2) { avisos.mostrar('Deja al menos una medida'); return; }
    const visibles = encendida ? zonas.visibles.filter((x) => x !== z) : [...zonas.visibles, z];
    zonas = { ...zonas, visibles };
    await guardarZonas(zonas);
    if (encendida) avisos.mostrar(z + ' se quitó. Su historial se guarda.');
    await leer();
  }
  async function agregarZona() {
    const k = nombreDeZona(nuevo);
    if (!k) { avisos.mostrar(nuevo.trim() ? 'Usa un nombre más corto' : 'Escribe el nombre de la medida'); return; }
    if (zonas.visibles.some((z) => mismaZona(z, k))) { avisos.mostrar('Esa medida ya está'); return; }
    const existente = zonas.conocidas.find((z) => mismaZona(z, k));
    zonas = { visibles: [...zonas.visibles, existente ?? k], conocidas: existente ? zonas.conocidas : [...zonas.conocidas, k] };
    nuevo = '';
    await guardarZonas(zonas);
    await leer();
  }
  const cuantas = (z: string) => porZona(filas, z).length;
</script>

<div class="tool" id="b-med">
  <div class="weight">
    <div>
      <span class="w-lab">Peso{peso ? ' · ' + etiquetaFecha(peso.fecha) : ''}</span>
      <b>{#if !peso}Sin registro{:else if verPeso}<Numero valor={peso.valor} unidad={peso.unidad} oculto={false} />{:else}Oculto{/if}</b>
    </div>
    <button class="ghost w-btn" aria-pressed={verPeso} onclick={() => (verPeso = !verPeso)}>{verPeso ? 'Ocultar' : 'Mostrar'}</button>
  </div>
  <p class="tool-note left">El número del peso queda oculto hasta que tú decidas verlo. Tus medidas y tu fuerza también cuentan tu progreso.</p>

  {#if cargado && zona}
    <div class="m-chips" role="radiogroup" aria-label="Medida">
      {#each zonas.visibles as z (z)}<button role="radio" aria-checked={z === zona} class:on={z === zona} onclick={() => elegir(z)}>{z}</button>{/each}
    </div>
    <figure class="chart">
      <figcaption><b>{zona}</b><span>cm · {vista.length > 1 ? 'últimas ' + vista.length + ' mediciones' : vista.length + (vista.length === 1 ? ' medición' : ' mediciones')}</span></figcaption>
      {#if grafica}
        <svg viewBox="0 0 360 190" role="img" aria-label={'Gráfica de ' + zona + (ocultoMedidas ? ', números ocultos' : '')}>
          {#each grafica.marcas as m (m.y)}
            <line class="grid" x1={grafica.izq} x2={grafica.der} y1={m.y} y2={m.y} />
            {#if !ocultoMedidas}<text x={grafica.izq - 6} y={m.y + 4} text-anchor="end">{m.n}</text>{/if}
          {/each}
          {#each grafica.puntos as p, i (i)}<text x={p.x} y={182} text-anchor="middle">{etiquetaFecha(p.fecha)}</text>{/each}
          <polygon class="area" points={grafica.area} />
          <polyline class="ln" points={grafica.linea} />
          {#if sel != null}<line class="xh" x1={grafica.puntos[sel].x} x2={grafica.puntos[sel].x} y1={grafica.arriba} y2={grafica.abajo} />{/if}
          {#each grafica.puntos as p, i (i)}<circle class="pt" class:sel={i === sel} cx={p.x} cy={p.y} r="5" />{/each}
          {#if !ocultoMedidas}<text class="end" x={grafica.puntos[grafica.puntos.length - 1].x + 10} y={grafica.puntos[grafica.puntos.length - 1].y + 4}>{formatoNum(vista[vista.length - 1].cm)}</text>{/if}
        </svg>
        <div class="pts" role="group" aria-label="Mediciones de la gráfica">
          {#each vista as m, i (m.fecha)}<button class:on={i === sel} aria-pressed={i === sel} onclick={() => (sel = i)}>{etiquetaFecha(m.fecha)}</button>{/each}
        </div>
        <p class="ch-tip" aria-live="polite">{sel != null ? etiquetaFecha(punto.fecha) + ': ' + (ocultoMedidas ? 'número oculto' : formatoNum(punto.cm) + ' cm') : 'Toca una fecha para ver el valor.'}</p>
      {:else}
        <p class="ch-tip" aria-live="polite">{vista.length ? 'Tienes 1 medición (' + etiquetaFecha(vista[0].fecha) + (ocultoMedidas ? '). Con 2 se ve la línea.' : ': ' + formatoNum(vista[0].cm) + ' cm). Con 2 se ve la línea.') : 'Aún no hay mediciones. Toca «Registrar medidas» para empezar.'}</p>
      {/if}
    </figure>

    <div class="m-table">
      <h4>{fechaFilas ? 'Última medición · ' + etiquetaFecha(fechaFilas) : 'Tus medidas'}</h4>
      <div>
        {#each zonas.visibles as z (z)}
          {@const s = porZona(filas, z)}
          {@const d = cambio(s)}
          <div class="m-row">
            <span>{z}</span>
            {#if !s.length}<b>Sin datos</b><span></span>
            {:else}<b><Numero valor={s[s.length - 1].cm} unidad="cm" oculto={ocultoMedidas} /></b>
              <span>{d == null ? 'primera' : ocultoMedidas ? '' : d === 0 ? 'igual' : (d > 0 ? '+' : '−') + formatoNum(Math.abs(d)) + ' cm'}</span>{/if}
          </div>
        {/each}
      </div>
      <button class="add" onclick={() => nav.abrirHoja('zonas')}>+ Agregar o quitar medidas</button>
    </div>
    <button class="start" onclick={abrirRegistro}>Registrar medidas de hoy</button>
  {/if}
</div>

{#if nav.hojaAbierta('medidas')}
  <Hoja titulo="Medidas de hoy">
    <p class="seg-help">Escribe solo las que quieras. Lo que dejes vacío no se guarda.</p>
    <div class="ms-grid">
      {#each zonas.visibles as z (z)}
        {@const s = porZona(filas, z)}
        <div class="man"><label for={'ms-' + z}>{z} (cm)</label><input id={'ms-' + z} type="text" inputmode="decimal" placeholder={s.length && !ocultoMedidas ? 'Antes: ' + formatoNum(s[s.length - 1].cm) : 'cm'} bind:value={campos[z]} /></div>
      {/each}
      <div class="man"><label for="ms-peso">Peso (opcional, {prefs.unidad})</label><input id="ms-peso" type="text" inputmode="decimal" placeholder="Queda oculto" bind:value={campoPeso} /></div>
    </div>
    <p class="tool-note left">El peso se guarda oculto hasta que tú lo muestres.</p>
    <button class="start" onclick={guardarMedidas}>Guardar</button>
  </Hoja>
{/if}

{#if nav.hojaAbierta('zonas')}
  <Hoja titulo="Tus medidas">
    <p class="seg-help">Elige cuáles quieres ver. Si quitas una, su historial se guarda.</p>
    <div class="group aj-g">
      {#each zonas.conocidas as z (z)}
        {@const on = zonas.visibles.includes(z)}
        <Interruptor id={'cf-' + z} encendido={on} titulo={z} detalle={cuantas(z) ? cuantas(z) + (cuantas(z) === 1 ? ' medición' : ' mediciones') : 'Sin mediciones'} onchange={() => cambiarZona(z, on)} />
      {/each}
    </div>
    <div class="man"><label for="cf-new">Agregar otra</label><input id="cf-new" type="text" maxlength="20" placeholder="Ej. Espalda" bind:value={nuevo} /></div>
    <button class="ghost" onclick={agregarZona}>Agregar</button>
  </Hoja>
{/if}
