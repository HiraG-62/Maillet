import { NavLink } from 'react-router';
import { LayoutDashboard, List, BarChart2, Settings } from 'lucide-react';

const navItems = [
  { path: '/', label: 'ホーム', icon: LayoutDashboard },
  { path: '/transactions', label: '取引', icon: List },
  { path: '/summary', label: '集計', icon: BarChart2 },
  { path: '/settings', label: '設定', icon: Settings },
];

export function BottomNav() {
  return (
    <nav
      aria-label="メインナビゲーション"
      className="md:hidden fixed bottom-0 left-0 right-0 z-50 h-16 flex items-stretch bg-[var(--color-surface)] border-t border-[var(--color-border)]"
      style={{ boxShadow: '0 -2px 12px rgba(0,0,0,0.06)' }}
    >
      {navItems.map(({ path, label, icon: Icon }) => (
        <NavLink
          key={path}
          to={path}
          end={path === '/'}
          className="flex-1 flex flex-col items-center justify-center"
        >
          {({ isActive }) => (
            <span
              className={`flex flex-col items-center gap-0.5 transition-all duration-200 px-3 py-1 ${
                isActive
                  ? 'nav-pill-active text-[var(--color-primary)]'
                  : 'text-[var(--color-text-muted)]'
              }`}
            >
              <Icon size={20} strokeWidth={isActive ? 2.5 : 2} />
              <span className={`text-[10px] font-medium leading-tight ${isActive ? '' : 'opacity-70'}`}>{label}</span>
            </span>
          )}
        </NavLink>
      ))}
    </nav>
  );
}
