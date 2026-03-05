import { RefreshCw } from 'lucide-react';
import { useNavigate } from 'react-router';
import { useSync } from '@/hooks/useSync';
import { useAuth } from '@/hooks/useAuth';

interface SyncButtonProps {
  variant?: 'navbar' | 'sidebar';
}

export function SyncButton({ variant = 'navbar' }: SyncButtonProps) {
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

  if (variant === 'sidebar') {
    return (
      <button
        onClick={handleSync}
        disabled={isSyncing || authLoading}
        aria-label={isSyncing ? '同期中' : 'Gmailから同期'}
        title={isSyncing ? '同期中...' : 'Gmailから同期'}
        className="w-full flex items-center justify-center lg:justify-start gap-3 px-2.5 lg:px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200
                   bg-[var(--color-primary-hover)] text-white dark:bg-[var(--color-primary)] dark:text-[var(--color-text-inverse)]
                   hover:opacity-90 active:scale-95
                   disabled:opacity-60 disabled:cursor-not-allowed"
      >
        <RefreshCw className={`w-[18px] h-[18px] shrink-0 ${isSyncing ? 'animate-spin' : ''}`} />
        <span className="hidden lg:block">{isSyncing ? '同期中...' : 'Gmailから同期'}</span>
      </button>
    );
  }

  return (
    <button
      onClick={handleSync}
      disabled={isSyncing || authLoading}
      aria-label={isSyncing ? '同期中' : '同期'}
      className="flex items-center gap-1.5 px-3 py-1.5 rounded-full
                 bg-[var(--color-primary)] text-white text-sm font-medium
                 hover:opacity-90 active:scale-95 transition-all
                 disabled:opacity-60"
    >
      <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} />
      <span className="hidden sm:inline">{isSyncing ? '同期中...' : '同期'}</span>
    </button>
  );
}
