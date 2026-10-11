<script lang="ts">
  import type { PerfilComida } from '../../core/db';
  import Hoja from '../../core/Hoja.svelte';
  import { nav } from '../../core/nav.svelte';
  import { avisos } from '../../core/aviso.svelte';
  import { iso } from '../../core/fechas';
  import { prefs } from '../ajustes';
  import { calBaja, calculadoraLibro, cap, diaCorto, fmtN, kRango, norm, porTxt, textoOrigen } from './calculos';
  import { guardarPerfil, leerPerfiles, perfilInicial } from './datos';
  import { numerosVisibles, vista } from './estado.svelte';

  type Quien = 'les' | 'jeff';
  let perfiles = $state<Record<Quien, PerfilComida>>({ les: perfilInicial('les'), jeff: perfilInicial('jeff') });
  let listo = $state(false);
  let quien = $state<Quien>('les');
  let agregando = $state<'gustos' | 'no' | null>(null);
  let nuevo = $state('');
  let temporizador: ReturnType<typeof setTimeout> | undefined;

  leerPerfiles().then((p) => { perfiles = p; listo = true; });

  const P = $derived(perfiles[quien]);
  const yo = $derived(quien === 'les');
  const ver = $derived(numerosVisibles());

  /** Guarda un perfil completo (los datos pasan a texto plano para la base). */
  async function poner(p: PerfilComida) {
    perfiles[p.quien] = p;
    await guardarPerfil($state.snapshot(p) as PerfilComida);
  }
  const copia = (p: PerfilComida) => structuredClone($state.snapshot(p)) as PerfilComida;

  function porcion(delta: number) {
    const p = copia(P);
    p.por = Math.min(3, Math.max(0.5, p.por + delta));
    poner(p);
  }

  async function agregarItem() {
    const t = nuevo.trim(), clave = agregando;
    if (!clave) return;
    if (!t) { document.getElementById('pf-new')?.focus(); return; }
    if (P[clave].some((x) => norm(x) === norm(t))) { avisos.mostrar('Ya está en la lista'); return; }
    const p = copia(P);
    p[clave].push(cap(t));
    agregando = null; nuevo = '';
    await poner(p);
  }
  function quitarItem(clave: 'gustos' | 'no', i: number) {
    const antes = copia(P), x = P[clave][i];
    const p = copia(P);
    p[clave].splice(i, 1);
    poner(p);
    avisos.deshacer('Se quitó «' + x + '»', () => poner(antes));
  }

  function escribirNota(e: Event) {
    const texto = (e.target as HTMLTextAreaElement).value, p = copia(P);
    p.nota = texto;
    perfiles[quien] = p;
    clearTimeout(temporizador);
    temporizador = setTimeout(() => guardarPerfil($state.snapshot(p) as PerfilComida), 400);
  }

  // ---------- Referencias ----------
  let src = $state<'nut' | 'nos'>('nut');
  let campos = $state<Record<'k1' | 'k2' | 'p' | 'c' | 'g' | 'mk' | 'mp', string | number>>({ k1: '', k2: '', p: '', c: '', g: '', mk: '', mp: '' });
  let aviso = $state(false);
  // Un campo numérico entrega número o texto, según lo que haya escrito.
  const num = (t: string | number | null | undefined) => { const s = String(t ?? '').trim(); return s === '' ? null : Number(s.replace(',', '.')); };
  const txt = (v: number | null) => (v == null ? '' : String(v));

  function abrirReferencias() {
    src = P.src === 'nos' ? 'nos' : 'nut';
    campos = { k1: txt(P.k?.[0] ?? null), k2: txt(P.k?.[1] ?? null), p: txt(P.p), c: txt(P.c), g: txt(P.g), mk: txt(P.mk), mp: txt(P.mp) };
    aviso = false;
    nav.abrirHoja('pf-ref');
  }
  const baja = () => calBaja(num(campos.k1), num(campos.k2));
  async function guardarReferencias() {
    if (baja()) { aviso = true; return; }
    const antes = copia(P);
    let k1 = num(campos.k1), k2 = num(campos.k2);
    if (k1 == null) k1 = k2;
    if (k2 == null) k2 = k1;
    const p = copia(P);
    p.k = k1 == null || k2 == null ? null : [Math.min(k1, k2), Math.max(k1, k2)];
    p.p = num(campos.p); p.c = num(campos.c); p.g = num(campos.g); p.mk = num(campos.mk); p.mp = num(campos.mp);
    p.src = src; p.fecha = iso(new Date());
    nav.cerrar();
    await poner(p);
    avisos.deshacer('Referencias guardadas', () => poner(antes));
  }

  // ---------- Calculadora del libro ----------
  let peso = $state('');
  let kc = $state<11 | 12>(12);
  let grasa = $state(0.4);
  const calc = $derived(calculadoraLibro(num(peso) ?? 0, prefs.unidad, kc, grasa));
  async function usarCalculo() {
    if (!calc.ok) return;
    const antes = copia(perfiles.les);
    const p = copia(perfiles.les);
    p.k = [calc.k11, calc.k12]; p.p = calc.p; p.c = calc.c; p.g = calc.g; p.src = 'book'; p.fecha = iso(new Date());
    nav.cerrar();
    await poner(p);
    avisos.deshacer('Referencias actualizadas con la calculadora', () => poner(antes));
  }
  function abrirCalc() { peso = ''; nav.abrirHoja('pf-calc'); }

  const resumenComida = $derived([P.mk ? fmtN(P.mk) + ' kcal' : '', P.mp ? P.mp + ' g de proteína' : ''].filter(Boolean).join(' · '));
