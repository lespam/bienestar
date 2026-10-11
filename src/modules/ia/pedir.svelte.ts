import { nav } from '../../core/nav.svelte';
import type { FnIA } from './estado.svelte';

// Quien quiere ayuda de la IA describe el pedido; la hoja se encarga del aviso, los controles y la respuesta.
export interface ItemIA { t: string; sub?: string; act?: string; aplicar?: () => void | Promise<void> }
export interface ResultadoIA { intro: string; items: ItemIA[]; /** Cierra la hoja al terminar (por ejemplo, cuando ya llenó un formulario). */ cerrar?: boolean }
export interface PedidoIA {
  fn: FnIA;
  titulo: string;
  /** Lo que se envía en esta ocasión, para el aviso de la primera vez. */
  envia?: string;
  ejecutar: (clave: string) => Promise<ResultadoIA>;
  /** Lo que se puede hacer sin IA («Hacerlo a mano»). */
  manual?: { texto: string; hacer: () => void };
}

export const pedido = $state<{ actual: PedidoIA | null }>({ actual: null });

export function pedirIA(p: PedidoIA) {
  pedido.actual = p;
  nav.abrirHoja('ia');
}
