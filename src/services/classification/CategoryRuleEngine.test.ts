// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { matchMerchant, classifyByRules, buildLearnedRules, autoClassifyNewTransactions } from './CategoryRuleEngine';
import { normalizeMerchant } from '@/lib/normalize-merchant';
import type { CategoryRule } from '@/types/settings';

vi.mock('@/lib/database', () => ({
  queryDB: vi.fn(),
  executeDB: vi.fn().mockResolvedValue({ changes: 1 }),
  saveDB: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/lib/transactions', () => ({
  updateTransactionCategory: vi.fn().mockResolvedValue(undefined),
}));

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

  it('supports fuzzy matching (levenshtein) for typos', () => {
    // fuzzyMatch 統合済み: 1文字違いはマッチする
    const rule: CategoryRule = { id: '1', keyword: 'STARBUCKS', category: '食費' };
    expect(matchMerchant('STARTBUCKS', rule)).toBe(true); // 1文字違いでもtrue（fuzzyMatch統合済み）
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

describe('buildLearnedRules', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('generates rules from manual category assignments', async () => {
    const { queryDB } = await import('@/lib/database');
    (queryDB as ReturnType<typeof vi.fn>).mockResolvedValueOnce([
      ['AMAZON CO JP', '買い物'],
      ['AMAZON CO JP', '買い物'],
      ['STARBUCKS', '食費'],
    ]);

    const rules = await buildLearnedRules();
    expect(rules).toHaveLength(2);
    const amazonRule = rules.find(r => r.category === '買い物');
    expect(amazonRule).toBeDefined();
    expect(amazonRule!.source).toBe('system');
    const sbRule = rules.find(r => r.category === '食費');
    expect(sbRule).toBeDefined();
  });

  it('picks the most frequent category per merchant', async () => {
    const { queryDB } = await import('@/lib/database');
    (queryDB as ReturnType<typeof vi.fn>).mockResolvedValueOnce([
      ['LAWSON', '食費'],
      ['LAWSON', 'コンビニ'],
      ['LAWSON', 'コンビニ'],
    ]);

    const rules = await buildLearnedRules();
    expect(rules).toHaveLength(1);
    expect(rules[0].category).toBe('コンビニ');
  });

  it('returns empty array when no manual transactions exist', async () => {
    const { queryDB } = await import('@/lib/database');
    (queryDB as ReturnType<typeof vi.fn>).mockResolvedValueOnce([]);

    const rules = await buildLearnedRules();
    expect(rules).toEqual([]);
  });

  it('skips rows with empty merchant', async () => {
    const { queryDB } = await import('@/lib/database');
    (queryDB as ReturnType<typeof vi.fn>).mockResolvedValueOnce([
      ['', '食費'],
      ['AMAZON', '買い物'],
    ]);

    const rules = await buildLearnedRules();
    expect(rules).toHaveLength(1);
    expect(rules[0].category).toBe('買い物');
  });
});

describe('autoClassifyNewTransactions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('classifies uncategorized transactions using learned + settings rules', async () => {
    const { queryDB } = await import('@/lib/database');
    const { updateTransactionCategory } = await import('@/lib/transactions');

    // First call: buildLearnedRules query
    (queryDB as ReturnType<typeof vi.fn>).mockResolvedValueOnce([
      ['AMAZON CO JP', '買い物'],
    ]);
    // Second call: uncategorized transactions
    (queryDB as ReturnType<typeof vi.fn>).mockResolvedValueOnce([
      [1, 'AMAZON CO JP'],
      [2, 'UNKNOWN SHOP'],
    ]);

    const result = await autoClassifyNewTransactions([]);
    expect(result.classified).toBe(1);
    expect(updateTransactionCategory).toHaveBeenCalledWith(1, '買い物', 'auto');
  });

  it('returns classified:0 when all transactions already have categories', async () => {
    const { queryDB } = await import('@/lib/database');

    // buildLearnedRules query
    (queryDB as ReturnType<typeof vi.fn>).mockResolvedValueOnce([]);
    // uncategorized query returns empty
    (queryDB as ReturnType<typeof vi.fn>).mockResolvedValueOnce([]);

    const result = await autoClassifyNewTransactions([]);
    expect(result.classified).toBe(0);
  });

  it('learned rules take priority over settings rules', async () => {
    const { queryDB } = await import('@/lib/database');
    const { updateTransactionCategory } = await import('@/lib/transactions');

    // buildLearnedRules: AMAZON → '買い物' (learned)
    (queryDB as ReturnType<typeof vi.fn>).mockResolvedValueOnce([
      ['AMAZON', '買い物'],
    ]);
    // uncategorized transactions
    (queryDB as ReturnType<typeof vi.fn>).mockResolvedValueOnce([
      [1, 'AMAZON'],
    ]);

    const settingsRules: CategoryRule[] = [
      { id: 's1', keyword: 'amazon', category: 'Shopping' },
    ];

    const result = await autoClassifyNewTransactions(settingsRules);
    expect(result.classified).toBe(1);
    // Learned rule '買い物' should win over settings 'Shopping'
    expect(updateTransactionCategory).toHaveBeenCalledWith(1, '買い物', 'auto');
  });

  it('handles no matching rules gracefully', async () => {
    const { queryDB } = await import('@/lib/database');
    const { updateTransactionCategory } = await import('@/lib/transactions');

    (queryDB as ReturnType<typeof vi.fn>).mockResolvedValueOnce([]);
    (queryDB as ReturnType<typeof vi.fn>).mockResolvedValueOnce([
      [1, 'TOTALLY UNKNOWN'],
    ]);

    const result = await autoClassifyNewTransactions([]);
    expect(result.classified).toBe(0);
    expect(updateTransactionCategory).not.toHaveBeenCalled();
  });
});