</script>

<header class="cur-head">
  <button class="back" aria-label="Volver" onclick={() => nav.cerrar()}>‹ Volver</button>
</header>
<div class="screen">
  <div class="tl-head">
    <h2 tabindex="-1">Perfiles</h2>
    <p class="seg-help">Lo que la app sabe de ti y de Jeff para armar el menú, las porciones y la lista de compras.</p>
    <div class="seg seg2" role="tablist" aria-label="Perfil">
      <button class:on={yo} role="tab" aria-selected={yo} onclick={() => { quien = 'les'; agregando = null; }}>Tú</button>
      <button class:on={!yo} role="tab" aria-selected={!yo} onclick={() => { quien = 'jeff'; agregando = null; }}>Jeff</button>
    </div>
  </div>

  {#if listo}
    <div class="pf-body">
      <section class="pf-card" aria-labelledby="pf-rh">
        <div class="pf-h"><h4 id="pf-rh">Referencias</h4>{#if ver}<button class="pf-ed" onclick={abrirReferencias}>Editar</button>{/if}</div>
        <p class="pf-src">{P.src ? textoOrigen(P.src, quien) + (P.fecha ? ' · ' + diaCorto(P.fecha) : '') : yo ? 'Aún no escribes tus referencias.' : 'Aún no escribes las de Jeff.'}</p>
        {#if ver}
          <div class="pf-rows">
            {#each [['Calorías al día', P.k ? kRango(P.k) : null], ['Proteína', P.p ? P.p + ' g' : null], ['Carbohidratos', P.c ? P.c + ' g' : null], ['Grasa', P.g ? P.g + ' g' : null]] as [l, v] (l)}
              <div class="pf-row"><span>{l}</span>{#if v == null}<b class="none">Sin referencia</b>{:else}<b>{v}</b>{/if}</div>
            {/each}
          </div>
          {#if resumenComida}<p class="pf-meal">Para una comida: {resumenComida}</p>{/if}
        {:else}
          <div class="pf-hid"><span>Los números están ocultos.</span><button class="ghost w-btn" onclick={() => (vista.ver = true)}>Mostrar</button></div>
        {/if}
        <p class="pf-why">Son referencias, no límites. La app nunca dice cuánto queda.</p>
      </section>

      {#if yo && ver}
        <section class="pf-card" aria-labelledby="pf-ch">
          <h4 id="pf-ch">Calculadora del libro</h4>
          <p class="seg-help">Opcional. Escribes tu peso y el método de Strong Curves te propone una referencia de partida.</p>
          <button class="add" onclick={abrirCalc}>Abrir la calculadora</button>
        </section>
      {/if}

      <section class="pf-card" aria-labelledby="pf-ph">
        <h4 id="pf-ph">{yo ? 'Tu porción' : 'Su porción'}</h4>
        <div class="stepper">
          <button aria-label="Porción más chica" disabled={P.por <= 0.5} onclick={() => porcion(-0.5)}>−</button>
          <b aria-live="polite">{porTxt(P.por)}</b>
          <button aria-label="Porción más grande" disabled={P.por >= 3} onclick={() => porcion(0.5)}>+</button>
        </div>
        <p class="seg-help">{yo ? 'Lo que comes' : 'Lo que Jeff come'} de cada receta. Se usa en el menú y en la lista de compras. Se guarda sola.</p>
      </section>

      {#each [['gustos', 'Gustos'], ['no', yo ? 'Lo que no comes' : 'Lo que no come']] as [clave, titulo] (clave)}
        {@const lista = P[clave as 'gustos' | 'no']}
        <section class="pf-card" aria-label={titulo}>
          <h4>{titulo}</h4>
          {#if lista.length}
            <div class="pf-chips">
              {#each lista as x, i (x)}<span class="pf-chip">{x}<button aria-label={'Quitar ' + x} onclick={() => quitarItem(clave as 'gustos' | 'no', i)}>×</button></span>{/each}
            </div>
          {:else}<p class="pf-none">Nada por ahora.</p>{/if}
          {#if agregando === clave}
            <div class="pf-add">
              <input type="text" id="pf-new" aria-label={titulo + ': escribe uno nuevo'} placeholder={clave === 'gustos' ? 'Ej. Pescado' : 'Ej. Cilantro'} bind:value={nuevo} onkeydown={(e) => { if (e.key === 'Enter') { e.preventDefault(); agregarItem(); } }} />
              <button onclick={agregarItem}>Agregar</button>
            </div>
          {:else}
            <button class="add" onclick={async () => { agregando = clave as 'gustos' | 'no'; nuevo = ''; await Promise.resolve(); setTimeout(() => document.getElementById('pf-new')?.focus(), 0); }}>+ Agregar</button>
          {/if}
          {#if clave === 'no'}<p class="seg-help">Son gustos, no reglas. El menú y el recetario avisan y proponen otra opción.</p>{/if}
        </section>
      {/each}

      <section class="pf-card">
        <label for="pf-note"><h4>Notas (opcional)</h4></label>
        <textarea id="pf-note" rows="2" placeholder={yo ? 'Ej. prefiero cenar temprano' : 'Ej. prefiere cenar temprano'} value={P.nota} oninput={escribirNota}></textarea>
        <p class="saved-note">Se guarda mientras escribes.</p>
      </section>
    </div>
  {/if}
  <p class="tool-note">La app no da consejos médicos. La calculadora del libro es opcional y solo propone un punto de partida. Si tienes dudas, consulta a tu nutrióloga. Todo se guarda solo en tu teléfono.</p>
</div>

{#if nav.hojaAbierta('pf-ref')}
  <Hoja titulo={yo ? 'Tus referencias' : 'Referencias de Jeff'}>
    <p class="seg-help">{yo ? 'Escribe las que te dio tu nutrióloga o las que definieron tú y Jeff. La app no las calcula.' : 'Escribe las de Jeff: de su nutrióloga o las que definieron tú y Jeff. La app no las calcula.'}</p>
    <span class="sh-lbl">Quién las definió</span>
    <div class="m-chips" role="radiogroup" aria-label="Quién las definió">
      <button class:on={src === 'nut'} role="radio" aria-checked={src === 'nut'} onclick={() => (src = 'nut')}>Con nutrióloga</button>
      <button class:on={src === 'nos'} role="radio" aria-checked={src === 'nos'} onclick={() => (src = 'nos')}>Tú y Jeff</button>
    </div>
    <div class="man">
      <label for="pf-k1">Calorías al día</label>
      <div class="rng">
        <input id="pf-k1" type="number" inputmode="numeric" bind:value={campos.k1} onchange={() => (aviso = baja())} />
        <span>a</span>
        <input id="pf-k2" type="number" inputmode="numeric" aria-label="Calorías al día, hasta" bind:value={campos.k2} onchange={() => (aviso = baja())} />
        <span>kcal</span>
      </div>
      <div class="man3">
        <span><label for="pf-p">Prot g</label><input id="pf-p" type="number" inputmode="numeric" bind:value={campos.p} /></span>
        <span><label for="pf-c">Carb g</label><input id="pf-c" type="number" inputmode="numeric" bind:value={campos.c} /></span>
        <span><label for="pf-g">Grasa g</label><input id="pf-g" type="number" inputmode="numeric" bind:value={campos.g} /></span>
      </div>
      <span class="sh-lbl">Para una comida (opcional)</span>
      <div class="man3 two">
        <span><label for="pf-mk">kcal</label><input id="pf-mk" type="number" inputmode="numeric" bind:value={campos.mk} /></span>
        <span><label for="pf-mp">Prot g</label><input id="pf-mp" type="number" inputmode="numeric" bind:value={campos.mp} /></span>
      </div>
      <p class="tool-note left">Deja vacío lo que no quieras usar.</p>
    </div>
    {#if aviso}
      <p class="pf-warn" aria-live="polite"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9" /><path d="M12 11v5M12 8h.01" /></svg><span>La app no guarda referencias de calorías tan bajas. Revisa esta cifra con una nutrióloga.</span></p>
    {/if}
    <button class="start" onclick={guardarReferencias}>Guardar</button>
  </Hoja>
{/if}

{#if nav.hojaAbierta('pf-calc')}
  <Hoja titulo="Calculadora del libro">
    <p class="seg-help">Método de Strong Curves, capítulo 5, para bajar de peso. Es un punto de partida. Tu peso no se guarda.</p>
    <div class="man">
      <label for="cc-w">Tu peso ({prefs.unidad})</label>
      <input id="cc-w" type="text" inputmode="decimal" placeholder="Ej. 155" bind:value={peso} />
      <span class="sh-lbl">Calorías</span>
      <div class="m-chips" role="radiogroup" aria-label="Calorías">
        <button class:on={kc === 12} role="radio" aria-checked={kc === 12} onclick={() => (kc = 12)}>Peso × 12</button>
        <button class:on={kc === 11} role="radio" aria-checked={kc === 11} onclick={() => (kc = 11)}>Peso × 11</button>
      </div>
      <span class="sh-lbl">Grasa por libra de peso</span>
      <div class="m-chips" role="radiogroup" aria-label="Grasa por libra">
        {#each [0.3, 0.4, 0.5] as g (g)}<button class:on={grasa === g} role="radio" aria-checked={grasa === g} onclick={() => (grasa = g)}>{g} g</button>{/each}
      </div>
    </div>
    <div aria-live="polite">
      {#if !calc.ok}
        <p class="pat-empty">{calc.texto}</p>
      {:else}
        <div class="pf-rows">
          <div class="pf-row"><span>Calorías al día</span><b>{fmtN(calc.k)} kcal</b></div>
          <div class="pf-row"><span>Proteína</span><b>{calc.p} g</b></div>
          <div class="pf-row"><span>Carbohidratos</span><b>{calc.c} g</b></div>
          <div class="pf-row"><span>Grasa</span><b>{calc.g} g</b></div>
        </div>
        <p class="seg-help">El libro da de {fmtN(calc.k11)} a {fmtN(calc.k12)} kcal (peso × 11 a × 12). Los gramos son para {fmtN(calc.k)} kcal.</p>
      {/if}
    </div>
    <p class="tool-note left">Son referencias de partida, no un consejo médico. No tienes que cumplirlas exactas cada día. Si tu nutrióloga te dio otras, usa las suyas.</p>
    <button class="start" disabled={!calc.ok} onclick={usarCalculo}>Usar como mi referencia</button>
  </Hoja>
{/if}
