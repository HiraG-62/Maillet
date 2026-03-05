import { Settings } from 'lucide-react';
import { useNavigate } from 'react-router';
import { BrandLogo } from '@/components/common/BrandLogo';
import { SyncButton } from '@/components/common/SyncButton';

export function Navbar() {
  const navigate = useNavigate();

  return (
    <header className="md:hidden fixed top-0 left-0 right-0 z-50 h-14 flex items-center justify-between px-4 bg-[var(--color-surface)]/90 backdrop-blur-md border-b border-[var(--color-border)]">
      <BrandLogo />

      <div className="flex items-center gap-2">
        <button
          onClick={() => navigate('/settings')}
          className="p-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-secondary)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-white/10 transition-colors"
          aria-label="設定"
        >
          <Settings size={16} />
        </button>

        <SyncButton variant="navbar" />
      </div>
    </header>
  );
}
