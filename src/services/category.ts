import { queryDB, executeDB } from '@/lib/database';

// Python版 category_service.py の CATEGORIES dict を移植（全キーワード収録）
export const CATEGORIES: Record<string, string[]> = {
  食費: [
    'マクドナルド', 'すき家', '吉野家', '松屋', 'モスバーガー', 'ケンタッキー',
    'スーパー', 'コンビニ', 'セブンイレブン', 'ファミリーマート', 'ローソン',
    'イオン', 'ライフ', '業務スーパー', 'デリバリー', '出前館', 'UberEats', 'Uber Eats',
    'サイゼリヤ', 'ガスト', 'デニーズ',
  ],
  交通費: [
    'JR', '東急', '小田急', '東京メトロ', '都営', '京王', '西武', '東武',
    '相鉄', 'タクシー', 'Suica', 'PASMO', 'バス', 'ウーバー', '新幹線',
    'Uber', '電車', 'ETC', '高速', 'メトロ',
  ],
  娯楽: [
    'Netflix', 'Amazon Prime', 'Hulu', 'Disney', 'YouTube Premium',
    'Spotify', 'Apple', 'Steam', 'PlayStation', 'Nintendo',
    'ゲーム', '映画', 'カラオケ', 'ジム', 'スポーツ',
  ],
  通信費: [
    'NTT', 'ドコモ', 'au', 'ソフトバンク', '楽天モバイル', 'IIJ', 'OCN',
    'インターネット', '光回線', 'Zoom', 'Slack', 'Adobe',
  ],
  医療: [
    '病院', 'クリニック', '薬局', 'ドラッグ', 'マツキヨ', 'ウェルシア', 'ウエルシア',
    '薬店', '歯科', 'スギ薬局', 'ツルハ',
  ],
  ショッピング: [
    'Amazon', '楽天', 'Yahoo', 'メルカリ', 'ZOZOTOWN', 'ユニクロ', '無印',
    'H&M', 'ニトリ', 'イケア', 'IKEA', 'ドンキ', 'コストコ',
  ],
  光熱費: [
    '東京電力', '関西電力', '中部電力', '東北電力', '九州電力',
    '東京ガス', '大阪ガス', 'ガス', '水道',
  ],
};

export function classify_transaction(merchant: string): string | null {
  if (!merchant) return null;
  const lower = merchant.toLowerCase();
  for (const [category, keywords] of Object.entries(CATEGORIES)) {
    if (keywords.some((kw) => lower.includes(kw.toLowerCase()))) {
      return category;
    }
  }
  return null;
}

export async function applyCategoriesToDB(
  overwrite = false
): Promise<{ updated: number; skipped: number }> {
  const sql = overwrite
    ? 'SELECT id, merchant FROM card_transactions'
    : "SELECT id, merchant FROM card_transactions WHERE category IS NULL OR category = ''";
  const rows = await queryDB<[number, string]>(sql, []);
  let updated = 0;
  let skipped = 0;
  for (const [id, merchant] of rows) {
    const category = classify_transaction(merchant ?? '');
    if (category) {
      await executeDB(
        'UPDATE card_transactions SET category = ? WHERE id = ?',
        [category, id]
      );
      updated++;
    } else {
      skipped++;
    }
  }
  return { updated, skipped };
}

export interface CategoryTotal {
  category: string;
  total: number;
  count: number;
}

export async function getCategoryTotals(
  year?: number,
  month?: number
): Promise<CategoryTotal[]> {
  const params: unknown[] = [];
  let where = "WHERE category IS NOT NULL AND category != ''";
  if (year !== undefined && month !== undefined) {
    const m = `${year}-${String(month).padStart(2, '0')}`;
    where += " AND strftime('%Y-%m', transaction_date) = ?";
    params.push(m);
  }
  const rows = await queryDB<[string, number, number]>(
    `SELECT category, COALESCE(SUM(amount),0), COUNT(*)
     FROM card_transactions
     ${where}
     GROUP BY category
     ORDER BY SUM(amount) DESC`,
    params
  );
  return rows.map(([category, total, count]) => ({ category, total, count }));
}
