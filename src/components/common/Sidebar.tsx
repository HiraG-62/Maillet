import { NavLink, Link } from 'react-router';
import { LayoutDashboard, List, BarChart2, Settings } from 'lucide-react';
import { BrandLogo } from '@/components/common/BrandLogo';
import { SyncButton } from '@/components/common/SyncButton';

const navItems = [
  { path: '/', label: 'ダッシュボード', icon: LayoutDashboard },
  { path: '/transactions', label: '取引一覧', icon: List },
  { path: '/summary', label: '集計', icon: BarChart2 },
  { path: '/settings', label: '設定', icon: Settings },
];

export function Sidebar() {
  return (
    <aside aria-label="サイドバーナビゲーション" className="hidden md:flex flex-col fixed inset-y-0 left-0 md:w-14 lg:w-56 bg-[var(--color-surface)] border-r border-[var(--color-border)] z-50 transition-all duration-200">
      <div className="flex items-center h-14 px-3 lg:px-4 border-b border-[var(--color-border)] overflow-hidden">
        <BrandLogo />
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
        <SyncButton variant="sidebar" />
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
