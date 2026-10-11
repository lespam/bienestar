// Puerta pública de Cuerpo.
export const Cuerpo = () => import('./Cuerpo.svelte');
// Lo que otros módulos pueden pedirle a Cuerpo.
export { fasesEn, etapaTxt } from './ciclo';
export type { EtapaCiclo, Fase } from './ciclo';
