// Músculos en movimiento: qué músculo trabaja en cada animación y dónde está en el cuerpo.
// Anatomía general y un resumen propio de cómo se mueve; la técnica exacta es la del libro (en la ficha).
export type Vista = 'front' | 'back';
export interface Musculo { nombre: string; vista: Vista; que: string; donde: string; hace: string }

const Z_RAW: Record<string, [string, Vista, string, string, string]> = {
    gluteos: ['Glúteo mayor', 'back', 'La "nalga": el músculo más grande de la cadera.', 'Está en la parte de atrás de la cadera.', 'Lleva el muslo hacia atrás y estira la cadera, como al ponerte de pie desde una sentadilla. Lo sientes al apretar.'],
    gmedio: ['Glúteo medio', 'back', 'Un músculo más pequeño, arriba y a un lado del glúteo mayor.', 'Está en el costado de la cadera.', 'Separa la pierna hacia afuera y mantiene la cadera firme cuando te apoyas en un solo pie.'],
    isquios: ['Isquiotibiales', 'back', 'Los músculos de atrás del muslo.', 'Van desde debajo del glúteo hasta detrás de la rodilla.', 'Doblan la rodilla y ayudan a llevar la pierna hacia atrás. Se estiran cuando te inclinas con las piernas casi rectas.'],
    cuadriceps: ['Cuádriceps', 'front', 'Los músculos del frente del muslo.', 'Van de la cadera a la rodilla, por delante.', 'Estiran la rodilla (enderezan la pierna). Trabajan al bajar y al subir en una sentadilla.'],
    dorsales: ['Dorsales', 'back', 'Dos músculos anchos a los lados de la espalda.', 'Van de la cintura hasta la axila.', 'Jalan el brazo hacia abajo y hacia atrás, como en un jalón o un remo.'],
    espalda: ['Espalda alta', 'back', 'Trapecio y romboides: los músculos entre los omóplatos.', 'Están entre las dos paletas, arriba de la espalda.', 'Juntan los omóplatos hacia atrás. Es lo que sientes al terminar un remo.'],
    erectores: ['Zona lumbar', 'back', 'Dos columnas de músculo a los lados de la columna.', 'Están en la parte baja de la espalda.', 'Mantienen la espalda recta y la estiran cuando subes el torso.'],
    deltoides: ['Hombros', 'front', 'El músculo redondo que cubre el hombro.', 'Está arriba del brazo, en la unión con el torso.', 'Levanta el brazo hacia adelante, a los lados o hacia atrás. En un press de hombro hace el empuje.'],
    pecho: ['Pecho', 'front', 'Los pectorales.', 'Están en el frente del pecho, de la clavícula al esternón.', 'Empujan el brazo hacia adelante y hacia el centro, como en un press.'],
    triceps: ['Tríceps', 'back', 'El músculo de atrás del brazo.', 'Va del hombro al codo, por detrás.', 'Estira el codo. Ayuda en todos los empujes.'],
    biceps: ['Bíceps', 'front', 'El músculo del frente del brazo.', 'Va del hombro al codo, por delante.', 'Dobla el codo. Ayuda cuando jalas, como en un remo o un jalón.'],
    abdomen: ['Abdomen', 'front', 'El recto abdominal, los "cuadritos".', 'Está en el frente del abdomen, de las costillas a la pelvis.', 'Acerca las costillas a la cadera, como en un crunch. En las planchas mantiene el cuerpo recto.'],
    oblicuos: ['Oblicuos', 'front', 'Los músculos de los costados del abdomen.', 'Están a los lados de la cintura.', 'Giran e inclinan el torso, y lo mantienen firme de lado.']
  };
export const MUSCULOS: Record<string, Musculo> = Object.fromEntries(
  Object.entries(Z_RAW).map(([k, [nombre, vista, que, donde, hace]]) => [k, { nombre, vista, que, donde, hace }])
);

