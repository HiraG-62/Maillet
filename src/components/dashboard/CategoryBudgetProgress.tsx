import { formatCurrency } from '@/lib/utils';

interface CategoryBudgetProgressProps {
  categoryBudgets: Record<string, number>;
  categoryTotals: Record<string, number>;
}

export function CategoryBudgetProgress({
  categoryBudgets,
  categoryTotals,
}: CategoryBudgetProgressProps) {
  const categories = Object.keys(categoryBudgets);

  if (categories.length === 0) return null;

  const showHint = categories.length < 2;

  return (
    <div className="float-card p-5 mb-8 fade-in" style={{ animationDelay: '0.05s' }}>
      <h2 className="text-sm font-semibold text-[var(--color-text-secondary)] mb-4">
        カテゴリ別使用枠
      </h2>
      <div className="space-y-4">
        {categories.map((category) => {
          const budget = categoryBudgets?.[category] ?? 0;
          const spent = categoryTotals?.[category] ?? 0;
          const ratio = budget > 0 ? spent / budget : 0;
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
                <span className="text-sm text-[var(--color-text-primary)]">{category}</span>
                <span className="text-xs font-medium" style={{ color: barColor }}>
                  {formatCurrency(spent)} / {formatCurrency(budget)}（{Math.round(ratio * 100)}%）
                </span>
              </div>
              <div className="relative h-3 w-full overflow-hidden rounded-full bg-[var(--color-border)]">
                <div
                  className="h-full rounded-full transition-all"
                  style={{
                    width: `${clampedPct}%`,
                    backgroundColor: barColor,
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>
      {showHint && (
        <p className="text-xs text-[var(--color-text-muted)] mt-3">
          設定画面でカテゴリ別使用枠を設定できます
        </p>
      )}
    </div>
  );
}
