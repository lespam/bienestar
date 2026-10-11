<script lang="ts">
  import Icono from '../../core/Icono.svelte';
  import { nav } from '../../core/nav.svelte';
  import { iso } from '../../core/fechas';
  import { prefs } from '../ajustes';
  import { historialDe, resumenPR, textoSeries, minutos, type Historial } from './calculos';
  import { cargarContexto, type Contexto } from './contexto';
  import { gruposDeRutina, type Ejercicio, type Letra } from './programa';
  import { aFecha, fechaMini } from './semana';

  let c = $state<Contexto | null>(null);
  let pestaña = $state<'rec' | 'ses'>('rec');
  let letra = $state<Letra>('A');
  let abiertoEj = $state('');
  let abiertaSes = $state(-1);
  let ver = $state(false);

  cargarContexto().then((x) => { c = x; if (x) letra = x.letra; });

  const hoyIso = iso(new Date());
  const oculto = $derived(prefs.ocultarEntreno && !ver);
  const letras = $derived<Letra[]>(c ? (Object.keys(c.p.rutinas) as Letra[]) : []);
  const ejercicios = $derived<Ejercicio[]>(c ? gruposDeRutina(c.p, letra).flatMap((g) => g.ejercicios) : []);
  const MODOS = { mixto: 'Casa + gym', casa: 'Solo casa', libro: 'Orden libro' };

  const filas = $derived(
    c ? ejercicios.map((e) => {
      const hist: Historial[] = historialDe(c!.todas.filter((x) => x.sesion.tipo === 'rutina'), e.clave);
      const pr = resumenPR(e.registro, hist, hist[0]?.sesion);
      return { e, hist, pr };
    }) : []
  );
  const tieneDatos = $derived(filas.some((f) => f.hist.length));

  /** Un récord nuevo en la sesión de hoy, para destacarlo arriba. */
  const destacado = $derived.by(() => {
    if (!c) return null;
    const hoy = c.hoy?.sesion;
    if (!hoy) return null;
    for (const g of c.grupos) for (const e of g.ejercicios) {
      const hist = historialDe(c.todas.filter((x) => x.sesion.tipo === 'rutina'), e.clave);
      const pr = resumenPR(e.registro, hist, hoy.id);
      if (pr.estado === 'nuevo' && pr.record) return { e, pr };
    }
    return null;
  });

  const cuando = (f: string, id: number, abierta?: boolean) => (abierta ? 'Hoy (en curso)' : f === hoyIso ? 'Hoy' : fechaMini(f).replace(/^./, (x) => x.toUpperCase()));

  const sesiones = $derived(
    c ? c.todas.filter((x) => x.sesion.tipo === 'rutina').map((x) => x).sort((a, b) => b.sesion.inicio - a.sesion.inicio) : []
  );
  function detalle(x: { sesion: { rutina?: Letra; id?: number }; series: { clave: string; n: number; v: Record<string, number | null>; unidad: 'lb' | 'kg'; sust?: string }[] }) {
    if (!c) return [];
    const por: Record<string, typeof x.series> = {};
    for (const s of x.series) { const k = s.clave + '|' + (s.sust ?? ''); (por[k] ??= []).push(s); }
    const orden = gruposDeRutina(c.p, x.sesion.rutina as Letra).flatMap((g) => g.ejercicios);
    return orden.flatMap((e) => Object.entries(por).filter(([k]) => k.startsWith(e.clave + '|')).map(([k, ss]) => ({
      nombre: (e.codigo ? e.codigo + ' · ' : '') + (ss[0].sust ?? e.nombre), texto: textoSeries(e.registro, ss, oculto), k
    })));
  }
  const ejerciciosTotales = (l?: Letra) => (c && l ? gruposDeRutina(c.p, l).flatMap((g) => g.ejercicios).length : 0);
  const empezados = (x: { series: { clave: string }[] }) => new Set(x.series.map((s) => s.clave)).size;
  const diaMes = (f: string) => { const d = aFecha(f); return [d.getDate(), ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'][d.getMonth()]]; };
</script>

<header class="cur-head">
  <button class="back" aria-label="Volver" onclick={() => nav.cerrar()}>‹ Volver</button>
  <span class="rest-next">{c?.p.nombre ?? ''}</span>
</header>
<div class="screen">
  <div class="tl-head">
    <h2 tabindex="-1">Registro de PR</h2>
    <div class="seg seg2" role="tablist" aria-label="Qué ver">
      <button class:on={pestaña === 'rec'} role="tab" aria-selected={pestaña === 'rec'} onclick={() => (pestaña = 'rec')}>Récords</button>
      <button class:on={pestaña === 'ses'} role="tab" aria-selected={pestaña === 'ses'} onclick={() => (pestaña = 'ses')}>Sesiones</button>
    </div>
  </div>

  {#if !c}
    <p class="pr-empty">Carga tu contenido personal para ver tus récords.</p>
  {:else if pestaña === 'rec'}
    <section class="tool">
      {#if destacado}
        <div class="pr-hi"><Icono nombre="trofeo" /><div><b>Nuevo PR hoy en {destacado.e.nombre}</b><span>{oculto ? destacado.pr.record!.tapado : destacado.pr.record!.texto}{destacado.pr.antes ? '. Antes: ' + (oculto ? destacado.pr.antes.tapado : destacado.pr.antes.texto) : ''}.</span></div></div>
      {/if}
      <div class="m-chips" role="radiogroup" aria-label="Rutina">
        {#each letras as l (l)}<button class:on={letra === l} role="radio" aria-checked={letra === l} onclick={() => { letra = l; abiertoEj = ''; }}>Rutina {l}</button>{/each}
      </div>
      <div class="group pr-list">
        {#if !tieneDatos}
          <p class="pr-empty">Todavía no hay registros de la Rutina {letra}. Aparecen aquí cuando guardas tu primera serie.</p>
        {:else}
          {#each filas as f (f.e.clave)}
            {#if f.hist.length}
              <div class="ex" class:open={abiertoEj === f.e.clave}>
                <button class="ex-btn" aria-expanded={abiertoEj === f.e.clave} onclick={() => (abiertoEj = abiertoEj === f.e.clave ? '' : f.e.clave)}>
                  <span class="nm">{f.e.codigo ? f.e.codigo + ' · ' : ''}{f.e.nombre}<small>Récord: {f.pr.fecha === hoyIso ? 'hoy' : f.pr.fecha ? fechaMini(f.pr.fecha) : '–'}</small></span>
                  <span class="pr-val"><b>{f.pr.record ? (oculto ? f.pr.record.tapado : f.pr.record.texto) : '–'}</b>{#if f.pr.estado === 'nuevo'}<span class="pr-badge">Nuevo PR</span>{:else if f.pr.estado === 'primera'}<span class="pr-badge first">Primera marca</span>{/if}</span>
                  <Icono nombre="abajo" />
                </button>
                {#if abiertoEj === f.e.clave}
                  <div class="ex-body">
                    <table class="hist"><thead><tr><th>Fecha</th><th>Lo que hiciste</th></tr></thead><tbody>
                      {#each f.hist as h (h.sesion)}
                        {@const ab = c.todas.find((x) => x.sesion.id === h.sesion)?.sesion.abierta === 1}
                        <tr class:best={h.fecha === f.pr.fecha}><td>{cuando(h.fecha, h.sesion, ab)}</td><td>{textoSeries(f.e.registro, h.series, oculto)}</td></tr>
                      {/each}
                    </tbody></table>
                    <div class="ex-links"><button onclick={() => nav.abrir('ficha', { clave: f.e.clave })}>Ver ficha</button></div>
                  </div>
                {/if}
              </div>
            {/if}
          {/each}
        {/if}
      </div>
    </section>
  {:else}
    <section class="tool">
      <div class="pr-sessions">
        {#if !sesiones.length}<p class="pr-empty">Todavía no hay sesiones. Aparecen aquí cuando empiezas una.</p>{/if}
        {#each sesiones as x, i (x.sesion.id)}
          {@const s = x.sesion}
          {@const [dia, mes] = diaMes(s.fecha)}
          <div class="ses" class:open={abiertaSes === i}>
            <button class="ses-btn" aria-expanded={abiertaSes === i} onclick={() => (abiertaSes = abiertaSes === i ? -1 : i)}>
              <span class="ses-date"><b>{dia}</b><span>{mes}</span></span>
              <span class="ses-t"><b>Rutina {s.rutina}</b><span>{s.abierta ? 'Abierta desde las ' + new Date(s.inicio).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', hour12: false }) : minutos((s.fin ?? s.inicio) - s.inicio) + ' min'} · {empezados(x)} de {ejerciciosTotales(s.rutina)} ejercicios</span></span>
              <span class="ses-tag" class:open={!!s.abierta}>{s.abierta ? 'Abierta' : 'Terminada'}</span>
              <Icono nombre="abajo" />
            </button>
            {#if abiertaSes === i}
              <div class="ses-body">
                <div class="ses-meta"><span>{MODOS[s.modo]}</span><span>{s.abierta ? minutos(Date.now() - s.inicio) + ' min hasta ahora' : minutos((s.fin ?? s.inicio) - s.inicio) + ' min'}</span>{#if oculto}<span>Números ocultos</span>{/if}</div>
                {#each detalle(x) as r (r.k)}<div class="ses-row"><span>{r.nombre}</span><span>{r.texto}</span></div>{/each}
                {#if s.nota}<p class="ses-note">“{s.nota}”</p>{/if}
                {#if s.abierta}<button class="start" onclick={() => nav.reemplazar('curso')}>Seguir con esta sesión</button>{/if}
              </div>
            {/if}
          </div>
        {/each}
      </div>
    </section>
  {/if}

  {#if prefs.ocultarEntreno}
    <button class="link-btn" aria-pressed={ver} onclick={() => (ver = !ver)}>{ver ? 'Ocultar números' : 'Ver números'}</button>
  {/if}
  <p class="tool-note">Un PR es tu mejor marca en cada ejercicio. Primero cuenta el peso y después las repeticiones.</p>
</div>
