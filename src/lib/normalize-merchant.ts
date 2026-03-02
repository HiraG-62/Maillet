/**
 * 店舗名を正規化して表記揺れを吸収する
 * - trim
 * - 全角英数→半角
 * - 半角カタカナ→全角カタカナ（濁点・半濁点結合処理含む）
 * - toUpperCase
 */

// 半角カナ → 全角カナ変換マップ（ヴァ行含む）
const HANKAKU_TO_ZENKAKU: Record<string, string> = {
  'ｦ': 'ヲ', 'ｧ': 'ァ', 'ｨ': 'ィ', 'ｩ': 'ゥ', 'ｪ': 'ェ', 'ｫ': 'ォ',
  'ｬ': 'ャ', 'ｭ': 'ュ', 'ｮ': 'ョ', 'ｯ': 'ッ', 'ｰ': 'ー',
  'ｱ': 'ア', 'ｲ': 'イ', 'ｳ': 'ウ', 'ｴ': 'エ', 'ｵ': 'オ',
  'ｶ': 'カ', 'ｷ': 'キ', 'ｸ': 'ク', 'ｹ': 'ケ', 'ｺ': 'コ',
  'ｻ': 'サ', 'ｼ': 'シ', 'ｽ': 'ス', 'ｾ': 'セ', 'ｿ': 'ソ',
  'ﾀ': 'タ', 'ﾁ': 'チ', 'ﾂ': 'ツ', 'ﾃ': 'テ', 'ﾄ': 'ト',
  'ﾅ': 'ナ', 'ﾆ': 'ニ', 'ﾇ': 'ヌ', 'ﾈ': 'ネ', 'ﾉ': 'ノ',
  'ﾊ': 'ハ', 'ﾋ': 'ヒ', 'ﾌ': 'フ', 'ﾍ': 'ヘ', 'ﾎ': 'ホ',
  'ﾏ': 'マ', 'ﾐ': 'ミ', 'ﾑ': 'ム', 'ﾒ': 'メ', 'ﾓ': 'モ',
  'ﾔ': 'ヤ', 'ﾕ': 'ユ', 'ﾖ': 'ヨ',
  'ﾗ': 'ラ', 'ﾘ': 'リ', 'ﾙ': 'ル', 'ﾚ': 'レ', 'ﾛ': 'ロ',
  'ﾜ': 'ワ', 'ﾝ': 'ン', 'ﾞ': '゛', 'ﾟ': '゜',
};

// 濁音マップ（主要なもの）
const voicedMap: Record<string, string> = {
  'カ': 'ガ', 'キ': 'ギ', 'ク': 'グ', 'ケ': 'ゲ', 'コ': 'ゴ',
  'サ': 'ザ', 'シ': 'ジ', 'ス': 'ズ', 'セ': 'ゼ', 'ソ': 'ゾ',
  'タ': 'ダ', 'チ': 'ヂ', 'ツ': 'ヅ', 'テ': 'デ', 'ト': 'ド',
  'ハ': 'バ', 'ヒ': 'ビ', 'フ': 'ブ', 'ヘ': 'ベ', 'ホ': 'ボ',
  'ウ': 'ヴ',
};

const semiVoicedMap: Record<string, string> = {
  'ハ': 'パ', 'ヒ': 'ピ', 'フ': 'プ', 'ヘ': 'ペ', 'ホ': 'ポ',
};

// 濁点・半濁点結合処理（ｶﾞ→ガ など）
function normalizeHankakuKana(s: string): string {
  let result = '';
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    const next = s[i + 1];
    if (next === 'ﾞ') {
      // 濁音化: カ→ガ など
      const voiced = voicedMap[HANKAKU_TO_ZENKAKU[c] ?? c];
      if (voiced) { result += voiced; i++; continue; }
    }
    if (next === 'ﾟ') {
      // 半濁音化: ハ→パ など
      const semiVoiced = semiVoicedMap[HANKAKU_TO_ZENKAKU[c] ?? c];
      if (semiVoiced) { result += semiVoiced; i++; continue; }
    }
    result += HANKAKU_TO_ZENKAKU[c] ?? c;
  }
  return result;
}

/**
 * Levenshtein 距離を計算
 */
export function levenshteinDistance(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, (_, i) =>
    Array.from({ length: n + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0))
  );
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (a[i - 1] === b[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1];
      } else {
        dp[i][j] = 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
      }
    }
  }
  return dp[m][n];
}

/**
 * 2つの正規化済み加盟店名がファジーマッチするか判定
 * @param threshold 最大許容編集距離（デフォルト: 文字数の20%、最小2）
 */
export function fuzzyMatch(a: string, b: string, threshold?: number): boolean {
  if (!a || !b) return false;
  const maxLen = Math.max(a.length, b.length);
  const limit = threshold ?? Math.max(2, Math.floor(maxLen * 0.2));
  return levenshteinDistance(a, b) <= limit;
}

/**
 * 店舗名を正規化して表記揺れを吸収する
 * - trim
 * - 全角英数→半角
 * - 半角カタカナ→全角カタカナ
 * - toUpperCase
 */
export function normalizeMerchant(name: string): string {
  if (!name) return '';
  return normalizeHankakuKana(
    name
      .trim()
      .replace(/[Ａ-Ｚａ-ｚ０-９]/g, (s) =>
        String.fromCharCode(s.charCodeAt(0) - 0xFEE0)
      )
  ).toUpperCase();
}
