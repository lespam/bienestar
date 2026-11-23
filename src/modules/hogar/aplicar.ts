import type { TareaHogar } from '../../core/db';
import { contarFuncion } from '../../core/uso';
import { agregarTarea, guardarDia, guardarTarea, leerDia, quitarTarea } from './datos';
import type { Frase } from './reglas';

/**
 * Hace lo que dice una frase ya confirmada («ya aspiré el cuarto», «agrega regar plantas», «tengo 20 min y poca energía»).
 * Es lo mismo que hace Hogar con su cuadro de texto, para que el cuadro único de Inicio llegue al mismo resultado.
 */
export async function aplicarFrase(f: Frase, hoy: string, tarea?: TareaHogar): Promise<{ aviso: string; deshacer: () => Promise<void> }> {
  if (f.tipo === 'capacidad') {
    const antes = await leerDia(hoy);
    await guardarDia({ ...antes, energia: f.energia ?? antes.energia, tiempo: f.tiempo ?? antes.tiempo });
    return { aviso: 'Tu capacidad de hoy quedó anotada', deshacer: () => guardarDia(antes).then(() => undefined) };
  }
  if (f.tipo === 'agregar') {
    const t: Omit<TareaHogar, 'id'> = { n: f.n, zona: 'Casa', min: f.min ?? 10, e: 1, cada: f.cada ?? 7 };
    const id = (await agregarTarea(t)) as number;
    return { aviso: 'Agregué «' + f.n + '» a tus tareas', deshacer: () => quitarTarea(id) };
  }
  const t = tarea ?? f.candidatas[0];
  if (!t?.id) return { aviso: 'No encontré esa tarea', deshacer: async () => {} };
  const antesT = JSON.parse(JSON.stringify(t)) as TareaHogar;
  const antesD = await leerDia(hoy);
  contarFuncion('hogar-hecha');
  await guardarTarea({ ...antesT, ult: hoy });
  await guardarDia({ ...antesD, hoy: antesD.hoy.filter((x) => x !== t.id), despues: antesD.despues.filter((x) => x !== t.id), hechas: [...antesD.hechas.filter((x) => x !== t.id), t.id] });
  return { aviso: 'Hecho: ' + t.n, deshacer: async () => { await guardarTarea(antesT); await guardarDia(antesD); } };
}
