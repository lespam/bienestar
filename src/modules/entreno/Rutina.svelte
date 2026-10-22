<script lang="ts">
  import Hoja from '../../core/Hoja.svelte';
  import Icono from '../../core/Icono.svelte';
  import { nav } from '../../core/nav.svelte';
  import { avisos } from '../../core/aviso.svelte';
  import { fechaLarga, iso, saludo } from '../../core/fechas';
  import { prefs } from '../ajustes';
  import { dondeQuedaste, ejerciciosEmpezados, textoSeries, type Modo } from './calculos';
  import { cargarContexto, datosDeEjercicio, planDe, type Contexto } from './contexto';
  import { agregarTip, cambiarModoSesion, guardarAjuste, guardarSustituto, iniciarSesion, quitarSustituto, terminarSesion, type Cuando } from './datos';
  import { fechaCorta3, lineaCuando, rutinasDelPrograma } from './semana';
  import { tieneGym, type Ejercicio, type Grupo, type Letra } from './programa';
  import { AnfitrionIA, iaLista, pedirIA, resumenSemanal, tipsDeEjercicios } from '../ia';
  import { sesionesParaResumen } from './resumen';
  import Animacion from './Animacion.svelte';
  import Rico from './Rico.svelte';
  import SustitutoHoja from './SustitutoHoja.svelte';
  import VistaPrevia from './VistaPrevia.svelte';
  import { MOVIMIENTO } from './musculos';

  const hoy = new Date();
  let c = $state<Contexto | null>(null);
  let abierto = $state('');
  let editando = $state<Ejercicio | null>(null);
  let cuando = $state<Cuando>({ dias: [], hora: '19:00', lugar: '' });
  let botonInicio = $state<HTMLButtonElement>();
  let pegajoso = $state(false);

  function resumirSemana() {
    if (!c) return;
    const ses = sesionesParaResumen(c, hoy);
    if (!ses.length) { avisos.mostrar('Aún no hay sesiones de estas dos semanas'); return; }
    const sinCifras = prefs.ocultarEntreno;
    pedirIA({
      fn: 'resumen', titulo: 'Resumen de la semana', envia: 'tus sesiones de entreno de las últimas dos semanas',
      ejecutar: async (clave) => ({ intro: 'Así vi tu semana. Es un apoyo, no una calificación.', items: (await resumenSemanal(clave, ses, sinCifras)).map((t) => ({ t })) })
    });
  }

  async function leer() {
    c = await cargarContexto(hoy);
    if (c && !abierto) abierto = c.grupos[0]?.ejercicios[0]?.clave ?? '';
  }
  leer();

  const ayuda: Record<Modo, string> = {
    mixto: 'Agrupa por lugar. Bajas al gym una sola vez.',
    casa: 'Todo en casa. Las de máquina se cambian por tu sustituto.',
    libro: 'Todo en el orden del libro. Las de máquina llevan la etiqueta Gym.'
  };
  const MODOS: [Modo, string][] = [['mixto', 'Casa + gym'], ['casa', 'Solo casa'], ['libro', 'Orden libro']];
  const DIA2 = ['Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sá', 'Do'], DIAN = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];

  const modo = $derived<Modo>(c?.hoy?.sesion.modo ?? c?.aj.modo ?? 'mixto');
  const primero = $derived<'gym' | 'casa'>(c?.hoy?.sesion.primero ?? c?.aj.primero ?? 'gym');
  const hayGym = $derived(!!c?.grupos.some(tieneGym));
  const todos = $derived(c ? c.grupos.flatMap((g) => g.ejercicios) : []);
  const nSuper = $derived(c ? c.grupos.filter((g) => g.tipo === 'superserie').length : 0);
  const estado = $derived(c?.hoy?.estado ?? 'nueva');
  const hechas = $derived(c?.hoy ? new Set(c.todas.find((x) => x.sesion.id === c!.hoy!.sesion.id)?.series.map((s) => s.clave + '#' + s.n)) : new Set<string>());
  const empezados = $derived(c ? ejerciciosEmpezados(c.grupos, hechas) : 0);
  const partes = $derived(c ? planDe(c, modo, primero) : []);

  async function elegirModo(m: Modo) {
    if (!c) return;
    await guardarAjuste('modo', m);
    c.aj.modo = m;
    if (c.hoy?.estado === 'abierta') { await cambiarModoSesion(c.hoy.sesion.id!, m, primero); c.hoy.sesion.modo = m; }
  }
  const ciclo = $derived(c ? rutinasDelPrograma(c.p) : []);
  /** Elegir otra rutina vale solo hoy; si eliges la que toca, se borra la elección. */
  async function elegirRutina(l: Letra) {
    if (!c || estado !== 'nueva') return;
    await guardarAjuste('elegida', l === c.tocaPorCiclo ? null : { letra: l, fecha: iso(hoy) });
    await guardarAjuste('cardioHoy', c.cardioHoy || c.aj.cuando.cardio?.[(hoy.getDay() + 6) % 7] ? { fecha: iso(hoy), si: false } : null);
    await leer();
  }
  async function elegirCardio() {
    if (!c || estado !== 'nueva') return;
    await guardarAjuste('cardioHoy', { fecha: iso(hoy), si: true });
    await leer();
  }
  async function elegirPrimero(p: 'gym' | 'casa') {
    if (!c) return;
    await guardarAjuste('primero', p);
    c.aj.primero = p;
    if (c.hoy?.estado === 'abierta') { await cambiarModoSesion(c.hoy.sesion.id!, modo, p); c.hoy.sesion.primero = p; }
  }

  async function empezar() {
    if (!c) return;
    if (estado === 'hecha') { nav.abrir('fin', { sesion: c.hoy!.sesion.id }); return; }
    if (estado === 'nueva') await iniciarSesion(c.letra, modo, primero);
    nav.abrir('curso');
  }
  async function terminarAsi() {
    if (!c?.hoy) return;
    await terminarSesion(c.hoy.sesion.id!);
    nav.abrir('fin', { sesion: c.hoy.sesion.id });
  }

  function tipsDeRutina() {
    if (!c) return;
    const letra = c.letra;
    const ejs = todos.map((e) => ({ clave: e.clave, nombre: e.nombre, series: e.series + ' × ' + e.rango, casa: !e.gym }));
    const nombre = new Map(ejs.map((e) => [e.clave, e.nombre]));
    pedirIA({
      fn: 'entreno', titulo: 'Tips con IA', envia: 'los nombres de los ejercicios de la Rutina ' + letra + ', sus series y repeticiones',
      ejecutar: async (k) => ({
        intro: 'Un tip por ejercicio de la Rutina ' + letra + '. Revísalos con el libro; los que guardes quedan en la ficha de cada ejercicio.',
        items: (await tipsDeEjercicios(k, ejs)).map((x) => x.clave === 'rutina'
          ? { t: x.tip, sub: 'Para toda la rutina' }
          : { t: x.tip, sub: nombre.get(x.clave), act: 'Guardar en su ficha', aplicar: async () => { await agregarTip(x.clave, x.tip, true); avisos.mostrar('Guardado en la ficha de ' + nombre.get(x.clave)); } })
      })
    });
  }

  function abrirCuando() {
    if (!c) return;
    cuando = structuredClone($state.snapshot(c.aj.cuando));
    cuando.cardio ??= [false, false, false, false, false, false, false];
    nav.abrirHoja('cuando');
  }
  async function guardarCuando() {
    if (!c) return;
    await guardarAjuste('cuando', $state.snapshot(cuando));
    await leer();
    nav.cerrar();
    avisos.mostrar('Guardado');
  }

  function elegirSust(e: Ejercicio) {
    editando = e;
    nav.abrirHoja('sust');
  }
  async function guardarSust(nombre: string, pagina?: string) {
    if (!c || !editando) return;
    const s = { clave: editando.clave, nombre, pagina };
    await guardarSustituto(s);
    c.sustitutos[editando.clave] = s;
    nav.cerrar();
    avisos.mostrar('Sustituto guardado');
  }
  async function quitarSust() {
    if (!c || !editando) return;
    await quitarSustituto(editando.clave);
    delete c.sustitutos[editando.clave];
    nav.cerrar();
  }

  function video(e: Ejercicio) {
    window.open('https://www.youtube.com/results?search_query=' + encodeURIComponent(e.nombre + ' exercise'), '_blank', 'noopener');
  }

  // El botón de empezar se queda pegado abajo cuando sales de su lugar.
  $effect(() => {
    if (!botonInicio || typeof IntersectionObserver === 'undefined') return;
    const io = new IntersectionObserver(([e]) => { pegajoso = !e.isIntersecting; });
    io.observe(botonInicio);
    return () => io.disconnect();
  });

  const textoInicio = $derived(c ? (estado === 'hecha' ? 'Ver resumen de hoy' : estado === 'abierta' ? `Seguir sesión · ${empezados} de ${todos.length}` : 'Empezar Rutina ' + c.letra) : '');
  const oculto = $derived(prefs.ocultarEntreno);
