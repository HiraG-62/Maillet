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
    <aside className="hidden md:flex flex-col fixed inset-y-0 left-0 w-56 bg-[#12121a] border-r border-white/10 z-50">
      <div className="flex items-center gap-2 h-14 px-4 border-b border-white/10">
        <CreditCard size={20} className="text-cyan-400" />
        <span className="text-slate-100 font-semibold tracking-wide">CardTracker</span>
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
                  : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
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
