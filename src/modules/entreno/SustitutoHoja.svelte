<script lang="ts">
  import Hoja from '../../core/Hoja.svelte';
  import type { Sustituto } from '../../core/db';

  // Tu ejercicio de casa en lugar de uno de máquina. Lo eliges del índice del libro.
  let { nombreOriginal, actual, alGuardar, alQuitar }: {
    nombreOriginal: string;
    actual?: Sustituto;
    alGuardar: (nombre: string, pagina?: string) => void;
    alQuitar: () => void;
  } = $props();
  // Se llena una vez al abrir la hoja.
  let nombre = $state('');
  let pagina = $state('');
  $effect.pre(() => { nombre = actual?.nombre ?? ''; pagina = actual?.pagina ?? ''; });
</script>

<Hoja titulo="Sustituto en casa">
  <p class="seg-help">Elige del índice del libro el ejercicio que haces en casa en lugar de {nombreOriginal}.</p>
  <div class="man">
    <label for="su-n">Ejercicio</label><input id="su-n" type="text" placeholder="Ej. Dumbbell pullover" bind:value={nombre} />
    <label for="su-p">Página (opcional)</label><input id="su-p" type="text" placeholder="Ej. p. 281" bind:value={pagina} />
  </div>
  <button class="start" disabled={!nombre.trim()} onclick={() => alGuardar(nombre.trim(), pagina.trim() || undefined)}>Guardar</button>
  {#if actual}<button class="ghost" onclick={alQuitar}>Quitar sustituto</button>{/if}
</Hoja>