export interface Movimiento { como: string; principales: string[]; apoyo: string[] }
/** Por id de animación. */
export const MOVIMIENTO: Record<string, Movimiento> = {
  "a-glute-bridge": {
    "como": "Aprieta los glúteos para subir la cadera hasta que hombros, cadera y rodillas queden en línea. Baja despacio.",
    "principales": [
      "gluteos"
    ],
    "apoyo": [
      "isquios"
    ]
  },
  "a-one-arm-row": {
    "como": "Jala el codo hacia la cadera y junta el omóplato hacia la columna. Baja el peso despacio.",
    "principales": [
      "dorsales",
      "espalda"
    ],
    "apoyo": [
      "biceps",
      "deltoides"
    ]
  },
  "a-box-squat": {
    "como": "Lleva la cadera hacia atrás y abajo hasta tocar el cajón. Empuja el piso para subir, apretando los glúteos.",
    "principales": [
      "cuadriceps",
      "gluteos"
    ],
    "apoyo": [
      "isquios"
    ]
  },
  "a-db-bench-press": {
    "como": "Empuja las mancuernas hacia arriba con el pecho. Baja controlando el peso.",
    "principales": [
      "pecho"
    ],
    "apoyo": [
      "triceps",
      "deltoides"
    ]
  },
  "a-db-rdl": {
    "como": "Lleva la cadera hacia atrás con la espalda recta. Sientes el estirón atrás del muslo. Sube empujando la cadera hacia adelante.",
    "principales": [
      "isquios",
      "gluteos"
    ],
    "apoyo": [
      "erectores"
    ]
  },
  "a-side-lying-abduction": {
    "como": "Sube la pierna de arriba desde el costado de la cadera, sin girar el cuerpo. Baja despacio.",
    "principales": [
      "gmedio"
    ],
    "apoyo": [
      "gluteos"
    ]
  },
  "a-front-plank": {
    "como": "Mantén el cuerpo en una línea recta, apretando abdomen y glúteos.",
    "principales": [
      "abdomen"
    ],
    "apoyo": [
      "oblicuos",
      "erectores"
    ]
  },
  "a-side-plank-knees": {
    "como": "Mantén la cadera arriba con el costado del abdomen y el glúteo medio.",
    "principales": [
      "oblicuos",
      "gmedio"
    ],
    "apoyo": [
      "abdomen"
    ]
  },
  "b-fe-single-leg-glute-bridge": {
    "como": "Sube la cadera empujando con una sola pierna. Aprieta el glúteo de esa pierna arriba.",
    "principales": [
      "gluteos"
    ],
    "apoyo": [
      "isquios"
    ]
  },
  "b-front-lat-pulldown": {
    "como": "Jala la barra hacia el pecho bajando los codos hacia las costillas.",
    "principales": [
      "dorsales"
    ],
    "apoyo": [
      "biceps",
      "espalda"
    ]
  },
  "b-step-up": {
    "como": "Pisa el cajón y sube empujando con esa pierna. El glúteo y el muslo hacen el trabajo.",
    "principales": [
      "gluteos",
      "cuadriceps"
    ],
    "apoyo": [
      "isquios"
    ]
  },
  "b-db-overhead-press": {
    "como": "Empuja las mancuernas sobre la cabeza con los hombros. Abdomen firme para no arquear la espalda.",
    "principales": [
      "deltoides"
    ],
    "apoyo": [
      "triceps",
      "abdomen"
    ]
  },
  "b-45-hyperextension": {
    "como": "Baja el torso doblando la cadera. Sube apretando los glúteos hasta quedar en línea, sin arquear de más.",
    "principales": [
      "erectores",
      "gluteos"
    ],
    "apoyo": [
      "isquios"
    ]
  },
  "b-side-lying-clam": {
    "como": "Abre la rodilla de arriba como una almeja, con los pies juntos. Se siente en el costado de la cadera.",
    "principales": [
      "gmedio"
    ],
    "apoyo": []
  },
  "b-crunch": {
    "como": "Acerca las costillas a la cadera enrollando el torso. No jales el cuello.",
    "principales": [
      "abdomen"
    ],
    "apoyo": []
  },
  "b-side-crunch": {
    "como": "Acerca la costilla de un lado a la cadera del mismo lado.",
    "principales": [
      "oblicuos"
    ],
    "apoyo": [
      "abdomen"
    ]
  },
  "c-glute-march": {
    "como": "Mantén la cadera arriba apretando los glúteos mientras subes una pierna y luego la otra.",
    "principales": [
      "gluteos"
    ],
    "apoyo": [
      "isquios",
      "abdomen"
    ]
  },
  "c-cable-column-row": {
    "como": "Jala el cable hacia el abdomen juntando los omóplatos.",
    "principales": [
      "espalda",
      "dorsales"
    ],
    "apoyo": [
      "biceps",
      "deltoides"
    ]
  },
  "c-bodyweight-squat": {
    "como": "Lleva la cadera hacia atrás y abajo. Empuja el piso para subir, apretando los glúteos.",
    "principales": [
      "cuadriceps",
      "gluteos"
    ],
    "apoyo": [
      "isquios"
    ]
  },
  "c-db-incline-press": {
    "como": "Empuja las mancuernas hacia arriba y un poco hacia adelante. Trabaja la parte alta del pecho y los hombros.",
    "principales": [
      "pecho",
      "deltoides"
    ],
    "apoyo": [
      "triceps"
    ]
  },
  "c-reaching-sl-rdl": {
    "como": "Inclínate sobre una pierna mientras la otra se va hacia atrás. La cadera va atrás y la espalda queda recta.",
    "principales": [
      "isquios",
      "gluteos"
    ],
    "apoyo": [
      "erectores",
      "gmedio"
    ]
  },
  "c-x-band-walk": {
    "como": "Camina de lado con la banda en X siempre tensa. El glúteo medio empuja cada paso.",
    "principales": [
      "gmedio"
    ],
    "apoyo": [
      "gluteos"
    ]
  },
  "c-rkc-plank": {
    "como": "Plancha apretando al máximo glúteos y abdomen.",
    "principales": [
      "abdomen"
    ],
    "apoyo": [
      "gluteos",
      "oblicuos"
    ]
  },
  "c-rope-horizontal-chop": {
    "como": "Gira el torso llevando la cuerda de un lado al otro, con los brazos casi rectos. El giro sale del abdomen.",
    "principales": [
      "oblicuos"
    ],
    "apoyo": [
      "abdomen",
      "deltoides"
    ]
  }
};

