import type { TareaHogar } from '../../core/db';

/** Catálogo de partida. Todo se edita, se quita o se completa desde «Mis tareas». */
export const CATALOGO: Omit<TareaHogar, 'id'>[] = [
  { n: 'Limpiar el mostrador', zona: 'Cocina', min: 5, e: 1, cada: 2, minima: 'Solo el mostrador, 2 min', minMin: 2, yo: 'limpias el mostrador' },
  { n: 'Sacar la basura', zona: 'Cocina', min: 5, e: 1, cada: 3, yo: 'sacas la basura' },
  { n: 'Lavar los platos', zona: 'Cocina', min: 15, e: 2, cada: 1, minima: 'Solo lo que ya no cabe, 5 min', minMin: 5, yo: 'lavas los platos' },
  { n: 'Barrer la cocina', zona: 'Cocina', min: 10, e: 2, cada: 4, minima: 'Solo frente a la estufa, 3 min', minMin: 3, yo: 'barres la cocina' },
  { n: 'Preparar comida de mañana', zona: 'Cocina', min: 30, e: 2, cada: 2, minima: 'Solo cortar lo de mañana, 10 min', minMin: 10, yo: 'preparas comida de mañana' },
  { n: 'Lavar la ropa', zona: 'Ropa', min: 10, e: 2, cada: 7, minima: 'Solo meter la ropa, 3 min', minMin: 3, antes: 'dejar la lavadora lista', antesMin: 3, yo: 'lavas la ropa' },
  { n: 'Doblar la ropa limpia', zona: 'Ropa', min: 15, e: 2, cada: 4, minima: 'Solo una pila, 5 min', minMin: 5, yo: 'doblas la ropa limpia' },
  { n: 'Guardar la ropa', zona: 'Ropa', min: 10, e: 1, cada: 4, yo: 'guardas la ropa' },
  { n: 'Zurcir o coser algo', zona: 'Ropa', min: 30, e: 2, cada: 14, minima: 'Solo enhebrar y dejarlo listo, 5 min', minMin: 5, yo: 'zurces o coses algo' },
  { n: 'Aspirar el cuarto', zona: 'Cuarto', min: 15, e: 2, cada: 7, minima: 'Solo alrededor de la cama, 5 min', minMin: 5, yo: 'aspiras el cuarto' },
  { n: 'Cambiar las sábanas', zona: 'Cuarto', min: 30, e: 3, cada: 14, yo: 'cambias las sábanas' },
  { n: 'Limpiar el lavabo del baño', zona: 'Baño', min: 10, e: 2, cada: 7, minima: 'Solo pasar una toallita, 3 min', minMin: 3, yo: 'limpias el lavabo del baño' },
  { n: 'Limpiar el inodoro del baño', zona: 'Baño', min: 10, e: 2, cada: 7, minima: 'Solo la taza por dentro, 3 min', minMin: 3, yo: 'limpias el inodoro del baño' },
  { n: 'Regar las plantas', zona: 'Sala', min: 5, e: 1, cada: 4, yo: 'riegas las plantas' },
  { n: 'Ordenar la mesa', zona: 'Sala', min: 5, e: 1, cada: 3, minima: 'Solo despejar un lado, 2 min', minMin: 2, yo: 'ordenas la mesa' }
];
