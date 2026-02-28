import { useState, useEffect } from 'react';
import type { CardTransaction } from '@/types/transaction';
import { CATEGORIES } from '@/services/category';
import { updateTransactionCategory, updateTransactionMemo } from '@/lib/transactions';
import { saveDB } from '@/lib/database';
import { formatDateFull, formatCurrency } from '@/lib/utils';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import {
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from '@/components/ui/select';
import { Loader2 } from 'lucide-react';

const CATEGORY_KEYS = Object.keys(CATEGORIES);

interface TransactionDetailModalProps {
  transaction: CardTransaction | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}

export function TransactionDetailModal({
  transaction,
  open,
  onOpenChange,
  onSaved,
}: TransactionDetailModalProps) {
  const [category, setCategory] = useState<string>('');
  const [memo, setMemo] = useState<string>('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (transaction) {
      setCategory(transaction.category || '__none__');
      setMemo(transaction.memo ?? '');
    }
  }, [transaction]);

  async function handleSave() {
    if (!transaction?.id) return;
    setIsSaving(true);
    try {
      const categoryToSave = category === '__none__' ? '' : category;
      await updateTransactionCategory(transaction.id, categoryToSave);
      await updateTransactionMemo(transaction.id, memo);
      await saveDB();
      onSaved();
      onOpenChange(false);
    } finally {
      setIsSaving(false);
    }
  }

  if (!transaction) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>取引詳細</DialogTitle>
          <DialogDescription>{transaction.merchant}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 mt-4">
          {/* Read-only fields */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-[var(--color-text-muted)] block mb-1">日付</label>
              <p className="text-sm text-[var(--color-text-primary)]">
                {formatDateFull(transaction.transaction_date)}
              </p>
            </div>
            <div>
              <label className="text-xs text-[var(--color-text-muted)] block mb-1">金額</label>
              <p className="text-sm font-semibold text-[var(--color-text-primary)]">
                {formatCurrency(transaction.amount)}
              </p>
            </div>
            <div>
              <label className="text-xs text-[var(--color-text-muted)] block mb-1">加盟店</label>
              <p className="text-sm text-[var(--color-text-primary)] truncate">
                {transaction.merchant}
              </p>
            </div>
            <div>
              <label className="text-xs text-[var(--color-text-muted)] block mb-1">カード</label>
              <p className="text-sm text-[var(--color-text-primary)]">
                {transaction.card_company || '—'}
              </p>
            </div>
          </div>

          {/* Category (editable) */}
          <div>
            <label className="text-xs text-[var(--color-text-muted)] block mb-1">カテゴリ</label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger>
                <SelectValue placeholder="カテゴリを選択" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">未分類</SelectItem>
                {CATEGORY_KEYS.filter((cat) => cat !== '').map((cat) => (
                  <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Memo (editable) */}
          <div>
            <label className="text-xs text-[var(--color-text-muted)] block mb-1">メモ</label>
            <textarea
              value={memo}
              onChange={(e) => setMemo(e.target.value)}
              placeholder="メモを入力..."
              rows={3}
              className="w-full rounded-md border border-[var(--color-border)] bg-[var(--color-background)] px-3 py-2 text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] resize-none"
            />
          </div>
        </div>

        {/* Save button */}
        <div className="mt-6 flex justify-end">
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium bg-[var(--color-primary)] text-white hover:bg-[var(--color-primary-hover)] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isSaving ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                保存中...
              </>
            ) : (
              '保存'
            )}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
