// カテゴリ関連ユーティリティ

export function getCategoryEmoji(category: string | null | undefined): string {
  if (!category) return '💳';
  const lower = category.toLowerCase();
  if (lower.includes('食') || lower.includes('飲食') || lower.includes('グルメ')) return '🍽️';
  if (lower.includes('交通') || lower.includes('鉄道')) return '🚃';
  if (lower.includes('ショッピング') || lower.includes('衣')) return '🛍️';
  if (lower.includes('光熱') || lower.includes('電気') || lower.includes('水道')) return '⚡';
  if (lower.includes('通信') || lower.includes('携帯')) return '📱';
  if (lower.includes('医療') || lower.includes('健康')) return '🏥';
  if (lower.includes('娯楽') || lower.includes('エンタメ')) return '🎬';
  return '💳';
}
