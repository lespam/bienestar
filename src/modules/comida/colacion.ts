// Las colaciones se arman por partes: una base, una fruta y algo más. Todo es opcional salvo la base.
// La primera lista es de la colación AM y la segunda de la PM.
export const COLACION = {
  base: [['Yogur natural', 'Yogur griego', 'Gelatina light', 'Rice cake', 'Requesón'], ['Fruta', 'Pepino o jícama', 'Palomitas']],
  fruta: ['Manzana', 'Plátano', 'Fresas', 'Papaya', 'Melón', 'Mandarina', 'Sandía'],
  extra: [['Granola o avena', 'Chía', 'Nueces'], ['Almendras', 'Nueces', 'Cacahuates', 'Crema de cacahuate']]
};

export interface PartesColacion { base: string; fruta: string; extra: string }

/** «Yogur natural + manzana + granola o avena». Si la base es «Fruta», la fruta ocupa su lugar. */
export function colacionTxt(x: PartesColacion): string {
  const partes: string[] = [];
  if (x.base !== 'Fruta') partes.push(x.base);
  else if (!x.fruta) partes.push('Fruta');
  if (x.fruta) partes.push(partes.length ? x.fruta.toLowerCase() : x.fruta);
  if (x.extra) partes.push(x.extra.toLowerCase());
  return partes.join(' + ');
}
