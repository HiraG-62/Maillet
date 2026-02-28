import { useState } from 'react';
import type { CardTransaction } from '@/types/transaction';
import { CurrencyDisplay } from '@/components/dashboard/CurrencyDisplay';
import { formatDateFull } from '@/lib/utils';
import { ChevronUp, ChevronDown } from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

type SortKey = 'date' | 'amount';
type SortDir = 'asc' | 'desc';

interface TransactionTableProps {
  transactions: CardTransaction[];
  onRowClick?: (tx: CardTransaction) => void;
}

interface CardBadgeStyle {
  bg: string;
  text: string;
  border: string;
}

function getCardBadgeStyle(cardCompany: string | null | undefined): CardBadgeStyle {
  const c = (cardCompany ?? '').toLowerCase();
  if (c.includes('smbc') || c.includes('三井住友')) {
    return { bg: 'bg-[var(--color-primary)]/15', text: 'text-[var(--color-primary)]', border: 'border-[var(--color-primary)]/30' };
  }
  if (c.includes('楽天')) {
    return { bg: 'bg-rose-500/15', text: 'dark:text-rose-400 text-rose-700', border: 'border-rose-500/30' };
  }
  if (c.includes('amex') || c.includes('アメックス')) {
    return { bg: 'bg-amber-500/15', text: 'dark:text-amber-400 text-amber-700', border: 'border-amber-500/30' };
  }
  if (c.includes('jcb')) {
    return { bg: 'bg-blue-500/15', text: 'dark:text-blue-400 text-blue-700', border: 'border-blue-500/30' };
  }
  if (c.includes('dcard') || c.includes('d card')) {
    return { bg: 'bg-[var(--color-primary)]/15', text: 'text-[var(--color-primary)]', border: 'border-[var(--color-primary)]/30' };
  }
  return { bg: 'bg-purple-500/15', text: 'dark:text-purple-400 text-purple-700', border: 'border-purple-500/30' };
}

const LARGE_AMOUNT_THRESHOLD = 50000;

export function TransactionTable({ transactions, onRowClick }: TransactionTableProps) {
  const [sortKey, setSortKey] = useState<SortKey>('date');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('desc');
    }
  };

  const SortIcon = ({ col }: { col: SortKey }) => {
    if (sortKey !== col) return <ChevronUp className="h-3 w-3 opacity-20" />;
    return sortDir === 'desc'
      ? <ChevronDown className="h-3 w-3 opacity-70" />
      : <ChevronUp className="h-3 w-3 opacity-70" />;
  };

  const sorted = [...transactions].sort((a, b) => {
    const dir = sortDir === 'asc' ? 1 : -1;
    if (sortKey === 'amount') return (a.amount - b.amount) * dir;
    return (new Date(a.transaction_date || '1970-01-01').getTime() - new Date(b.transaction_date || '1970-01-01').getTime()) * dir;
  });

  return (
    <div className="overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow className="dark:border-white/10 border-black/10 hover:bg-transparent">
            <TableHead
              className="text-[var(--color-text-secondary)] uppercase text-xs tracking-wide font-semibold cursor-pointer select-none hover:text-[var(--color-primary)] transition-colors"
              onClick={() => toggleSort('date')}
            >
              <span className="flex items-center gap-1">
                日付
                <SortIcon col="date" />
              </span>
            </TableHead>
            <TableHead className="text-[var(--color-text-secondary)] uppercase text-xs tracking-wide font-semibold">
              カード
            </TableHead>
            <TableHead
              className="text-[var(--color-text-secondary)] uppercase text-xs tracking-wide font-semibold text-right cursor-pointer select-none hover:text-[var(--color-primary)] transition-colors"
              onClick={() => toggleSort('amount')}
            >
              <span className="flex items-center justify-end gap-1">
                金額
                <SortIcon col="amount" />
              </span>
            </TableHead>
            <TableHead className="text-[var(--color-text-secondary)] uppercase text-xs tracking-wide font-semibold">
              加盟店
            </TableHead>
            <TableHead className="text-[var(--color-text-secondary)] uppercase text-xs tracking-wide font-semibold">
              カテゴリ
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sorted.map((tx, idx) => {
            const cardStyle = getCardBadgeStyle(tx.card_company);
            const isLarge = Math.abs(tx.amount) >= LARGE_AMOUNT_THRESHOLD;
            return (
              <TableRow
                key={tx.id ?? idx}
                onClick={() => onRowClick?.(tx)}
                className={`dark:border-white/5 border-black/5 dark:hover:bg-white/5 hover:bg-black/5 transition-colors ${onRowClick ? 'cursor-pointer' : ''}`}
              >
                <TableCell className="text-[var(--color-text-secondary)] text-sm whitespace-nowrap">
                  {formatDateFull(tx.transaction_date)}
                </TableCell>
                <TableCell>
                  {tx.card_company ? (
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${cardStyle.bg} ${cardStyle.text} ${cardStyle.border}`}
                    >
                      {tx.card_company}
                    </span>
                  ) : (
                    <span className="text-[var(--color-text-muted)] text-xs">—</span>
                  )}
                </TableCell>
                <TableCell className="text-right">
                  <CurrencyDisplay
                    amount={tx.amount}
                    size="sm"
                    className={isLarge ? 'dark:text-orange-300 text-orange-600' : tx.amount < 0 ? 'dark:text-orange-400 text-orange-600' : undefined}
                  />
                </TableCell>
                <TableCell className="text-[var(--color-text-primary)] text-sm font-medium">{tx.merchant}</TableCell>
                <TableCell>
                  {tx.category ? (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs dark:bg-white/8 bg-black/[8%] text-[var(--color-text-secondary)] border dark:border-white/10 border-black/10">
                      {tx.category}
                    </span>
                  ) : (
                    <span className="text-[var(--color-text-muted)] text-xs">—</span>
                  )}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
