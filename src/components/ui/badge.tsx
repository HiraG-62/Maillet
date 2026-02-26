import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const badgeVariants = cva(
  'inline-flex items-center border font-semibold transition-colors',
  {
    variants: {
      variant: {
        default: 'border-slate-700 bg-slate-800 text-slate-200',
        neutral: 'border-slate-700 bg-slate-800 text-slate-200',
        primary: 'border-cyan-500/30 bg-cyan-500/20 text-cyan-400',
        cyan: 'border-cyan-500/30 bg-cyan-500/20 text-cyan-400',
        outline: 'border-slate-600 text-slate-400',
        success: 'border-emerald-500/30 bg-emerald-500/20 text-emerald-400',
        green: 'border-emerald-500/30 bg-emerald-500/20 text-emerald-400',
        warning: 'border-amber-500/30 bg-amber-500/20 text-amber-400',
        destructive: 'border-red-500/30 bg-red-500/20 text-red-400',
        red: 'border-red-500/30 bg-red-500/20 text-red-400',
        danger: 'border-red-500/30 bg-red-500/20 text-red-400',
        purple: 'border-purple-500/30 bg-purple-500/20 text-purple-400',
        orange: 'border-orange-500/30 bg-orange-500/20 text-orange-400',
        pink: 'border-pink-500/30 bg-pink-500/20 text-pink-400',
      },
      size: {
        sm: 'text-xs px-2 py-0.5',
        md: 'text-sm px-2.5 py-0.5',
        lg: 'text-sm px-3 py-1',
      },
      shape: {
        rounded: 'rounded-md',
        pill: 'rounded-full',
      },
    },
    defaultVariants: { variant: 'default', size: 'md', shape: 'pill' },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, size, shape, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant, size, shape }), className)} {...props} />;
}
