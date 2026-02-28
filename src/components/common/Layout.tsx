import { useEffect, useRef } from 'react';
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
  const { transactions, isLoading, setTransactions, setLoading } = useTransactionStore();
  const initRef = useRef(false);

  useEffect(() => {
    if (initRef.current || transactions.length > 0 || isLoading) return;
    initRef.current = true;
    setLoading(true);
    initDB()
      .then(() => getTransactions())
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
      {/* Mobile: top navbar */}
      <Navbar />

      {/* PC: left sidebar */}
      <Sidebar />

      {/* Main content area */}
      <main className="md:ml-56 min-h-screen pt-14 pb-20 md:pt-0 md:pb-0">
        {children}
      </main>

      {/* Mobile: bottom tab navigation */}
      <BottomNav />
    </div>
  );
}
