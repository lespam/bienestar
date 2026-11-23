import type { Receta } from '../../core/db';

// De dónde viene la imagen de una receta, para nombrarla bien: nunca se presenta una ilustración como foto real.
type ConImagen = Pick<Receta, 'img' | 'img_tipo'>;

/** Una ilustración (dibujada por código o hecha con IA), no una foto. */
export const esIlustracion = (r: ConImagen) => r.img_tipo === 'generada' || r.img_tipo === 'ilustración';

/** Cómo se llama la imagen en la pantalla. */
export function nombreImagen(r: ConImagen): string {
  if (r.img_tipo === 'generada') return 'Ilustración hecha con IA';
  if (r.img_tipo === 'ilustración') return 'Ilustración';
  if (r.img_tipo === 'foto del libro') return 'Foto del libro';
  return 'Foto del platillo';
}

/** «Generar imagen» se ofrece donde no hay foto: sin imagen o con una ilustración. Una foto (del libro o tuya) nunca se reemplaza. */
export const sePuedeGenerar = (r: ConImagen) => !r.img || esIlustracion(r);
