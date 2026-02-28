// カテゴリごとの固定カラー（バリアントカラーとは独立）
// ライトモード・ダークモード両方で視認性が確保された色を選定
export const CATEGORY_COLORS: Record<string, string> = {
  '食費': '#FF6384',       // 赤系
  '交通費': '#36A2EB',     // 青系
  '日用品': '#FFCE56',     // 黄系
  '娯楽': '#4BC0C0',       // ティール系
  '光熱費': '#FF9F40',     // オレンジ系
  '通信費': '#9966FF',     // 紫系
  '医療': '#FF6699',       // ピンク系
  'ショッピング': '#45B7D1', // 水色系
  'その他': '#C9CBCF',     // グレー系
};

// カテゴリ名から色を取得（未定義カテゴリはグレー）
export function getCategoryColor(category: string): string {
  return CATEGORY_COLORS[category] ?? CATEGORY_COLORS['その他'] ?? '#C9CBCF';
}
