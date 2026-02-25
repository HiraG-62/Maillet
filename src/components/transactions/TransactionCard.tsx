import type { CardTransaction } from '@/types/transaction';
import { CurrencyDisplay } from '@/components/dashboard/CurrencyDisplay';
import { Badge } from '@/components/ui/badge';

interface TransactionCardProps {
  transaction: CardTransaction;
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}`;
}

export function TransactionCard({ transaction }: TransactionCardProps) {
  return (
    <div className="md:hidden bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-4 hover:bg-white/[0.07] transition-colors">
      <div className="flex items-start justify-between gap-3">
        {/* Left: date + card + merchant */}
        <div className="flex-1 min-w-0">
          <p className="text-xs text-slate-500 mb-1">{formatDate(transaction.transaction_date)}</p>
          <p className="text-sm font-medium text-slate-200 truncate">{transaction.merchant}</p>
          <p className="text-xs text-slate-400 mt-0.5">{transaction.card_company}</p>
        </div>

        {/* Right: amount + category */}
        <div className="flex flex-col items-end gap-1.5 shrink-0">
          <CurrencyDisplay amount={transaction.amount} size="sm" />
          {transaction.category && (
            <Badge variant="outline" className="text-[10px] px-1.5 py-0">
              {transaction.category}
            </Badge>
          )}
        </div>
      </div>
    </div>
  );
}
