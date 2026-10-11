// Pantalla encendida durante la sesión, el descanso y la ficha (plan, punto 2c).
// Varias pantallas pueden pedirla a la vez; se suelta cuando ya nadie la usa.
// El teléfono la suelta al salir de la app: al volver se pide otra vez.

const dueños = new Set<symbol>();
let candado: WakeLockSentinel | null = null;
let pidiendo = false;
let adios: ReturnType<typeof setTimeout> | undefined;

async function pedir() {
  if (candado || pidiendo || !dueños.size) return;
  pidiendo = true;
  try {
    const w = await navigator.wakeLock?.request('screen');
    if (w && dueños.size) candado = w; else await w?.release();
  } catch { /* algunos teléfonos o modos de ahorro no lo permiten */ }
  pidiendo = false;
}

function soltarSiNadie() {
  if (dueños.size) return;
  const c = candado; candado = null;
  c?.release().catch(() => {});
}

/** Pide la pantalla encendida; devuelve la función que la suelta. */
export function mantenerEncendida(): () => void {
  const yo = Symbol();
  dueños.add(yo);
  clearTimeout(adios);
  void pedir();
  return () => {
    dueños.delete(yo);
    // Un respiro, para que pasar de una pantalla a otra no apague y vuelva a encender.
    clearTimeout(adios);
    adios = setTimeout(soltarSiNadie, 400);
  };
}

if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && dueños.size) { candado = null; void pedir(); }
  });
}
