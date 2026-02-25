import { cn } from '@/lib/utils';

interface CurrencyDisplayProps {
  amount: number;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const sizeConfig = {
  sm: { wrapper: 'text-sm font-medium', symbol: 'text-[0.6em]' },
  md: { wrapper: 'text-xl font-bold', symbol: 'text-[0.6em]' },
  lg: { wrapper: 'text-4xl font-black', symbol: 'text-[0.6em]' },
};

export function CurrencyDisplay({ amount, size = 'md', className }: CurrencyDisplayProps) {
  const config = sizeConfig[size];
  const isNegative = amount < 0;
  const absAmount = Math.abs(amount);

  return (
    <span
      className={cn(
        'font-mono tracking-tighter',
        config.wrapper,
        isNegative ? 'text-red-400' : '',
        className
      )}
    >
      {isNegative && '-'}
      <span className={config.symbol}>¥</span>
      {absAmount.toLocaleString('ja-JP')}
    </span>
  );
}
