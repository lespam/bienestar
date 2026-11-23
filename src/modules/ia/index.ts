// Puerta pública de la IA opcional (fase 8). Solo manda lo que cada pantalla decide enviar.
export { pedirIA } from './pedir.svelte';
export type { ItemIA, ResultadoIA, PedidoIA } from './pedir.svelte';
export { default as AnfitrionIA } from './Anfitrion.svelte';
export { default as AjustesIA } from './AjustesIA.svelte';
export { leerRefri, proponerComidas, leerRecetaDeFoto, tipsDeReceta, tipsGenerales, cambiosDeIngredientes, ordenarPreparacion, ideasDeMenu, estimarComida, estimarDeFoto, resumenSemanal, tipsDeEjercicios, masCombinaciones, ideaDeUsual, leerTicket, unirNombres } from './tareas';
export type { RecetaLeida, AlimentoEstimado, EjercicioCorto, Hallazgo, PeticionCocina, ComidaIA, TiempoIA, PeticionCombos, ComboNuevo, PeticionUsual, IdeaDeUsual, TicketLeido, ArticuloLeido } from './tareas';
export { aBase64 } from './api';
export { cargarIA, iaLista } from './estado.svelte';
export { default as CuadroUnico } from './CuadroUnico.svelte';
export { registrar, entender, entenderConIA, intenciones, partir, textoDeAcciones, ejecutar, vaciarRegistro } from './cuadro';
export type { Entendido, Intencion, Resultado } from './cuadro';
