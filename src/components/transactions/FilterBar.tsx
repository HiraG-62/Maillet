import { Search, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface FilterBarProps {
  selectedMonth: string;
  selectedCard: string;
  searchQuery: string;
  onMonthChange: (month: string) => void;
  onCardChange: (card: string) => void;
  onSearchChange: (query: string) => void;
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

const CARD_OPTIONS = [
  { value: 'all', label: '全カード' },
  { value: 'SMBC', label: 'SMBC' },
  { value: 'JCB', label: 'JCB' },
  { value: '楽天', label: '楽天' },
  { value: 'AMEX', label: 'AMEX' },
  { value: 'dCard', label: 'dCard' },
];

export function FilterBar({
  selectedMonth,
  selectedCard,
  searchQuery,
  onMonthChange,
  onCardChange,
  onSearchChange,
  onReset,
}: FilterBarProps) {
  const monthOptions = getPast12Months();
  const hasActiveFilter =
    selectedMonth !== 'all' || selectedCard !== 'all' || searchQuery.trim() !== '';

  return (
    <div className="bg-[var(--color-background)] border dark:border-white/10 border-black/10 rounded-lg p-3">
      <div className="flex flex-col gap-3 md:flex-row md:items-center">
        {/* Month selector */}
        <Select value={selectedMonth} onValueChange={onMonthChange}>
          <SelectTrigger
            className={`w-full md:w-40 bg-transparent text-[var(--color-text-primary)] transition-colors ${
              selectedMonth !== 'all'
                ? 'border-cyan-500/50 bg-cyan-500/5 text-cyan-400'
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
        <Select value={selectedCard} onValueChange={onCardChange}>
          <SelectTrigger
            className={`w-full md:w-36 bg-transparent text-[var(--color-text-primary)] transition-colors ${
              selectedCard !== 'all'
                ? 'border-cyan-500/50 bg-cyan-500/5 text-cyan-400'
                : 'dark:border-white/10 border-black/10'
            }`}
          >
            <SelectValue placeholder="カード選択" />
          </SelectTrigger>
          <SelectContent>
            {CARD_OPTIONS.map((c) => (
              <SelectItem key={c.value} value={c.value}>
                {c.label}
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
            className="pl-9 bg-transparent dark:border-white/10 border-black/10 text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/30"
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
