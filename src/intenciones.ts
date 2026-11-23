import { iso } from './core/fechas';
import { nav } from './core/nav.svelte';
import { anotarComido, anotarHay, agregarFaltantes, leerTextoHay, quitarFaltantes } from './modules/comida';
import { elegirRutinaHoy, letrasDeRutina } from './modules/entreno';
import { aplicarFrase, buscarTarea, entendi, interpretar, listarTareas, type Energia, type Frase } from './modules/hogar';
import { registrar, type Entendido, type Intencion } from './modules/ia';

// Las acciones del cuadro único. Cada una vive aquí, con sus reglas, su forma para el modelo y lo que hace.
// Agregar una acción es registrar otra; ninguna toca a las demás. El orden importa: la primera que entiende, gana.

const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
const mayus = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);
const hoyIso = () => iso(new Date());
const texto = (v: unknown, max = 80) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const textos = (v: unknown, max = 8) => (Array.isArray(v) ? v.map((x) => texto(x)).filter(Boolean).slice(0, max) : []);

/** Lo que dice un grupo de una regla, con las mayúsculas y los acentos de lo que escribiste. */
function captura(original: string, rx: RegExp, grupo = 1): string | null {
  const s = norm(original);
  const m = new RegExp(rx.source, rx.flags.includes('d') ? rx.flags : rx.flags + 'd').exec(s) as (RegExpExecArray & { indices?: [number, number][] }) | null;
  if (!m || m[grupo] == null) return null;
  const ind = m.indices?.[grupo];
  return ind && s.length === original.length ? original.slice(ind[0], ind[1]).trim() : m[grupo].trim();
}
/** «leche, huevos y 2 limones» → ['Leche', 'Huevos', '2 limones'] */
const ARTICULO = /^(?:un|una|unos|unas|el|la|los|las|mi|mis|mi)\s+/i;
const lista = (t: string) => t.split(/\s*,\s*|\s+y\s+|\s+e\s+(?=[aeiou])/i).map((x) => x.replace(ARTICULO, '').replace(/[.!?]+$/, '').trim()).filter(Boolean).slice(0, 8).map(mayus);
const unir = (xs: string[]) => (xs.length < 2 ? xs.join('') : xs.slice(0, -1).join(', ') + ' y ' + xs[xs.length - 1]);

// ---------- Lista de compras ----------
const RX_COMPRAS = /^(?:me\s+)?(?:agrega(?:r)?|anade|anadir|anota(?:r)?|apunta(?:r)?|pon(?:er)?|compra(?:r)?)\s+(.+?)\s+(?:a|en|para)\s+(?:mi\s+|la\s+)?(?:lista|compras)(?:\s+de\s+(?:las\s+)?compras)?$/;
const RX_FALTA = /^(?:me\s+)?(?:falta(?:n)?|se\s+me\s+acab(?:o|aron)|se\s+acab(?:o|aron)|ya\s+no\s+tengo|necesito\s+comprar|hay\s+que\s+comprar)\s+(.+)$/;
const armarCompras = (articulos: string[]): Entendido | null => articulos.length ? { id: 'compras', datos: { articulos }, resumen: 'Agregar a tu lista de compras: ' + unir(articulos) + '.' } : null;
const compras: Intencion = {
  id: 'compras',
  descripcion: 'Agregar cosas a la lista de compras de esta semana.',
  formato: '{"articulos":["leche","huevos"]}',
  ejemplos: ['agrega leche y huevos a la lista'],
  reglas: (f) => { const t = captura(f, RX_COMPRAS) ?? captura(f, RX_FALTA); return t ? armarCompras(lista(t)) : null; },
  desdeModelo: (d) => armarCompras(textos(d.articulos).map(mayus)),
  aplicar: async (e) => {
    const nombres = textos(e.datos.articulos);
    const nuevos = await agregarFaltantes(nombres, hoyIso());
    if (!nuevos.length) return { aviso: 'Eso ya estaba en tu lista de compras' };
    return { aviso: 'Agregué a tu lista: ' + unir(nuevos), deshacer: () => quitarFaltantes(nuevos, hoyIso()) };
  }
};

