<script lang="ts">
  import Interruptor from '../../core/Interruptor.svelte';
  import { AjustesIA } from '../ia';
  import Hoja from '../../core/Hoja.svelte';
  import { nav } from '../../core/nav.svelte';
  import { avisos } from '../../core/aviso.svelte';
  import { plataforma } from '../../core/plataforma.svelte';
  import { elegirArchivo } from '../../core/archivos';
  import { importarZip, volverACopia, ultimaCopia } from '../../core/respaldo';
  import { metaContenido, resumenCargado } from '../../core/contenido';
  import { fechaCorta, diasEntre } from '../../core/fechas';
  import { prefs, guardar, cargarPrefs, enlaceObsidian } from './prefs.svelte';
  import { hacerRespaldo, elegirContenido } from './acciones';

  let copia = $state<{ id: number; fecha: number } | null>(null);
  let contenido = $state<{ fecha: number; resumen: string[] } | null>(null);
  let cargando = $state(false);

  async function leer() {
    const c = await ultimaCopia();
    copia = c ? { id: c.id!, fecha: c.fecha } : null;
    const m = await metaContenido();
    contenido = m ? { fecha: m.cargado, resumen: await resumenCargado() } : null;
  }
  leer();

  const ultimo = $derived(
    prefs.ultimoRespaldo == null ? 'Aún no haces un respaldo'
      : diasEntre(prefs.ultimoRespaldo, Date.now()) === 0 ? 'Último respaldo: hoy'
      : 'Último respaldo: hace ' + diasEntre(prefs.ultimoRespaldo, Date.now()) + ' días'
  );

  async function interruptor(k: 'ocultarComida' | 'ocultarEntreno' | 'recordarRespaldo') {
    await guardar(k, !prefs[k]);
    avisos.mostrar('Guardado');
  }
  async function unidad(u: 'lb' | 'kg') {
    await guardar('unidad', u);
    avisos.mostrar('Unidades: ' + (u === 'lb' ? 'libras' : 'kilos'));
  }
  async function exportar() {
    const t = await hacerRespaldo();
    if (t) avisos.mostrar(t);
  }

  async function datosCambiaron() {
    await cargarPrefs();
    plataforma.datos++;
  }
  async function importar() {
    nav.cerrar();
    const f = await elegirArchivo();
    if (!f) return;
    const r = await importarZip(f.bytes);
    if (!r.ok) { avisos.mostrar('Este archivo no es un respaldo de la app. No cambié nada.'); return; }
    await datosCambiaron();
    avisos.deshacer('Respaldo importado', async () => { await volverACopia(r.copia); await datosCambiaron(); avisos.mostrar('Volviste a tus datos anteriores'); });
  }
  async function volver() {
    if (!copia) return;
    const id = copia.id;
    if (await volverACopia(id)) { await datosCambiaron(); avisos.mostrar('Volviste a tus datos anteriores'); }
  }
  async function cargarContenido() {
    const r = await elegirContenido(() => (cargando = true));
    cargando = false;
    if (!r) return;
    if (!r.ok) { avisos.mostrar('Este archivo no es tu contenido personal. No cambié nada.'); return; }
    avisos.mostrar('Listo. Tu contenido ya está en tu teléfono.');
    plataforma.datos++;
  }

  // Editar enlace
  const NOMBRES = { yt: 'YouTube', am: 'Apple Music', ob: 'Obsidian' } as const;
  let enlace = $state<'yt' | 'am' | 'ob'>('ob');
  let texto = $state('');
  function editar(k: 'yt' | 'am' | 'ob') { enlace = k; texto = prefs.enlaces[k]; nav.abrirHoja('enlace'); }
  async function guardarEnlace() {
    const v = texto.trim();
    if (!v) { avisos.mostrar('Escribe el enlace'); return; }
    await guardar('enlaces', { ...prefs.enlaces, [enlace]: v });
    nav.cerrar();
    avisos.mostrar('Enlace guardado');
  }
</script>

