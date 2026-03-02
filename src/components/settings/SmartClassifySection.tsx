import { useState, useEffect } from 'react';
import { Sparkles, Loader2, AlertCircle, CheckCircle2 } from 'lucide-react';
import { getUnclassifiedCount, retroactiveApply } from '@/services/classification';
import { getUnclassifiedMerchants } from '@/services/classification/CategoryRuleEngine';
import {
  generateCategoryProposals,
  estimateCost,
  clearSessionKey,
} from '@/services/classification/AutoRuleForge';
import { useSettingsStore } from '@/stores/settings-store';
import { KeyStoreError } from '@/types/llm';
import type { ClassificationProposal } from '@/types/classification';

type State = 'idle' | 'pin_input' | 'loading' | 'showing_proposals' | 'done' | 'error';

export function SmartClassifySection() {
  const [unclassifiedCount, setUnclassifiedCount] = useState(0);
  const [merchantCount, setMerchantCount] = useState(0);
  const [state, setState] = useState<State>('idle');
  const [pin, setPin] = useState('');
  const [proposals, setProposals] = useState<ClassificationProposal[]>([]);
  const [errorMessage, setErrorMessage] = useState('');
  const [updatedCount, setUpdatedCount] = useState(0);
  const [costEstimate, setCostEstimate] = useState('');

  useEffect(() => {
    getUnclassifiedCount().then(setUnclassifiedCount).catch(() => {});
  }, []);

  const handleStart = async () => {
    const merchants = await getUnclassifiedMerchants();
    setMerchantCount(merchants.length);
    setCostEstimate(estimateCost(merchants.length));
    setState('pin_input');
  };

  const handlePinSubmit = async () => {
    if (!pin) return;
    setState('loading');
    try {
      const result = await generateCategoryProposals(pin);
      setProposals(result.proposals);
      setState('showing_proposals');
    } catch (err) {
      if (err instanceof KeyStoreError) {
        setErrorMessage('PINが間違っています');
      } else {
        setErrorMessage(err instanceof Error ? err.message : '不明なエラーが発生しました');
      }
      clearSessionKey();
      setState('error');
    }
  };

  const handleApprove = async (approvedProposals: ClassificationProposal[]) => {
    const { addCategoryRule } = useSettingsStore.getState();
    for (const p of approvedProposals) {
      addCategoryRule({
        keyword: p.merchantName,
        category: p.suggestedCategory,
        source: 'ai',
        confidence: p.confidence,
        userConfirmed: true,
        createdAt: new Date().toISOString(),
      });
    }
    const allRules = useSettingsStore.getState().categoryRules;
    const result = await retroactiveApply(allRules);
    setUpdatedCount(result.updated);
    setUnclassifiedCount(0);
    setState('done');
  };

  const handleRetry = () => {
    setPin('');
    setErrorMessage('');
    setState('idle');
  };

  return (
    <div className="space-y-3">
      {/* 未分類件数バッジ */}
      {unclassifiedCount > 0 && state !== 'done' && (
        <div className="flex items-center gap-2 text-sm text-amber-400">
          <Sparkles className="w-4 h-4" />
          <span>
            未分類の取引が <strong>{unclassifiedCount}件</strong> あります
          </span>
        </div>
      )}
      {unclassifiedCount === 0 && state === 'idle' && (
        <p className="text-sm text-[var(--color-text-muted)]">未分類の取引はありません</p>
      )}

      {/* idle: 開始ボタン */}
      {state === 'idle' && unclassifiedCount > 0 && (
        <button
          onClick={() => void handleStart()}
          className="px-4 py-2 rounded-lg text-sm font-medium transition-colors
                     bg-[var(--color-primary-light)] text-[var(--color-primary)]
                     hover:bg-[var(--color-primary)] hover:text-[var(--color-text-inverse)]"
        >
          AIカテゴリ整理を開始
        </button>
      )}

      {/* pin_input: コスト表示 + PIN入力 */}
      {state === 'pin_input' && (
        <div className="space-y-3">
          <p className="text-xs text-[var(--color-text-muted)]">
            {merchantCount}件の加盟店をAIに送信します（推定コスト {costEstimate}）
          </p>
          <div className="flex gap-2">
            <input
              type="password"
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && void handlePinSubmit()}
              placeholder="APIキーのPINを入力"
              className="flex-1 px-3 py-2 rounded-lg text-sm
                         bg-[var(--color-surface)] border border-[var(--color-border)]
                         text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)]
                         focus:outline-none focus:border-[var(--color-primary)]"
            />
            <button
              onClick={() => void handlePinSubmit()}
              disabled={!pin}
              className="px-4 py-2 rounded-lg text-sm font-medium transition-colors
                         bg-[var(--color-primary)] text-[var(--color-text-inverse)]
                         disabled:opacity-50 disabled:cursor-not-allowed"
            >
              送信
            </button>
          </div>
        </div>
      )}

      {/* loading */}
      {state === 'loading' && (
        <div className="flex items-center gap-2 text-sm text-[var(--color-text-muted)]">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span>AIが分類を提案しています...</span>
        </div>
      )}

      {/* showing_proposals: 提案リスト（CategorySuggestPanelが未実装のためインライン表示） */}
      {state === 'showing_proposals' && (
        <div className="space-y-3">
          <p className="text-xs font-medium text-[var(--color-text-secondary)]">
            {proposals.length}件の提案
          </p>
          <ul className="space-y-2 max-h-64 overflow-y-auto">
            {proposals.map((p) => (
              <li
                key={p.merchantName}
                className="flex items-center justify-between px-3 py-2 rounded-lg
                           bg-[var(--color-surface-elevated)] text-sm"
              >
                <div className="min-w-0">
                  <p className="font-medium text-[var(--color-text-primary)] truncate">
                    {p.merchantName}
                  </p>
                  {p.reasoning && (
                    <p className="text-xs text-[var(--color-text-muted)] truncate">{p.reasoning}</p>
                  )}
                </div>
                <span className="ml-2 shrink-0 text-xs font-medium text-[var(--color-primary)]">
                  {p.suggestedCategory}
                </span>
              </li>
            ))}
          </ul>
          <div className="flex gap-2">
            <button
              onClick={() => void handleApprove(proposals)}
              className="px-4 py-2 rounded-lg text-sm font-medium transition-colors
                         bg-[var(--color-primary)] text-[var(--color-text-inverse)]"
            >
              すべて承認して適用
            </button>
            <button
              onClick={handleRetry}
              className="px-4 py-2 rounded-lg text-sm font-medium transition-colors
                         bg-[var(--color-surface)] border border-[var(--color-border)]
                         text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-elevated)]"
            >
              キャンセル
            </button>
          </div>
        </div>
      )}

      {/* done */}
      {state === 'done' && (
        <div className="flex items-center gap-2 text-sm" style={{ color: 'var(--color-success)' }}>
          <CheckCircle2 className="w-4 h-4" />
          <span>{updatedCount}件のカテゴリを更新しました</span>
        </div>
      )}

      {/* error */}
      {state === 'error' && (
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm" style={{ color: 'var(--color-danger)' }}>
            <AlertCircle className="w-4 h-4" />
            <span>{errorMessage}</span>
          </div>
          <button
            onClick={handleRetry}
            className="px-4 py-2 rounded-lg text-sm font-medium transition-colors
                       bg-[var(--color-surface)] border border-[var(--color-border)]
                       text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-elevated)]"
          >
            再試行
          </button>
        </div>
      )}
    </div>
  );
}
