import { useEffect, useRef, useState } from 'react';
import { Navbar } from './Navbar';
import { BottomNav } from './BottomNav';
import { Sidebar } from './Sidebar';
import { useTransactionStore } from '@/stores/transaction-store';
import { initDB } from '@/lib/database';
import { getTransactions } from '@/lib/transactions';

interface LayoutProps {
  children: React.ReactNode;
}

export function Layout({ children }: LayoutProps) {
  const { transactions, isLoading, setTransactions, setLoading, setDbWarning } = useTransactionStore();
  const initRef = useRef(false);
  const [isOffline, setIsOffline] = useState(() => !navigator.onLine);

  useEffect(() => {
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  useEffect(() => {
    if (initRef.current || transactions.length > 0 || isLoading) return;
    initRef.current = true;
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
      .catch((err) => {
        console.error('[Layout] DB init/load failed:', err);
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  return (
    <div className="min-h-screen gradient-bg text-[var(--color-text-primary)]">
      {/* Offline banner */}
      {isOffline && (
        <div className="fixed top-0 left-0 right-0 z-50 bg-red-600 text-white text-center text-sm py-2 px-4 font-medium">
          オフライン — 同期できません
        </div>
      )}

      {/* Mobile: top navbar */}
      <Navbar />

      {/* PC: left sidebar */}
      <Sidebar />

      {/* Main content area */}
      <main className="md:ml-14 lg:ml-56 min-h-screen pt-14 pb-20 md:pt-0 md:pb-0">
        <div className="max-w-screen-xl mx-auto">
          {children}
        </div>
      </main>

      {/* Mobile: bottom tab navigation */}
      <BottomNav />
    </div>
  );
}
