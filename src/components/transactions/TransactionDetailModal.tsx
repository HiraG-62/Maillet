import { useState, useEffect } from 'react';
import type { CardTransaction } from '@/types/transaction';
import { CATEGORIES } from '@/services/category';
import { updateTransactionCategory, updateTransactionMemo, updateTransactionTags, getTransactions, deleteTransaction } from '@/lib/transactions';
import { TagBadge } from '@/components/transactions/TagBadge';
import { saveDB } from '@/lib/database';
import { formatDateFull, formatCurrency } from '@/lib/utils';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import {
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from '@/components/ui/select';
import { Loader2, Trash2, ChevronLeft, ChevronRight } from 'lucide-react';

const CATEGORY_KEYS = Object.keys(CATEGORIES);
const DESCRIPTION_MAX_LEN = 80;

interface TransactionDetailModalProps {
  transaction: CardTransaction | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
  onPrev?: () => void;
  onNext?: () => void;
  hasPrev?: boolean;
  hasNext?: boolean;
}

export function TransactionDetailModal({
  transaction,
  open,
  onOpenChange,
  onSaved,
  onPrev,
  onNext,
  hasPrev = false,
  hasNext = false,
}: TransactionDetailModalProps) {
  const [category, setCategory] = useState<string>('');
  const [memo, setMemo] = useState<string>('');
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');
  const [allTags, setAllTags] = useState<string[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isDescriptionExpanded, setIsDescriptionExpanded] = useState(false);

  useEffect(() => {
    if (transaction) {
      setCategory(transaction.category || '__none__');
      setMemo(transaction.memo ?? '');
      setTags(transaction.tags ?? []);
      setIsDescriptionExpanded(false);
    }
  }, [transaction]);

  useEffect(() => {
    getTransactions().then((txList) => {
      const tagSet = new Set<string>();
      txList.forEach((tx) => (tx.tags ?? []).forEach((t) => tagSet.add(t)));
      setAllTags([...tagSet]);
    }).catch(() => {});
  }, []);

  async function handleDelete() {
    if (!transaction?.id) return;
    setIsDeleting(true);
    try {
      await deleteTransaction(transaction.id);
      await saveDB();
      onSaved();
      onOpenChange(false);
    } catch (err) {
      console.error('[TransactionDetailModal] Delete failed:', err);
    } finally {
      setIsDeleting(false);
      setShowDeleteConfirm(false);
    }
  }

  async function handleSave() {
    if (!transaction?.id) return;
    setIsSaving(true);
    try {
      const categoryToSave = category === '__none__' ? '' : category;
      await updateTransactionCategory(transaction.id, categoryToSave);
      await updateTransactionMemo(transaction.id, memo);
      await updateTransactionTags(transaction.id, tags);
      await saveDB();
      onSaved();
      onOpenChange(false);
    } catch (err) {
      console.error('[TransactionDetailModal] Save failed:', err);
    } finally {
      setIsSaving(false);
    }
  }

  if (!transaction) return null;

  const description = transaction.description;
  const hasDescription = description != null && description.trim() !== '';
  const isLongDescription = hasDescription && description.length > DESCRIPTION_MAX_LEN;
  const displayedDescription = isLongDescription && !isDescriptionExpanded
    ? description.slice(0, DESCRIPTION_MAX_LEN) + '…'
    : description;

  const showNavigation = onPrev != null || onNext != null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="flex items-center justify-between gap-2">
            <div className="flex-1 min-w-0">
              <DialogTitle>取引詳細</DialogTitle>
              <DialogDescription>{transaction.merchant}</DialogDescription>
            </div>
            {showNavigation && (
              <div className="flex items-center gap-1 shrink-0">
                <button
                  onClick={onPrev}
                  disabled={!hasPrev}
                  className="p-1.5 rounded-md text-[var(--color-text-secondary)] hover:bg-[var(--color-border)]/30 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  aria-label="前の取引"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <button
                  onClick={onNext}
                  disabled={!hasNext}
                  className="p-1.5 rounded-md text-[var(--color-text-secondary)] hover:bg-[var(--color-border)]/30 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  aria-label="次の取引"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            )}
          </div>
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

          {/* Description */}
          {hasDescription && (
            <div>
              <label className="text-xs text-[var(--color-text-muted)] block mb-1">説明</label>
              <p className="text-sm text-[var(--color-text-primary)] break-words">
                {displayedDescription}
              </p>
              {isLongDescription && (
                <button
                  onClick={() => setIsDescriptionExpanded((v) => !v)}
                  className="mt-0.5 text-xs text-[var(--color-primary)] hover:underline"
                >
                  {isDescriptionExpanded ? '折り畳む' : 'もっと見る'}
                </button>
              )}
            </div>
          )}

          {/* Category (editable) */}
          <div>
            <label className="text-xs text-[var(--color-text-muted)] flex items-center gap-1.5 mb-1">
              カテゴリ
              {transaction.category_source === 'auto' && (
                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-blue-500/20 text-blue-400 border border-blue-500/30">
                  自動分類済み
                </span>
              )}
            </label>
            <Select value={category || '__none__'} onValueChange={setCategory}>
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

          {/* Tags */}
          <div>
            <label className="text-xs text-[var(--color-text-muted)] block mb-1">タグ</label>
            <div className="flex flex-wrap gap-1.5 mb-2">
              {tags.map((tag) => (
                <TagBadge key={tag} tag={tag} onRemove={() => setTags(tags.filter((t) => t !== tag))} />
              ))}
            </div>
            <div className="relative">
              <input
                type="text"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={(e) => {
                  if ((e.key === 'Enter' || e.key === ',') && tagInput.trim()) {
                    e.preventDefault();
                    const newTag = tagInput.trim().replace(/,$/, '');
                    if (newTag && !tags.includes(newTag)) {
                      setTags([...tags, newTag]);
                    }
                    setTagInput('');
                  }
                }}
                placeholder="タグを入力してEnter..."
                list="tag-suggestions"
                className="w-full rounded-md border border-[var(--color-border)] bg-[var(--color-background)] px-3 py-2 text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
              />
              <datalist id="tag-suggestions">
                {allTags.filter((t) => !tags.includes(t)).map((t) => (
                  <option key={t} value={t} />
                ))}
              </datalist>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="mt-6 flex justify-between items-center">
          {!showDeleteConfirm ? (
            <button
              onClick={() => setShowDeleteConfirm(true)}
              disabled={isSaving || isDeleting}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-md text-sm font-medium text-red-500 hover:bg-red-500/10 border border-red-500/30 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <Trash2 className="h-4 w-4" />
              削除
            </button>
          ) : (
            <div className="flex items-center gap-2">
              <span className="text-xs text-[var(--color-text-secondary)]">本当に削除しますか？</span>
              <button
                onClick={handleDelete}
                disabled={isDeleting}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium bg-red-500 text-white hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {isDeleting ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
                削除する
              </button>
              <button
                onClick={() => setShowDeleteConfirm(false)}
                disabled={isDeleting}
                className="px-3 py-1.5 rounded-md text-xs font-medium text-[var(--color-text-secondary)] hover:bg-[var(--color-border)]/30 disabled:opacity-50 transition-colors"
              >
                キャンセル
              </button>
            </div>
          )}
          <button
            onClick={handleSave}
            disabled={isSaving || isDeleting}
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
