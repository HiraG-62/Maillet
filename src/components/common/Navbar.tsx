import { Mail, RefreshCw } from 'lucide-react';
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
        <span className="text-[var(--color-text-primary)] font-bold tracking-wide text-lg">Maillet</span>
      </div>

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
    </header>
  );
}