// ---------- Hogar ----------
const armarHogar = (f: Frase): Entendido => {
  if (f.tipo === 'hecha' && f.candidatas.length > 1) {
    return { id: 'hogar', datos: { frase: f }, resumen: 'Marcar como hecha una de estas tareas. ¿Cuál?', opciones: f.candidatas.slice(0, 4).map((c) => ({ id: 'hogar', datos: { frase: { tipo: 'hecha', candidatas: [c] } }, resumen: 'Marcar «' + c.n + '» como hecha.' })) };
  }
  return { id: 'hogar', datos: { frase: f }, resumen: entendi(f) };
};
const hogar: Intencion = {
  id: 'hogar',
  descripcion: 'Tareas de la casa: marcar una como hecha, agregar una tarea nueva, o decir cuánto tiempo y energía hay hoy.',
  formato: '{"tipo":"capacidad","tiempo":20,"energia":"poca|media|buena"} o {"tipo":"hecha","tarea":"aspirar el cuarto"} o {"tipo":"agregar","n":"regar plantas","cada":3,"min":5}',
  ejemplos: ['tengo 20 minutos y poca energía', 'ya aspiré el cuarto'],
  reglas: async (f) => { const r = interpretar(f, await listarTareas()); return r ? armarHogar(r) : null; },
  desdeModelo: async (d) => {
    if (d.tipo === 'capacidad') {
      const energia = (['poca', 'media', 'buena'] as Energia[]).find((x) => x === d.energia);
      const tiempo = typeof d.tiempo === 'number' && d.tiempo > 0 && d.tiempo <= 600 ? Math.round(d.tiempo) : undefined;
      return energia || tiempo ? armarHogar({ tipo: 'capacidad', energia, tiempo: tiempo ? ([60, 30, 15, 5].find((t) => t <= tiempo) ?? 5) : undefined }) : null;
    }
    if (d.tipo === 'agregar') {
      const n = texto(d.n);
      return n ? armarHogar({ tipo: 'agregar', n, ...(typeof d.cada === 'number' && d.cada > 0 ? { cada: Math.round(d.cada) } : {}), ...(typeof d.min === 'number' && d.min > 0 ? { min: Math.round(d.min) } : {}) }) : null;
    }
    if (d.tipo === 'hecha') {
      const c = buscarTarea(texto(d.tarea), await listarTareas());
      return c.length ? armarHogar({ tipo: 'hecha', candidatas: c }) : null;
    }
    return null;
  },
  aplicar: async (e) => {
    const f = e.datos.frase as Frase;
    const r = await aplicarFrase(f, hoyIso(), f.tipo === 'hecha' ? f.candidatas[0] : undefined);
    if (f.tipo === 'capacidad') nav.abrir('hogar');
    return r;
  }
};

// ---------- Rutina de hoy ----------
const RX_RUTINA = /\brutina\s+([a-z])\b/;
const armarRutina = (letra: string): Entendido => ({ id: 'rutina', datos: { letra }, resumen: 'Hoy: Rutina ' + letra + '.' });
const rutina: Intencion = {
  id: 'rutina',
  descripcion: 'Elegir qué rutina de entrenamiento se hace hoy.',
  formato: '{"letra":"A"}',
  ejemplos: ['hoy hago la rutina C'],
  reglas: async (f) => {
    const s = norm(f);
    const m = RX_RUTINA.exec(s);
    if (!m || !/\b(hago|hare|hacer|voy a|toca|entreno|entrenar|empiezo|empezar|quiero|elijo|cambio|cambiar|pon|usar|usa)\b|^rutina\b/.test(s)) return null;
    const letra = m[1].toUpperCase();
    return (await letrasDeRutina()).includes(letra) ? armarRutina(letra) : null;
  },
  desdeModelo: async (d) => { const l = texto(d.letra, 1).toUpperCase(); return l && (await letrasDeRutina()).includes(l) ? armarRutina(l) : null; },
  aplicar: async (e) => {
    const r = await elegirRutinaHoy(String(e.datos.letra));
    if (!r.ok) return { aviso: r.motivo === 'ya-hay-sesion' ? 'Hoy ya empezaste o terminaste una rutina. Quedó como estaba.' : r.motivo === 'no-existe' ? 'No encontré esa rutina en tu programa.' : 'Todavía no cargas tu programa.' };
    nav.irTab('rutina');
    return { aviso: 'Hoy toca la Rutina ' + e.datos.letra, deshacer: r.deshacer };
  }
};

// ---------- Registrar lo que comí ----------
const RX_COMI = /^(?:(hoy|ayer|ahorita|ahora)\s+)?(?:me\s+)?(comi|desayune|cene|almorce|tome|merende|botanee)\s+(.+)$/;
type Comida = 0 | 1 | 2 | 3;
const NOMBRE_COMIDA: Record<Comida, string> = { 0: 'desayuno', 1: 'comida', 2: 'colación', 3: 'cena' };
const VERBO_A_COMIDA: Record<string, Comida> = { desayune: 0, comi: 1, almorce: 1, tome: 2, merende: 2, botanee: 2, cene: 3 };
const ayer = () => { const d = new Date(); d.setDate(d.getDate() - 1); return iso(d); };
const armarComida = (alimentos: string[], comida: Comida, deAyer: boolean): Entendido | null => alimentos.length
  ? { id: 'comida', datos: { alimentos, comida, ayer: deAyer }, resumen: 'Anotar en tu registro de comida (' + (deAyer ? 'ayer, ' : 'hoy, ') + NOMBRE_COMIDA[comida] + '): ' + unir(alimentos) + '. Solo el nombre, sin números.' }
  : null;
