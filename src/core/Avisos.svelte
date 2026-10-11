<script lang="ts">
  import { avisos } from './aviso.svelte';
</script>

<div class="toast" class:show={avisos.visible} role="status">{avisos.texto}</div>
<div class="undo" role="status" hidden={!avisos.deshacerFn}
  onfocusin={() => avisos.pausar()} onpointerdown={() => avisos.pausar()} onpointerenter={() => avisos.pausar()}
  onfocusout={() => avisos.armar()} onpointerleave={() => avisos.armar()}>
  <span>{avisos.deshacerTexto}</span><button onclick={() => avisos.usar()}>Deshacer</button>
</div>
