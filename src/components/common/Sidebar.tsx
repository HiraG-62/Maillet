import { NavLink, Link, useNavigate } from 'react-router';
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
    <aside aria-label="サイドバーナビゲーション" className="hidden md:flex flex-col fixed inset-y-0 left-0 md:w-14 lg:w-56 bg-[var(--color-surface)] border-r border-[var(--color-border)] z-50 transition-all duration-200">
      <div className="flex items-center h-14 px-3 lg:px-4 border-b border-[var(--color-border)] gap-2.5 overflow-hidden">
        <div className="w-8 h-8 rounded-lg bg-[var(--color-primary)] flex items-center justify-center shrink-0">
          <Mail size={16} className="text-white" />
        </div>
        <span className="hidden lg:block text-[var(--color-text-primary)] font-bold tracking-wide text-lg whitespace-nowrap">Maillet</span>
      </div>
      <nav className="flex-1 p-2 lg:p-3 space-y-1">
        {navItems.map(({ path, label, icon: Icon }) => (
          <NavLink
            key={path}
            to={path}
            end={path === '/'}
            className={({ isActive }) =>
              `flex items-center justify-center lg:justify-start gap-3 px-2.5 lg:px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 ${
                isActive
                  ? 'bg-[var(--color-primary-light)] text-[var(--color-primary)]'
                  : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-primary-light)]/50'
              }`
            }
            title={label}
          >
            <Icon size={18} className="shrink-0" />
            <span className="hidden lg:block">{label}</span>
          </NavLink>
        ))}
      </nav>
      <div className="p-2 lg:p-3 border-t border-[var(--color-border)]">
        <button
          onClick={handleSync}
          disabled={isSyncing || authLoading}
          className="w-full flex items-center justify-center lg:justify-start gap-3 px-2.5 lg:px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200
                     bg-[var(--color-primary-hover)] text-white dark:bg-[var(--color-primary)] dark:text-[var(--color-text-inverse)]
                     hover:opacity-90 active:scale-95
                     disabled:opacity-60 disabled:cursor-not-allowed"
          title={isSyncing ? '同期中...' : 'Gmailから同期'}
        >
          <RefreshCw className={`w-[18px] h-[18px] shrink-0 ${isSyncing ? 'animate-spin' : ''}`} />
          <span className="hidden lg:block">{isSyncing ? '同期中...' : 'Gmailから同期'}</span>
        </button>
        <div className="hidden lg:flex justify-center gap-3 mt-3 text-xs text-[var(--color-text-muted)]">
          <Link to="/privacy" className="hover:text-[var(--color-text-secondary)] transition-colors">
            プライバシーポリシー
          </Link>
          <span>·</span>
          <Link to="/terms" className="hover:text-[var(--color-text-secondary)] transition-colors">
            利用規約
          </Link>
        </div>
      </div>
    </aside>
  );
}
