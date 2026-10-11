const DIAS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
export const DIA_MS = 86_400_000;

/** "Jueves 1 de octubre", como en el mockup. */
export function fechaLarga(d: Date): string {
  return DIAS[d.getDay()] + ' ' + d.getDate() + ' de ' + MESES[d.getMonth()];
}
/** "11 de octubre". */
export function fechaCorta(d: Date): string {
  return d.getDate() + ' de ' + MESES[d.getMonth()];
}
/** AAAA-MM-DD en la hora del teléfono. */
export function iso(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
}
export function saludo(d: Date): string {
  const h = d.getHours();
  return h < 12 ? 'Buenos días' : h < 19 ? 'Buenas tardes' : 'Buenas noches';
}
/** Días enteros entre dos momentos. */
export function diasEntre(a: number, b: number): number {
  return Math.floor((b - a) / DIA_MS);
}
