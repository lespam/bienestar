<script lang="ts">
  import Icono from '../../core/Icono.svelte';
  import { nav } from '../../core/nav.svelte';
  import { avisos } from '../../core/aviso.svelte';
  import { plataforma } from '../../core/plataforma.svelte';
  import { fechaLarga, saludo } from '../../core/fechas';
  import { prefs, tocaRespaldo, ahoraNoRespaldo, enlaceObsidian, hacerRespaldo, elegirContenido } from '../ajustes';
  import { resumenDeHoy, empezarHoy, terminarHoy } from '../entreno';
  import { mensajeDelDia } from '../mente';

  // Inicio solo lee: Entreno, Mente y Ajustes por su puerta (plan, punto 1).
  const hoy = new Date();
  let rutina = $state<Awaited<ReturnType<typeof resumenDeHoy>>>(null);
  let listo = $state(false);
  let mensaje = $state<{ texto: string; mensaje?: string } | null>(null);
  let cargando = $state(false);

  async function leer() {
    rutina = await resumenDeHoy(hoy);
    mensaje = await mensajeDelDia(hoy);
    listo = true;
  }
  leer();

  const respaldo = $derived(tocaRespaldo(prefs));

  async function cargar() {
    const r = await elegirContenido(() => (cargando = true));
    cargando = false;
    if (!r) return;
    if (!r.ok) { avisos.mostrar('Este archivo no es tu contenido personal. No cambié nada.'); return; }
    avisos.mostrar('Listo. Tu contenido ya está en tu teléfono.');
    await leer();
  }
  async function respaldar() {
    const t = await hacerRespaldo();
    if (t) avisos.mostrar(t);
  }
  async function empezar() {
    const id = await empezarHoy();
    if (id == null) return;
    nav.irTab('rutina');
    nav.abrir('curso');
  }
  function seguir() { nav.irTab('rutina'); nav.abrir('curso'); }
  async function terminarAsi() {
    if (rutina?.sesion == null) return;
    await terminarHoy(rutina.sesion);
    nav.irTab('rutina');
    nav.abrir('fin', { sesion: rutina.sesion });
  }
  function resumen() { nav.irTab('rutina'); nav.abrir('fin', { sesion: rutina?.sesion }); }
  function pronto(titulo: string, fase: number) { nav.abrir('pronto', { titulo, fase }); }
</script>

