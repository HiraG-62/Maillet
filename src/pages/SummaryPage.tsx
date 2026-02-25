import { useState, useMemo } from 'react';
import { useTransactionStore } from '@/stores/transaction-store';
import MonthlyBarChart from '@/components/dashboard/MonthlyBarChart';
import CategoryPieChart from '@/components/dashboard/CategoryPieChart';
import { CurrencyDisplay } from '@/components/dashboard/CurrencyDisplay';

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

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold text-cyan-400 mb-6">集計</h1>

      {/* 月選択 */}
      <div className="mb-6">
        <label className="text-sm text-slate-400 mr-2">表示月:</label>
        <select
          value={selectedMonth}
          onChange={(e) => setSelectedMonth(e.target.value)}
          className="bg-[#12121a] border border-white/10 text-slate-200 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:border-cyan-500"
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

      {/* 月次推移グラフ */}
      <div className="mb-6 rounded-lg border border-white/10 bg-[#12121a]/80 p-4">
        <h2 className="text-sm font-medium text-slate-400 mb-3">月次推移（過去6ヶ月）</h2>
        {monthlyData.some((d) => d.total_amount > 0) ? (
          <MonthlyBarChart data={monthlyData} height={200} />
        ) : (
          <div className="h-[200px] flex items-center justify-center text-slate-500 text-sm">
            データなし
          </div>
        )}
      </div>

      {/* カテゴリ別支出グラフ */}
      <div className="mb-6 rounded-lg border border-white/10 bg-[#12121a]/80 p-4">
        <h2 className="text-sm font-medium text-slate-400 mb-3">
          カテゴリ別支出（{formatMonthLabel(selectedMonth)}）
        </h2>
        {categoryData.length > 0 ? (
          <CategoryPieChart data={categoryData} height={250} />
        ) : (
          <div className="h-[250px] flex items-center justify-center text-slate-500 text-sm">
            データなし
          </div>
        )}
      </div>

      {/* カテゴリ明細テーブル */}
      <div className="rounded-lg border border-white/10 bg-[#12121a]/80 p-4">
        <h2 className="text-sm font-medium text-slate-400 mb-3">カテゴリ別内訳</h2>
        {categoryData.length > 0 ? (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/10">
                <th className="text-left py-2 text-slate-400 font-medium">カテゴリ</th>
                <th className="text-right py-2 text-slate-400 font-medium">金額</th>
              </tr>
            </thead>
            <tbody>
              {categoryData.map((item, i) => (
                <tr key={i} className="border-b border-white/5 last:border-0">
                  <td className="py-2 text-slate-200">{item.name}</td>
                  <td className="py-2 text-right">
                    <CurrencyDisplay amount={item.value} size="sm" className="text-cyan-300" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="py-8 text-center text-slate-500 text-sm">データなし</div>
        )}
      </div>
    </div>
  );
}
