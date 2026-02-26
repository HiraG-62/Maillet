import { Mail } from 'lucide-react';

export function Navbar() {
  return (
    <header className="md:hidden fixed top-0 left-0 right-0 z-50 h-14 flex items-center justify-between px-4 bg-[var(--color-surface)]/90 backdrop-blur-md border-b border-[var(--color-border)]">
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 rounded-lg bg-[var(--color-primary)] flex items-center justify-center">
          <Mail size={16} className="text-white" />
        </div>
        <span className="text-[var(--color-text-primary)] font-bold tracking-wide text-lg">Maillet</span>
      </div>
    </header>
  );
}
