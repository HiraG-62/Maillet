import type { CardTransaction } from '@/types/transaction';
import { CurrencyDisplay } from './CurrencyDisplay';

interface RecentTransactionsProps {
  transactions: CardTransaction[];
  limit?: number;
}

const CARD_BADGE_COLORS: Record<string, { bg: string; text: string }> = {
  smbc: { bg: 'bg-blue-500/20', text: 'text-blue-400' },
  jcb: { bg: 'bg-green-500/20', text: 'text-green-400' },
  rakuten: { bg: 'bg-red-500/20', text: 'text-red-400' },
  amex: { bg: 'bg-purple-500/20', text: 'text-purple-400' },
  dcard: { bg: 'bg-orange-500/20', text: 'text-orange-400' },
};

function getCardBadgeColor(company: string | null | undefined): { bg: string; text: string } {
  if (!company) return { bg: 'bg-slate-500/20', text: 'text-slate-400' };
  const lower = company.toLowerCase().replace(/[\s\-_]/g, '');
  for (const [key, val] of Object.entries(CARD_BADGE_COLORS)) {
    if (lower.includes(key)) return val;
  }
  return { bg: 'bg-slate-500/20', text: 'text-slate-400' };
}

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '—';
  const d = dateStr.slice(0, 10);
  const parts = d.split('-');
  if (parts.length === 3) {
    return `${parseInt(parts[1])}/${parseInt(parts[2])}`;
  }
  return d;
}

export function RecentTransactions({ transactions, limit = 10 }: RecentTransactionsProps) {
  const sorted = [...transactions]
    .sort((a, b) => (b.transaction_date ?? '').localeCompare(a.transaction_date ?? ''))
    .slice(0, limit);

  if (sorted.length === 0) {
    return <p className="text-slate-500 text-sm py-4 text-center">取引データなし</p>;
  }

  return (
    <ul>
      {sorted.map((tx, index) => {
        const badge = getCardBadgeColor(tx.card_company);
        return (
          <li
            key={tx.id ?? `${tx.transaction_date}-${index}`}
            className="flex items-center gap-3 py-3 border-b border-white/5 last:border-b-0"
          >
            <span className="text-slate-400 text-sm w-10 shrink-0">
              {formatDate(tx.transaction_date)}
            </span>
            <span
              className={`px-2 py-0.5 rounded text-[10px] font-medium shrink-0 ${badge.bg} ${badge.text}`}
            >
              {tx.card_company}
            </span>
            <span className="flex-1 text-slate-200 text-sm truncate">
              {tx.merchant}
            </span>
            <CurrencyDisplay amount={tx.amount} size="sm" className="shrink-0" />
          </li>
        );
      })}
    </ul>
  );
}