</script>

{#snippet fila(e: Ejercicio, sub: boolean, chip: boolean)}
  {@const s = sub ? c!.sustitutos[e.clave] : undefined}
  {@const d = datosDeEjercicio(c!, e, s?.nombre)}
  {@const clave = e.clave + (sub ? '·sust' : '')}
  <div class="ex" class:open={abierto === clave} class:sub>
    <button class="ex-btn" aria-expanded={abierto === clave} onclick={() => (abierto = abierto === clave ? '' : clave)}>
      {#if sub}
        <span class="nm">{s ? s.nombre : 'Sustituto en casa'}<small>En lugar de {e.nombre}</small></span>
      {:else}
        <span class="nm">{e.codigo ? e.codigo + ' · ' : ''}{e.nombre}{#if e.gym && chip}<span class="chip">Gym</span>{/if}<small>p. {e.pagina}</small></span>
      {/if}
      <span class="rx">{e.series} × {e.rango}</span>
      <Icono nombre="abajo" />
    </button>
    {#if abierto === clave}
      <div class="ex-body">
        {#if sub && !s}
          <p class="where">Elige tu sustituto del índice del libro. Aquí aparecerán su animación y tus datos.</p>
          <div class="ex-links"><button onclick={() => elegirSust(e)}>Elegir sustituto</button></div>
        {:else}
          <Animacion anim={sub ? undefined : e.anim} nombre={s?.nombre ?? e.nombre} hl={!sub && e.anim && MOVIMIENTO[e.anim] ? { p: MOVIMIENTO[e.anim].principales, s: MOVIMIENTO[e.anim].apoyo } : undefined} />
          {#if d.ultima}
            <div class="stats">
              <div class="stat"><span>Última vez · {fechaCorta3(d.ultima.fecha)}</span><b>{textoSeries(e.registro, d.ultima.series, oculto)}</b></div>
              <div class="stat"><span>Récord</span><b>{d.record ? (oculto ? d.record.tapado : d.record.texto) : '–'}</b></div>
            </div>
            {#if !oculto}<p class="where">{dondeQuedaste(e, d.ultima.series)}</p>{/if}
          {:else}
            <p class="where">Aún no hay registros de este ejercicio.</p>
          {/if}
          <div class="ex-links">
            {#if sub}<button onclick={() => elegirSust(e)}>Cambiar sustituto</button>
            {:else}<button onclick={() => nav.abrir('ficha', { clave: e.clave })}>Ver ficha</button>{/if}
            <button onclick={() => video(e)}>Video</button>
          </div>
        {/if}
      </div>
    {/if}
  </div>
{/snippet}

{#snippet bloque(g: Grupo, sub: boolean, chip: boolean)}
  <div class="group">
    {#if g.etiqueta}<span class="tag">{g.etiqueta}</span>{/if}
    {#each g.ejercicios as e (e.clave)}{@render fila(e, sub && e.gym, chip)}{/each}
  </div>
{/snippet}

<div class="screen">
  <div class="hello">
    <small>{fechaLarga(hoy)}</small>
    <h2 tabindex="-1">{saludo(hoy)}, Les</h2>
    <p class="quote">“Hoy cuenta lo que haces, no qué tan perfecto sale.”</p>
  </div>

  {#if !c}
    <section class="today"><h3>Rutina</h3><p>Carga tu contenido personal en Inicio para ver tu rutina.</p></section>
  {:else}
    <section class="week" aria-label="Seguimiento semanal">
      <div class="week-head"><h4>Esta semana</h4><span>{c.p.nombre ?? 'Programa'} · Semana {c.semanaN}</span></div>
      <div class="days">
        {#each c.semana as d (d.iso)}
          <div class="day" class:done={d.estado === 'hecha' || d.texto === 'hoy, hecha' || d.texto === 'hoy, cardio hecho'} class:today={d.estado === 'hoy'} class:rest={d.estado === 'libre'}>
            <span class="dn">{d.inicial}</span><span class="num">{d.num}</span>{#if d.ses === 'cardio'}<span class="ses"><Icono nombre="pulso" /></span>{:else}<span class="ses">{d.ses}</span>{/if}{#if d.texto}<span class="sr">{d.texto}</span>{/if}
          </div>
        {/each}
      </div>
      {#if iaLista('resumen')}<button class="link-btn" onclick={resumirSemana}>Resumen de la semana con IA</button>{/if}
      <!-- Un cero al empezar se lee como deuda: hasta la primera sesión, un mensaje de inicio. -->
      <span class="week-note">{c.llevas ? 'Llevas ' + c.llevas + (c.llevas === 1 ? ' sesión' : ' sesiones') + ' desde que empezaste.' : 'Esta semana empieza tu programa.'}</span>
    </section>
    <section class="today">
      {#if c.cardioHoy}
        <h3>Cardio</h3>
        <p>{c.cardioHoy === 'hecho' ? 'Ya registraste cardio hoy.' : 'Registra lo que hagas: caminata, bici u otro. Cuenta como una sesión.'}</p>
      {:else}
        <h3>Rutina {c.letra}</h3>
        <p>{todos.length} ejercicios · {nSuper} {nSuper === 1 ? 'superserie' : 'superseries'} (p. {c.p.rutinas[c.letra].pagina})</p>
      {/if}
      {#if estado === 'nueva' && c.cardioHoy !== 'hecho'}
        <div class="mini"><span>Hacer hoy:</span>
          {#each ciclo as l (l)}{@const on = !c.cardioHoy && c.letra === l}<button class="l" class:on aria-pressed={on} aria-label={'Rutina ' + l + (l === c.tocaPorCiclo ? ', la que toca' : '')} onclick={() => elegirRutina(l)}>{l}</button>{/each}
          <button class="l" class:on={c.cardioHoy === 'planeado'} aria-pressed={c.cardioHoy === 'planeado'} onclick={elegirCardio}>Cardio</button>
        </div>
      {/if}
      <div class="when-row"><Icono nombre="reloj" /><span>{lineaCuando(c.aj.cuando, hoy)}</span><button class="when-btn" onclick={abrirCuando}>Cambiar</button></div>
    </section>

    {#if c.cardioHoy}
      <div class="r-acts">
        <button class="start" onclick={() => nav.abrir('cardio')}>{c.cardioHoy === 'hecho' ? 'Ver tu cardio' : 'Registrar cardio'}</button>
        {#if c.cardioHoy === 'hecho'}<button class="ghost" onclick={() => elegirRutina(c!.letra)}>También hacer Rutina {c.letra}</button>{/if}
      </div>
    {:else}
    <div class="r-acts">
      {#if estado === 'nueva' && c.mejor}
        <p class="feel"><Icono nombre="carita" /><span>Las últimas 3 veces terminaste sintiéndote mejor.</span></p>
      {/if}
      <button class="start" bind:this={botonInicio} onclick={empezar}>{textoInicio}</button>
      {#if estado === 'abierta'}<button class="ghost" onclick={terminarAsi}>Terminar así</button>{/if}
    </div>

    <VistaPrevia programa={c.p} letra={c.letra} />
    {#if iaLista('entreno')}<button class="link-btn" onclick={tipsDeRutina}>Tips de la Rutina {c.letra} con IA</button>{/if}

    <section class="focus" aria-label="Dónde estás">
      <div class="fh"><h4>Dónde estás</h4></div>
      <ul>{#each c.donde.items as t, i (i)}<li><span><Rico texto={t} /></span></li>{/each}</ul>
      <p class="goal">{c.donde.meta}</p>
    </section>


    <section class="plan">
      <h4>Ejercicios</h4>
      <div class="seg" role="radiogroup" aria-label="Dónde entrenas hoy">
        {#each MODOS as [m, t] (m)}<button class:on={modo === m} role="radio" aria-checked={modo === m} onclick={() => elegirModo(m)}>{t}</button>{/each}
      </div>
      <p class="seg-help">{hayGym ? ayuda[modo] : 'La Rutina ' + c.letra + ' se hace completa en casa.'}</p>
      {#if modo === 'mixto' && hayGym}
        <div class="mini"><span>Empiezo en:</span>
          <button class:on={primero === 'gym'} aria-pressed={primero === 'gym'} onclick={() => elegirPrimero('gym')}>Gym</button>
          <button class:on={primero === 'casa'} aria-pressed={primero === 'casa'} onclick={() => elegirPrimero('casa')}>Casa</button>
        </div>
      {/if}
      <div class="plan-list">
        {#each partes as parte, k (k)}
          {#if parte.lugar}
            {#if parte.mover}<div class="move">{parte.mover}</div>{/if}
            <div class="place {parte.lugar}"><Icono nombre={parte.lugar === 'casa' ? 'casa' : 'rutina'} />{parte.lugar === 'casa' ? 'En casa' : 'Gym del edificio'}</div>
          {/if}
          {#each parte.grupos as g, gi (gi)}{@render bloque(g, modo === 'casa', modo === 'libro')}{/each}
        {/each}
      </div>
    </section>
    {/if}

    <section class="tools">
      <h4>Para entrenar</h4>
      <button class="pr-btn" onclick={() => nav.abrir('pr')}>
        <Icono nombre="trofeo" />
        <span><b>Registro de PR</b><small>Tus récords y sesiones pasadas</small></span>
      </button>
      <button class="pr-btn" onclick={() => nav.abrir('cardio')}>
        <Icono nombre="pulso" />
        <span><b>Cardio</b><small>Registra una caminata, bici u otro</small></span>
      </button>
      <div class="quick">
        <button onclick={() => nav.abrir('calentar', { letra: c!.letra })}><Icono nombre="fuego" />Calentar</button>
        <button onclick={() => nav.abrir('herramientas', { tool: 'crono' })}><Icono nombre="crono" />Cronómetro</button>
        <button onclick={() => nav.abrir('herramientas', { tool: 'timer' })}><Icono nombre="timer" />Temporizador</button>
        <button onclick={() => nav.abrir('descanso')}><Icono nombre="pulso" />Descanso</button>
      </div>
    </section>

    {#if pegajoso}<div class="rt-sticky"><button class="start" onclick={empezar}>{textoInicio}</button></div>{/if}
  {/if}
</div>

{#if nav.hojaAbierta('cuando') && c}
  <Hoja titulo="Cuándo y dónde">
    <p class="seg-help">Elige qué días haces rutina y qué días cardio, la hora y el lugar. La rutina que sigue va al siguiente día de rutina.</p>
    <span class="sh-lbl">Días de rutina</span>
    <div class="wh-days">
      {#each DIA2 as d, i (i)}<button class:on={cuando.dias[i]} aria-pressed={cuando.dias[i]} aria-label={'Rutina el ' + DIAN[i].toLowerCase()} onclick={() => { cuando.dias[i] = !cuando.dias[i]; if (cuando.dias[i] && cuando.cardio) cuando.cardio[i] = false; }}>{d}</button>{/each}
    </div>
    <span class="sh-lbl">Días de cardio</span>
    <div class="wh-days">
      {#each DIA2 as d, i (i)}<button class:on={cuando.cardio?.[i]} aria-pressed={!!cuando.cardio?.[i]} aria-label={'Cardio el ' + DIAN[i].toLowerCase()} onclick={() => { const cd = (cuando.cardio ??= [false, false, false, false, false, false, false]); cd[i] = !cd[i]; if (cd[i]) cuando.dias[i] = false; }}>{d}</button>{/each}
    </div>
    <div class="man">
      <label for="wh-time">Hora</label><input id="wh-time" type="time" bind:value={cuando.hora} />
      <label for="wh-place">Dónde</label><input id="wh-place" type="text" placeholder="Ej. en la sala" bind:value={cuando.lugar} />
    </div>
    <p class="tool-note left">La app no puede avisarte a una hora exacta. Si quieres un aviso, pon una alarma o un evento en el calendario de tu teléfono.</p>
    <button class="start" onclick={guardarCuando}>Guardar</button>
  </Hoja>
{/if}

{#if nav.hojaAbierta('sust') && editando}
  <SustitutoHoja nombreOriginal={editando.nombre} actual={c?.sustitutos[editando.clave]} alGuardar={guardarSust} alQuitar={quitarSust} />
{/if}

<AnfitrionIA />
