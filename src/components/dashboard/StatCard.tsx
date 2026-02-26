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
  default:  { text: 'text-cyan-400',   borderLeft: 'border-l-4 border-l-cyan-500',   glowHover: 'hover:shadow-cyan-500/10' },
  success:  { text: 'text-emerald-400', borderLeft: 'border-l-4 border-l-emerald-500', glowHover: 'hover:shadow-emerald-500/10' },
  warning:  { text: 'text-amber-400',  borderLeft: 'border-l-4 border-l-amber-500',  glowHover: 'hover:shadow-amber-500/10' },
  danger:   { text: 'text-red-400',    borderLeft: 'border-l-4 border-l-red-500',    glowHover: 'hover:shadow-red-500/10' },
  cyan:     { text: 'text-cyan-400',   borderLeft: 'border-l-4 border-l-cyan-500',   glowHover: 'hover:shadow-cyan-500/10' },
  purple:   { text: 'text-purple-400', borderLeft: 'border-l-4 border-l-purple-500', glowHover: 'hover:shadow-purple-500/10' },
  orange:   { text: 'text-orange-400', borderLeft: 'border-l-4 border-l-orange-500', glowHover: 'hover:shadow-orange-500/10' },
  green:    { text: 'text-green-400',  borderLeft: 'border-l-4 border-l-green-500',  glowHover: 'hover:shadow-green-500/10' },
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
        'rounded-lg border border-white/10',
        config.borderLeft,
        'bg-[#12121a]/80 backdrop-blur-xl',
        'shadow-lg shadow-black/20',
        'transition-all duration-200 hover:scale-[1.02] hover:shadow-lg',
        config.glowHover,
        'p-4'
      )}
    >
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs text-white/50 tracking-wider uppercase">{title}</span>
        {icon && <span className={cn('opacity-80', config.text)}>{icon}</span>}
      </div>

      {isLoading ? (
        <div className="space-y-2 mt-1">
          <div className="h-7 w-3/4 rounded bg-white/10 animate-pulse" />
          <div className="h-3 w-1/2 rounded bg-white/5 animate-pulse" />
        </div>
      ) : (
        <>
          <div className={cn('font-mono tracking-tight font-bold text-2xl', config.text)}>
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
