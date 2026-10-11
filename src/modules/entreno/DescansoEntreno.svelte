<script lang="ts">
  import Descanso from '../../core/Descanso.svelte';
  import { fraseAlAzar } from '../mente';
  import { guardarLargoDescanso, leerLargoDescanso } from '../herramientas';
  import { nav } from '../../core/nav.svelte';
  import { registrarDescanso, sesionAbierta } from './datos';

  // El descanso de la pieza compartida, con lo propio de Entreno: qué sigue, la frase de tu colección
  // y guardar cuánto descansaste de verdad.
  const d = nav.pantalla?.datos ?? {};
  let sesion: number | undefined = typeof d.sesion === 'number' ? d.sesion : undefined;
  let frase = $state<{ texto: string; origen: string } | null>(null);
  const despues = typeof d.despues === 'string' ? d.despues : undefined;

  let largo = $state<number | null>(null);
  leerLargoDescanso().then((l) => (largo = l));
  fraseAlAzar().then((f) => (frase = f));
  if (sesion == null) sesionAbierta().then((s) => (sesion = s?.id));
  // El id puede llegar un momento después; se usa el último valor al salir.
  const alSalir = (seg: number) => { void registrarDescanso(sesion, despues, seg); };
</script>

{#if largo != null}
  <Descanso largoInicial={largo} alElegirLargo={guardarLargoDescanso} siguiente={typeof d.siguiente === 'string' ? d.siguiente : ''} automatico={d.automatico === true} {frase} {alSalir} />
{/if}
