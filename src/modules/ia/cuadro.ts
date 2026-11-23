import { extraerJson, MODELO_TEXTO, preguntar, type Pregunta } from './api';

// El cuadro único: una frase escrita o dicha se enruta a la acción correcta.
// Primero reglas locales (sin IA). Solo si ninguna entiende y tú lo pides, una llamada con la frase y la lista de acciones.
// Cada acción es un manejador registrado aquí; agregar una no toca las demás. Siempre se confirma antes de guardar nada.

export interface Entendido {
  /** La acción que entendió. */
  id: string;
  datos: Record<string, unknown>;
  /** Lo que se muestra para confirmar: «Marcar la rutina C de hoy». */
  resumen: string;
  /** Si caben varias lecturas (¿cuál de estas tareas?), eliges una. */
  opciones?: Entendido[];
}
export interface Resultado {
  aviso?: string;
  deshacer?: () => void | Promise<void>;
}
export interface Intencion {
  id: string;
  /** Una línea para el modelo cuando las reglas no entienden. */
  descripcion: string;
  /** La forma de `datos` que el modelo debe devolver. */
  formato: string;
  ejemplos: string[];
  /** Reglas locales sobre una frase corta. `null` si no es de esta acción. */
  reglas: (frase: string) => Entendido | null | Promise<Entendido | null>;
  /** Valida lo que contestó el modelo. `null` si no sirve. */
  desdeModelo: (datos: Record<string, unknown>) => Entendido | null | Promise<Entendido | null>;
  aplicar: (e: Entendido) => Resultado | void | Promise<Resultado | void>;
}

const registro = new Map<string, Intencion>();
/** Agrega una acción (o cambia la que tenía el mismo nombre). Solo se llama al iniciar la app. */
export function registrar(i: Intencion) { registro.set(i.id, i); }
export const intenciones = (): Intencion[] => [...registro.values()];
export const intencionDe = (id: string) => registro.get(id);
/** Para las pruebas. */
export function vaciarRegistro() { registro.clear(); }

const CORTE = 300;
const INICIO_DE_IDEA = '(?:la|el|los|las|hoy|ahora|manana|mañana|ayer|esta|este|proxima|próxima|quiero|tambien|también|ya|tengo|toca|me|voy|haz|haga|agrega|agregar|anota|abre|muestrame|muéstrame|sugiere|sugiereme)';
/** Parte una frase en ideas, solo donde de verdad empieza otra («… y la próxima semana quiero …»). */
export function partir(frase: string): string[] {
  const t = frase.trim().slice(0, CORTE);
  return t
    .split(new RegExp('\\s*[.;\\n]+\\s*|\\s*,\\s+(?=' + INICIO_DE_IDEA + '\\b)|\\s+y\\s+(?=' + INICIO_DE_IDEA + '\\b)', 'i'))
    .map((x) => x.trim())
    .filter(Boolean);
}

async function primera(texto: string): Promise<Entendido | null> {
  for (const i of registro.values()) {
    const e = await i.reglas(texto);
    if (e) return e;
  }
  return null;
}

/** Entiende una frase con reglas locales, sin IA. Una frase con dos ideas da dos acciones. Si no entiende, `[]`. */
export async function entender(frase: string): Promise<Entendido[]> {
  const t = frase.trim().slice(0, CORTE);
  if (!t) return [];
  const ideas = partir(t);
  if (ideas.length > 1) {
    const entendidas: Entendido[] = [];
    for (const idea of ideas) {
      const e = await primera(idea);
      if (!e) break;
      entendidas.push(e);
    }
    if (entendidas.length === ideas.length) return entendidas;
  }
  const todo = await primera(t);
  return todo ? [todo] : [];
}

const SISTEMA_CUADRO = 'Eres el selector de acciones de una app personal de bienestar. Recibes una frase en español de México y una lista de acciones. ' +
  'Elige la acción que corresponde y devuelve sus datos. No tienes más contexto y no inventas datos que la frase no dice. ' +
  'Responde SOLO con JSON: {"intencion":"id","datos":{...}} o {"intencion":"ninguna"}.';

/** La lista de acciones que se le manda al modelo: solo nombres, para qué sirven y la forma de sus datos. */
export function textoDeAcciones(): string {
  return [...registro.values()].map((i) => '- ' + i.id + ': ' + i.descripcion + ' datos: ' + i.formato + (i.ejemplos.length ? ' Ejemplo: «' + i.ejemplos[0] + '»' : '')).join('\n');
}

/** Una sola llamada: la frase y la lista de acciones, nada de tus datos. El resultado se valida antes de mostrarlo. */
export async function entenderConIA(clave: string, frase: string, ask: (p: Pregunta, clave: string) => Promise<string> = preguntar): Promise<Entendido[]> {
  const t = frase.trim().slice(0, CORTE);
  const r = await ask({ modelo: MODELO_TEXTO, sistema: SISTEMA_CUADRO, max: 400, texto: 'Acciones:\n' + textoDeAcciones() + '\n\nFrase: «' + t + '»' }, clave);
  const j = extraerJson(r);
  const id = typeof j.intencion === 'string' ? j.intencion : '';
  const i = registro.get(id);
  if (!i || !j.datos || typeof j.datos !== 'object' || Array.isArray(j.datos)) return [];
  const e = await i.desdeModelo(j.datos as Record<string, unknown>);
  return e ? [e] : [];
}

/** Aplica lo que confirmaste. */
export async function ejecutar(e: Entendido): Promise<Resultado | void> {
  const i = registro.get(e.id);
  if (!i) return;
  return i.aplicar(e);
}
