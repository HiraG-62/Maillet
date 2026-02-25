import { useAuth } from '@/hooks/useAuth';
import { LogOut } from 'lucide-react';

export function AuthStatus() {
  const { authState, logout } = useAuth();

  if (!authState.isAuthenticated) {
    return (
      <div
        className="flex items-center gap-2 text-xs text-slate-500"
        title="未ログイン"
        aria-label="未ログイン"
      >
        <span className="w-2 h-2 rounded-full bg-slate-600 shrink-0" aria-hidden="true" />
        <span className="hidden sm:inline">未ログイン</span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 text-xs text-slate-300">
      <span
        className="w-2 h-2 rounded-full bg-cyan-400 shrink-0"
        aria-hidden="true"
        title="ログイン済み"
      />
      <span className="hidden sm:inline text-slate-400">Gmail 接続済み</span>
      <button
        onClick={logout}
        title="ログアウト"
        aria-label="Gmail からログアウト"
        className="flex items-center gap-1 text-slate-500 hover:text-slate-200 transition-colors ml-1"
      >
        <LogOut size={13} />
        <span className="hidden sm:inline">ログアウト</span>
      </button>
    </div>
  );
}
