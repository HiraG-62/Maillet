import { useState, useMemo } from 'react';
import type { ClassificationProposal } from '@/types/classification';
import { CATEGORIES } from '@/services/category';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const CATEGORY_KEYS = Object.keys(CATEGORIES);
const PAGE_SIZE = 5;

interface CategorySuggestPanelProps {
  proposals: ClassificationProposal[];
  onApprove: (approved: ClassificationProposal[]) => void;
  onClose: () => void;
}

function confidenceColor(confidence: number): string {
  if (confidence >= 0.9) return 'text-[var(--color-primary)]';
  if (confidence >= 0.7) return 'text-amber-400';
  return 'text-[var(--color-text-muted)]';
}

function confidenceBarColor(confidence: number): string {
  if (confidence >= 0.9) return '';
  if (confidence >= 0.7) return '[&>div]:bg-amber-400';
  return '[&>div]:bg-[var(--color-text-muted)]';
}

export function CategorySuggestPanel({ proposals, onApprove, onClose }: CategorySuggestPanelProps) {
  const sorted = useMemo(
    () => [...proposals].sort((a, b) => b.confidence - a.confidence),
    [proposals]
  );

  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [checked, setChecked] = useState<boolean[]>(() => sorted.map(() => true));
  const [categories, setCategories] = useState<string[]>(() =>
    sorted.map((p) => p.suggestedCategory)
  );

  const visible = sorted.slice(0, visibleCount);
  const hasMore = visibleCount < sorted.length;

  const handleCheck = (idx: number) => {
    setChecked((prev) => prev.map((v, i) => (i === idx ? !v : v)));
  };

  const handleCategoryChange = (idx: number, value: string) => {
    setCategories((prev) => prev.map((v, i) => (i === idx ? value : v)));
  };

  const handleApprove = () => {
    const approved = sorted
      .map((p, i) => ({ ...p, suggestedCategory: categories[i] }))
      .filter((_, i) => checked[i]);
    onApprove(approved);
  };

  const checkedCount = checked.filter(Boolean).length;

  return (
    <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-semibold text-[var(--color-text-primary)]">
          AI カテゴリ提案
          <span className="ml-2 text-sm font-normal text-[var(--color-text-muted)]">
            ({sorted.length} 件)
          </span>
        </h3>
      </div>

      <div className="space-y-2">
        {visible.map((proposal, idx) => (
          <div
            key={proposal.merchantName}
            className="flex items-center gap-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-background)]/60 px-3 py-2"
          >
            {/* チェックボックス */}
            <input
              type="checkbox"
              checked={checked[idx]}
              onChange={() => handleCheck(idx)}
              className="h-4 w-4 cursor-pointer accent-[var(--color-primary)]"
              aria-label={`${proposal.merchantName} を承認`}
            />

            {/* 加盟店名 + 件数 */}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-[var(--color-text-primary)] truncate">
                {proposal.merchantName}
              </p>
              <p className="text-xs text-[var(--color-text-muted)]">
                {proposal.transactionCount} 件の取引に適用
              </p>
            </div>

            {/* カテゴリドロップダウン */}
            <div className="w-28 shrink-0">
              <Select
                value={categories[idx]}
                onValueChange={(v) => handleCategoryChange(idx, v)}
              >
                <SelectTrigger className="h-8 text-xs px-2">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORY_KEYS.map((cat) => (
                    <SelectItem key={cat} value={cat}>
                      {cat}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* 確信度バー + テキスト */}
            <div className="w-24 shrink-0 space-y-1">
              <Progress
                value={Math.round(proposal.confidence * 100)}
                className={`h-1.5 ${confidenceBarColor(proposal.confidence)}`}
              />
              <p className={`text-xs text-right ${confidenceColor(proposal.confidence)}`}>
                {Math.round(proposal.confidence * 100)}%
              </p>
            </div>

            {/* reasoning */}
            <p
              className="hidden sm:block w-28 shrink-0 text-xs text-[var(--color-text-muted)] truncate"
              title={proposal.reasoning}
            >
              {proposal.reasoning}
            </p>
          </div>
        ))}
      </div>

      {hasMore && (
        <button
          onClick={() => setVisibleCount((n) => n + PAGE_SIZE)}
          className="text-xs text-[var(--color-primary)] hover:underline"
        >
          さらに表示 ({sorted.length - visibleCount} 件)
        </button>
      )}

      <div className="flex items-center justify-end gap-2 pt-2 border-t border-[var(--color-border)]">
        <Button variant="outline" size="sm" onClick={onClose}>
          キャンセル
        </Button>
        <Button
          size="sm"
          onClick={handleApprove}
          disabled={checkedCount === 0}
        >
          すべて承認 ({checkedCount} 件)
        </Button>
      </div>
    </div>
  );
}
