import { create } from 'zustand';
import type { CardTransaction, MonthlyAggregation } from '@/types/transaction';

interface TransactionState {
  transactions: CardTransaction[];
  currentMonth: string;
  aggregation: MonthlyAggregation | null;
  isLoading: boolean;
  error: string | null;
  setTransactions: (transactions: CardTransaction[]) => void;
  setCurrentMonth: (month: string) => void;
  setAggregation: (aggregation: MonthlyAggregation | null) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
}

export const useTransactionStore = create<TransactionState>((set) => ({
  transactions: [],
  currentMonth: '',
  aggregation: null,
  isLoading: false,
  error: null,
  setTransactions: (transactions) => set({ transactions }),
  setCurrentMonth: (currentMonth) => set({ currentMonth }),
  setAggregation: (aggregation) => set({ aggregation }),
  setLoading: (isLoading) => set({ isLoading }),
  setError: (error) => set({ error }),
}));
