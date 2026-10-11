<script lang="ts">
  // Pantalla de lo que todavía no se construye. Dice en qué fase llega.
  let { titulo, fase }: { titulo: string; fase: number } = $props();
</script>

<div class="tl-head"><h2 tabindex="-1">{titulo}</h2></div>
<div class="pronto">
  <p>Esta parte llega en la fase {fase}. Mientras, lo demás ya funciona.</p>
</div>
