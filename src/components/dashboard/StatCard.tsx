import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface StatCardProps {
  title: string;
  value: ReactNode;
  unit?: string;
  subtext?: string;
  variant?: 'default' | 'warning' | 'danger' | 'success' | 'cyan' | 'purple' | 'orange' | 'green';
  icon?: ReactNode;
  isLoading?: boolean;
}

const variantConfig: Record<
  NonNullable<StatCardProps['variant']>,
  { text: string; borderLeft: string; glowHover: string }
> = {
  default:  { text: 'text-[var(--color-primary)]',   borderLeft: 'border-l-4 border-l-[var(--color-primary)]',   glowHover: 'hover:shadow-[var(--color-primary-light)]' },
  success:  { text: 'text-[var(--color-success)]', borderLeft: 'border-l-4 border-l-[var(--color-success)]', glowHover: 'hover:shadow-[var(--color-success)]' },
  warning:  { text: 'text-amber-400',  borderLeft: 'border-l-4 border-l-amber-500',  glowHover: 'hover:shadow-amber-500/10' },
  danger:   { text: 'text-red-400',    borderLeft: 'border-l-4 border-l-red-500',    glowHover: 'hover:shadow-red-500/10' },
  cyan:     { text: 'text-[var(--color-primary)]',   borderLeft: 'border-l-4 border-l-[var(--color-primary)]',   glowHover: 'hover:shadow-[var(--color-primary-light)]' },
  purple:   { text: 'text-[var(--color-primary-hover)]',   borderLeft: 'border-l-4 border-l-[var(--color-primary-hover)]',   glowHover: 'hover:shadow-[var(--color-primary-light)]' },
  orange:   { text: 'text-[var(--color-primary-hover)]',   borderLeft: 'border-l-4 border-l-[var(--color-primary-hover)]',   glowHover: 'hover:shadow-[var(--color-primary-light)]' },
  green:    { text: 'text-[var(--color-primary)]',   borderLeft: 'border-l-4 border-l-[var(--color-primary)]',   glowHover: 'hover:shadow-[var(--color-primary-light)]' },
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
  const config = variantConfig[variant];

  return (
    <div
      className={cn(
        'rounded-lg border dark:border-white/10 border-black/10',
        config.borderLeft,
        'bg-[var(--color-background)]/80 backdrop-blur-xl',
        'shadow-lg shadow-black/20',
        'transition-all duration-200 hover:scale-[1.02] hover:shadow-lg',
        config.glowHover,
        'p-4'
      )}
    >
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs dark:text-white/50 text-black/50 tracking-wider uppercase">{title}</span>
        {icon && <span className={cn('opacity-80', config.text)}>{icon}</span>}
      </div>

      {isLoading ? (
        <div className="space-y-2 mt-1">
          <div className="h-7 w-3/4 rounded dark:bg-white/10 bg-black/10 animate-pulse" />
          <div className="h-3 w-1/2 rounded dark:bg-white/5 bg-black/5 animate-pulse" />
        </div>
      ) : (
        <>
          <div className={cn('font-mono tracking-tight font-bold text-2xl', config.text)}>
            {value}
            {unit && <span className="text-sm font-normal ml-1 dark:text-white/60 text-black/60">{unit}</span>}
          </div>
          {subtext && (
            <p className="text-xs dark:text-white/40 text-black/40 mt-1">{subtext}</p>
          )}
        </>
      )}
    </div>
  );
}