<header class="cur-head"><button class="back" onclick={() => nav.cerrar()}>‹ Volver</button></header>
<div class="screen">
  <div class="tl-head"><h2 tabindex="-1">Ajustes</h2></div>

  <section class="tp-sec"><h4>Ocultar números</h4>
    <div class="group aj-g">
      <Interruptor id="aj-food" encendido={prefs.ocultarComida} titulo="Comida y cuerpo" detalle="Oculta calorías, macros, peso y medidas." onchange={() => interruptor('ocultarComida')} />
      <Interruptor id="aj-train" encendido={prefs.ocultarEntreno} titulo="Entrenamiento" detalle="Oculta pesos y repeticiones de tus series." onchange={() => interruptor('ocultarEntreno')} />
    </div>
    <p class="tp-hint">La primera vez que abres la app, te pregunta esto. Cada pantalla tiene un botón «Mostrar» por si quieres verlos un momento.</p>
  </section>

  <section class="tp-sec"><h4 id="aj-u">Unidades de peso</h4>
    <div class="seg seg2" role="radiogroup" aria-labelledby="aj-u">
      <button role="radio" class:on={prefs.unidad === 'lb'} aria-checked={prefs.unidad === 'lb'} onclick={() => unidad('lb')}>Libras (lb)</button>
      <button role="radio" class:on={prefs.unidad === 'kg'} aria-checked={prefs.unidad === 'kg'} onclick={() => unidad('kg')}>Kilos (kg)</button>
    </div>
  </section>

  <AjustesIA />

  <section class="tp-sec"><h4>Respaldo</h4>
    <div class="group aj-g aj-bk">
      <p class="aj-last">{ultimo}</p>
      <p class="tp-hint">Tus datos y fotos están solo en este teléfono. Un respaldo te protege si lo cambias o lo pierdes.</p>
      {#if plataforma.persistente === false}
        <p class="aj-warn">Tu navegador todavía no asegura guardar tus datos. Instala la app en tu pantalla de inicio y haz un respaldo.</p>
      {/if}
      <div class="aj-acts">
        <button class="start" onclick={exportar}>Exportar respaldo (ZIP)</button>
        <button class="ghost" onclick={() => nav.abrirHoja('importar')}>Importar respaldo</button>
        {#if copia}<button class="ghost" onclick={volver}>Volver a mis datos anteriores</button>{/if}
      </div>
      <Interruptor id="aj-rem" encendido={prefs.recordarRespaldo} titulo="Recordarme cada mes" detalle="Inicio te lo muestra cuando pasa un mes." onchange={() => interruptor('recordarRespaldo')} />
    </div>
  </section>

  <section class="tp-sec"><h4>Contenido personal</h4>
    <div class="group aj-g">
      <div class="aj-row"><span>
        <b>{contenido ? 'Cargado el ' + fechaCorta(new Date(contenido.fecha)) : 'Sin cargar'}</b>
        <small>{contenido ? contenido.resumen.join(' · ') : 'Tu rutina, tus recetas, Fresh y tus letras.'}</small>
      </span></div>
      <div class="aj-acts" role="status">
        <button class="ghost" onclick={cargarContenido} disabled={cargando}>{cargando ? 'Cargando tu contenido…' : contenido ? 'Cargar otro archivo' : 'Cargar archivo'}</button>
      </div>
    </div>
  </section>

  <section class="tp-sec"><h4>Enlaces de Inicio</h4>
    <div class="group aj-g">
      {#each [['yt', prefs.enlaces.yt], ['am', prefs.enlaces.am], ['ob', prefs.enlaces.ob ? 'Bóveda: ' + prefs.enlaces.ob : 'Sin bóveda elegida']] as [k, sub] (k)}
        <div class="aj-row"><span><b>{NOMBRES[k as 'yt']}</b><small>{sub}</small></span><button class="pf-ed" onclick={() => editar(k as 'yt')}>Editar</button></div>
      {/each}
    </div>
  </section>
  <p class="tool-note">Sin cuentas ni servidor. Todo se guarda solo en tu teléfono.</p>
</div>

{#if nav.hojaAbierta('enlace')}
  <Hoja titulo={NOMBRES[enlace]}>
    <div class="man"><label for="ln-in">{enlace === 'ob' ? 'Nombre de tu bóveda' : 'Enlace'}</label><input id="ln-in" type="text" bind:value={texto}></div>
    {#if enlace === 'ob'}
      <div class="man">
        <p class="seg-help">El botón de Inicio abre: <b>{enlaceObsidian(texto.trim() || 'NOMBRE')}</b></p>
        <ol class="steps ln-steps"><li>Instala Obsidian desde Google Play.</li><li>Abre tu bóveda una vez en Obsidian.</li><li>Escribe aquí su nombre exacto, como aparece arriba en Obsidian.</li></ol>
      </div>
    {/if}
    <button class="start" onclick={guardarEnlace}>Guardar</button>
  </Hoja>
{/if}

{#if nav.hojaAbierta('importar')}
  <Hoja titulo="Importar respaldo">
    <p class="seg-help">Importar cambia tus datos actuales por los del archivo. Antes, la app guarda un respaldo de lo que tienes ahora, por si quieres volver.</p>
    <button class="start" onclick={importar}>Elegir archivo ZIP</button>
    <button class="ghost" onclick={() => nav.cerrar()}>Cancelar</button>
  </Hoja>
{/if}
