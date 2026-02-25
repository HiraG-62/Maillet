import { Search } from 'lucide-react';
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
}: FilterBarProps) {
  const monthOptions = getPast12Months();

  return (
    <div className="bg-[#12121a] border border-white/10 rounded-lg p-3">
      <div className="flex flex-col gap-3 md:flex-row md:items-center">
        {/* Month selector */}
        <Select value={selectedMonth} onValueChange={onMonthChange}>
          <SelectTrigger className="w-full md:w-40 bg-transparent border-white/10 text-slate-200">
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
          <SelectTrigger className="w-full md:w-36 bg-transparent border-white/10 text-slate-200">
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
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
          <Input
            type="text"
            placeholder="加盟店・説明で検索..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-9 bg-transparent border-white/10 text-slate-200 placeholder:text-slate-500"
          />
        </div>
      </div>
    </div>
  );
}
