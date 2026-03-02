// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { normalizeMerchant, levenshteinDistance, fuzzyMatch } from './normalize-merchant';

describe('normalizeMerchant', () => {
  it('半角カタカナを全角カタカナに変換する', () => {
    expect(normalizeMerchant('ｽﾀﾊﾞ渋谷')).toBe('スタバ渋谷');
  });

  it('濁点結合を正しく処理する（ｶﾞ→ガ）', () => {
    expect(normalizeMerchant('ｶﾞｽﾄ')).toBe('ガスト');
  });

  it('半濁点結合を正しく処理する（ﾊﾟ→パ）', () => {
    expect(normalizeMerchant('ﾊﾟﾅｿﾆｯｸ')).toBe('パナソニック');
  });

  it('全角英字を半角大文字に変換する', () => {
    expect(normalizeMerchant('ａｍａｚｏｎ')).toBe('AMAZON');
  });

  it('全角数字を半角に変換する', () => {
    expect(normalizeMerchant('ｺﾝﾋﾞﾆ１２３')).toBe('コンビニ123');
  });

  it('前後の空白をトリムする', () => {
    expect(normalizeMerchant('  AMAZON  ')).toBe('AMAZON');
  });

  it('空文字列は空文字列を返す', () => {
    expect(normalizeMerchant('')).toBe('');
  });

  it('nullishな値は空文字列を返す', () => {
    expect(normalizeMerchant(null as unknown as string)).toBe('');
    expect(normalizeMerchant(undefined as unknown as string)).toBe('');
  });

  it('既存の半角英字はそのまま大文字化される', () => {
    expect(normalizeMerchant('starbucks')).toBe('STARBUCKS');
  });
});

describe('levenshteinDistance', () => {
  it('同一文字列は距離0', () => {
    expect(levenshteinDistance('STARBUCKS', 'STARBUCKS')).toBe(0);
  });

  it('1文字削除で距離1', () => {
    expect(levenshteinDistance('STARBUCKS', 'STARBUKS')).toBe(1);
  });

  it('1文字置換で距離1', () => {
    expect(levenshteinDistance('AMAZON', 'AMAZEN')).toBe(1);
  });

  it('空文字列との距離は相手の文字数', () => {
    expect(levenshteinDistance('', 'ABC')).toBe(3);
    expect(levenshteinDistance('ABC', '')).toBe(3);
  });

  it('全く異なる文字列の距離', () => {
    expect(levenshteinDistance('AMAZON', 'NETFLIX')).toBeGreaterThan(4);
  });
});

describe('fuzzyMatch', () => {
  it('近い文字列はtrueを返す（編集距離が閾値以内）', () => {
    // 'AMAZON.CO.JP' vs 'AMAZON CO JP': 距離2、閾値max(2,floor(12*0.2))=2 → true
    expect(fuzzyMatch('AMAZON.CO.JP', 'AMAZON CO JP')).toBe(true);
  });

  it('全く異なる文字列はfalseを返す', () => {
    expect(fuzzyMatch('AMAZON', 'NETFLIX')).toBe(false);
  });

  it('同一文字列はtrueを返す', () => {
    expect(fuzzyMatch('AMAZON', 'AMAZON')).toBe(true);
  });

  it('1文字の差異はtrueを返す（デフォルト閾値）', () => {
    expect(fuzzyMatch('STARBUCKS', 'STARBUKS')).toBe(true);
  });

  it('空文字列はfalseを返す', () => {
    expect(fuzzyMatch('', 'AMAZON')).toBe(false);
    expect(fuzzyMatch('AMAZON', '')).toBe(false);
  });

  it('カスタム閾値を使用できる', () => {
    expect(fuzzyMatch('AMAZON', 'AMAZEN', 1)).toBe(true);
    expect(fuzzyMatch('AMAZON', 'NETFLIX', 1)).toBe(false);
  });
});
