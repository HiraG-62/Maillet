import { useState, useEffect } from 'react';
import type { CardTransaction } from '@/types/transaction';
import { detectSubscriptions, type DetectedSubscription } from '@/services/subscription-detector';

/**
 * サブスクリプション自動検知フック
 * transactions が変わるたびに再計算する
 */
export function useSubscriptions(transactions: CardTransaction[]) {
  const [subscriptions, setSubscriptions] = useState<DetectedSubscription[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!transactions?.length) {
      setSubscriptions([]);
      return;
    }

    let cancelled = false;
    setIsLoading(true);

    detectSubscriptions()
      .then((result) => {
        if (!cancelled) {
          setSubscriptions(result);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setSubscriptions([]);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [transactions]);

  return { subscriptions, isLoading };
}
