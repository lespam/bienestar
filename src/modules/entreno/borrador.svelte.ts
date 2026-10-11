// Lo que escribes en una serie y todavía no guardas. Se conserva si abres la ficha o el descanso y vuelves.
export const borrador = $state<{ v: Record<string, string> }>({ v: {} });
export const llaveBorrador = (clave: string, n: number, campo: string) => `${clave}#${n}#${campo}`;
export function limpiarBorrador(clave: string, n: number) {
  const pref = `${clave}#${n}#`;
  for (const k of Object.keys(borrador.v)) if (k.startsWith(pref)) delete borrador.v[k];
}
export function limpiarTodoBorrador() { borrador.v = {}; }
