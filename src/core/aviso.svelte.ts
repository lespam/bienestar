// Avisos: los simples duran 4 s; "Deshacer" dura 10 s y se detiene mientras lo tocas o lo enfocas (regla 6).
export const AVISO_MS = 4000;
export const DESHACER_MS = 10000;

class Avisos {
  texto = $state('');
  visible = $state(false);
  deshacerTexto = $state('');
  deshacerFn = $state<null | (() => void)>(null);
  private t1: ReturnType<typeof setTimeout> | undefined;
  private t2: ReturnType<typeof setTimeout> | undefined;

  mostrar(t: string) {
    this.texto = t; this.visible = true;
    clearTimeout(this.t1);
    this.t1 = setTimeout(() => { this.visible = false; }, AVISO_MS);
  }
  deshacer(t: string, fn: () => void) {
    this.visible = false;
    this.deshacerTexto = t; this.deshacerFn = fn;
    this.armar();
  }
  armar() { clearTimeout(this.t2); this.t2 = setTimeout(() => this.quitar(), DESHACER_MS); }
  pausar() { clearTimeout(this.t2); }
  quitar() { clearTimeout(this.t2); this.deshacerFn = null; }
  usar() { const f = this.deshacerFn; this.quitar(); f?.(); }
}

export const avisos = new Avisos();
