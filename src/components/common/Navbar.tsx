import { CreditCard } from 'lucide-react';

export function Navbar() {
  return (
    <header className="md:hidden fixed top-0 left-0 right-0 z-50 h-14 flex items-center px-4 bg-[#12121a] border-b border-white/10">
      <div className="flex items-center gap-2">
        <CreditCard size={20} className="text-cyan-400" />
        <span className="text-slate-100 font-semibold tracking-wide">CardTracker</span>
      </div>
    </header>
  );
}
