import { useState, useCallback, useRef } from 'react';
import { syncGmailTransactions } from '@/services/gmail/sync';
import { useTransactionStore } from '@/stores/transaction-store';
import { queryDB } from '@/lib/database';
import type { SyncProgress, SyncResult } from '@/types/gmail';
import type { CardTransaction } from '@/types/transaction';

interface UseSyncReturn {
  progress: SyncProgress;
  result: SyncResult | null;
  isSyncing: boolean;
  error: string | null;
  startSync: () => Promise<void>;
  cancelSync: () => void;
  reset: () => void;
}

export function useSync(): UseSyncReturn {
  const [progress, setProgress] = useState<SyncProgress>({
    current: 0,
    total: 0,
    percentage: 0,
    status: 'idle',
    message: '',
  });

  const [result, setResult] = useState<SyncResult | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const abortControllerRef = useRef<AbortController | null>(null);
  const setTransactions = useTransactionStore((state) => state.setTransactions);

  const startSync = useCallback(async () => {
    try {
      // Prevent multiple simultaneous syncs
      if (isSyncing) {
        return;
      }

      setIsSyncing(true);
      setError(null);
      abortControllerRef.current = new AbortController();

      const syncResult = await syncGmailTransactions((progressUpdate) => {
        setProgress(progressUpdate);
      });

      setResult(syncResult);

      // Fetch updated transactions from database
      if (!abortControllerRef.current.signal.aborted) {
        const transactions = await queryDB<CardTransaction>(
          'SELECT * FROM card_transactions ORDER BY transaction_date DESC'
        );

        setTransactions(transactions);
      }
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      setError(errMsg);
      setProgress({
        current: 0,
        total: 0,
        percentage: 0,
        status: 'error',
        message: errMsg,
      });
    } finally {
      setIsSyncing(false);
      abortControllerRef.current = null;
    }
  }, [isSyncing, setTransactions]);

  const cancelSync = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    setIsSyncing(false);
    setProgress({
      current: 0,
      total: 0,
      percentage: 0,
      status: 'idle',
      message: '',
    });
  }, []);

  const reset = useCallback(() => {
    setProgress({
      current: 0,
      total: 0,
      percentage: 0,
      status: 'idle',
      message: '',
    });
    setResult(null);
    setError(null);
    setIsSyncing(false);
  }, []);

  return {
    progress,
    result,
    isSyncing,
    error,
    startSync,
    cancelSync,
    reset,
  };
}
