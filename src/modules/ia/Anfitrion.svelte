<script lang="ts">
  import { nav } from '../../core/nav.svelte';
  import HojaIA from './HojaIA.svelte';
  import { pedido } from './pedir.svelte';
</script>

<!-- Va una vez en cada pantalla que pide ayuda con IA. -->
{#if nav.hojaAbierta('ia') && pedido.actual}{#key pedido.actual}<HojaIA />{/key}{/if}
