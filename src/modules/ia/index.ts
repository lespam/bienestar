// Puerta pública de la IA opcional (fase 8). Solo manda lo que cada pantalla decide enviar.
export { pedirIA } from './pedir.svelte';
export type { ItemIA, ResultadoIA, PedidoIA } from './pedir.svelte';
export { default as AnfitrionIA } from './Anfitrion.svelte';
export { default as AjustesIA } from './AjustesIA.svelte';
export { leerRecetaDeFoto, tipsDeReceta, tipsGenerales, cambiosDeIngredientes, ordenarPreparacion, ideasDeMenu, estimarComida, estimarDeFoto, resumenSemanal } from './tareas';
export type { RecetaLeida, AlimentoEstimado } from './tareas';
export { aBase64 } from './api';
export { cargarIA } from './estado.svelte';
