import type { CardTransaction } from '@/types/transaction';
import { CurrencyDisplay } from '@/components/dashboard/CurrencyDisplay';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

interface TransactionTableProps {
  transactions: CardTransaction[];
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

export function TransactionTable({ transactions }: TransactionTableProps) {
  const sorted = [...transactions].sort(
    (a, b) => new Date(b.transaction_date ?? '').getTime() - new Date(a.transaction_date ?? '').getTime()
  );

  return (
    <div className="hidden md:block bg-[#12121a] border border-white/10 rounded-lg overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow className="border-white/10">
            <TableHead className="text-slate-400">日付</TableHead>
            <TableHead className="text-slate-400">カード</TableHead>
            <TableHead className="text-slate-400 text-right">金額</TableHead>
            <TableHead className="text-slate-400">加盟店</TableHead>
            <TableHead className="text-slate-400">カテゴリ</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sorted.map((tx, idx) => (
            <TableRow key={tx.id ?? idx} className="border-white/5 hover:bg-white/[0.04]">
              <TableCell className="text-slate-300 text-sm whitespace-nowrap">
                {formatDate(tx.transaction_date)}
              </TableCell>
              <TableCell className="text-slate-300 text-sm">{tx.card_company}</TableCell>
              <TableCell className="text-right">
                <CurrencyDisplay amount={tx.amount} size="sm" />
              </TableCell>
              <TableCell className="text-slate-200 text-sm">{tx.merchant}</TableCell>
              <TableCell>
                {tx.category ? (
                  <Badge variant="outline" className="text-xs">
                    {tx.category}
                  </Badge>
                ) : (
                  <span className="text-slate-600 text-xs">—</span>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
