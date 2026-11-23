import type Dexie from 'dexie';

// Cuándo cambió cada tabla. Sirve para el paquete de continuidad: al pasar tus datos entre el teléfono y la computadora,
// la app compara estas fechas y te dice qué se reemplaza o se combina. Sin servidor: las fechas viven en tu base.

/** Tablas que no cuentan como cambios tuyos. */
const SIN_SEGUIMIENTO = new Set(['copias', 'sync']);
const ESPERA_MS = 300;

interface Seguimiento {
  /** Lo que cambió desde que se guardó por última vez. */
  pendiente: Record<string, number>;
  temporizador: ReturnType<typeof setTimeout> | undefined;
  volcando: Promise<void>;
}
const porBase = new WeakMap<Dexie, Seguimiento>();

/** Empieza a anotar cuándo cambia cada tabla. Se llama una vez por cada base, al crearla. */
export function vigilarCambios(base: Dexie): void {
  const s: Seguimiento = { pendiente: {}, temporizador: undefined, volcando: Promise.resolve() };
  porBase.set(base, s);
  const marcar = (tabla: string) => {
    s.pendiente[tabla] = Date.now();
    clearTimeout(s.temporizador);
    s.temporizador = setTimeout(() => { void volcar(base); }, ESPERA_MS);
  };
  for (const t of base.tables) {
    if (SIN_SEGUIMIENTO.has(t.name)) continue;
    const nombre = t.name;
    t.hook('creating', () => { marcar(nombre); });
    t.hook('updating', () => { marcar(nombre); });
    t.hook('deleting', () => { marcar(nombre); });
  }
}

/** Guarda en la base lo que cambió. Una sola escritura a la vez. */
export function volcar(base: Dexie): Promise<void> {
  const s = porBase.get(base);
  if (!s) return Promise.resolve();
  clearTimeout(s.temporizador);
  s.volcando = s.volcando.then(async () => {
    const nuevo = s.pendiente;
    if (!Object.keys(nuevo).length) return;
    s.pendiente = {};
    try {
      const antes = ((await base.table('sync').get('mod'))?.v ?? {}) as Record<string, number>;
      const todo = { ...antes };
      for (const [t, ms] of Object.entries(nuevo)) todo[t] = Math.max(todo[t] ?? 0, ms);
      await base.table('sync').put({ k: 'mod', v: todo });
    } catch {
      // La base se cerró (otra pestaña la actualizó o termina una prueba): se vuelve a anotar en el siguiente cambio.
      for (const [t, ms] of Object.entries(nuevo)) s.pendiente[t] = Math.max(s.pendiente[t] ?? 0, ms);
    }
  });
  return s.volcando;
}

/** Cuándo cambió cada tabla, incluso lo que todavía no se guarda. */
export async function fechasDeCambio(base: Dexie): Promise<Record<string, number>> {
  await volcar(base);
  return ((await base.table('sync').get('mod'))?.v ?? {}) as Record<string, number>;
}

/** Pone estas fechas como las de cada tabla (al traer datos de un paquete, la tabla queda con la fecha del paquete). */
export async function ponerFechasDeCambio(base: Dexie, fechas: Record<string, number>): Promise<void> {
  const s = porBase.get(base);
  await s?.volcando;
  if (s) { clearTimeout(s.temporizador); s.pendiente = {}; }
  const antes = ((await base.table('sync').get('mod'))?.v ?? {}) as Record<string, number>;
  await base.table('sync').put({ k: 'mod', v: { ...antes, ...fechas } });
}
