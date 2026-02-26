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
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 h-16 flex items-center justify-around bg-[var(--color-surface)] border-t border-[var(--color-border)]"
         style={{ boxShadow: '0 -2px 12px rgba(0,0,0,0.06)' }}
    >
      {navItems.map(({ path, label, icon: Icon }) => (
        <NavLink
          key={path}
          to={path}
          end={path === '/'}
          className={({ isActive }) =>
            `flex items-center gap-1.5 text-xs font-medium transition-all duration-200 ${
              isActive
                ? 'nav-pill-active text-[var(--color-primary)]'
                : 'text-[var(--color-text-muted)] px-3 py-1.5'
            }`
          }
        >
          {({ isActive }) => (
            <>
              <Icon size={20} strokeWidth={isActive ? 2.5 : 2} />
              {isActive && <span>{label}</span>}
            </>
          )}
        </NavLink>
      ))}
    </nav>
  );
}
