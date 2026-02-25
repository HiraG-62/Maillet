import { useMemo } from 'react';
import { useTransactionStore } from '@/stores/transaction-store';
import { useSettingsStore } from '@/stores/settings-store';
import { StatCard } from './StatCard';
import { CurrencyDisplay } from './CurrencyDisplay';

function getCurrentMonth(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

export function StatGrid() {
  const transactions = useTransactionStore((s) => s.transactions);
  const monthlyBudget = useSettingsStore((s) => s.monthly_budget);

  const aggregation = useMemo(() => {
    const currentMonth = getCurrentMonth();
    const filtered = transactions.filter(
      (tx) => (tx.transaction_date ?? '').slice(0, 7) === currentMonth
    );
    const total = filtered.reduce((sum, tx) => sum + tx.amount, 0);
    const count = filtered.length;
    const average = count > 0 ? Math.round(total / count) : 0;
    return { total, count, average };
  }, [transactions]);

  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {/* 月間合計 */}
      <StatCard
        title="月間合計"
        value={<CurrencyDisplay amount={aggregation.total} size="md" />}
        variant="default"
      />

      {/* 利用件数 */}
      <StatCard
        title="利用件数"
        value={aggregation.count}
        unit="件"
        variant="default"
      />

      {/* 平均利用額 */}
      <StatCard
        title="平均利用額"
        value={<CurrencyDisplay amount={aggregation.average} size="md" />}
        variant="default"
      />

      {/* 月間目安額 */}
      <StatCard
        title="月間目安額"
        value={
          monthlyBudget > 0 ? (
            <CurrencyDisplay amount={monthlyBudget} size="md" />
          ) : (
            '未設定'
          )
        }
        variant="default"
      />
    </div>
  );
}
