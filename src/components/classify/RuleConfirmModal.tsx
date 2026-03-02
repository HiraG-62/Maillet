import { useState } from 'react';
import type { ClassificationProposal } from '@/types/classification';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

interface RuleConfirmModalProps {
  open: boolean;
  proposals: ClassificationProposal[];
  onConfirm: () => void;
  onClose: () => void;
}

export function RuleConfirmModal({ open, proposals, onConfirm, onClose }: RuleConfirmModalProps) {
  const [isApplying, setIsApplying] = useState(false);

  const totalTransactions = proposals.reduce((sum, p) => sum + p.transactionCount, 0);

  const handleConfirm = async () => {
    setIsApplying(true);
    try {
      await onConfirm();
    } finally {
      setIsApplying(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            {proposals.length} 件のカテゴリルールを追加しますか？
          </DialogTitle>
        </DialogHeader>

        {/* 提案サマリー一覧 */}
        <div className="mt-3 max-h-60 overflow-y-auto space-y-1">
          {proposals.map((p) => (
            <div
              key={p.merchantName}
              className="flex items-center justify-between rounded-md px-3 py-1.5 bg-[var(--color-background)]/60 border border-[var(--color-border)]"
            >
              <span className="text-sm text-[var(--color-text-primary)] truncate flex-1">
                {p.merchantName}
              </span>
              <span className="text-[var(--color-text-muted)] mx-2 text-xs">→</span>
              <span className="text-sm font-medium text-[var(--color-primary)] shrink-0">
                {p.suggestedCategory}
              </span>
            </div>
          ))}
        </div>

        {/* 注記 */}
        <p className="mt-3 text-xs text-[var(--color-text-muted)]">
          対象の未分類取引（計 {totalTransactions} 件）に遡及適用されます。
        </p>

        <DialogFooter className="mt-4 gap-2">
          <Button variant="outline" size="sm" onClick={onClose} disabled={isApplying}>
            戻る
          </Button>
          <Button size="sm" onClick={handleConfirm} disabled={isApplying}>
            {isApplying ? '適用中...' : '確認・適用'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
