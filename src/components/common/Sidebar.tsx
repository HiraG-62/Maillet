import { NavLink, useNavigate } from 'react-router';
import { Mail, LayoutDashboard, List, BarChart2, Settings, RefreshCw } from 'lucide-react';
import { useSync } from '@/hooks/useSync';
import { useAuth } from '@/hooks/useAuth';

const navItems = [
  { path: '/', label: 'ダッシュボード', icon: LayoutDashboard },
  { path: '/transactions', label: '取引一覧', icon: List },
  { path: '/summary', label: '集計', icon: BarChart2 },
  { path: '/settings', label: '設定', icon: Settings },
];

export function Sidebar() {
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
    <aside className="hidden md:flex flex-col fixed inset-y-0 left-0 w-56 bg-[var(--color-surface)] border-r border-[var(--color-border)] z-50">
      <div className="flex items-center gap-2.5 h-14 px-4 border-b border-[var(--color-border)]">
        <div className="w-8 h-8 rounded-lg bg-[var(--color-primary)] flex items-center justify-center">
          <Mail size={16} className="text-white" />
        </div>
        <span className="text-[var(--color-text-primary)] font-bold tracking-wide text-lg">Maillet</span>
      </div>
      <nav className="flex-1 p-3 space-y-1">
        {navItems.map(({ path, label, icon: Icon }) => (
          <NavLink
            key={path}
            to={path}
            end={path === '/'}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 ${
                isActive
                  ? 'bg-[var(--color-primary-light)] text-teal-900 dark:text-[var(--color-primary)]'
                  : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-primary-light)]/50'
              }`
            }
          >
            <Icon size={18} />
            <span>{label}</span>
          </NavLink>
        ))}
      </nav>
      <div className="p-3 border-t border-[var(--color-border)]">
        <button
          onClick={handleSync}
          disabled={isSyncing || authLoading}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200
                     bg-[var(--color-primary-hover)] text-white dark:bg-[var(--color-primary)] dark:text-[var(--color-text-inverse)]
                     hover:opacity-90 active:scale-95
                     disabled:opacity-60 disabled:cursor-not-allowed"
        >
          <RefreshCw className={`w-[18px] h-[18px] shrink-0 ${isSyncing ? 'animate-spin' : ''}`} />
          <span>{isSyncing ? '同期中...' : 'Gmailから同期'}</span>
        </button>
      </div>
    </aside>
  );
}
