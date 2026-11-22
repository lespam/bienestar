// Visor de imágenes: una sola pieza para toda la app. Quien muestra imágenes llama a `visor.abrir`.
// Se apoya en la pila de navegación, así que el gesto atrás de Android lo cierra.
import { nav } from './nav.svelte';

export interface ImagenVisor { src: string; alt: string }

class Visor {
  imagenes = $state<ImagenVisor[]>([]);
  indice = $state(0);

  abrir(imagenes: ImagenVisor[], indice = 0) {
    const validas = imagenes.filter((x) => x.src);
    if (!validas.length) return;
    this.imagenes = validas;
    this.indice = Math.min(Math.max(indice, 0), validas.length - 1);
    nav.abrirHoja('visor');
  }
}

export const visor = new Visor();
