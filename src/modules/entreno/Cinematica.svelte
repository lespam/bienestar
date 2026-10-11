<script lang="ts">
  import { onMount } from 'svelte';
  import { armarCinematica, type Version } from './cinematica';
  import type { Letra, Programa } from './programa';

  // La cinemática de la sesión: tu rutina como una escena con cámara en movimiento.
  let { programa, letra }: { programa: Programa; letra: Letra } = $props();

  const VELOCIDADES = [0.5, 0.75, 1, 1.5, 2];
  let version = $state<Version>('res');
  let velocidad = $state(1);
  let juega = $state(true);
  let sin3d = $state(false);
  let t = $state(0);
  let actual = $state(0);
  let lienzo = $state<HTMLCanvasElement>();
  let escenario = $state<HTMLElement>();
  let corte = $state<HTMLElement>();
  const reducir = typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;

  const cin = $derived(armarCinematica(programa, letra, version));
  const tl = $derived(cin?.tl ?? []);
  const total = $derived(cin?.total ?? 1);
  const seg = $derived(tl[actual]);
  const hecho = $derived(t >= total - 1 && !juega);

  const inicio = (i: number) => tl.slice(0, i).reduce((a, s) => a + s.d, 0);
  const indiceEn = (x: number) => { let s = 0; for (let i = 0; i < tl.length; i++) { s += tl[i].d; if (x < s) return i; } return tl.length - 1; };
  const primeroDe = (b: number) => Math.max(0, tl.findIndex((s) => s.b === b));
  const mm = (ms: number) => { const s = Math.floor(ms / 1000 / velocidad); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };

  function ir(i: number) { i = Math.max(0, Math.min(tl.length - 1, i)); t = inicio(i); cambiar(i); }
  function cambiar(i: number) {
    if (i === actual) return;
    actual = i;
    if (!reducir && corte) { corte.classList.remove('go'); void corte.offsetWidth; corte.classList.add('go'); }
  }
  function bloqueAnt() { const b = seg.b, dentro = t - inicio(primeroDe(b)) > 1500; ir(primeroDe(dentro ? b : Math.max(-1, b - 1))); }
  function bloqueSig() { const b = seg.b; ir(b >= (cin?.bloques.length ?? 0) ? tl.length - 1 : primeroDe(b + 1)); }
  function pausa() { if (!juega && t >= total - 1) { t = 0; cambiar(0); } juega = !juega; }
  function pantallaCompleta() { try { if (document.fullscreenElement) document.exitFullscreen(); else escenario?.requestFullscreen().catch(() => {}); } catch { /* sin pantalla completa */ } }
  function cambiarVersion(v: Version) { version = v; t = 0; actual = 0; juega = true; }

  onMount(() => {
    let parar = false, raf = 0, ultimo = 0, visible = true;
    let motor: { frame: (s: unknown, local: number, ts: number) => void; dispose: () => void } | null = null;
    const io = new IntersectionObserver(([e]) => { visible = e.isIntersecting; });
    if (escenario) io.observe(escenario);
    import('./escena').then(({ crearEscena }) => {
      if (parar || !lienzo || !escenario) return;
      try { motor = crearEscena(lienzo, escenario, reducir); } catch { sin3d = true; return; }
      const cuadro = (ts: number) => {
        if (parar) return;
        raf = requestAnimationFrame(cuadro);
        const dt = Math.min(80, ts - ultimo) * velocidad; ultimo = ts;
        if (!visible || document.visibilityState !== 'visible') return;
        if (juega && !reducir) { t += dt; if (t >= total) { t = total - 1; juega = false; } }
        const i = indiceEn(t);
        cambiar(i);
        motor!.frame(tl[i], t - inicio(i), ts);
      };
      raf = requestAnimationFrame((ts) => { ultimo = ts; cuadro(ts); });
    });
    return () => { parar = true; cancelAnimationFrame(raf); io.disconnect(); motor?.dispose(); };
  });

  const resumen = $derived(Math.round(total / 1000));
</script>

