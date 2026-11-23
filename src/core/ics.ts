import { entregarArchivo } from './archivos';

// Recordatorios sin servidor: un archivo .ics que el calendario del teléfono abre. Con la app cerrada, el aviso lo da el calendario.

export interface EventoIcs {
  /** Para que importar dos veces no duplique el evento. */
  id: string;
  titulo: string;
  /** AAAA-MM-DD */
  fecha: string;
  /** HH:MM. Sin hora, el evento dura todo el día. */
  hora?: string;
  minutos?: number;
  nota?: string;
}

const escapar = (t: string) => t.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
/** Las líneas de un .ics miden 75 bytes como máximo; la continuación empieza con un espacio. */
export function plegar(linea: string): string {
  const enc = new TextEncoder();
  const partes: string[] = [];
  let actual = '', largo = 0, limite = 75;
  for (const ch of linea) {
    const b = enc.encode(ch).length;
    if (largo + b > limite) { partes.push(actual); actual = ''; largo = 0; limite = 74; }
    actual += ch; largo += b;
  }
  partes.push(actual);
  return partes.join('\r\n ');
}
const dosD = (n: number) => String(n).padStart(2, '0');
const soloDigitos = (f: string) => f.replace(/-/g, '');
function sumarDia(f: string): string {
  const d = new Date(+f.slice(0, 4), +f.slice(5, 7) - 1, +f.slice(8, 10) + 1);
  return d.getFullYear() + dosD(d.getMonth() + 1) + dosD(d.getDate());
}
function finConHora(f: string, h: string, min: number): string {
  const d = new Date(+f.slice(0, 4), +f.slice(5, 7) - 1, +f.slice(8, 10), +h.slice(0, 2), +h.slice(3, 5) + min);
  return d.getFullYear() + dosD(d.getMonth() + 1) + dosD(d.getDate()) + 'T' + dosD(d.getHours()) + dosD(d.getMinutes()) + '00';
}

/** El texto del archivo. Con hora, el evento sigue la hora de tu teléfono; sin hora, dura todo el día. */
export function calendarioIcs(eventos: EventoIcs[], ahora = new Date()): string {
  const sello = ahora.getUTCFullYear() + dosD(ahora.getUTCMonth() + 1) + dosD(ahora.getUTCDate()) + 'T' + dosD(ahora.getUTCHours()) + dosD(ahora.getUTCMinutes()) + dosD(ahora.getUTCSeconds()) + 'Z';
  const l: string[] = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Cuerpo, Mente y Alma//ES', 'CALSCALE:GREGORIAN'];
  for (const e of eventos) {
    const conHora = !!e.hora && /^\d{2}:\d{2}$/.test(e.hora);
    l.push('BEGIN:VEVENT', 'UID:' + e.id.replace(/[^a-zA-Z0-9-]/g, '') + '@cuerpo-mente-alma', 'DTSTAMP:' + sello);
    if (conHora) { l.push('DTSTART:' + soloDigitos(e.fecha) + 'T' + e.hora!.replace(':', '') + '00', 'DTEND:' + finConHora(e.fecha, e.hora!, e.minutos ?? 15)); }
    else l.push('DTSTART;VALUE=DATE:' + soloDigitos(e.fecha), 'DTEND;VALUE=DATE:' + sumarDia(e.fecha));
    l.push('SUMMARY:' + escapar(e.titulo));
    if (e.nota) l.push('DESCRIPTION:' + escapar(e.nota));
    // Un aviso a la hora del evento; en los de todo el día, a las 9 de ese día.
    l.push('BEGIN:VALARM', 'ACTION:DISPLAY', 'DESCRIPTION:' + escapar(e.titulo), conHora ? 'TRIGGER:PT0S' : 'TRIGGER:PT9H', 'END:VALARM', 'END:VEVENT');
  }
  l.push('END:VCALENDAR');
  return l.map(plegar).join('\r\n') + '\r\n';
}

/** Comparte el archivo con el calendario del teléfono o lo descarga. */
export function entregarIcs(nombre: string, eventos: EventoIcs[]) {
  return entregarArchivo(nombre.endsWith('.ics') ? nombre : nombre + '.ics', new TextEncoder().encode(calendarioIcs(eventos)), 'text/calendar');
}