const ZONES: Record<Vista, Record<string, string>> = {
    front: { pecho: '<ellipse cx="84" cy="86" rx="16" ry="12"/><ellipse cx="116" cy="86" rx="16" ry="12"/>', deltoides: '<circle cx="57" cy="74" r="11"/><circle cx="143" cy="74" r="11"/>', biceps: '<ellipse cx="50" cy="102" rx="7" ry="15"/><ellipse cx="150" cy="102" rx="7" ry="15"/>', abdomen: '<rect x="88" y="106" width="24" height="46" rx="10"/>', oblicuos: '<ellipse cx="76" cy="130" rx="8" ry="19"/><ellipse cx="124" cy="130" rx="8" ry="19"/>', cuadriceps: '<ellipse cx="85" cy="214" rx="13" ry="35"/><ellipse cx="115" cy="214" rx="13" ry="35"/>' },
    back: { espalda: '<ellipse cx="100" cy="78" rx="24" ry="14"/>', dorsales: '<ellipse cx="80" cy="108" rx="14" ry="22" transform="rotate(-12 80 108)"/><ellipse cx="120" cy="108" rx="14" ry="22" transform="rotate(12 120 108)"/>', deltoides: '<circle cx="57" cy="74" r="11"/><circle cx="143" cy="74" r="11"/>', triceps: '<ellipse cx="50" cy="102" rx="7" ry="15"/><ellipse cx="150" cy="102" rx="7" ry="15"/>', erectores: '<rect x="91" y="128" width="18" height="30" rx="8"/>', gmedio: '<ellipse cx="72" cy="164" rx="9" ry="9"/><ellipse cx="128" cy="164" rx="9" ry="9"/>', gluteos: '<ellipse cx="87" cy="186" rx="16" ry="14"/><ellipse cx="113" cy="186" rx="16" ry="14"/>', isquios: '<ellipse cx="85" cy="230" rx="13" ry="27"/><ellipse cx="115" cy="230" rx="13" ry="27"/>' }
  };

/** Cuerpo de frente o de espalda con la zona elegida en rosa. Son trazos fijos de este archivo. */
export function cuerpoSVG(vista: Vista, clave: string): string {
  const zs = ZONES[vista];
  const dentro = Object.keys(zs).map((k) => '<g class="z' + (k === clave ? ' on' : '') + '">' + zs[k] + '</g>').join('');
  return '<svg viewBox="0 0 200 330" aria-hidden="true"><circle class="bf" cx="100" cy="28" r="14"/><path class="bf" d="M62 66 Q100 54 138 66 L128 140 Q132 160 130 172 L70 172 Q68 160 72 140 Z"/>' +
    '<g class="b" stroke-width="15"><path d="M56 72 L44 130 L40 182"/><path d="M144 72 L156 130 L160 182"/></g><g class="b" stroke-width="28"><path d="M86 176 L82 252"/><path d="M114 176 L118 252"/></g><g class="b" stroke-width="17"><path d="M82 256 L82 322"/><path d="M118 256 L118 322"/></g>' + dentro + '</svg>';
}
