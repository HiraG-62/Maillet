import type { CardTransaction } from '@/types/transaction';
import { CurrencyDisplay } from '@/components/dashboard/CurrencyDisplay';
import {
  ShoppingBag,
  Plane,
  Film,
  Heart,
  CreditCard,
  Coffee,
  Car,
} from 'lucide-react';

interface TransactionCardProps {
  transaction: CardTransaction;
}

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const hh = d.getHours();
  const min = d.getMinutes();
  const date = `${yyyy}/${mm}/${dd}`;
  if (hh === 0 && min === 0) return date;
  return `${date} ${String(hh).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
}

function getCardBorderClass(cardCompany: string | null | undefined): string {
  const c = (cardCompany ?? '').toLowerCase();
  if (c.includes('smbc') || c.includes('三井住友')) return 'border-l-teal-500';
  if (c.includes('楽天')) return 'border-l-rose-500';
  if (c.includes('amex') || c.includes('アメックス')) return 'border-l-amber-500';
  if (c.includes('jcb')) return 'border-l-blue-500';
  if (c.includes('dcard') || c.includes('d card')) return 'border-l-green-500';
  return 'border-l-purple-500';
}

interface CategoryStyle {
  bg: string;
  text: string;
}

function getCategoryStyle(category: string | null | undefined): CategoryStyle {
  const c = (category ?? '').toLowerCase();
  if (c.includes('食') || c.includes('グルメ') || c.includes('飲食') || c.includes('レストラン')) {
    return { bg: 'bg-orange-500/20', text: 'text-orange-300' };
  }
  if (c.includes('ショッピング') || c.includes('購入') || c.includes('買い物')) {
    return { bg: 'bg-pink-500/20', text: 'text-pink-300' };
  }
  if (c.includes('交通') || c.includes('移動') || c.includes('電車') || c.includes('バス')) {
    return { bg: 'bg-blue-500/20', text: 'text-blue-300' };
  }
  if (c.includes('旅行') || c.includes('飛行機') || c.includes('ホテル')) {
    return { bg: 'bg-sky-500/20', text: 'text-sky-300' };
  }
  if (c.includes('エンタメ') || c.includes('娯楽') || c.includes('映画')) {
    return { bg: 'bg-purple-500/20', text: 'text-purple-300' };
  }
  if (c.includes('健康') || c.includes('医療') || c.includes('病院')) {
    return { bg: 'bg-green-500/20', text: 'text-green-300' };
  }
  if (c.includes('通信') || c.includes('サブスク')) {
    return { bg: 'bg-cyan-500/20', text: 'text-cyan-300' };
  }
  return { bg: 'dark:bg-white/10 bg-black/10', text: 'text-[var(--color-text-secondary)]' };
}

function getCategoryIcon(category: string | null | undefined) {
  const c = (category ?? '').toLowerCase();
  const cls = 'h-3 w-3 shrink-0';
  if (c.includes('食') || c.includes('グルメ') || c.includes('飲食') || c.includes('レストラン')) {
    return <Coffee className={cls} />;
  }
  if (c.includes('ショッピング') || c.includes('購入') || c.includes('買い物')) {
    return <ShoppingBag className={cls} />;
  }
  if (c.includes('交通') || c.includes('移動') || c.includes('電車') || c.includes('バス')) {
    return <Car className={cls} />;
  }
  if (c.includes('旅行') || c.includes('飛行機') || c.includes('ホテル')) {
    return <Plane className={cls} />;
  }
  if (c.includes('エンタメ') || c.includes('娯楽') || c.includes('映画')) {
    return <Film className={cls} />;
  }
  if (c.includes('健康') || c.includes('医療') || c.includes('病院')) {
    return <Heart className={cls} />;
  }
  return <CreditCard className={cls} />;
}

export function TransactionCard({ transaction }: TransactionCardProps) {
  const borderClass = getCardBorderClass(transaction.card_company);
  const catStyle = getCategoryStyle(transaction.category);

  return (
    <div
      className={`border-l-4 ${borderClass} p-4 hover:bg-[var(--color-surface-hover,var(--color-surface))] transition-colors duration-200`}
    >
      <div className="flex items-start justify-between gap-3">
        {/* Left: date + card + merchant */}
        <div className="flex-1 min-w-0">
          <p className="text-xs text-[var(--color-text-secondary)] mb-1">{formatDate(transaction.transaction_date)}</p>
          <p className="text-sm font-medium text-[var(--color-text-primary)] truncate">{transaction.merchant}</p>
          <p className="text-xs text-[var(--color-text-muted)] mt-0.5">{transaction.card_company}</p>
        </div>

        {/* Right: amount + category */}
        <div className="flex flex-col items-end gap-1.5 shrink-0">
          <CurrencyDisplay amount={transaction.amount} size="md" />
          {transaction.category && (
            <span
              className={`flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full ${catStyle.bg} ${catStyle.text}`}
            >
              {getCategoryIcon(transaction.category)}
              {transaction.category}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
