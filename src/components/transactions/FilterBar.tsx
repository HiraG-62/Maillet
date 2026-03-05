import { useState } from 'react';
import { Search, X, Tag, ChevronDown, ArrowUpDown } from 'lucide-react';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

export type SortKey = 'date_desc' | 'date_asc' | 'amount_desc' | 'amount_asc';

interface FilterBarProps {
  selectedMonth: string;
  selectedCard: string;
  searchQuery: string;
  categories: string[];
  selectedCategory: string;
  availableCards?: string[];
  availableTags?: string[];
  selectedTags?: string[];
  sortKey?: SortKey;
  onMonthChange: (month: string) => void;
  onCardChange: (card: string) => void;
  onSearchChange: (query: string) => void;
  onCategoryChange: (category: string) => void;
  onTagsChange?: (tags: string[]) => void;
  onSortChange?: (sort: SortKey) => void;
  onReset?: () => void;
}

function getPast12Months(): Array<{ value: string; label: string }> {
  const months: Array<{ value: string; label: string }> = [];
  const now = new Date();
  for (let i = 0; i < 12; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const label = `${d.getFullYear()}年${d.getMonth() + 1}月`;
    months.push({ value, label });
  }
  return months;
}

const SORT_OPTIONS: Array<{ value: SortKey; label: string }> = [
  { value: 'date_desc', label: '日付 (新→古)' },
  { value: 'date_asc', label: '日付 (古→新)' },
  { value: 'amount_desc', label: '金額 (高→低)' },
  { value: 'amount_asc', label: '金額 (低→高)' },
];

