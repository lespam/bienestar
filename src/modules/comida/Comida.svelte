<script lang="ts">
  import { nav } from '../../core/nav.svelte';
  import { reiniciarVista } from './estado.svelte';

  // Al volver a Comida, los números que mostraste con "Mostrar" vuelven a taparse.
  reiniciarVista();
</script>

<div class="screen">
  <div class="fd-head"><h2 tabindex="-1">Comida</h2></div>
  <section class="tools">
    <h4>Para planear</h4>
    <div class="quick">
      <button onclick={() => nav.abrir('recetas')}><svg aria-hidden="true" focusable="false" viewBox="0 0 24 24"><path d="M2 4h6a4 4 0 0 1 4 4v12a3 3 0 0 0-3-3H2zM22 4h-6a4 4 0 0 0-4 4v12a3 3 0 0 1 3-3h7z" /></svg>Recetario</button>
      <button onclick={() => nav.abrir('perfiles')}><svg aria-hidden="true" focusable="false" viewBox="0 0 24 24"><circle cx="9" cy="8" r="3" /><path d="M3 20a6 6 0 0 1 12 0" /><circle cx="17" cy="9" r="2.5" /><path d="M16 14.1a5 5 0 0 1 5 4.9" /></svg>Perfiles</button>
    </div>
  </section>
</div>
