import { db } from '../../core/db';
import { DIA_MS } from '../../core/fechas';
import { plataforma } from '../../core/plataforma.svelte';

// Preferencias: son de Ajustes y todos las leen por su puerta (plan, punto 1).
export type Paleta = 'calma' | 'bosque' | 'oceano' | 'atardecer';
export const PALETAS: { id: Paleta; n: string; m: string[] }[] = [
  { id: 'calma', n: 'Calma', m: ['#1b1622', '#c9b3f5', '#f2b8c6'] },
  { id: 'bosque', n: 'Bosque', m: ['#141b18', '#9fdcbf', '#f2b8c6'] },
  { id: 'oceano', n: 'Océano', m: ['#121822', '#a9c8f0', '#f2b8c6'] },
  { id: 'atardecer', n: 'Atardecer', m: ['#1e1517', '#f5b9a6', '#a8dcc5'] }
];
/** Pone la paleta en toda la app y en la barra del teléfono. */
export function aplicarPaleta(p: Paleta) {
  if (typeof document === 'undefined') return;
  const raiz = document.documentElement;
  if (p === 'calma') delete raiz.dataset.paleta; else raiz.dataset.paleta = p;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', PALETAS.find((x) => x.id === p)?.m[0] ?? '#1b1622');
}

export interface Prefs {
  /** Ocultar números: true = ocultos. */
  ocultarComida: boolean;
  ocultarEntreno: boolean;
  unidad: 'lb' | 'kg';
  enlaces: { yt: string; am: string; ob: string };
  recordarRespaldo: boolean;
  ultimoRespaldo: number | null;
  /** Desde cuándo cuenta el recordatorio si nunca hiciste un respaldo. */
  primerRegistro: number | null;
  respaldoOcultoHasta: number | null;
  bienvenida: boolean;
  /** Colores de la app (Ajustes > Colores). */
  paleta: Paleta;
}

export const PREFS_INICIALES: Prefs = {
  ocultarComida: true,
  ocultarEntreno: false,
  unidad: 'lb',
  enlaces: { yt: 'https://www.youtube.com', am: 'https://music.apple.com', ob: '' },
  recordarRespaldo: true,
  ultimoRespaldo: null,
  primerRegistro: null,
  respaldoOcultoHasta: null,
  bienvenida: false,
  paleta: 'calma'
};

export const prefs = $state<Prefs>(structuredClone(PREFS_INICIALES));

export async function cargarPrefs() {
  const filas = await db.ajustes.toArray();
  const p = structuredClone(PREFS_INICIALES) as unknown as Record<string, unknown>;
  for (const f of filas) if (f.k in p) p[f.k] = f.v;
  Object.assign(prefs, p);
  aplicarPaleta(prefs.paleta);
}

export async function guardar<K extends keyof Prefs>(k: K, v: Prefs[K]) {
  prefs[k] = v;
  await db.ajustes.put({ k, v: $state.snapshot(v) });
  if (prefs.primerRegistro == null && k !== 'primerRegistro') {
    // La primera vez que guardas algo, la app pide guardar sus datos de forma permanente.
    await guardar('primerRegistro', Date.now());
    await plataforma.pedirGuardado();
  }
}

/** Otros módulos la llaman al guardar tu primer registro: pide guardar los datos de forma permanente. */
export async function registroNuevo() {
  if (prefs.primerRegistro != null) return;
  await guardar('primerRegistro', Date.now());
  await plataforma.pedirGuardado();
}

/** La tarjeta mensual: 30 días sin respaldo (o desde tu primer registro); "Ahora no" la esconde 7 días. */
export function tocaRespaldo(p: Pick<Prefs, 'recordarRespaldo' | 'ultimoRespaldo' | 'primerRegistro' | 'respaldoOcultoHasta'>, ahora = Date.now()): boolean {
  if (!p.recordarRespaldo) return false;
  if (p.respaldoOcultoHasta && ahora < p.respaldoOcultoHasta) return false;
  // Hasta tu primer respaldo se ve en cuanto hay algo que respaldar; después, una vez al mes.
  if (p.ultimoRespaldo == null) return p.primerRegistro != null;
  return ahora - p.ultimoRespaldo >= 30 * DIA_MS;
}

export function ahoraNoRespaldo(ahora = Date.now()) { return guardar('respaldoOcultoHasta', ahora + 7 * DIA_MS); }

export function enlaceObsidian(boveda: string) {
  return boveda ? 'obsidian://open?vault=' + encodeURIComponent(boveda) : 'obsidian://open';
}
