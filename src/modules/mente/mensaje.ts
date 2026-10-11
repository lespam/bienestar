import { db, type ItemColeccion } from '../../core/db';
import { parte } from '../../core/contenido';
import { iso } from '../../core/fechas';
import { FRASES_MIAS } from '../../data/frases-mias';

/** Letra de canción que llega en el contenido personal. */
export interface Letra { texto: string; artista: string; mensaje?: string; tema?: string }

/** Copia una vez las frases de fábrica y las letras del contenido personal a tu Colección. */
export async function sembrar() {
  const nuevas: ItemColeccion[] = FRASES_MIAS.map((f, i) => ({ tipo: 'frase', texto: f.texto, origen: 'Mía', tema: f.tema, semilla: 'fabrica:mia:' + i }));
  const letras = (await parte<Letra[]>('letras')) ?? [];
  letras.forEach((l, i) => nuevas.push({ tipo: 'cancion', texto: l.texto, origen: 'Canción · ' + l.artista, mensaje: l.mensaje, tema: l.tema, semilla: 'contenido:letra:' + i }));
  const ya = new Set((await db.coleccion.where('semilla').anyOf(nuevas.map((n) => n.semilla!)).toArray()).map((x) => x.semilla));
  const faltan = nuevas.filter((n) => !ya.has(n.semilla));
  if (faltan.length) await db.coleccion.bulkAdd(faltan);
}

/** El mensaje del día sale de tu Colección y se guarda por fecha, para que no cambie en el día. */
export async function mensajeDelDia(hoy = new Date()): Promise<ItemColeccion | null> {
  await sembrar();
  const fecha = iso(hoy);
  const guardado = await db.mensajes.get(fecha);
  if (guardado) {
    const it = await db.coleccion.get(guardado.item);
    if (it) return it;
  }
  const textos = (await db.coleccion.toArray()).filter((x) => x.tipo !== 'imagen' && x.texto);
  if (!textos.length) return null;
  const ayer = (await db.mensajes.orderBy('fecha').last())?.item;
  const opciones = textos.length > 1 ? textos.filter((x) => x.id !== ayer) : textos;
  const it = opciones[Math.floor(Math.random() * opciones.length)];
  await db.mensajes.put({ fecha, item: it.id! });
  return it;
}
