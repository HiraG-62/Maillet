import { Mail } from 'lucide-react';

export function BrandLogo() {
  return (
    <div className="flex items-center gap-2">
      <div className="w-8 h-8 rounded-lg bg-[var(--color-primary)] flex items-center justify-center">
        <Mail size={16} className="text-white" />
      </div>
      <span
        className="font-black tracking-tight text-lg bg-gradient-to-r from-[var(--color-primary)] to-cyan-400 bg-clip-text text-transparent"
        style={{ letterSpacing: '-0.02em' }}
      >
        Maillet
      </span>
    </div>
  );
}
