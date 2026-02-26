import { NavLink } from 'react-router';
import { CreditCard, LayoutDashboard, List, BarChart2, Settings } from 'lucide-react';

const navItems = [
  { path: '/', label: 'ダッシュボード', icon: LayoutDashboard },
  { path: '/transactions', label: '取引一覧', icon: List },
  { path: '/summary', label: '集計', icon: BarChart2 },
  { path: '/settings', label: '設定', icon: Settings },
];

export function Sidebar() {
  return (
    <aside className="hidden md:flex flex-col fixed inset-y-0 left-0 w-56 bg-[var(--color-background)] border-r dark:border-white/10 border-black/10 z-50">
      <div className="flex items-center gap-2 h-14 px-4 border-b dark:border-white/10 border-black/10">
        <CreditCard size={20} className="text-cyan-400" />
        <span className="text-[var(--color-text-primary)] font-semibold tracking-wide">CardTracker</span>
      </div>
      <nav className="flex-1 p-3 space-y-1">
        {navItems.map(({ path, label, icon: Icon }) => (
          <NavLink
            key={path}
            to={path}
            end={path === '/'}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-cyan-400/10 text-cyan-400'
                  : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] dark:hover:bg-white/5 hover:bg-black/5'
              }`
            }
          >
            <Icon size={18} />
            <span>{label}</span>
          </NavLink>
        ))}
      </nav>
    </aside>
  );
}