<div class="screen">
  <div class="hello">
    <div class="in-top">
      <small>{fechaLarga(hoy)}</small>
      <button class="in-gear" aria-label="Ajustes" onclick={() => nav.abrir('ajustes')}><Icono nombre="engrane" /></button>
    </div>
    <h2 tabindex="-1">{saludo(hoy)}, Les</h2>
  </div>

  {#if plataforma.nuevaVersion}
    <div class="in-upd" role="status"><span>Hay una versión nueva</span><button onclick={() => plataforma.actualizar()}>Actualizar</button></div>
  {/if}

  {#if listo}
    <section class="in-main" aria-label="Lo principal de hoy">
      {#if rutina}
        {#if rutina.estado === 'abierta'}
          <div class="im-eye"><span>Sesión abierta</span></div>
          <h3>Rutina {rutina.letra}</h3>
          <p class="im-sub">Llevas {rutina.empezados} de {rutina.ejercicios} ejercicios. Lo que hiciste ya está guardado.</p>
          <div class="im-bar" aria-hidden="true">{#each [...Array(rutina.ejercicios).keys()] as i (i)}<i class:on={i < rutina.empezados}></i>{/each}</div>
          <div class="im-two"><button class="im-go" onclick={seguir}>Seguir</button><button class="im-end" onclick={terminarAsi}>Terminar así</button></div>
        {:else if rutina.estado === 'hecha'}
          <div class="im-eye"><span>Hoy</span></div>
          <h3>Rutina {rutina.letra} guardada</h3>
          <p class="im-sub">{rutina.empezados >= rutina.ejercicios ? `Hiciste los ${rutina.ejercicios} ejercicios.` : `Hiciste ${rutina.empezados} ${rutina.empezados === 1 ? 'ejercicio' : 'ejercicios'}. Cuenta como sesión.`}</p>
          <button class="ghost" onclick={resumen}>Ver resumen</button>
        {:else}
          <div class="im-eye"><span>Hoy</span>{#if rutina.cuando}<span>{rutina.cuando}</span>{/if}</div>
          <h3>Rutina {rutina.letra}</h3>
          <p class="im-sub">{rutina.ejercicios} ejercicios · {rutina.enGym ? rutina.enGym + ' en el gym' : 'todos en casa'}</p>
          {#if rutina.mejor}<p class="feel"><Icono nombre="carita" /><span>Las últimas 3 veces terminaste sintiéndote mejor.</span></p>{/if}
          <button class="start" onclick={empezar}>Empezar Rutina {rutina.letra}</button>
        {/if}
      {:else}
        <div class="im-eye"><span>Para empezar</span></div>
        <h3>Carga tu contenido personal</h3>
        <p class="im-sub">Con tu archivo aparecen tu rutina, tus recetas y tus letras.</p>
        <div role="status">{#if cargando}<span class="sr">Cargando tu contenido…</span>{/if}</div>
        <button class="start" onclick={cargar} disabled={cargando}>{cargando ? 'Cargando…' : 'Cargar archivo'}</button>
      {/if}
    </section>
  {/if}

  {#if respaldo}
    <section class="in-note" aria-label="Respaldo">
      <b>Hace un mes de tu último respaldo</b>
      <p>Toma un minuto y protege tus datos y fotos.</p>
      <div class="im-two"><button class="im-go" onclick={respaldar}>Hacer respaldo</button><button class="im-end" onclick={() => ahoraNoRespaldo()}>Ahora no</button></div>
    </section>
  {:else if plataforma.persistente === false}
    <section class="in-note" aria-label="Guardado">
      <p>Tu navegador todavía no asegura guardar tus datos. Instala la app en tu pantalla de inicio y haz un respaldo.</p>
      <button class="ghost" onclick={respaldar}>Hacer respaldo</button>
    </section>
  {/if}

  {#if mensaje}
    <section class="in-msg" aria-label="Mensaje del día">
      <div class="in-mh"><h4>Mensaje del día</h4><span class="example">de tus frases</span></div>
      <p class="in-quote">“{mensaje.texto}”</p>
      {#if mensaje.mensaje}<p class="im-sub">{mensaje.mensaje}</p>{/if}
      <button class="in-more" onclick={() => pronto('Colección', 7)}>Ver tu colección ›</button>
    </section>
  {/if}

  <section class="in-area cu" aria-labelledby="in-a1">
    <div class="in-ah"><h3 id="in-a1">Cuerpo</h3><span>Entrenamiento, comida y medidas</span></div>
    <div class="group">
      <button class="in-row" onclick={() => nav.irTab('rutina')}><span class="in-ic"><Icono nombre="rutina" /></span><span><b>Rutina</b><small>Tu semana y tus récords</small></span><i aria-hidden="true">›</i></button>
      <button class="in-row" onclick={() => nav.irTab('comida')}><span class="in-ic"><Icono nombre="comida" /></span><span><b>Comida</b><small>Aún no hay menú para esta semana</small></span><i aria-hidden="true">›</i></button>
      <button class="in-row" onclick={() => nav.irTab('cuerpo')}><span class="in-ic"><Icono nombre="cuerpo" /></span><span><b>Cuerpo</b><small>Medidas, fotos y período</small></span><i aria-hidden="true">›</i></button>
      <button class="in-row" onclick={() => pronto('Patrones', 6)}><span class="in-ic"><Icono nombre="patrones" /></span><span><b>Patrones</b><small>Cuándo tienes días flexibles</small></span><i aria-hidden="true">›</i></button>
    </div>
  </section>

  <section class="in-area mn" aria-labelledby="in-a2">
    <div class="in-ah"><h3 id="in-a2">Mente</h3><span>Tu colección y tus metas</span></div>
    <div class="group">
      <button class="in-row" onclick={() => pronto('Tablero de visión', 7)}><span class="in-ic"><Icono nombre="vision" /></span><span><b>Tablero de visión</b><small>Tus metas y cómo llegar</small></span><i aria-hidden="true">›</i></button>
      <button class="in-row" onclick={() => pronto('Colección', 7)}><span class="in-ic"><Icono nombre="coleccion" /></span><span><b>Colección</b><small>Frases, imágenes, videos y canciones</small></span><i aria-hidden="true">›</i></button>
    </div>
  </section>

  <section class="in-area al" aria-labelledby="in-a3">
    <div class="in-ah"><h3 id="in-a3">Alma</h3><span>Tu semana</span></div>
    <div class="group">
      <button class="in-row" onclick={() => pronto('Planeador semanal', 7)}><span class="in-ic"><Icono nombre="calendario" /></span><span><b>Planeador semanal</b><small>De lunes a viernes</small></span><i aria-hidden="true">›</i></button>
    </div>
  </section>

  <section class="tools">
    <h4>Herramientas</h4>
    <div class="quick q3">
      <button onclick={() => nav.abrir('herramientas', { tool: 'crono' })}><Icono nombre="crono" />Cronómetro</button>
      <button onclick={() => nav.abrir('herramientas', { tool: 'timer' })}><Icono nombre="timer" />Temporizador</button>
      <button onclick={() => nav.abrir('herramientas', { tool: 'coin' })}><Icono nombre="moneda" />Moneda</button>
    </div>
  </section>

  <section class="tools">
    <h4>Enlaces</h4>
    <div class="quick q3">
      <a href={prefs.enlaces.yt} target="_blank" rel="noopener"><Icono nombre="youtube" />YouTube</a>
      <a href={prefs.enlaces.am} target="_blank" rel="noopener"><Icono nombre="musica" />Apple Music</a>
      <a href={enlaceObsidian(prefs.enlaces.ob)}><Icono nombre="obsidian" />Obsidian</a>
    </div>
  </section>
</div>
