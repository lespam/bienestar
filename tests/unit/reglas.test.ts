import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { tocaRespaldo } from '../../src/modules/ajustes/prefs.svelte';
import { Nav } from '../../src/core/nav.svelte';
import { DIA_MS } from '../../src/core/fechas';

const base = { recordarRespaldo: true, ultimoRespaldo: null, primerRegistro: null, respaldoOcultoHasta: null };

describe('recordatorio mensual de respaldo', () => {
  const t = Date.UTC(2026, 9, 11);
  it('aparece a los 30 días del último respaldo', () => {
    expect(tocaRespaldo({ ...base, ultimoRespaldo: t - 29 * DIA_MS }, t)).toBe(false);
    expect(tocaRespaldo({ ...base, ultimoRespaldo: t - 30 * DIA_MS }, t)).toBe(true);
  });
  it('si nunca hubo respaldo, aparece en cuanto hay algo que respaldar', () => {
    expect(tocaRespaldo(base, t)).toBe(false);
    expect(tocaRespaldo({ ...base, primerRegistro: t - DIA_MS }, t)).toBe(true);
    expect(tocaRespaldo({ ...base, primerRegistro: t - DIA_MS, respaldoOcultoHasta: t + DIA_MS }, t)).toBe(false);
  });
  it('"Ahora no" la esconde 7 días y el interruptor la apaga', () => {
    const v = { ...base, ultimoRespaldo: t - 40 * DIA_MS };
    expect(tocaRespaldo({ ...v, respaldoOcultoHasta: t + DIA_MS }, t)).toBe(false);
    expect(tocaRespaldo({ ...v, recordarRespaldo: false }, t)).toBe(false);
  });
});

describe('gesto atrás', () => {
  it('cierra la hoja, luego la pantalla, luego regresa a Inicio y avisa antes de salir', () => {
    const n = new Nav();
    let aviso = '';
    (n as unknown as { avisar: (t: string) => void }).avisar = (t) => { aviso = t; };
    n.irTab('comida');
    n.abrir('ajustes');
    n.abrirHoja('enlace');
    expect(n.atras(0)).toBe(false); expect(n.hoja).toBeNull(); expect(n.pantalla?.id).toBe('ajustes');
    expect(n.atras(0)).toBe(false); expect(n.pantalla).toBeNull(); expect(n.tab).toBe('comida');
    expect(n.atras(0)).toBe(false); expect(n.tab).toBe('inicio');
    expect(n.atras(1000)).toBe(false); expect(aviso).toBe('Desliza otra vez para salir');
    expect(n.atras(2000)).toBe(true);
    expect(n.atras(10000)).toBe(false);
  });
});

// Reglas de tono: nada de culpa, rojos de alerta ni cuentas regresivas de castigo.
function archivos(d: string): string[] {
  return readdirSync(d).flatMap((f) => { const p = join(d, f); return statSync(p).isDirectory() ? archivos(p) : [p]; });
}
describe('tono', () => {
  const textos = archivos('src').filter((f) => /\.(svelte|ts)$/.test(f)).map((f) => [f, readFileSync(f, 'utf8')] as const);
  it('sin palabras de culpa', () => {
    const malas = /\b(fallaste|fallo|fallaste|rompiste|trampa|tramposa|castigo|culpable|mal hecho|perdiste tu racha|racha perdida)\b/i;
    for (const [f, t] of textos) expect(malas.test(t), f).toBe(false);
  });
  it('sin rojos de alerta', () => {
    const css = readFileSync('src/core/calma.css', 'utf8') + textos.map((x) => x[1]).join('\n');
    expect(/#(f00|ff0000|e53935|d32f2f|c62828|dc2626|ef4444)\b|\bcolor:\s*red\b/i.test(css)).toBe(false);
  });
});
