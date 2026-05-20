/**
 * Tests unitarios de utils/formatters.js
 */
import { describe, it, expect } from 'vitest';
import {
  todayBogota,
  toDateBogota,
  formatDateDisplay,
  formatCurrency,
  formatDate,
  formatDateTime,
  formatDateLong,
  formatStatus,
} from './formatters';

describe('todayBogota', () => {
  it('devuelve formato YYYY-MM-DD', () => {
    const r = todayBogota();
    expect(r).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe('toDateBogota', () => {
  it('convierte Date a YYYY-MM-DD', () => {
    const d = new Date('2026-05-19T12:00:00Z');
    const r = toDateBogota(d);
    expect(r).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('convierte string ISO a YYYY-MM-DD', () => {
    const r = toDateBogota('2026-05-19T17:00:00Z');
    expect(r).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe('formatDateDisplay', () => {
  it('YYYY-MM-DD se formatea a dd/mm/yyyy sin conversión UTC', () => {
    expect(formatDateDisplay('2026-05-19')).toBe('19/05/2026');
  });

  it('null devuelve "N/A"', () => {
    expect(formatDateDisplay(null)).toBe('N/A');
  });

  it('undefined devuelve "N/A"', () => {
    expect(formatDateDisplay(undefined)).toBe('N/A');
  });

  it('cadena vacía devuelve "N/A"', () => {
    expect(formatDateDisplay('')).toBe('N/A');
  });

  it('fecha inválida devuelve "Fecha inválida"', () => {
    expect(formatDateDisplay('hola-mundo')).toBe('Fecha inválida');
  });

  it('ISO completo se formatea correctamente', () => {
    // 19 mayo 2026 al mediodía UTC → en Bogotá (UTC-5) es 7am, mismo día
    const r = formatDateDisplay('2026-05-19T12:00:00Z');
    expect(r).toMatch(/19\/05\/2026/);
  });
});

describe('formatCurrency', () => {
  it('formatea número como COP', () => {
    const r = formatCurrency(1500);
    expect(r).toContain('1.500'); // separador de miles colombiano
    expect(r).toMatch(/\$/);
  });

  it('formatea string numérico', () => {
    const r = formatCurrency('25000');
    expect(r).toContain('25.000');
  });

  it('valor null o undefined devuelve $0', () => {
    expect(formatCurrency(null)).toMatch(/\$\s?0/);
    expect(formatCurrency(undefined)).toMatch(/\$\s?0/);
  });

  it('valor no numérico devuelve $0', () => {
    expect(formatCurrency('abc')).toMatch(/\$\s?0/);
  });

  it('sin decimales (maximumFractionDigits=0)', () => {
    const r = formatCurrency(1500.99);
    expect(r).not.toContain(',99');
  });

  it('valores grandes', () => {
    const r = formatCurrency(1234567);
    expect(r).toContain('1.234.567');
  });
});

describe('formatDate alias de formatDateDisplay', () => {
  it('comportamiento idéntico', () => {
    expect(formatDate('2026-05-19')).toBe(formatDateDisplay('2026-05-19'));
  });
});

describe('formatDateTime', () => {
  it('YYYY-MM-DD sin hora delega en formatDateDisplay', () => {
    expect(formatDateTime('2026-05-19')).toBe('19/05/2026');
  });

  it('null devuelve "N/A"', () => {
    expect(formatDateTime(null)).toBe('N/A');
  });

  it('ISO con hora incluye HH:mm', () => {
    const r = formatDateTime('2026-05-19T15:30:00Z');
    expect(r).toMatch(/\d{2}\/\d{2}\/\d{4}\s+\d{2}:\d{2}/);
  });
});

describe('formatDateLong', () => {
  it('null devuelve "N/A"', () => {
    expect(formatDateLong(null)).toBe('N/A');
  });

  it('fecha válida contiene día de la semana en español', () => {
    const r = formatDateLong('2026-05-19T12:00:00Z');
    // martes 19 de mayo de 2026
    expect(r.toLowerCase()).toMatch(/(lunes|martes|miércoles|jueves|viernes|sábado|domingo)/);
    expect(r).toMatch(/2026/);
  });
});

describe('formatStatus', () => {
  it('pagado', () => {
    const r = formatStatus('pagado');
    expect(r.label).toBe('PAGADO');
    expect(r.colorClass).toBe('text-success');
  });

  it('pendiente', () => {
    expect(formatStatus('pendiente').label).toBe('PENDIENTE');
  });

  it('parcial', () => {
    expect(formatStatus('parcial').colorClass).toBe('text-primary');
  });

  it('case insensitive', () => {
    expect(formatStatus('PAGADO').label).toBe('PAGADO');
    expect(formatStatus('Pagado').label).toBe('PAGADO');
  });

  it('estado desconocido devuelve uppercase + text-muted', () => {
    const r = formatStatus('en_proceso');
    expect(r.label).toBe('EN_PROCESO');
    expect(r.colorClass).toBe('text-muted');
  });

  it('null/undefined devuelve vacío', () => {
    const r = formatStatus(null);
    expect(r.colorClass).toBe('text-muted');
  });
});
