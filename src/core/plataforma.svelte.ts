// Cosas del teléfono: guardado permanente y versiones nuevas (plan, puntos 2a y 2b).

class Plataforma {
  /** null mientras se revisa; false si el navegador no asegura guardar los datos. */
  persistente = $state<boolean | null>(null);
  /** Hay una versión nueva lista; Inicio ofrece "Actualizar". */
  nuevaVersion = $state(false);
  /** Aumenta cuando cambian todos tus datos (importar o deshacer), para volver a leerlos. */
  datos = $state(0);
  private aplicar: (() => Promise<void>) | null = null;

  /** Se revisa cada vez que abre la app. */
  async revisarGuardado() {
    try {
      this.persistente = navigator.storage?.persisted ? await navigator.storage.persisted() : false;
    } catch { this.persistente = false; }
  }
  /** Se pide la primera vez que guardas algo. */
  async pedirGuardado() {
    try {
      if (navigator.storage?.persist) this.persistente = await navigator.storage.persist();
    } catch { /* se queda como estaba */ }
  }

  ofrecerVersion(aplicar: () => Promise<void>) { this.aplicar = aplicar; this.nuevaVersion = true; }
  async actualizar() { await this.aplicar?.(); }
}

export const plataforma = new Plataforma();
