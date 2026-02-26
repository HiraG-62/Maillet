import { useAuth } from '@/hooks/useAuth';
import { useSync } from '@/hooks/useSync';
import { RefreshCw, LogIn, CheckCircle, AlertCircle, XCircle } from 'lucide-react';

export function SyncPanel() {
  const { authState, login, isLoading: authLoading, error: authError } = useAuth();
  const { progress, result, isSyncing, error: syncError, startSync, cancelSync, reset } = useSync();

  const isGoogleConfigured = Boolean(import.meta.env.VITE_GOOGLE_CLIENT_ID);

  // Not authenticated: show Google login button
  if (!authState.isAuthenticated) {
    return (
      <div className="bg-[var(--color-background)] border dark:border-white/10 border-black/10 rounded-xl p-6 space-y-4">
        <div className="flex items-center gap-2 text-[var(--color-text-secondary)]">
          <LogIn size={18} className="text-cyan-400" />
          <span className="font-medium">Gmail 同期</span>
        </div>
        {isGoogleConfigured ? (
          <p className="text-sm text-[var(--color-text-muted)]">
            Gmail からカード利用明細を自動取得するには、Google アカウントでログインしてください。
          </p>
        ) : (
          <p className="text-sm text-[var(--color-text-muted)]">
            Gmail連携は設定が必要です。管理者にお問い合わせください。
          </p>
        )}
        {authError && (
          <p className="text-sm text-red-400 flex items-center gap-1">
            <AlertCircle size={14} />
            {authError}
          </p>
        )}
        <button
          onClick={() => void login()}
          disabled={authLoading || !isGoogleConfigured}
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-white text-[var(--color-text-primary)] font-medium text-sm hover:bg-[var(--color-surface)] transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {authLoading ? (
            <RefreshCw size={16} className="animate-spin" />
          ) : (
            <svg viewBox="0 0 24 24" className="w-4 h-4" aria-hidden="true">
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              />
            </svg>
          )}
          Google でログイン
        </button>
      </div>
    );
  }

  // Authenticated: show sync controls
  return (
    <div className="bg-[var(--color-background)] border dark:border-white/10 border-black/10 rounded-xl p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-[var(--color-text-secondary)]">
          <RefreshCw size={18} className="text-cyan-400" />
          <span className="font-medium">Gmail 同期</span>
        </div>
        {result && (
          <button
            onClick={reset}
            className="text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] transition-colors"
          >
            クリア
          </button>
        )}
      </div>

      {/* Sync button or cancel */}
      {!isSyncing ? (
        <button
          onClick={() => void startSync()}
          disabled={isSyncing}
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-cyan-500 text-[var(--color-text-primary)] font-medium text-sm hover:bg-cyan-400 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
        >
          <RefreshCw size={16} />
          同期開始
        </button>
      ) : (
        <button
          onClick={cancelSync}
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-[var(--color-surface-elevated)] text-[var(--color-text-primary)] font-medium text-sm hover:bg-[var(--color-surface-elevated)] transition-colors"
        >
          <XCircle size={16} />
          キャンセル
        </button>
      )}

      {/* Progress bar */}
      {(isSyncing || progress.status === 'done' || progress.status === 'error') && (
        <div className="space-y-2">
          <div className="flex justify-between text-xs text-[var(--color-text-secondary)]">
            <span>{progress.message ?? ''}</span>
            <span>{progress.percentage}%</span>
          </div>
          <div className="w-full h-1.5 dark:bg-white/10 bg-black/10 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-300 ${
                progress.status === 'error'
                  ? 'bg-red-500'
                  : progress.status === 'done'
                    ? 'bg-emerald-500'
                    : 'bg-cyan-500'
              }`}
              style={{ width: `${progress.percentage}%` }}
            />
          </div>
          {progress.total > 0 && (
            <p className="text-xs text-[var(--color-text-muted)]">
              {progress.current} / {progress.total} 件処理済み
            </p>
          )}
        </div>
      )}

      {/* Sync error */}
      {syncError && (
        <p className="text-sm text-red-400 flex items-center gap-1">
          <AlertCircle size={14} />
          {syncError}
        </p>
      )}

      {/* Sync result summary */}
      {result && !isSyncing && (
        <div className="dark:bg-white/5 bg-black/5 rounded-lg p-3 space-y-1.5 text-sm">
          <div className="flex items-center gap-2 text-emerald-400 font-medium">
            <CheckCircle size={15} />
            <span>同期完了</span>
          </div>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-[var(--color-text-secondary)] pt-1">
            <span>取得メール数</span>
            <span className="text-[var(--color-text-primary)] text-right">{result.total_fetched}</span>
            <span>新規取引</span>
            <span className="text-cyan-400 text-right font-medium">{result.new_transactions}</span>
            <span>重複スキップ</span>
            <span className="text-[var(--color-text-primary)] text-right">{result.duplicates_skipped}</span>
            {result.parse_errors > 0 && (
              <>
                <span className="text-amber-400">解析エラー</span>
                <span className="text-amber-400 text-right">{result.parse_errors}</span>
              </>
            )}
          </div>
          {result.errors.length > 0 && (
            <details className="mt-2">
              <summary className="text-xs text-amber-500 cursor-pointer hover:text-amber-400">
                エラー詳細 ({result.errors.length})
              </summary>
              <ul className="mt-1 space-y-0.5 text-xs text-[var(--color-text-muted)]">
                {result.errors.map((e, i) => (
                  <li key={i} className="truncate">
                    {e}
                  </li>
                ))}
              </ul>
            </details>
          )}
        </div>
      )}
    </div>
  );
}
