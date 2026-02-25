import { useTransactionStore } from '@/stores/transaction-store';
import { useSettingsStore } from '@/stores/settings-store';
import { StatCard } from './StatCard';
import { CurrencyDisplay } from './CurrencyDisplay';

function getBudgetVariant(ratio: number): 'success' | 'warning' | 'danger' {
  if (ratio >= 100) return 'danger';
  if (ratio >= 80) return 'warning';
  return 'success';
}

export function StatGrid() {
  const aggregation = useTransactionStore((s) => s.aggregation);
  const monthlyBudget = useSettingsStore((s) => s.monthly_budget);

  const isLoading = aggregation === null;

  const budgetRatio =
    monthlyBudget > 0 && aggregation
      ? (aggregation.total / monthlyBudget) * 100
      : null;

  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {/* 月間合計 */}
      <StatCard
        title="月間合計"
        value={
          isLoading ? '' : (
            <CurrencyDisplay amount={aggregation!.total} size="md" />
          )
        }
        isLoading={isLoading}
        variant="default"
      />

      {/* 取引件数 */}
      <StatCard
        title="取引件数"
        value={isLoading ? '' : aggregation!.count}
        unit="件"
        isLoading={isLoading}
        variant="default"
      />

      {/* 平均取引額 */}
      <StatCard
        title="平均取引額"
        value={
          isLoading ? '' : (
            <CurrencyDisplay amount={aggregation!.average} size="md" />
          )
        }
        isLoading={isLoading}
        variant="default"
      />

      {/* 予算達成率 */}
      <StatCard
        title="予算達成率"
        value={
          budgetRatio !== null
            ? `${budgetRatio.toFixed(0)}%`
            : monthlyBudget === 0
            ? '未設定'
            : ''
        }
        isLoading={isLoading && monthlyBudget > 0}
        variant={
          budgetRatio !== null ? getBudgetVariant(budgetRatio) : 'default'
        }
      />
    </div>
  );
}
