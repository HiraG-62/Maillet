import { Mail, RefreshCw, Settings } from 'lucide-react';
import { useNavigate } from 'react-router';
import { useSync } from '@/hooks/useSync';
import { useAuth } from '@/hooks/useAuth';

export function Navbar() {
  const navigate = useNavigate();
  const { authState, isLoading: authLoading } = useAuth();
  const { startSync, isSyncing } = useSync();

  const handleSync = () => {
    if (authLoading) return;
    if (!authState.isAuthenticated) {
      navigate('/settings');
      return;
    }
    startSync();
  };

  return (
    <header className="md:hidden fixed top-0 left-0 right-0 z-50 h-14 flex items-center justify-between px-4 bg-[var(--color-surface)]/90 backdrop-blur-md border-b border-[var(--color-border)]">
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

      <div className="flex items-center gap-2">
        <button
          onClick={() => navigate('/settings')}
          className="p-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-secondary)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-white/10 transition-colors"
          aria-label="設定"
        >
          <Settings size={16} />
        </button>

        <button
          onClick={handleSync}
          disabled={isSyncing || authLoading}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full
                     bg-[var(--color-primary)] text-white text-sm font-medium
                     hover:opacity-90 active:scale-95 transition-all
                     disabled:opacity-60"
        >
          <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} />
          <span className="hidden sm:inline">{isSyncing ? '同期中...' : '同期'}</span>
        </button>
      </div>
    </header>
  );
}
