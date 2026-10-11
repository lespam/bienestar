import { db } from '../../core/db';
import { DIA_MS } from '../../core/fechas';
import { plataforma } from '../../core/plataforma.svelte';

// Preferencias: son de Ajustes y todos las leen por su puerta (plan, punto 1).
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
  bienvenida: false
};

export const prefs = $state<Prefs>(structuredClone(PREFS_INICIALES));

export async function cargarPrefs() {
  const filas = await db.ajustes.toArray();
  const p = structuredClone(PREFS_INICIALES) as unknown as Record<string, unknown>;
  for (const f of filas) if (f.k in p) p[f.k] = f.v;
  Object.assign(prefs, p);
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
  const desde = p.ultimoRespaldo ?? p.primerRegistro;
  if (desde == null || ahora - desde < 30 * DIA_MS) return false;
  return !(p.respaldoOcultoHasta && ahora < p.respaldoOcultoHasta);
}

export function ahoraNoRespaldo(ahora = Date.now()) { return guardar('respaldoOcultoHasta', ahora + 7 * DIA_MS); }

export function enlaceObsidian(boveda: string) {
  return boveda ? 'obsidian://open?vault=' + encodeURIComponent(boveda) : 'obsidian://open';
}
