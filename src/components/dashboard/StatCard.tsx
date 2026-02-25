import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface StatCardProps {
  title: string;
  value: ReactNode;
  unit?: string;
  subtext?: string;
  variant?: 'default' | 'warning' | 'danger' | 'success';
  icon?: ReactNode;
  isLoading?: boolean;
}

const variantAccent = {
  default: 'text-cyan-400',
  success: 'text-emerald-400',
  warning: 'text-amber-400',
  danger: 'text-red-400',
};

export function StatCard({
  title,
  value,
  unit,
  subtext,
  variant = 'default',
  icon,
  isLoading = false,
}: StatCardProps) {
  const accent = variantAccent[variant];

  return (
    <div
      className={cn(
        'rounded-lg border border-white/10',
        'bg-[#12121a]/80 backdrop-blur-xl',
        'shadow-lg shadow-black/20',
        'p-4'
      )}
    >
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs text-white/50 tracking-wider uppercase">{title}</span>
        {icon && <span className={cn('opacity-70', accent)}>{icon}</span>}
      </div>

      {isLoading ? (
        <div className="space-y-2 mt-1">
          <div className="h-7 w-3/4 rounded bg-white/10 animate-pulse" />
          <div className="h-3 w-1/2 rounded bg-white/5 animate-pulse" />
        </div>
      ) : (
        <>
          <div className={cn('font-mono tracking-tight font-bold text-2xl', accent)}>
            {value}
            {unit && <span className="text-sm font-normal ml-1 text-white/60">{unit}</span>}
          </div>
          {subtext && (
            <p className="text-xs text-white/40 mt-1">{subtext}</p>
          )}
        </>
      )}
    </div>
  );
}