const comida: Intencion = {
  id: 'comida',
  descripcion: 'Anotar en el registro de comida lo que ya comió o bebió (solo nombres).',
  formato: '{"alimentos":["yogur","fruta"],"tiempo":"desayuno|comida|colacion|cena","cuando":"hoy|ayer"}',
  ejemplos: ['hoy comí yogur y fruta'],
  reglas: (f) => {
    const s = norm(f);
    const m = RX_COMI.exec(s);
    const t = captura(f, RX_COMI, 3);
    if (!m || !t) return null;
    return armarComida(lista(t), VERBO_A_COMIDA[m[2]], m[1] === 'ayer');
  },
  desdeModelo: (d) => {
    const mapa: Record<string, Comida> = { desayuno: 0, comida: 1, colacion: 2, cena: 3 };
    return armarComida(textos(d.alimentos).map(mayus), mapa[texto(d.tiempo, 12)] ?? 1, d.cuando === 'ayer');
  },
  aplicar: async (e) => {
    const nombres = textos(e.datos.alimentos);
    const deshacer = await anotarComido(nombres, (e.datos.comida as Comida) ?? 1, e.datos.ayer ? ayer() : hoyIso());
    return { aviso: 'Anotado: ' + unir(nombres), deshacer };
  }
};

// ---------- Sugerir el menú ----------
const RX_SUGERIR = /(?:sugier|suger|arma|armar|arme|propon|planea|planear|dame)\w*\s+(?:me\s+)?(?:un\s+|el\s+|mi\s+|una\s+)?(?:menu|plan|semana|comidas|borrador)|(?:quiero|dame|busco|prefiero)\s+algo\s+diferente|algo\s+diferente\s+(?:para|en)\s+(?:la|esta)/;
const armarSugerir = (proxima: boolean): Entendido => ({ id: 'sugerir', datos: { proxima }, resumen: 'Armar un borrador de menú para ' + (proxima ? 'la próxima semana' : 'esta semana') + '. Lo verás antes de guardar nada.' });
const sugerir: Intencion = {
  id: 'sugerir',
  descripcion: 'Sugerir un borrador del menú de la semana.',
  formato: '{"semana":"esta|proxima"}',
  ejemplos: ['sugiéreme el menú de la próxima semana'],
  reglas: (f) => { const s = norm(f); return RX_SUGERIR.test(s) ? armarSugerir(/proxima|que viene/.test(s)) : null; },
  desdeModelo: (d) => armarSugerir(d.semana === 'proxima'),
  aplicar: (e) => { nav.abrir('tarjetas', { acomodar: 1, sugerir: 1, ...(e.datos.proxima ? { k: -1 } : {}) }); }
};

// ---------- Lo que hay en casa ----------
const RX_TENGO = /^(?:hoy\s+|ahorita\s+)?(?:tengo|tenemos|hay|me\s+quedan|quedan)\s+(.+)$/;
const RX_NEVERA = /con lo que (?:tengo|hay)|plan (?:con|de) lo que (?:tengo|hay)|que (?:puedo|podemos) (?:cocinar|hacer de comer) con/;
/** «Tengo hambre» no es un alimento. */
const NO_ALIMENTO = /^(?:hambre|sed|sueno|ganas|frio|calor|prisa|tiempo|dudas?|un problema|que|poco|mucho|miedo|cita|junta|reunion|pendientes?|energia|cansancio)\b/;
const armarNevera = (alimentos: { n: string; q?: string; urgente?: boolean }[]): Entendido => ({
  id: 'nevera', datos: { alimentos },
  resumen: alimentos.length ? 'Anotar lo que hay en casa (' + unir(alimentos.map((a) => a.n)) + ') y abrir «Con lo que tengo».' : 'Abrir «Con lo que tengo».'
});
const nevera: Intencion = {
  id: 'nevera',
  descripcion: 'Anotar lo que hay en casa y armar un plan con eso.',
  formato: '{"alimentos":["pollo","3 jitomates"]}',
  ejemplos: ['tengo pollo, 3 jitomates y yogur'],
  reglas: (f) => {
    const s = norm(f);
    if (RX_NEVERA.test(s)) return armarNevera([]);
    const t = captura(f, RX_TENGO);
    if (!t || NO_ALIMENTO.test(norm(t))) return null;
    const alimentos = leerTextoHay(t);
    return alimentos.length ? armarNevera(alimentos) : null;
  },
  desdeModelo: (d) => armarNevera(leerTextoHay(textos(d.alimentos).join(', '))),
  aplicar: async (e) => {
    const alimentos = (e.datos.alimentos as { n: string; q?: string; urgente?: boolean }[]) ?? [];
    const deshacer = alimentos.length ? await anotarHay(alimentos, hoyIso()) : undefined;
    nav.abrir('nevera');
    return { aviso: alimentos.length ? 'Anoté lo que hay en casa' : undefined, deshacer };
  }
};

