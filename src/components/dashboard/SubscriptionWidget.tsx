import type { DetectedSubscription } from '@/services/subscription-detector';
import { CurrencyDisplay } from './CurrencyDisplay';

interface SubscriptionWidgetProps {
  subscriptions: DetectedSubscription[];
  isLoading: boolean;
}

export function SubscriptionWidget({ subscriptions, isLoading }: SubscriptionWidgetProps) {
  if (isLoading) {
    return (
      <div className="float-card p-5">
        <h3 className="text-sm font-semibold text-[var(--color-text-secondary)] mb-3">
          定期支出
        </h3>
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex items-center gap-3">
              <div className="h-4 w-24 rounded bg-[var(--color-primary-light)] animate-pulse" />
              <div className="flex-1" />
              <div className="h-4 w-16 rounded bg-[var(--color-primary-light)] animate-pulse" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (subscriptions.length === 0) {
    return (
      <div className="float-card p-5">
        <h3 className="text-sm font-semibold text-[var(--color-text-secondary)] mb-3">
          定期支出
        </h3>
        <p className="text-sm text-[var(--color-text-muted)] text-center py-4">
          定期支出は検出されませんでした
        </p>
      </div>
    );
  }

  // 月額合計（年次は÷12で月額換算）
  const monthlyTotal = subscriptions.reduce((sum, s) => {
    return sum + (s.frequency === 'yearly' ? Math.round(s.amount / 12) : s.amount);
  }, 0);

  return (
    <div className="float-card p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-[var(--color-text-secondary)]">
          定期支出
        </h3>
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-[var(--color-text-muted)]">月額合計</span>
          <CurrencyDisplay amount={monthlyTotal} size="sm" />
        </div>
      </div>

      <ul className="space-y-0">
        {subscriptions.map((sub, i) => (
          <li
            key={`${sub.merchant}-${sub.amount}-${i}`}
            className={`flex items-center gap-3 py-3 ${
              i < subscriptions.length - 1
                ? 'border-b border-[var(--color-border)]/50'
                : ''
            }`}
          >
            {/* 店舗名 */}
            <span className="flex-1 text-sm text-[var(--color-text-primary)] truncate">
              {sub.merchant}
            </span>

            {/* 信頼度バッジ */}
            <span
              className={`shrink-0 px-1.5 py-0.5 rounded text-[10px] font-medium ${
                sub.confidence === 'high'
                  ? 'bg-[var(--color-success)]/15 text-emerald-700 dark:text-[var(--color-success)]'
                  : 'bg-[var(--color-warning)]/15 text-amber-700 dark:text-[var(--color-warning)]'
              }`}
            >
              {sub.confidence === 'high' ? '高' : '中'}
            </span>

            {/* 頻度 */}
            <span className="shrink-0 text-xs text-[var(--color-text-muted)]">
              {sub.frequency === 'monthly' ? '月次' : '年次'}
            </span>

            {/* 金額 */}
            <CurrencyDisplay amount={sub.amount} size="sm" className="shrink-0" />

            {/* 次回予想日 */}
            <span className="shrink-0 text-[10px] text-[var(--color-text-muted)] w-16 text-right">
              次回 {formatShortDate(sub.nextEstimatedDate)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** YYYY-MM-DD → M/D */
function formatShortDate(dateStr: string): string {
  const parts = dateStr.split('-');
  if (parts.length < 3) return dateStr;
  return `${parseInt(parts[1])}/${parseInt(parts[2])}`;
}