<section class="cin" aria-label="Cinemática de tu sesión">
  <div class="cin-seg" role="radiogroup" aria-label="Versión del adelanto">
    <button role="radio" aria-checked={version === 'res'} class:on={version === 'res'} onclick={() => cambiarVersion('res')}>Resumen</button>
    <button role="radio" aria-checked={version === 'ser'} class:on={version === 'ser'} onclick={() => cambiarVersion('ser')}>Con series</button>
  </div>

  <div class="escena" bind:this={escenario}>
    <canvas bind:this={lienzo} aria-label="Escena 3D de la rutina"></canvas>
    {#if seg}
      <div class="hud">
        <div class="hud-top"><span>{seg.top}</span><span class="pips" aria-hidden="true">{#each [...(cin?.bloques ?? []).keys()] as j (j)}<i class:done={seg.b > j || seg.b === (cin?.bloques.length ?? 0)} class:now={seg.b === j}></i>{/each}</span></div>
        <div class="hud-mid">{#if seg.mid}{#key actual}<div class="gk rise">{seg.mid.gk}</div><div class="gt rise" class:s={seg.mid.chico}>{seg.mid.gt}</div><div class="gs rise">{seg.mid.gs}</div>{/key}{/if}</div>
        <div class="hud-bot">
          {#if seg.bot}{#key actual}
            <div class="nm rise">{seg.bot.nombre}{#if seg.bot.gym}<span class="gym">GYM</span>{/if}</div>
            <div class="rxl rise">{seg.bot.rx}{#if seg.bot.series} · {#each [...Array(seg.bot.series.n).keys()] as j (j)}<i class="d" class:on={j < seg.bot.series.i}></i>{/each} Serie {seg.bot.series.i} de {seg.bot.series.n}{/if}</div>
            <div class="hc rise">{#each seg.bot.principales as m (m)}<span class="p">{m}</span>{/each}{#each seg.bot.apoyo as m (m)}<span>{m}</span>{/each}</div>
          {/key}{/if}
        </div>
      </div>
    {/if}
    <div class="corte" bind:this={corte} aria-hidden="true"></div>
    {#if sin3d}<p class="sin3d">Tu teléfono no pudo abrir la vista 3D. El resto de la app funciona igual.</p>{/if}
  </div>

  <p class="leyenda" aria-live="polite">{seg?.cap ?? ''}</p>
  <div class="prog" aria-hidden="true"><i style:width="{(t / total) * 100}%"></i></div>
  <div class="mapa" role="group" aria-label="Bloques de la sesión">
    {#each cin?.bloques ?? [] as b, j (j)}
      <button class:done={seg && (seg.b > j || seg.b === (cin?.bloques.length ?? 0))} class:now={seg?.b === j} onclick={() => ir(primeroDe(j))}><span>{b.etiqueta}</span><small>{b.chico}</small></button>
    {/each}
  </div>
  <div class="ctl">
    <button onclick={bloqueAnt}>‹ Bloque</button>
    <button class="go" onclick={pausa}>{juega ? 'Pausa' : hecho ? 'Repetir' : 'Reanudar'}</button>
    <button onclick={bloqueSig}>Bloque ›</button>
    <button onclick={pantallaCompleta}>Pantalla completa</button>
    <small>{mm(t)} / {mm(total)}</small>
  </div>
  <div class="cin-seg vel" role="radiogroup" aria-label="Velocidad">
    {#each VELOCIDADES as v (v)}<button role="radio" aria-checked={velocidad === v} class:on={velocidad === v} onclick={() => (velocidad = v)}>{v}x</button>{/each}
  </div>
  <p class="nota">{version === 'ser' ? 'Con series' : 'Resumen'}: unos {Math.floor(resumen / 60)}:{String(resumen % 60).padStart(2, '0')}. {version === 'ser' ? 'Cada serie es un ciclo del movimiento, no cuenta repeticiones.' : 'Un ejemplo de cada ejercicio.'} Qué músculo trabaja cada ejercicio y cómo se mueve es un resumen; la técnica exacta es la de la página del libro.</p>
</section>

<style>
  .cin { display: grid; gap: 10px; }
  .escena { position: relative; aspect-ratio: 4 / 5; border-radius: 20px; overflow: hidden; background: #120e19; color: #f3eef7; isolation: isolate; }
  .escena canvas { position: absolute; inset: 0; width: 100%; height: 100%; display: block; }
  .escena::before, .escena::after { content: ""; position: absolute; left: 0; right: 0; height: 11%; background: #000; z-index: 3; }
  .escena::before { top: 0; } .escena::after { bottom: 0; }
  .hud { position: absolute; inset: 0; z-index: 4; display: grid; grid-template-rows: auto 1fr auto; padding: 13% 14px 13%; pointer-events: none; }
  .hud-top { display: flex; justify-content: space-between; align-items: center; gap: 8px; font-size: 12px; font-weight: 800; letter-spacing: .14em; text-transform: uppercase; color: #f2b8c6; }
  .pips { display: flex; gap: 4px; } .pips i { width: 22px; height: 4px; border-radius: 4px; background: rgba(255,255,255,.22); } .pips i.done { background: #c9b3f5; } .pips i.now { background: #f2b8c6; }
  .hud-mid { display: grid; place-content: center; text-align: center; gap: 6px; }
  .gk { font-size: 12px; font-weight: 800; letter-spacing: .3em; color: #f2b8c6; }
  .gt { font-family: var(--f-serif); font-size: clamp(30px, 8vw, 54px); letter-spacing: .06em; text-transform: uppercase; line-height: 1; text-shadow: 0 2px 24px rgba(0,0,0,.7); }
  .gt.s { font-size: clamp(22px, 6vw, 36px); }
  .gs { font-size: 14px; font-weight: 700; }
  .hud-bot { display: grid; gap: 4px; align-self: end; text-shadow: 0 1px 12px rgba(0,0,0,.8); }
  .nm { font-family: var(--f-serif); font-size: clamp(16px, 4.2vw, 24px); line-height: 1.1; }
  .rxl { font-size: 13px; font-weight: 700; display: flex; gap: 6px; align-items: center; flex-wrap: wrap; }
  .rxl .d { width: 10px; height: 10px; border-radius: 50%; border: 2px solid #c9b3f5; display: inline-block; } .rxl .d.on { background: #f2b8c6; border-color: #f2b8c6; }
  .hc { display: flex; gap: 5px; flex-wrap: wrap; } .hc span { font-size: 12px; font-weight: 800; padding: 3px 9px; border-radius: 99px; border: 1px solid #c9b3f5; } .hc span.p { background: #f2b8c6; border-color: #f2b8c6; color: #1b1622; }
  .gym { background: #f2b8c6; color: #1b1622; font: 800 12px var(--f-soft); letter-spacing: .08em; padding: 2px 7px; border-radius: 99px; margin-left: 6px; vertical-align: 3px; }
  .rise { animation: rise .6s ease both; } @keyframes rise { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: none; } }
  .corte { position: absolute; inset: 0; background: #000; z-index: 5; opacity: 0; pointer-events: none; }
  .corte:global(.go) { animation: corte .45s ease-out; } @keyframes corte { from { opacity: 1; } to { opacity: 0; } }
  .sin3d { position: absolute; z-index: 6; inset: auto 14px 14% 14px; margin: 0; font-size: 14px; text-align: center; color: #f3eef7; }
  .leyenda { margin: 0; font-size: 14px; line-height: 1.5; min-height: 3em; }
  .prog { height: 6px; border-radius: 99px; background: var(--soft); overflow: hidden; } .prog i { display: block; height: 100%; background: var(--rose); }
  .mapa { display: flex; gap: 8px; }
  .mapa button { flex: 1; min-width: 0; font: 700 13px var(--f-soft); color: var(--muted); background: var(--panel); border: 1px solid var(--line); border-radius: 14px; padding: 8px 6px; min-height: 48px; display: grid; gap: 2px; }
  .mapa button small { font-weight: 600; font-size: 12px; }
  .mapa button.done { color: var(--fg); background: var(--soft); border-color: var(--soft); } .mapa button.now { color: var(--ink); background: var(--accent); border-color: var(--accent); }
  .ctl { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; }
  .ctl button, .cin-seg button { font: 600 14px var(--f-soft); color: var(--fg); background: transparent; border: 1px solid var(--line); border-radius: 99px; padding: 8px 14px; min-height: 44px; }
  .ctl .go { background: var(--accent); color: var(--ink); border-color: var(--accent); min-width: 100px; }
  .ctl small { color: var(--muted); font-size: 13px; margin-left: auto; font-variant-numeric: tabular-nums; }
  .cin-seg { display: flex; gap: 6px; flex-wrap: wrap; }
  .cin-seg button.on { background: var(--accent); color: var(--ink); border-color: var(--accent); }
  .cin-seg.vel button { padding-inline: 12px; min-width: 48px; }
  .nota { margin: 0; font-size: 13px; line-height: 1.45; color: var(--muted); }
  @media (prefers-reduced-motion: reduce) { .rise, .corte:global(.go) { animation: none; } }
</style>
