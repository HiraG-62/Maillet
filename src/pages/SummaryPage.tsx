import { useState, useMemo, useEffect } from 'react';
import { TrendingUp, BarChart2, PieChart as PieChartIcon, Layers, Store } from 'lucide-react';
import { useTransactionStore } from '@/stores/transaction-store';
import MonthlyBarChart from '@/components/dashboard/MonthlyBarChart';
import CategoryPieChart from '@/components/dashboard/CategoryPieChart';
import { CurrencyDisplay } from '@/components/dashboard/CurrencyDisplay';
import { normalizeMerchant } from '@/lib/normalize-merchant';

const toYearMonth = (dateStr: string | null | undefined) => (dateStr ?? '').slice(0, 7);

const getLastNMonths = (fromMonth: string, n: number): string[] => {
  const [yearStr, monthStr] = fromMonth.split('-');
  const year = parseInt(yearStr);
  const month = parseInt(monthStr);
  const result: string[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(year, month - 1 - i, 1);
    result.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  }
  return result;
};

const now = new Date();
const defaultMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

const formatMonthLabel = (m: string) => {
  const [year, month] = m.split('-');
  return `${year}年${parseInt(month)}月`;
};

export default function SummaryPage() {
  const transactions = useTransactionStore((s) => s.transactions);

  const [selectedMonth, setSelectedMonth] = useState(defaultMonth);
  const [isExpanded, setIsExpanded] = useState(false);
  const DEFAULT_DISPLAY_COUNT = 10;

  useEffect(() => {
    setIsExpanded(false);
  }, [selectedMonth]);

  const availableMonths = useMemo(() => {
    const months = new Set<string>();
    transactions.forEach((t) => months.add(toYearMonth(t.transaction_date)));
    return Array.from(months).filter(m => m.length > 0).sort((a, b) => b.localeCompare(a));
  }, [transactions]);

  const monthlyData = useMemo(() => {
    const last6 = getLastNMonths(defaultMonth, 6);
    const totals: Record<string, number> = {};
    transactions.forEach((t) => {
      const m = toYearMonth(t.transaction_date);
      if (last6.includes(m)) {
        totals[m] = (totals[m] ?? 0) + t.amount;
      }
    });
    return last6.map((m) => ({ month: m, total_amount: totals[m] ?? 0 }));
  }, [transactions]);

  const categoryData = useMemo(() => {
    const filtered = transactions.filter(
      (t) => toYearMonth(t.transaction_date) === selectedMonth
    );
    const totals: Record<string, number> = {};
    filtered.forEach((t) => {
      const cat = t.category ?? 'その他';
      totals[cat] = (totals[cat] ?? 0) + t.amount;
    });
    return Object.entries(totals)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [transactions, selectedMonth]);

  const merchantRanking = useMemo(() => {
    const filtered = transactions.filter(
      (t) => toYearMonth(t.transaction_date) === selectedMonth
    );
    const map = new Map<string, { display: string; total: number; count: number }>();
    for (const tx of filtered) {
      const key = normalizeMerchant(tx.merchant ?? '');
      if (!key) continue;
      const existing = map.get(key);
      if (existing) {
        existing.total += tx.amount ?? 0;
        existing.count += 1;
      } else {
        map.set(key, { display: tx.merchant?.trim() ?? key, total: tx.amount ?? 0, count: 1 });
      }
    }
    return [...map.values()]
      .sort((a, b) => b.total - a.total);
  }, [transactions, selectedMonth]);

  return (
    <div className="p-6">
      {/* Page header with gradient title */}
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2 rounded-lg bg-gradient-to-br from-[var(--color-primary)]/20 to-[var(--color-primary-hover)]/20 border border-[var(--color-primary)]/20">
          <TrendingUp className="w-5 h-5 text-[var(--color-primary)]" />
        </div>
        <h1 className="text-2xl font-bold bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-primary-hover)] bg-clip-text text-transparent">
          集計
        </h1>
      </div>

      {/* Month selector */}
      <div className="mb-6">
        <label className="text-sm text-[var(--color-text-secondary)] mr-2">表示月:</label>
        <select
          value={selectedMonth}
          onChange={(e) => setSelectedMonth(e.target.value)}
          className="bg-[var(--color-background)] border dark:border-white/10 border-black/10 text-[var(--color-text-primary)] rounded-md px-3 py-1.5 text-sm focus:outline-none focus:border-[var(--color-primary)] transition-colors"
        >
          {availableMonths.length > 0 ? (
            availableMonths.map((m) => (
              <option key={m} value={m}>
                {formatMonthLabel(m)}
              </option>
            ))
          ) : (
            <option value={defaultMonth}>{formatMonthLabel(defaultMonth)}</option>
          )}
        </select>
      </div>

      {/* Monthly bar chart — float card */}
      <div className="float-card p-5 mb-6">
        <div className="flex items-center gap-2 mb-4">
          <BarChart2 className="w-4 h-4 text-[var(--color-primary)]" />
          <h2 className="text-sm font-semibold text-[var(--color-text-primary)]">月次推移（過去6ヶ月）</h2>
        </div>
        {monthlyData.some((d) => d.total_amount > 0) ? (
          <MonthlyBarChart data={monthlyData} height={200} />
        ) : (
          <div className="h-[200px] flex flex-col items-center justify-center gap-2 text-[var(--color-text-secondary)]">
            <BarChart2 className="w-10 h-10 opacity-40" />
            <span className="text-sm">データなし</span>
          </div>
        )}
      </div>

      {/* Category pie chart — float card */}
      <div className="float-card p-5 mb-6">
        <div className="flex items-center gap-2 mb-4">
          <PieChartIcon className="w-4 h-4 text-[var(--color-primary)]" />
          <h2 className="text-sm font-semibold text-[var(--color-text-primary)]">
            カテゴリ別支出（{formatMonthLabel(selectedMonth)}）
          </h2>
        </div>
        {categoryData.length > 0 ? (
          <CategoryPieChart data={categoryData} height={250} />
        ) : (
          <div className="h-[250px] flex flex-col items-center justify-center gap-2 text-[var(--color-text-secondary)]">
            <PieChartIcon className="w-10 h-10 opacity-40" />
            <span className="text-sm">この月はデータがありません</span>
          </div>
        )}
      </div>

      {/* Category breakdown table — float card */}
      <div className="float-card p-5">
        <div className="flex items-center gap-2 mb-4">
          <Layers className="w-4 h-4 text-[var(--color-primary)]" />
          <h2 className="text-sm font-semibold text-[var(--color-text-primary)]">カテゴリ別内訳</h2>
        </div>
        {categoryData.length > 0 ? (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b dark:border-white/10 border-black/10">
                <th className="text-left py-2 text-[var(--color-text-secondary)] font-medium">カテゴリ</th>
                <th className="text-right py-2 text-[var(--color-text-secondary)] font-medium">金額</th>
              </tr>
            </thead>
            <tbody>
              {categoryData.map((item, i) => (
                <tr key={i} className="border-b border-white/5 last:border-0 hover:bg-white/[0.02] transition-colors">
                  <td className="py-2.5 text-[var(--color-text-primary)]">{item.name}</td>
                  <td className="py-2.5 text-right">
                    <CurrencyDisplay amount={item.value} size="sm" className="text-[var(--color-primary)]" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="py-10 flex flex-col items-center gap-2 text-[var(--color-text-secondary)]">
            <Layers className="w-10 h-10 opacity-40" />
            <span className="text-sm">この月のデータがありません</span>
          </div>
        )}
      </div>

      {/* Merchant ranking — float card */}
      <div className="float-card p-5 mt-6">
        <div className="flex items-center gap-2 mb-4">
          <Store className="w-4 h-4 text-[var(--color-primary)]" />
          <h2 className="text-sm font-semibold text-[var(--color-text-primary)]">
            店舗別ランキング（{formatMonthLabel(selectedMonth)}）
          </h2>
        </div>
        {merchantRanking.length > 0 ? (
          <div>
            <div className="space-y-3">
              {(isExpanded ? merchantRanking : merchantRanking.slice(0, DEFAULT_DISPLAY_COUNT)).map((item, i) => (
                <div key={item.display} className="flex items-center gap-3">
                  <span className="text-sm font-bold w-6 text-center text-[var(--color-primary)]">
                    {i + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-baseline">
                      <span className="text-sm font-medium truncate text-[var(--color-text-primary)]">
                        {item.display}
                      </span>
                      <CurrencyDisplay amount={item.total} size="sm" className="text-[var(--color-primary)]" />
                    </div>
                    <div className="mt-1 h-1.5 rounded-full bg-[var(--color-surface)]">
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${(item.total / (merchantRanking[0]?.total || 1)) * 100}%`,
                          backgroundColor: 'var(--color-primary)',
                        }}
                      />
                    </div>
                    <span className="text-xs text-[var(--color-text-muted)]">{item.count}件</span>
                  </div>
                </div>
              ))}
            </div>
            {merchantRanking.length > DEFAULT_DISPLAY_COUNT && (
              <button
                onClick={() => setIsExpanded(!isExpanded)}
                className="w-full mt-3 py-2 text-sm font-medium rounded-lg text-[var(--color-primary)] hover:bg-[var(--color-primary)]/10 transition-colors"
              >
                {isExpanded
                  ? '閉じる'
                  : `すべて表示（${merchantRanking.length}件）`}
              </button>
            )}
          </div>
        ) : (
          <div className="py-10 flex flex-col items-center gap-2 text-[var(--color-text-secondary)]">
            <Store className="w-10 h-10 opacity-40" />
            <span className="text-sm">この月のデータがありません</span>
          </div>
        )}
      </div>
    </div>
  );
}
