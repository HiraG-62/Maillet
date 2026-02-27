/**
 * 店舗名を正規化して表記揺れを吸収する
 * - trim
 * - 全角英数→半角
 * - toUpperCase
 */
export function normalizeMerchant(name: string): string {
  if (!name) return '';
  return name
    .trim()
    .replace(/[Ａ-Ｚａ-ｚ０-９]/g, (s) =>
      String.fromCharCode(s.charCodeAt(0) - 0xFEE0)
    )
    .toUpperCase();
}
