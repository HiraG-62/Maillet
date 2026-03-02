// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { matchMerchant, classifyByRules } from './CategoryRuleEngine';
import { normalizeMerchant } from '@/lib/normalize-merchant';
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

  it('uses merchantPattern exclusively even when keyword would match', () => {
    // merchantPattern が指定されていればキーワードは無視される
    const rule = makeRule({ keyword: 'amazon', merchantPattern: 'RAKUTEN' });
    expect(matchMerchant('AMAZON CO JP', rule)).toBe(false);
    expect(matchMerchant('RAKUTEN ICHIBA', rule)).toBe(true);
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

  it('normalizes half-width kana in keyword (ｽﾀﾊﾞ → スタバ)', () => {
    // 半角カナ 'ｽﾀﾊﾞ' は正規化で全角 'スタバ' になるため一致すること
    const rule = makeRule({ keyword: 'ｽﾀﾊﾞ' });
    expect(matchMerchant('スタバ新宿', rule)).toBe(true);
  });

  it('normalizes half-width kana in merchant name (pre-normalized by caller)', () => {
    // matchMerchant の第1引数は呼び出し元が normalizeMerchant() で正規化済みを想定。
    // 半角カナの merchant は normalizeMerchant() で全角化してから渡す。
    const rule = makeRule({ keyword: 'スタバ' });
    const normalized = normalizeMerchant('ｽﾀﾊﾞ新宿'); // → 'スタバ新宿'
    expect(matchMerchant(normalized, rule)).toBe(true);
  });

  it('returns false for empty merchant string', () => {
    const rule = makeRule({ keyword: 'amazon' });
    expect(matchMerchant('', rule)).toBe(false);
  });

  // TODO: matchMerchant のファジーマッチ統合テスト（現状は完全一致のみ）
  it('should eventually support fuzzy matching (levenshtein)', () => {
    // 現在の動作: 完全一致のみ（部分一致は含む）
    const rule: CategoryRule = { id: '1', keyword: 'STARBUCKS', category: '食費' };
    expect(matchMerchant('STARTBUCKS', rule)).toBe(false); // 1文字違いでもfalse（現在）
    // 将来: fuzzyMatch 統合後は true になる想定
    // expect(matchMerchant('STARTBUCKS', rule)).toBe(true);
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

  it('applies rules with source:ai (optional field does not block matching)', () => {
    // source: 'ai' のルールも通常通り動作すること
    const rules = [
      makeRule({ id: '1', keyword: 'netflix', category: 'Entertainment', source: 'ai' }),
    ];
    expect(classifyByRules('NETFLIX', rules)).toBe('Entertainment');
  });

  it('applies rules regardless of confidence value (confidence is not a filter)', () => {
    // confidence が低くても適用されること（フィルタとして使わない）
    const rules = [
      makeRule({ id: '1', keyword: 'suica', category: 'Transport', confidence: 0.1 }),
    ];
    expect(classifyByRules('SUICA CHARGE', rules)).toBe('Transport');
  });

  it('applies rules with userConfirmed:false', () => {
    const rules = [
      makeRule({ id: '1', keyword: 'uber', category: 'Transport', userConfirmed: false }),
    ];
    expect(classifyByRules('UBER EATS', rules)).toBe('Transport');
  });

  it('returns null for empty merchant string', () => {
    const rules = [
      makeRule({ id: '1', keyword: 'amazon', category: 'Shopping' }),
    ];
    expect(classifyByRules('', rules)).toBeNull();
  });
});
