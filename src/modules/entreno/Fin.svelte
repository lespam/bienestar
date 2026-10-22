<script lang="ts">
  import Icono from '../../core/Icono.svelte';
  import { nav } from '../../core/nav.svelte';
  import { fechaLarga } from '../../core/fechas';
  import { prefs } from '../ajustes';
  import { ejerciciosEmpezados, historialDe, llave, logros, minutos } from './calculos';
  import { cargarContexto, excluir, type Contexto } from './contexto';
  import { avisos } from '../../core/aviso.svelte';
  import { borrarSesion, marcarSinAnotar, reponerSesion, segundosDeDescanso, sentirse } from './datos';
  import { aFecha, fechaDia } from './semana';
  import { gruposDeRutina } from './programa';
  import type { Sesion } from '../../core/db';
  import Rico from './Rico.svelte';

  const id = Number(nav.pantalla?.datos?.sesion ?? 0);
  let c = $state<Contexto | null>(null);
  let descanso = $state(0);
  let sintio = $state<Sesion['sintio']>();

  (async () => {
    c = await cargarContexto();
    descanso = await segundosDeDescanso(id);
    sintio = c?.todas.find((x) => x.sesion.id === id)?.sesion.sintio;
  })();

  const reg = $derived(c?.todas.find((x) => x.sesion.id === id));
  const s = $derived(reg?.sesion);
  const grupos = $derived(c && s ? (s.rutina && s.rutina !== c.letra ? gruposDeRutina(c.p, s.rutina) : c.grupos) : []);
  const total = $derived(grupos.flatMap((g) => g.ejercicios).length);
  const k = $derived(reg ? ejerciciosEmpezados(grupos, new Set(reg.series.map((x) => llave(x.clave, x.n)))) : 0);
  const completa = $derived(k >= total && total > 0);
  const mins = $derived(s ? minutos((s.fin ?? Date.now()) - s.inicio) : 0);
  const oculto = $derived(prefs.ocultarEntreno);

  const sinSeries = $derived(!!reg && reg.series.length === 0);
  const sub = $derived(sinSeries ? 'La hiciste sin anotar series. Cuenta como sesión.' : completa ? `Hiciste los ${total} ejercicios.` : `Hiciste ${k} ${k === 1 ? 'ejercicio' : 'ejercicios'}. Cuenta como sesión.`);
  const coach = $derived(completa ? 'Buen trabajo. Cada serie que terminas ya cuenta.' : 'Un poco cuenta más que nada. Lo que hiciste hoy ya está guardado.');
  const dRest = $derived(descanso <= 0 ? '0 min' : descanso < 60 ? 'menos de 1 min' : Math.round(descanso / 60) + ' min');

  const dias = $derived.by(() => {
    if (!c || !s) return '';
    const previas = c.todas.filter((x) => x.sesion.id !== s.id && x.sesion.tipo === 'rutina' && x.sesion.rutina === s.rutina && x.sesion.inicio < s.inicio).sort((a, b) => b.sesion.inicio - a.sesion.inicio);
    return previas[0] ? 'el ' + fechaDia(previas[0].sesion.fecha).split(' ')[0] : '';
  });
  const victorias = $derived.by(() => {
    if (!c || !reg || !s) return [];
    if (!reg.series.length) return ['Hoy entrenaste sin anotar. La próxima vez puedes guardar tus series para ver tu progreso.'];
    if (oculto || !dias) return [`<b>Series guardadas:</b> ${reg.series.length}. Cada una cuenta.`];
    const resto = excluir(c.todas.filter((x) => x.sesion.inicio < s.inicio), s.id);
    const antes = (clave: string) => historialDe(resto, clave)[0]?.series ?? [];
    return logros(grupos, reg.series, antes, dias, prefs.unidad);
  });

  // Sin series: no se celebra igual que con series. Preguntamos, con dos opciones del mismo tamaño (auditoría 2026-10-22, hallazgo 4).
  const preguntar = $derived(sinSeries && !s?.sinAnotar);
  async function hiceSinAnotar() {
    await marcarSinAnotar(id);
    c = await cargarContexto();
  }
  async function descartar() {
    const b = await borrarSesion(id);
    nav.irTab('rutina');
    if (b) avisos.deshacer('Sesión descartada', async () => { await reponerSesion(b); });
  }

  const MENSAJE: Record<string, string> = { mejor: 'Anotado. Lo verás antes de tu próxima sesión.', igual: 'Anotado.', peor: 'Anotado. Algunos días cuestan más.' };
  async function sentir(v: 'mejor' | 'igual' | 'peor') { sintio = v; await sentirse(id, v); }
  function volver() { nav.reemplazar('curso', { revisar: id }); }
  const fecha = $derived(s ? fechaLarga(aFecha(s.fecha)) : '');
  const llevas = $derived(c?.llevas ?? 0);
</script>

<div class="screen">
  {#if s && preguntar}
    <div class="fin-top">
      <small>{fecha}</small>
      <h2 tabindex="-1">Rutina {s.rutina} terminada</h2>
      <p>No hay series anotadas. ¿Qué hacemos con esta sesión?</p>
    </div>
    <div class="fin-dos">
      <button class="start" onclick={hiceSinAnotar}>La hice sin anotar</button>
      <button class="ghost" onclick={descartar}>Descartar</button>
    </div>
    <p class="seg-help">«La hice sin anotar» la cuenta como sesión. «Descartar» la quita, y puedes deshacerlo.</p>
    <button class="link-btn" onclick={volver}>Anotar las series ahora</button>
  {:else if s}
    <div class="fin-top">
      <span class="fin-ic" aria-hidden="true"><Icono nombre="check" /></span>
      <small>{fecha}</small>
      <h2 tabindex="-1">Rutina {s.rutina} guardada</h2>
      <p>{sub}</p>
    </div>
    <div class="stats fin-stats">
      <div class="stat"><span>Tiempo total</span><b>{mins} min</b></div>
      <div class="stat"><span>Descansos</span><b>{dRest}</b></div>
    </div>
    <section class="focus" aria-label="Logros de hoy">
      <div class="fh"><h4>Logros de hoy</h4></div>
      <ul>{#each victorias as t, i (i)}<li><span><Rico texto={t} /></span></li>{/each}</ul>
      <p class="goal">{coach}</p>
    </section>
    <p class="fin-total">Llevas {llevas} {llevas === 1 ? 'sesión' : 'sesiones'} desde que empezaste.</p>
    <section class="fin-feel" aria-labelledby="fin-fq">
      <div class="fh"><h4 id="fin-fq">¿Cómo te sientes?</h4><span class="example">opcional</span></div>
      <div class="seg" role="radiogroup" aria-labelledby="fin-fq">
        {#each [['mejor', 'Mejor'], ['igual', 'Igual'], ['peor', 'Peor']] as [v, t] (v)}
          <button class:on={sintio === v} role="radio" aria-checked={sintio === v} onclick={() => sentir(v as 'mejor' | 'igual' | 'peor')}>{t}</button>
        {/each}
      </div>
      <p class="seg-help" role="status">{sintio ? MENSAJE[sintio] : 'Comparado con antes de entrenar. Un toque basta.'}</p>
    </section>
    <div class="fin-acts">
      <button class="start" onclick={() => nav.irTab('inicio')}>Ir a Inicio</button>
      <button class="ghost" onclick={() => nav.abrir('pr')}>Ver en Registro de PR</button>
      <button class="link-btn" onclick={volver}>Editar esta sesión</button>
    </div>
  {:else if c}
    <p class="seg-help">No encontré esta sesión.</p>
  {/if}
</div>
