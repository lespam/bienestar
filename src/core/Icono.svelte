<script lang="ts" module>
  // Trazos copiados del mockup. Decorativos por defecto (aria-hidden); el botón lleva el nombre.
  const TRAZOS: Record<string, string> = {
    engrane: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
    check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
    abajo: '<path d="M6 9l6 6 6-6"/>',
    reloj: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    carita: '<circle cx="12" cy="12" r="9"/><path d="M8.5 14.5c1.8 2 5.2 2 7 0M9 9.5h.01M15 9.5h.01"/>',
    trofeo: '<path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0zM7 6H4v1a3 3 0 0 0 3 3M17 6h3v1a3 3 0 0 1-3 3"/>',
    fuego: '<path d="M12 3c2 3 5 5 5 9a5 5 0 0 1-10 0c0-2 1-3 2-4 0 2 1 3 2 3 0-3-1-5 1-8z"/>',
    pulso: '<path d="M3 12h4l2-5 4 10 2-5h6"/>',
    casa: '<path d="M3 11l9-7 9 7M5 10v10h14V10"/>',
    play: '<path d="M6 4l14 8-14 8z"/>',
    rutina: '<path d="M6 7v10M18 7v10M3 10v4M21 10v4M6 12h12"/>',
    comida: '<path d="M4 11h16a8 8 0 0 1-16 0zM9 4v4M12 3v5M15 4v4"/>',
    cuerpo: '<circle cx="12" cy="5" r="2"/><path d="M5 9h14M12 9v6M8.5 21l3.5-6 3.5 6"/>',
    patrones: '<circle cx="5" cy="17" r="1.6"/><circle cx="11" cy="7" r="1.6"/><circle cx="19" cy="11" r="1.6"/><circle cx="15" cy="19" r="1.6"/><path d="M6 15.5l4-7M12.6 7.7l4.8 2.6M18.3 12.6l-2.5 4.9M13.4 18.7l-6.8-1.5"/>',
    coleccion: '<path d="M6 3h12v18l-6-4-6 4z"/>',
    vision: '<path d="M2 9l10-5 10 5-10 5zM6 11v5c3 2.5 9 2.5 12 0v-5"/>',
    calendario: '<rect x="3" y="5" width="18" height="16" rx="3"/><path d="M3 10h18M8 3v4M16 3v4"/>',
    crono: '<circle cx="12" cy="13" r="8"/><path d="M12 9v4l2.5 2M9 2h6"/>',
    timer: '<path d="M6 2h12M6 22h12M7 2c0 6 10 6 10 10s-10 4-10 10M17 2c0 6-10 6-10 10"/>',
    moneda: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5.5"/>',
    youtube: '<rect x="2.5" y="5" width="19" height="14" rx="4"/><path d="M10 9l5 3-5 3z"/>',
    musica: '<path d="M9 18V5l11-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="17" cy="16" r="3"/>',
    obsidian: '<path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><path d="M14 3v6h6M8 13h8M8 17h5"/>'
  };
</script>

<script lang="ts">
  let { nombre }: { nombre: string } = $props();
</script>

<!-- Los trazos son constantes de este archivo, nunca texto tuyo. -->
<!-- eslint-disable-next-line svelte/no-at-html-tags -->
<svg aria-hidden="true" focusable="false" viewBox="0 0 24 24">{@html TRAZOS[nombre] ?? ''}</svg>
