import { CreditCard, ShoppingBag, Utensils, Train, Zap } from 'lucide-react';
import type { CardTransaction } from '@/types/transaction';
import { CurrencyDisplay } from './CurrencyDisplay';

interface RecentTransactionsProps {
  transactions: CardTransaction[];
  limit?: number;
}

const CARD_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  smbc: { bg: 'bg-blue-500/20', text: 'text-blue-400', border: '#3b82f6' },
  jcb: { bg: 'bg-green-500/20', text: 'text-green-400', border: '#22c55e' },
  rakuten: { bg: 'bg-red-500/20', text: 'text-red-400', border: '#ef4444' },
  amex: { bg: 'bg-purple-500/20', text: 'text-purple-400', border: '#a855f7' },
  dcard: { bg: 'bg-orange-500/20', text: 'text-orange-400', border: '#f97316' },
};

const DEFAULT_CARD = { bg: 'bg-[var(--color-surface-elevated)]/20', text: 'text-[var(--color-text-secondary)]', border: '#64748b' };

function getCardColor(company: string | null | undefined) {
  if (!company) return DEFAULT_CARD;
  const lower = company.toLowerCase().replace(/[\s\-_]/g, '');
  for (const [key, val] of Object.entries(CARD_COLORS)) {
    if (lower.includes(key)) return val;
  }
  return DEFAULT_CARD;
}

function getCategoryIcon(category: string | null | undefined) {
  if (!category) return <CreditCard size={14} className="text-[var(--color-text-muted)] shrink-0" />;
  const lower = category.toLowerCase();
  if (lower.includes('食') || lower.includes('飲食') || lower.includes('restaurant') || lower.includes('グルメ')) {
    return <Utensils size={14} className="text-orange-400 shrink-0" />;
  }
  if (lower.includes('交通') || lower.includes('鉄道') || lower.includes('電車') || lower.includes('travel')) {
    return <Train size={14} className="text-blue-400 shrink-0" />;
  }
  if (lower.includes('ショッピング') || lower.includes('shop') || lower.includes('衣料')) {
    return <ShoppingBag size={14} className="text-pink-400 shrink-0" />;
  }
  if (lower.includes('光熱') || lower.includes('電気') || lower.includes('utility') || lower.includes('水道')) {
    return <Zap size={14} className="text-yellow-400 shrink-0" />;
  }
  return <CreditCard size={14} className="text-[var(--color-text-secondary)] shrink-0" />;
}

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const hh = d.getHours();
  const min = d.getMinutes();
  const date = `${mm}/${dd}`;
  if (hh === 0 && min === 0) return date;
  return `${date} ${String(hh).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
}

export function RecentTransactions({ transactions, limit = 10 }: RecentTransactionsProps) {
  const sorted = [...transactions]
    .sort((a, b) => (b.transaction_date ?? '').localeCompare(a.transaction_date ?? ''))
    .slice(0, limit);

  if (sorted.length === 0) {
    return <p className="text-[var(--color-text-muted)] text-sm py-4 text-center">取引データなし</p>;
  }

  return (
    <ul>
      {sorted.map((tx, index) => {
        const card = getCardColor(tx.card_company);
        return (
          <li
            key={tx.id ?? `${tx.transaction_date}-${index}`}
            className="flex items-center gap-3 py-3 border-b dark:border-white/5 border-black/5 last:border-b-0 dark:hover:bg-white/5 hover:bg-black/5 transition-colors cursor-pointer rounded-r-md pl-2"
            style={{ borderLeft: `3px solid ${card.border}` }}
          >
            {getCategoryIcon(tx.category)}
            <span className="text-[var(--color-text-secondary)] text-xs w-auto shrink-0">
              {formatDate(tx.transaction_date)}
            </span>
            <span
              className={`px-2 py-0.5 rounded-full text-[10px] font-semibold shrink-0 ${card.bg} ${card.text}`}
            >
              {tx.card_company}
            </span>
            <span className="flex-1 text-[var(--color-text-primary)] text-sm truncate">
              {tx.merchant}
            </span>
            <CurrencyDisplay amount={tx.amount} size="md" className="shrink-0" />
          </li>
        );
      })}
    </ul>
  );
}
