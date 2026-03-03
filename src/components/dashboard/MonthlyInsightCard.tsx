import { useNavigate } from 'react-router';
import { CurrencyDisplay } from './CurrencyDisplay';

interface MonthlyInsightCardProps {
  totalSpending: number;
  prevMonthTotal: number;
  hasPrevData: boolean;
  categoryTotals: Record<string, number>;
  categoryBudgets: Record<string, number>;
  isLoading: boolean;
}

export function MonthlyInsightCard({
  totalSpending,
  categoryTotals,
  categoryBudgets,
  isLoading,
}: MonthlyInsightCardProps) {
  const navigate = useNavigate();

  if (isLoading) {
    return (
      <div className="float-card p-5 mb-8 fade-in">
        <div className="h-4 w-32 rounded bg-[var(--color-primary-light)] animate-pulse mb-4" />
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-8 rounded bg-[var(--color-primary-light)] animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  const hasNoTransactions = totalSpending === 0 && Object.keys(categoryTotals).length === 0;

  if (hasNoTransactions) {
    return (
      <div className="float-card p-5 mb-8 fade-in">
        <h2 className="text-sm font-semibold text-[var(--color-text-secondary)] mb-3">
          今月の支出サマリー
        </h2>
        <p className="text-sm text-[var(--color-text-muted)] text-center py-4">
          今月の取引データがありません
        </p>
      </div>
    );
  }

  const sortedCategories = Object.entries(categoryTotals)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 3);

  const hasNoBudgets = Object.keys(categoryBudgets).length === 0;

  return (
    <div className="float-card p-5 mb-8 fade-in">
      <h2 className="text-sm font-semibold text-[var(--color-text-secondary)] mb-4">
        今月の支出サマリー
      </h2>

      <div className="space-y-4">
        {sortedCategories.map(([category, amount]) => {
          const pct = totalSpending > 0 ? (amount / totalSpending) * 100 : 0;
          const budget = categoryBudgets[category];
          const hasBudget = budget !== undefined && budget > 0;

          if (hasBudget) {
            const ratio = amount / budget;
            const clampedPct = Math.min(ratio, 1) * 100;
            const barColor =
              ratio <= 0.5
                ? 'var(--color-success)'
                : ratio <= 0.8
                ? 'var(--color-warning)'
                : 'var(--color-danger)';

            return (
              <div key={category}>
                <div className="flex justify-between items-center mb-1.5">
                  <span className="text-sm text-[var(--color-text-primary)] min-w-0 truncate">
                    {category}
                  </span>
                  <div className="text-right shrink-0 ml-2 flex items-center gap-1.5">
                    <CurrencyDisplay amount={amount} size="sm" />
                    <span className="text-xs text-[var(--color-text-muted)]">
                      ({pct.toFixed(1)}%)
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="relative h-2 flex-1 overflow-hidden rounded-full bg-[var(--color-border)]">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{ width: `${clampedPct}%`, backgroundColor: barColor }}
                    />
                  </div>
                  <span className="text-xs shrink-0" style={{ color: barColor }}>
                    {Math.round(ratio * 100)}%消化
                  </span>
                </div>
              </div>
            );
          }

          return (
            <div key={category} className="flex justify-between items-center">
              <span className="text-sm text-[var(--color-text-primary)] min-w-0 truncate">
                {category}
              </span>
              <div className="text-right shrink-0 ml-2 flex items-center gap-1.5">
                <CurrencyDisplay amount={amount} size="sm" />
                <span className="text-xs text-[var(--color-text-muted)]">
                  ({pct.toFixed(1)}%)
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {hasNoBudgets && (
        <div className="mt-4 pt-4 border-t border-[var(--color-border)]">
          <p className="text-xs text-[var(--color-text-muted)] mb-2">
            予算を設定すると消化率が表示されます
          </p>
          <button
            onClick={() => void navigate('/settings')}
            className="text-xs text-[var(--color-primary)] font-medium hover:underline"
          >
            設定する →
          </button>
        </div>
      )}
    </div>
  );
}
