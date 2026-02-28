// @vitest-environment node
import { describe, it, expect } from 'vitest';
import {
  cn,
  formatCurrency,
  formatMonth,
  getCurrentMonth,
  formatDate,
  formatDateFull,
  formatDateShort,
  formatDateRelative,
  formatDateForExport,
} from './utils';

describe('cn', () => {
  it('merges class names', () => {
    expect(cn('a', 'b')).toBe('a b');
  });
  it('handles undefined and null', () => {
    expect(cn('a', undefined, null, 'b')).toBe('a b');
  });
  it('deduplicates conflicting Tailwind classes (last wins)', () => {
    expect(cn('text-red-500', 'text-blue-500')).toBe('text-blue-500');
  });
  it('handles empty input', () => {
    expect(cn()).toBe('');
  });
  it('handles falsy boolean', () => {
    expect(cn('a', false && 'b', 'c')).toBe('a c');
  });
});

describe('formatCurrency', () => {
  it('formats JPY', () => {
    const result = formatCurrency(1000);
    expect(result).toContain('1,000');
  });
  it('formats 0 yen', () => {
    const result = formatCurrency(0);
    expect(result).toContain('0');
  });
  it('formats negative amount', () => {
    const result = formatCurrency(-500);
    expect(result).toContain('500');
  });
  it('formats large amount (999,999,999)', () => {
    const result = formatCurrency(999999999);
    expect(result).toContain('999,999,999');
  });
});

describe('formatDate', () => {
  it('formats valid date to M/D', () => {
    const result = formatDate('2026-03-15');
    expect(result).toMatch(/3\/15/);
  });
  it('returns empty string for null', () => {
    expect(formatDate(null)).toBe('');
  });
  it('returns empty string for undefined', () => {
    expect(formatDate(undefined)).toBe('');
  });
  it('returns original string for invalid date', () => {
    expect(formatDate('not-a-date')).toBe('not-a-date');
  });
  it('returns empty string for empty string', () => {
    expect(formatDate('')).toBe('');
  });
});

describe('formatDateFull', () => {
  it('returns "—" for null', () => {
    expect(formatDateFull(null)).toBe('—');
  });
  it('returns "—" for undefined', () => {
    expect(formatDateFull(undefined)).toBe('—');
  });
  it('returns original string for invalid date', () => {
    expect(formatDateFull('invalid')).toBe('invalid');
  });
  it('formats date string (YYYY/MM/DD)', () => {
    const result = formatDateFull('2026-03-15T00:00:00');
    expect(result).toMatch(/2026\/03\/15/);
  });
  it('includes time when not 00:00', () => {
    const result = formatDateFull('2026-03-15T14:30:00');
    expect(result).toContain('2026/03/15');
  });
});

describe('formatDateShort', () => {
  it('returns "—" for null', () => {
    expect(formatDateShort(null)).toBe('—');
  });
  it('returns "—" for undefined', () => {
    expect(formatDateShort(undefined)).toBe('—');
  });
  it('returns original string for invalid date', () => {
    expect(formatDateShort('bad')).toBe('bad');
  });
  it('formats date to MM/DD', () => {
    const result = formatDateShort('2026-03-05T00:00:00');
    expect(result).toMatch(/03\/05/);
  });
});

describe('formatDateRelative', () => {
  it('returns empty string for null', () => {
    expect(formatDateRelative(null)).toBe('');
  });
  it('returns empty string for undefined', () => {
    expect(formatDateRelative(undefined)).toBe('');
  });
  it('returns original string for invalid date', () => {
    expect(formatDateRelative('invalid')).toBe('invalid');
  });
  it('returns 今日 for today', () => {
    const today = new Date().toISOString();
    expect(formatDateRelative(today)).toBe('今日');
  });
  it('returns 昨日 for yesterday', () => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    expect(formatDateRelative(yesterday.toISOString())).toBe('昨日');
  });
  it('returns M/D for older dates', () => {
    const result = formatDateRelative('2020-01-05T12:00:00');
    expect(result).toMatch(/^\d+\/\d+$/);
  });
});

describe('formatDateForExport', () => {
  it('returns empty string for undefined', () => {
    expect(formatDateForExport(undefined)).toBe('');
  });
  it('returns original string for invalid date', () => {
    expect(formatDateForExport('not-valid')).toBe('not-valid');
  });
  it('formats a valid ISO string to YYYY/MM/DD HH:mm', () => {
    const result = formatDateForExport('2026-03-15T10:30:00');
    expect(result).toContain('2026/03/15');
    expect(result).toContain('10:30');
  });
  it('pads single-digit months and days', () => {
    const result = formatDateForExport('2026-01-05T09:05:00');
    expect(result).toContain('2026/01/05');
  });
});

describe('formatMonth', () => {
  it('formats YYYY-MM to Japanese', () => {
    expect(formatMonth('2026-02')).toBe('2026年2月');
  });
  it('handles month with leading zero (January)', () => {
    expect(formatMonth('2026-01')).toBe('2026年1月');
  });
  it('handles December', () => {
    expect(formatMonth('2025-12')).toBe('2025年12月');
  });
  it('handles October', () => {
    expect(formatMonth('2025-10')).toBe('2025年10月');
  });
});

describe('getCurrentMonth', () => {
  it('returns YYYY-MM format', () => {
    expect(getCurrentMonth()).toMatch(/^\d{4}-\d{2}$/);
  });
  it('returns current year', () => {
    const year = new Date().getFullYear().toString();
    expect(getCurrentMonth()).toContain(year);
  });
  it('returns a valid month (01-12)', () => {
    const month = parseInt(getCurrentMonth().split('-')[1]);
    expect(month).toBeGreaterThanOrEqual(1);
    expect(month).toBeLessThanOrEqual(12);
  });
});
