import { queryDB } from '@/lib/database';
import { normalizeMerchant } from '@/lib/normalize-merchant';

export interface DetectedSubscription {
  merchant: string;
  amount: number;
  frequency: 'monthly' | 'yearly';
  confidence: 'high' | 'medium';
  occurrences: number;
  lastDate: string;
  nextEstimatedDate: string;
  dates: string[];
}

/**
 * 取引データからサブスクリプション（定期支出）を自動検知する
 *
 * アルゴリズム:
 * 1. SQL で同一店舗・同一金額の取引を集約（2回以上出現）
 * 2. JS で日付間隔を分析し、月次(25-35日)または年次(350-380日)パターンを検出
 * 3. 標準偏差で信頼度を判定（<5日=高, 5-10日=中）
 */
export async function detectSubscriptions(): Promise<DetectedSubscription[]> {
  // Step A: SQL候補抽出
  const rows = await queryDB<[string, number, number, string]>(
    `SELECT merchant, amount, COUNT(*) as cnt,
            GROUP_CONCAT(transaction_date, ',') as dates
     FROM card_transactions
     GROUP BY LOWER(TRIM(merchant)), amount
     HAVING cnt >= 2
     ORDER BY cnt DESC`,
    []
  );

  const results: DetectedSubscription[] = [];

  for (const [merchant, amount, occurrences, datesStr] of rows) {
    if (!merchant?.trim() || !datesStr) continue;

    // 日付をパースしてソート
    const dates = parseDates(datesStr);
    if (dates.length < 2) continue;

    // 隣接日付の差分（日数）を計算
    const intervals = computeIntervals(dates);
    if (intervals.length === 0) continue;

    const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
    const stdDev = computeStdDev(intervals, avgInterval);

    // 周期パターン判定
    let frequency: 'monthly' | 'yearly' | null = null;
    if (avgInterval >= 25 && avgInterval <= 35) {
      frequency = 'monthly';
    } else if (avgInterval >= 350 && avgInterval <= 380) {
      frequency = 'yearly';
    }

    if (!frequency) continue;

    // 信頼度判定
    let confidence: 'high' | 'medium';
    if (stdDev < 5) {
      confidence = 'high';
    } else if (stdDev < 10) {
      confidence = 'medium';
    } else {
      continue; // 標準偏差が大きすぎる → サブスクではない
    }

    const lastDate = dates[dates.length - 1];
    const nextEstimatedDate = addDays(lastDate, Math.round(avgInterval));

    // normalizeMerchant で表記揺れを吸収した代表名を使用
    const displayMerchant = merchant.trim();

    results.push({
      merchant: displayMerchant,
      amount,
      frequency,
      confidence,
      occurrences,
      lastDate: formatISODate(lastDate),
      nextEstimatedDate: formatISODate(nextEstimatedDate),
      dates: dates.map(formatISODate),
    });
  }

  // normalizeMerchant で重複を統合（表記揺れ対応）
  return deduplicateByNormalizedMerchant(results);
}

/** 日付文字列をパースしてDate配列にしてソート */
function parseDates(datesStr: string): Date[] {
  return datesStr
    .split(',')
    .map((s) => new Date(s.trim()))
    .filter((d) => !isNaN(d.getTime()))
    .sort((a, b) => a.getTime() - b.getTime());
}

/** 隣接日付間の差分（日数）を計算 */
function computeIntervals(dates: Date[]): number[] {
  const intervals: number[] = [];
  for (let i = 1; i < dates.length; i++) {
    const diff = (dates[i].getTime() - dates[i - 1].getTime()) / (1000 * 60 * 60 * 24);
    intervals.push(diff);
  }
  return intervals;
}

/** 標準偏差を計算（ゼロ除算回避付き） */
function computeStdDev(values: number[], mean: number): number {
  if (values.length <= 1) return 0;
  const variance =
    values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / values.length;
  return Math.sqrt(variance);
}

/** Date に日数を加算 */
function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

/** Date を YYYY-MM-DD 形式に変換 */
function formatISODate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** normalizeMerchant で同一と見なせる店舗を統合 */
function deduplicateByNormalizedMerchant(
  subs: DetectedSubscription[]
): DetectedSubscription[] {
  const map = new Map<string, DetectedSubscription>();

  for (const sub of subs) {
    const key = `${normalizeMerchant(sub.merchant)}|${sub.amount}`;
    const existing = map.get(key);
    if (!existing || sub.occurrences > existing.occurrences) {
      map.set(key, sub);
    }
  }

  return Array.from(map.values());
}
