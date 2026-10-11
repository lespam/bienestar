// Navegación: una sola pila con pantallas y hojas (plan, punto 2b).
// El gesto atrás de Android cierra lo último que abriste: primero la hoja, después la pantalla.
// Desde otra pestaña regresa a Inicio. En Inicio, el primer gesto avisa y solo el segundo sale.

export type Tab = 'inicio' | 'rutina' | 'comida' | 'cuerpo';
export type Capa =
  | { tipo: 'pantalla'; id: string; datos?: Record<string, unknown>; desde: HTMLElement | null }
  | { tipo: 'hoja'; id: string; desde: HTMLElement | null };

const SALIR_MS = 2500;

class Nav {
  tab = $state<Tab>('inicio');
  pila = $state<Capa[]>([]);
  /** Aumenta cada vez que cambia la pantalla visible, para mover el foco al título. */
  cambio = $state(0);
  private salirHasta = 0;
  private avisar: (t: string) => void = () => {};

  get pantalla() {
    for (let i = this.pila.length - 1; i >= 0; i--) { const c = this.pila[i]; if (c.tipo === 'pantalla') return c; }
    return null;
  }
  get hoja() {
    const c = this.pila[this.pila.length - 1];
    return c?.tipo === 'hoja' ? c : null;
  }
  hojaAbierta(id: string) { return this.hoja?.id === id; }

  private foco(): HTMLElement | null {
    return typeof document !== 'undefined' && document.activeElement instanceof HTMLElement ? document.activeElement : null;
  }

  irTab(t: Tab) { this.pila = []; this.tab = t; this.cambio++; }
  abrir(id: string, datos?: Record<string, unknown>) { this.pila = [...this.pila, { tipo: 'pantalla', id, datos, desde: this.foco() }]; this.cambio++; }
  abrirHoja(id: string) { this.pila = [...this.pila, { tipo: 'hoja', id, desde: this.foco() }]; }

  /** Cierra lo último abierto y devuelve el foco al botón que lo abrió. */
  cerrar() {
    const c = this.pila[this.pila.length - 1];
    if (!c) return;
    this.pila = this.pila.slice(0, -1);
    if (c.tipo === 'pantalla') this.cambio++;
    const d = c.desde;
    if (d) queueMicrotask(() => { if (d.isConnected) d.focus(); });
  }

  /** Cierra hojas y pantallas hasta quedar en la pantalla `id` (por ejemplo, de una receta de vuelta al menú). */
  cerrarHasta(id: string) {
    while (this.pila.length && this.pantalla?.id !== id) this.cerrar();
  }

  /** Reemplaza la pantalla de arriba, sin dejarla en la pila (por ejemplo, de la bienvenida a Inicio). */
  reemplazar(id: string, datos?: Record<string, unknown>) {
    this.pila = [...this.pila.slice(0, -1), { tipo: 'pantalla', id, datos, desde: null }];
    this.cambio++;
  }

  /** Qué hace el gesto atrás. Devuelve true si la app debe salir. */
  atras(ahora = Date.now()): boolean {
    if (this.pila.length) { this.cerrar(); return false; }
    if (this.tab !== 'inicio') { this.irTab('inicio'); return false; }
    if (ahora < this.salirHasta) return true;
    this.salirHasta = ahora + SALIR_MS;
    this.avisar('Desliza otra vez para salir');
    return false;
  }

  /** Conecta el gesto atrás del teléfono con la pila. */
  conectar(avisar: (t: string) => void) {
    this.avisar = avisar;
    history.replaceState({ b: 0 }, '');
    history.pushState({ b: 1 }, '');
    addEventListener('popstate', () => {
      if (this.atras()) history.back();
      else history.pushState({ b: 1 }, '');
    });
  }
}

export const nav = new Nav();
export { Nav };
