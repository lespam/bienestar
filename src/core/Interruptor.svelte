<script lang="ts">
  // Fila con interruptor, igual que en Ajustes del mockup.
  let { id, encendido, titulo, detalle, onchange }: { id: string; encendido: boolean; titulo: string; detalle: string; onchange: () => void } = $props();
</script>

<div class="aj-row">
  <span><b id={id + '-l'}>{titulo}</b><small>{detalle}</small></span>
  <button class="sw" {id} role="switch" aria-checked={encendido} aria-labelledby={id + '-l'} onclick={onchange}><i></i></button>
</div>
