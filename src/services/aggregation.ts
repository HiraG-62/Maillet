import { queryDB } from '@/lib/database';

export interface AggResult {
  total: number;
  count: number;
  average: number;
}

export interface CardAggResult extends AggResult {
  card_company: string;
}

export interface MerchantTotal {
  merchant: string;
  total: number;
  count: number;
}

export interface MonthlyTrend {
  labels: string[];  // ["2025年12月", "2026年1月", ...]
  values: number[];  // 月次合計金額
}

function monthStr(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, '0')}`;
}

export async function getMonthlySummary(
  year: number,
  month: number,
  card_company?: string
): Promise<AggResult> {
  const m = monthStr(year, month);
  const params: unknown[] = [m];
  let extra = '';
  if (card_company) {
    extra = ' AND card_company = ?';
    params.push(card_company);
  }
  const rows = await queryDB<[number, number]>(
    `SELECT COALESCE(SUM(amount),0), COUNT(*)
     FROM card_transactions
     WHERE strftime('%Y-%m', transaction_date) = ?${extra}`,
    params
  );
  const [total, count] = (rows[0] as [number, number]) ?? [0, 0];
  return { total, count, average: count > 0 ? Math.round(total / count) : 0 };
}

export async function getMonthlyByCard(
  year: number,
  month: number
): Promise<CardAggResult[]> {
  const m = monthStr(year, month);
  const rows = await queryDB<[string, number, number]>(
    `SELECT card_company, COALESCE(SUM(amount),0), COUNT(*)
     FROM card_transactions
     WHERE strftime('%Y-%m', transaction_date) = ?
     GROUP BY card_company
     ORDER BY SUM(amount) DESC`,
    [m]
  );
  return rows.map(([card_company, total, count]) => ({
    card_company,
    total,
    count,
    average: count > 0 ? Math.round(total / count) : 0,
  }));
}

export async function getTopMerchants(
  year: number,
  month: number,
  limit = 5
): Promise<MerchantTotal[]> {
  const m = monthStr(year, month);
  const rows = await queryDB<[string, number, number]>(
    `SELECT COALESCE(merchant, '不明'), COALESCE(SUM(amount),0), COUNT(*)
     FROM card_transactions
     WHERE strftime('%Y-%m', transaction_date) = ?
     GROUP BY merchant
     ORDER BY SUM(amount) DESC
     LIMIT ?`,
    [m, limit]
  );
  return rows.map(([merchant, total, count]) => ({ merchant, total, count }));
}

export async function getAllTimeSummaryByCard(): Promise<
  Record<string, AggResult>
> {
  const rows = await queryDB<[string, number, number]>(
    `SELECT card_company, COALESCE(SUM(amount),0), COUNT(*)
     FROM card_transactions
     GROUP BY card_company`,
    []
  );
  const result: Record<string, AggResult> = {};
  for (const [card_company, total, count] of rows) {
    result[card_company] = {
      total,
      count,
      average: count > 0 ? Math.round(total / count) : 0,
    };
  }
  return result;
}

export async function getMonthlyTrend(months = 12): Promise<MonthlyTrend> {
  const rows = await queryDB<[string, number]>(
    `SELECT strftime('%Y-%m', transaction_date) as mo, COALESCE(SUM(amount),0)
     FROM card_transactions
     GROUP BY mo
     ORDER BY mo DESC
     LIMIT ?`,
    [months]
  );
  const sorted = [...rows].reverse();
  const labels = sorted.map(([mo]) => {
    const [year, month] = mo.split('-');
    return `${year}年${parseInt(month)}月`;
  });
  const values = sorted.map(([, total]) => total);
  return { labels, values };
}
