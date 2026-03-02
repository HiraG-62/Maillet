// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { matchMerchant, classifyByRules } from './CategoryRuleEngine';
import type { CategoryRule } from '@/types/settings';

function makeRule(overrides: Partial<CategoryRule> = {}): CategoryRule {
  return { id: '1', keyword: '', category: 'Food', ...overrides };
}

describe('matchMerchant', () => {
  it('matches when normalized merchant includes normalized keyword', () => {
    const rule = makeRule({ keyword: 'amazon' });
    expect(matchMerchant('AMAZON CO JP', rule)).toBe(true);
  });

  it('is case-insensitive via normalization', () => {
    const rule = makeRule({ keyword: 'Starbucks' });
    expect(matchMerchant('STARBUCKS SHIBUYA', rule)).toBe(true);
  });

  it('returns false when keyword does not match', () => {
    const rule = makeRule({ keyword: 'amazon' });
    expect(matchMerchant('RAKUTEN ICHIBA', rule)).toBe(false);
  });

  it('prefers merchantPattern over keyword', () => {
    const rule = makeRule({ keyword: 'wrong', merchantPattern: 'LAWSON' });
    expect(matchMerchant('LAWSON GINZA', rule)).toBe(true);
  });

  it('falls back to keyword when merchantPattern is undefined', () => {
    const rule = makeRule({ keyword: 'seven' });
    expect(matchMerchant('SEVEN ELEVEN', rule)).toBe(true);
  });

  it('returns false when both keyword and merchantPattern are empty', () => {
    const rule = makeRule({ keyword: '', merchantPattern: undefined });
    expect(matchMerchant('ANYTHING', rule)).toBe(false);
  });

  it('handles full-width characters in pattern', () => {
    const rule = makeRule({ keyword: 'Ａｍａｚｏｎ' });
    expect(matchMerchant('AMAZON CO JP', rule)).toBe(true);
  });
});

describe('classifyByRules', () => {
  it('returns category of the first matching rule', () => {
    const rules = [
      makeRule({ id: '1', keyword: 'amazon', category: 'Shopping' }),
      makeRule({ id: '2', keyword: 'amaz', category: 'Misc' }),
    ];
    expect(classifyByRules('AMAZON CO JP', rules)).toBe('Shopping');
  });

  it('returns null when no rules match', () => {
    const rules = [
      makeRule({ id: '1', keyword: 'starbucks', category: 'Cafe' }),
    ];
    expect(classifyByRules('LAWSON GINZA', rules)).toBeNull();
  });

  it('returns null for empty rules array', () => {
    expect(classifyByRules('ANYTHING', [])).toBeNull();
  });

  it('skips rules that do not match and returns later match', () => {
    const rules = [
      makeRule({ id: '1', keyword: 'starbucks', category: 'Cafe' }),
      makeRule({ id: '2', keyword: 'lawson', category: 'Convenience' }),
    ];
    expect(classifyByRules('LAWSON GINZA', rules)).toBe('Convenience');
  });
});
