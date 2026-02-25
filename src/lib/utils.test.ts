// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { cn, formatCurrency, formatMonth, getCurrentMonth } from './utils';

describe('cn', () => {
  it('merges class names', () => {
    expect(cn('a', 'b')).toBe('a b');
  });
});

describe('formatCurrency', () => {
  it('formats JPY', () => {
    const result = formatCurrency(1000);
    expect(result).toContain('1,000');
  });
});

describe('formatMonth', () => {
  it('formats YYYY-MM to Japanese', () => {
    expect(formatMonth('2026-02')).toBe('2026年2月');
  });
});

describe('getCurrentMonth', () => {
  it('returns YYYY-MM format', () => {
    expect(getCurrentMonth()).toMatch(/^\d{4}-\d{2}$/);
  });
});