export function FilterBar({
  selectedMonth,
  selectedCard,
  searchQuery,
  categories,
  selectedCategory,
  availableCards = [],
  availableTags = [],
  selectedTags = [],
  sortKey = 'date_desc',
  onMonthChange,
  onCardChange,
  onSearchChange,
  onCategoryChange,
  onTagsChange,
  onSortChange,
  onReset,
}: FilterBarProps) {
  const [tagMenuOpen, setTagMenuOpen] = useState(false);

  const monthOptions = getPast12Months();
  const hasActiveFilter =
    selectedMonth !== 'all' || selectedCard !== 'all' || searchQuery.trim() !== '' || selectedCategory !== '' || selectedTags.length > 0;

  function toggleTag(tag: string) {
    if (!onTagsChange) return;
    if (selectedTags.includes(tag)) {
      onTagsChange(selectedTags.filter((t) => t !== tag));
    } else {
      onTagsChange([...selectedTags, tag]);
    }
  }

  function clearTags() {
    onTagsChange?.([]);
  }

  const tagLabel =
    selectedTags.length === 0
      ? 'タグ'
      : selectedTags.length === 1
        ? selectedTags[0]
        : `タグ ${selectedTags.length}件`;

  return (
    <div className="float-card p-3">
      <div className="flex flex-col gap-3 md:flex-row md:items-center">
        {/* Month selector */}
        <Select value={selectedMonth || 'all'} onValueChange={onMonthChange}>
          <SelectTrigger
            className={`w-full md:w-40 bg-transparent text-[var(--color-text-primary)] transition-colors ${
              selectedMonth !== 'all'
                ? 'border-[var(--color-primary)]/50 bg-[var(--color-primary)]/5 text-[var(--color-primary)]'
                : 'dark:border-white/10 border-black/10'
            }`}
          >
            <SelectValue placeholder="月を選択" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全期間</SelectItem>
            {monthOptions.map((m) => (
              <SelectItem key={m.value} value={m.value}>
                {m.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Card company selector */}
        <Select value={selectedCard || 'all'} onValueChange={onCardChange}>
          <SelectTrigger
            className={`w-full md:w-36 bg-transparent text-[var(--color-text-primary)] transition-colors ${
              selectedCard !== 'all'
                ? 'border-[var(--color-primary)]/50 bg-[var(--color-primary)]/5 text-[var(--color-primary)]'
                : 'dark:border-white/10 border-black/10'
            }`}
          >
            <SelectValue placeholder="カード選択" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全カード</SelectItem>
            {availableCards.map((card) => (
              <SelectItem key={card} value={card}>
                {card}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Category selector */}
        <Select
          value={selectedCategory || '__all__'}
          onValueChange={(v) => onCategoryChange(v === '__all__' ? '' : v)}
          // Note: '__unclassified__' is passed through as-is to the parent
        >
          <SelectTrigger
            className={`w-full md:w-36 bg-transparent text-[var(--color-text-primary)] transition-colors ${
              selectedCategory !== ''
                ? 'border-[var(--color-primary)]/50 bg-[var(--color-primary)]/5 text-[var(--color-primary)]'
                : 'dark:border-white/10 border-black/10'
            }`}
          >
            <SelectValue placeholder="カテゴリ" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">全カテゴリ</SelectItem>
            <SelectItem value="__unclassified__">未分類</SelectItem>
            {categories.filter(c => c && c.trim() !== '').map((cat) => (
              <SelectItem key={cat} value={cat}>
                {cat}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Tag MultiSelect via DropdownMenu + Checkbox */}
        <DropdownMenu open={tagMenuOpen} onOpenChange={setTagMenuOpen}>
          <DropdownMenuTrigger asChild>
            <button
              className={`flex items-center justify-between gap-2 w-full md:w-36 px-3 py-2 rounded-md border text-sm transition-colors ${
                selectedTags.length > 0
                  ? 'border-[var(--color-primary)]/50 bg-[var(--color-primary)]/5 text-[var(--color-primary)]'
                  : 'dark:border-white/10 border-black/10 bg-transparent text-[var(--color-text-primary)]'
              }`}
            >
              <span className="flex items-center gap-1.5 truncate">
                <Tag className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">{tagLabel}</span>
              </span>
              <ChevronDown className="h-3.5 w-3.5 shrink-0 opacity-60" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-48" align="start">
            {availableTags.length === 0 ? (
              <div className="px-2 py-3 text-sm text-[var(--color-text-muted)] text-center">
                タグなし
              </div>
            ) : (
              <>
                <DropdownMenuLabel className="flex items-center justify-between">
                  <span>タグ選択</span>
                  {selectedTags.length > 0 && (
                    <button
                      onClick={(e) => { e.preventDefault(); clearTags(); }}
                      className="text-xs text-[var(--color-primary)] hover:underline"
                    >
                      クリア
                    </button>
                  )}
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                {availableTags.map((tag) => (
                  <DropdownMenuCheckboxItem
                    key={tag}
                    checked={selectedTags.includes(tag)}
                    onCheckedChange={() => toggleTag(tag)}
                    onSelect={(e) => e.preventDefault()}
                  >
                    {tag}
                  </DropdownMenuCheckboxItem>
                ))}
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Sort dropdown (mobile + PC common) */}
        <Select value={sortKey} onValueChange={(v) => onSortChange?.(v as SortKey)}>
          <SelectTrigger
            className={`w-full md:w-36 bg-transparent text-[var(--color-text-primary)] transition-colors ${
              sortKey !== 'date_desc'
                ? 'border-[var(--color-primary)]/50 bg-[var(--color-primary)]/5 text-[var(--color-primary)]'
                : 'dark:border-white/10 border-black/10'
            }`}
          >
            <span className="flex items-center gap-1.5">
              <ArrowUpDown className="h-3.5 w-3.5 shrink-0 opacity-60" />
              <SelectValue />
            </span>
          </SelectTrigger>
          <SelectContent>
            {SORT_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Free-word search */}
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--color-text-secondary)] pointer-events-none" />
          <Input
            type="text"
            placeholder="加盟店・説明で検索..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-9 bg-transparent dark:border-white/10 border-black/10 text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:border-[var(--color-primary)]/50 focus:ring-1 focus:ring-[var(--color-primary)]/30"
          />
        </div>

        {/* Reset button — visible only when a filter is active */}
        {hasActiveFilter && onReset && (
          <button
            onClick={onReset}
            className="flex items-center gap-1.5 px-3 py-2 rounded-md dark:bg-white/5 bg-black/5 dark:hover:bg-white/10 hover:bg-black/10 text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] text-sm transition-colors shrink-0"
          >
            <X className="h-3.5 w-3.5" />
            <span>リセット</span>
          </button>
        )}
      </div>
    </div>
  );
}
