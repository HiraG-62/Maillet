import { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router';
import { ChevronLeft, ChevronRight, ArrowRight } from 'lucide-react';
import { useTransactionStore } from '@/stores/transaction-store';
import { useSettingsStore } from '@/stores/settings-store';
import { useAuth } from '@/hooks/useAuth';
import { useSync } from '@/hooks/useSync';
import { initDB } from '@/lib/database';
import { getTransactions } from '@/lib/transactions';
import { CurrencyDisplay } from '@/components/dashboard/CurrencyDisplay';

function getCurrentMonth(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

function formatMonthLabel(ym: string): string {
  const parts = ym.split('-');
  if (parts.length === 2) {
    return `${parts[0]}年${parseInt(parts[1])}月`;
  }
  return ym;
}

function addMonths(ym: string, delta: number): string {
  const parts = ym.split('-');
  const y = parseInt(parts[0]);
  const m = parseInt(parts[1]) - 1;
  const d = new Date(y, m + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  const now = new Date();
  const isToday = d.toDateString() === now.toDateString();
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const isYesterday = d.toDateString() === yesterday.toDateString();

  if (isToday) return '今日';
  if (isYesterday) return '昨日';

  return `${d.getMonth() + 1}/${d.getDate()}`;
}

function getCategoryEmoji(category: string | null | undefined): string {
  if (!category) return '💳';
  const lower = category.toLowerCase();
  if (lower.includes('食') || lower.includes('飲食') || lower.includes('グルメ')) return '🍽️';
  if (lower.includes('交通') || lower.includes('鉄道')) return '🚃';
  if (lower.includes('ショッピング') || lower.includes('衣')) return '🛍️';
  if (lower.includes('光熱') || lower.includes('電気') || lower.includes('水道')) return '⚡';
  if (lower.includes('通信') || lower.includes('携帯')) return '📱';
  if (lower.includes('医療') || lower.includes('健康')) return '🏥';
  if (lower.includes('娯楽') || lower.includes('エンタメ')) return '🎬';
  return '💳';
}

export default function DashboardPage() {
  const { transactions, isLoading, setTransactions, setLoading } = useTransactionStore();
  const monthlyBudget = useSettingsStore((s) => s.monthly_budget);
  const [selectedMonth, setSelectedMonth] = useState(getCurrentMonth);
  const [dbWarning, setDbWarning] = useState<string | null>(null);
  const { error: authError } = useAuth();
  const { isSyncing, result, progress } = useSync();
  const navigate = useNavigate();

  useEffect(() => {
    setLoading(true);
    initDB()
      .then((res) => {
        if (res?.warning) {
          setDbWarning(res.warning);
        }
        return getTransactions();
      })
      .then((data) => {
        setTransactions(data ?? []);
      })
      .finally(() => {
        setLoading(false);
      });
  }, [setTransactions, setLoading]);

  // DEBUG-091
  useEffect(() => {
    (window as any).__debugDB = async () => {
      await initDB();
      const txs = await getTransactions();
      console.log('[DEBUG-091] DB transactions count:', txs.length);
      console.log('[DEBUG-091] DB transactions (first 3):', JSON.stringify(txs.slice(0, 3), null, 2));
      return txs;
    };
    console.log('[DEBUG-091] __debugDB ready. Type window.__debugDB() in console.');
  }, []);

  const monthlyStats = useMemo(() => {
    const filtered = transactions.filter(
      (tx) => (tx.transaction_date ?? '').slice(0, 7) === selectedMonth
    );
    const total = filtered.reduce((sum, tx) => sum + tx.amount, 0);
    const count = filtered.length;
    const average = count > 0 ? Math.round(total / count) : 0;
    return { total, count, average };
  }, [transactions, selectedMonth]);

  const recentTransactions = useMemo(() => {
    return [...transactions]
      .sort((a, b) => (b.transaction_date ?? '').localeCompare(a.transaction_date ?? ''))
      .slice(0, 5);
  }, [transactions]);

  const isEmpty = transactions.length === 0 && !isLoading;

  return (
    <div className="max-w-2xl mx-auto px-6 py-8 md:px-8 md:py-10">
      {/* Alerts */}
      {authError && (
        <div className="mb-6 float-card-flat p-4 border-l-4 border-l-[var(--color-danger)] fade-in">
          <p className="text-sm text-[var(--color-danger)]">認証エラー: {authError}</p>
        </div>
      )}
      {dbWarning && (
        <div className="mb-6 float-card-flat p-4 border-l-4 border-l-[var(--color-warning)] fade-in">
          <p className="text-sm text-[var(--color-warning)]">⚠️ {dbWarning}</p>
        </div>
      )}

      {/* ===== Hero Card — 月間利用総額 ===== */}
      <div className="float-card p-6 mb-8 fade-in">
        {/* Month selector */}
        <div className="flex items-center justify-between mb-4">
          <span className="text-sm font-medium text-[var(--color-text-muted)]">
            {formatMonthLabel(selectedMonth)}の利用総額
          </span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setSelectedMonth((m) => addMonths(m, -1))}
              className="p-1.5 rounded-full hover:bg-[var(--color-primary-light)] text-[var(--color-text-muted)] hover:text-[var(--color-primary)] transition-colors"
              aria-label="前の月"
            >
              <ChevronLeft size={16} />
            </button>
            <button
              onClick={() => setSelectedMonth((m) => addMonths(m, 1))}
              className="p-1.5 rounded-full hover:bg-[var(--color-primary-light)] text-[var(--color-text-muted)] hover:text-[var(--color-primary)] transition-colors"
              aria-label="次の月"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>

        {/* Total amount — large and bold */}
        <div className="text-center mb-4">
          {isLoading ? (
            <div className="h-12 w-48 mx-auto rounded-lg bg-[var(--color-primary-light)] animate-pulse" />
          ) : (
            <CurrencyDisplay amount={monthlyStats.total} size="lg" className="text-4xl! font-black text-[var(--color-text-primary)]" />
          )}
        </div>

        {/* Divider */}
        <div className="border-t border-[var(--color-border)] my-4" />

        {/* Sub stats */}
        <div className="flex justify-around text-center">
          <div>
            <p className="text-xs text-[var(--color-text-muted)] mb-1">利用件数</p>
            <p className="text-lg font-bold text-[var(--color-text-primary)]">
              {monthlyStats.count}<span className="text-sm font-normal text-[var(--color-text-muted)] ml-0.5">件</span>
            </p>
          </div>
          <div className="w-px bg-[var(--color-border)]" />
          <div>
            <p className="text-xs text-[var(--color-text-muted)] mb-1">平均</p>
            <p className="text-lg font-bold text-[var(--color-text-primary)]">
              <CurrencyDisplay amount={monthlyStats.average} size="sm" />
            </p>
          </div>
          {monthlyBudget > 0 && (
            <>
              <div className="w-px bg-[var(--color-border)]" />
              <div>
                <p className="text-xs text-[var(--color-text-muted)] mb-1">予算残り</p>
                <p className="text-lg font-bold text-[var(--color-text-primary)]">
                  <CurrencyDisplay
                    amount={monthlyBudget - monthlyStats.total}
                    size="sm"
                    variant={monthlyBudget - monthlyStats.total < 0 ? 'negative' : 'positive'}
                  />
                </p>
              </div>
            </>
          )}
        </div>
      </div>

      {/* ===== Recent Transactions ===== */}
      {!isEmpty && recentTransactions.length > 0 && (
        <div className="mb-8 slide-up" style={{ animationDelay: '0.1s' }}>
          <h2 className="text-sm font-semibold text-[var(--color-text-secondary)] mb-3 px-1">最近の取引</h2>
          <div className="float-card overflow-hidden">
            {recentTransactions.map((tx, i) => (
              <div
                key={tx.id ?? `${tx.transaction_date}-${i}`}
                className={`flex items-center gap-3 px-5 py-3.5 transition-colors hover:bg-[var(--color-primary-light)]/30 ${
                  i < recentTransactions.length - 1 ? 'border-b border-[var(--color-border)]/50' : ''
                }`}
              >
                <span className="text-lg shrink-0">{getCategoryEmoji(tx.category)}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-[var(--color-text-primary)] truncate">{tx.merchant}</p>
                  <p className="text-xs text-[var(--color-text-muted)]">{tx.card_company}</p>
                </div>
                <div className="text-right shrink-0">
                  <CurrencyDisplay amount={tx.amount} size="sm" />
                  <p className="text-[10px] text-[var(--color-text-muted)] mt-0.5">{formatDate(tx.transaction_date)}</p>
                </div>
              </div>
            ))}
            {/* 全て見る */}
            <button
              onClick={() => navigate('/transactions')}
              className="w-full flex items-center justify-center gap-1 py-3 text-sm font-medium text-[var(--color-primary)] hover:bg-[var(--color-primary-light)]/30 transition-colors"
            >
              全て見る <ArrowRight size={14} />
            </button>
          </div>
        </div>
      )}

      {/* ===== Empty State ===== */}
      {isEmpty && (
        <div className="float-card p-12 text-center mb-8 fade-in">
          <div className="text-4xl mb-3">📭</div>
          <p className="text-[var(--color-text-secondary)] text-lg mb-2">データがありません</p>
          <p className="text-[var(--color-text-muted)] text-sm">
            下の「同期」ボタンからGmailの取引データを取得してください
          </p>
        </div>
      )}

      {/* Sync status */}
      {isSyncing && progress.total > 0 && (
        <p className="text-center text-xs text-[var(--color-primary)] mb-4 fade-in">
          {progress.current}/{progress.total}件 処理中...
        </p>
      )}
      {result && !isSyncing && (
        <p className="text-center text-xs text-[var(--color-text-muted)] mb-4 fade-in">
          新規 {result.new_transactions}件 取得しました
        </p>
      )}

      {/* ===== Maillet Illustration (世界観) ===== */}
      <div className="maillet-illustration fade-in" style={{ animationDelay: '0.3s' }}>
        <svg viewBox="0 0 400 140" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
          {/* 封筒 */}
          <rect x="130" y="50" width="140" height="90" rx="8" fill="var(--color-primary-light)" stroke="var(--color-primary)" strokeWidth="1.5" opacity="0.7" />
          {/* 封筒フラップ */}
          <path d="M130 58 L200 95 L270 58" stroke="var(--color-primary)" strokeWidth="1.5" fill="none" opacity="0.5" />
          {/* カード（封筒から飛び出す） */}
          <g transform="rotate(-12, 210, 30)">
            <rect x="165" y="8" width="90" height="56" rx="6" fill="var(--color-surface)" stroke="var(--color-primary)" strokeWidth="1.5" />
            <rect x="173" y="20" width="30" height="20" rx="3" fill="var(--color-primary)" opacity="0.3" />
            <line x1="173" y1="50" x2="247" y2="50" stroke="var(--color-border)" strokeWidth="1" />
          </g>
          {/* 装飾ドット */}
          <circle cx="80" cy="100" r="3" fill="var(--color-primary)" opacity="0.2" />
          <circle cx="95" cy="85" r="2" fill="var(--color-primary)" opacity="0.15" />
          <circle cx="320" cy="90" r="4" fill="var(--color-primary)" opacity="0.2" />
          <circle cx="335" cy="75" r="2" fill="var(--color-primary)" opacity="0.15" />
          <circle cx="60" cy="70" r="2" fill="var(--color-primary)" opacity="0.1" />
          <circle cx="350" cy="110" r="3" fill="var(--color-primary)" opacity="0.1" />
        </svg>
      </div>
    </div>
  );
}
