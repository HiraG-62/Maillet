import { cn } from '@/lib/utils';

interface CurrencyDisplayProps {
  amount: number;
  size?: 'sm' | 'md' | 'lg';
  variant?: 'default' | 'positive' | 'negative' | 'muted';
  className?: string;
}

const sizeConfig = {
  sm: { wrapper: 'text-base font-semibold', symbol: 'text-[0.65em]' },
  md: { wrapper: 'text-xl font-bold', symbol: 'text-[0.65em]' },
  lg: { wrapper: 'text-3xl font-black', symbol: 'text-[0.55em]' },
};

const variantColors = {
  default: 'text-[var(--color-text-primary)]',
  positive: 'text-emerald-400',
  negative: 'text-orange-400',
  muted: 'text-[var(--color-text-secondary)]',
};

export function CurrencyDisplay({ amount, size = 'md', variant, className }: CurrencyDisplayProps) {
  const config = sizeConfig[size];
  const isNegative = amount < 0;
  const absAmount = Math.abs(amount);

  const colorClass = variant
    ? variantColors[variant]
    : isNegative
      ? variantColors.negative
      : '';

  return (
    <span
      className={cn(
        'font-mono tracking-tighter transition-all duration-300',
        config.wrapper,
        colorClass,
        className
      )}
    >
      {isNegative && '-'}
      <span className={cn('opacity-70', config.symbol)}>¥</span>
      {absAmount.toLocaleString('ja-JP')}
    </span>
  );
}
