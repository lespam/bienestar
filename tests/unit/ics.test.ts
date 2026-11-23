import { describe, expect, it } from 'vitest';
import { calendarioIcs, plegar } from '../../src/core/ics';

const ahora = new Date(Date.UTC(2026, 10, 23, 12, 0, 0));

describe('.ics', () => {
  it('un evento de todo el día', () => {
    const t = calendarioIcs([{ id: 'ya-toca-1', titulo: 'Comprar leche', fecha: '2026-11-30', nota: 'La compras cada semana.' }], ahora);
    expect(t).toContain('BEGIN:VCALENDAR\r\nVERSION:2.0');
    expect(t).toContain('UID:ya-toca-1@cuerpo-mente-alma');
    expect(t).toContain('DTSTAMP:20261123T120000Z');
    expect(t).toContain('DTSTART;VALUE=DATE:20261130\r\nDTEND;VALUE=DATE:20261201');
    expect(t).toContain('SUMMARY:Comprar leche');
    expect(t).toContain('TRIGGER:PT9H');
    expect(t.endsWith('END:VCALENDAR\r\n')).toBe(true);
    expect(t.split('\r\n').every((x) => new TextEncoder().encode(x).length <= 75)).toBe(true);
  });
  it('un evento con hora y su duración, y el cambio de mes', () => {
    const t = calendarioIcs([{ id: 'a', titulo: 'Preparar', fecha: '2026-11-30', hora: '23:50', minutos: 30 }], ahora);
    expect(t).toContain('DTSTART:20261130T235000\r\nDTEND:20261201T002000');
    expect(t).toContain('TRIGGER:PT0S');
  });
  it('escapa comas, punto y coma y saltos de línea', () => {
    const t = calendarioIcs([{ id: 'a', titulo: 'Pollo, arroz; frijol', fecha: '2026-11-30', nota: 'Uno\nDos' }], ahora);
    expect(t).toContain('SUMMARY:Pollo\\, arroz\\; frijol');
    expect(t).toContain('DESCRIPTION:Uno\\nDos');
  });
  it('dobla las líneas largas sin partir un acento', () => {
    const largo = plegar('SUMMARY:' + 'á'.repeat(100));
    expect(largo.split('\r\n').every((x) => new TextEncoder().encode(x).length <= 75)).toBe(true);
    expect(largo.replace(/\r\n /g, '')).toBe('SUMMARY:' + 'á'.repeat(100));
  });
});