// ---------- Inspiración ----------
const inspiracion: Intencion = {
  id: 'inspiracion',
  descripcion: 'Mostrar las inspiraciones (fotos e ideas de platillos) para planear.',
  formato: '{}',
  ejemplos: ['muéstrame las inspiraciones de hoy'],
  reglas: (f) => (/inspiraci/.test(norm(f)) ? { id: 'inspiracion', datos: {}, resumen: 'Abrir la inspiración de tu menú.' } : null),
  desdeModelo: () => ({ id: 'inspiracion', datos: {}, resumen: 'Abrir la inspiración de tu menú.' }),
  aplicar: () => { nav.abrir('menu', { inspiracion: 1 }); }
};

// ---------- Ir a una pantalla ----------
const DESTINOS: { rx: RegExp; nombre: string; ir: () => void }[] = [
  { rx: /con lo que tengo|nevera|refri/, nombre: 'Con lo que tengo', ir: () => nav.abrir('nevera') },
  { rx: /lista de compras|compras/, nombre: 'la lista de compras', ir: () => nav.abrir('compras') },
  { rx: /preparaci/, nombre: 'el plan de preparación', ir: () => nav.abrir('prep') },
  { rx: /hoy toca/, nombre: 'Hoy toca', ir: () => nav.abrir('hoytoca') },
  { rx: /recetas|recetario/, nombre: 'el Recetario', ir: () => nav.abrir('recetas') },
  { rx: /menu/, nombre: 'el menú', ir: () => nav.abrir('menu') },
  { rx: /perfiles/, nombre: 'los perfiles de comida', ir: () => nav.abrir('perfiles') },
  { rx: /\btips\b|combinaciones/, nombre: 'los tips', ir: () => nav.abrir('tips') },
  { rx: /hogar|tareas de la casa|\bcasa\b/, nombre: 'Hogar', ir: () => nav.abrir('hogar') },
  { rx: /planeador|\balma\b/, nombre: 'el planeador de Alma', ir: () => nav.irTab('alma') },
  { rx: /coleccion|\bmente\b/, nombre: 'la colección de Mente', ir: () => nav.abrir('mente') },
  { rx: /patrones/, nombre: 'los patrones', ir: () => nav.abrir('patrones') },
  { rx: /ajustes/, nombre: 'Ajustes', ir: () => nav.abrir('ajustes') },
  { rx: /\brutina\b/, nombre: 'Rutina', ir: () => nav.irTab('rutina') },
  { rx: /\bcomida\b/, nombre: 'Comida', ir: () => nav.irTab('comida') },
  { rx: /\bcuerpo\b|medidas|peso/, nombre: 'Cuerpo', ir: () => nav.abrir('cuerpo') },
  { rx: /\binicio\b/, nombre: 'Inicio', ir: () => nav.irTab('inicio') }
];
const RX_ABRIR = /^(?:abre|abrir|ve a|ir a|llevame a|muestrame|muestra|quiero ver|ver)\s+(?:a\s+)?(?:mi\s+|mis\s+|la\s+|el\s+|los\s+|las\s+)?(.+)$/;
const armarAbrir = (i: number): Entendido => ({ id: 'abrir', datos: { i }, resumen: 'Abrir ' + DESTINOS[i].nombre + '.' });
const abrir: Intencion = {
  id: 'abrir',
  descripcion: 'Abrir una pantalla de la app.',
  formato: '{"pantalla":"compras|menu|recetas|hogar|alma|mente|ajustes|rutina|comida|cuerpo|inicio|tips|perfiles|patrones"}',
  ejemplos: ['abre la lista de compras'],
  reglas: (f) => { const t = captura(f, RX_ABRIR); if (!t) return null; const i = DESTINOS.findIndex((d) => d.rx.test(norm(t))); return i >= 0 ? armarAbrir(i) : null; },
  desdeModelo: (d) => { const i = DESTINOS.findIndex((x) => x.rx.test(norm(texto(d.pantalla)))); return i >= 0 ? armarAbrir(i) : null; },
  aplicar: (e) => { DESTINOS[Number(e.datos.i)]?.ir(); }
};

/** El orden de aquí es el orden en que las reglas miran la frase. */
export function registrarIntenciones() {
  for (const i of [compras, hogar, rutina, comida, sugerir, inspiracion, nevera, abrir]) registrar(i);
}
