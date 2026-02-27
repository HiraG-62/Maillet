import { useState } from 'react';
import { ChevronDown, ChevronRight, Trash2 } from 'lucide-react';
import { useSettingsStore } from '@/stores/settings-store';
import { useTransactionStore } from '@/stores/transaction-store';
import { applyCategoriesToDB, CATEGORIES } from '@/services/category';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const CATEGORY_KEYS = Object.keys(CATEGORIES);

export function CategoryRuleEditor() {
  const { categoryRules, addCategoryRule, removeCategoryRule } = useSettingsStore();
  const { setTransactions } = useTransactionStore();
  const [keyword, setKeyword] = useState('');
  const [category, setCategory] = useState('');
  const [isDefaultOpen, setIsDefaultOpen] = useState(false);
  const [isReclassifying, setIsReclassifying] = useState(false);
  const [reclassifyResult, setReclassifyResult] = useState<{
    updated: number;
    skipped: number;
  } | null>(null);

  const handleAdd = () => {
    const trimmedKeyword = keyword.trim();
    const trimmedCategory = category.trim();
    if (!trimmedKeyword || !trimmedCategory) return;
    addCategoryRule({ keyword: trimmedKeyword, category: trimmedCategory });
    setKeyword('');
    setCategory('');
  };

  const handleReclassify = async () => {
    setIsReclassifying(true);
    setReclassifyResult(null);
    try {
      const rules = useSettingsStore.getState().categoryRules;
      const result = await applyCategoriesToDB(false, rules);
      setReclassifyResult(result);
      // transaction-store を空にして次回ロード時に再取得させる
      setTransactions([]);
    } catch (e) {
      console.error('再分類エラー', e);
    } finally {
      setIsReclassifying(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* 拡張3: ユーザールール優先の説明 */}
      <p className="text-xs text-[var(--color-text-muted)]">
        ユーザー定義ルールはデフォルトルールより優先されます。
      </p>

      {/* 既存ルール一覧 */}
      {categoryRules?.length === 0 ? (
        <p className="text-sm text-[var(--color-text-muted)]">
          ルールがありません。キーワードとカテゴリを入力して追加してください。
        </p>
      ) : (
        <div className="space-y-2">
          {categoryRules?.map((rule) => (
            <div
              key={rule.id}
              className="flex items-center gap-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-background)]/80 px-3 py-2"
            >
              <span className="flex-1 text-sm text-[var(--color-text-primary)] truncate">
                {rule.keyword}
              </span>
              <span className="text-[var(--color-text-muted)] text-xs">→</span>
              <span className="text-sm font-medium text-[var(--color-primary)]">
                {rule.category}
              </span>
              <button
                onClick={() => removeCategoryRule(rule.id)}
                className="ml-1 p-1 rounded hover:bg-[var(--color-surface-elevated)] text-[var(--color-text-muted)] hover:text-[var(--color-danger)] transition-colors"
                aria-label={`${rule.keyword} ルールを削除`}
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* 新規ルール追加フォーム */}
      <div className="flex gap-2">
        <Input
          placeholder="キーワード"
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          className="flex-1"
        />
        {/* 拡張1: カテゴリ名のSelect選択肢 */}
        <Select value={category} onValueChange={setCategory}>
          <SelectTrigger className="flex-1">
            <SelectValue placeholder="カテゴリを選択" />
          </SelectTrigger>
          <SelectContent>
            {CATEGORY_KEYS.map((cat) => (
              <SelectItem key={cat} value={cat}>
                {cat}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          onClick={handleAdd}
          variant="default"
          disabled={!keyword.trim() || !category.trim()}
        >
          追加
        </Button>
      </div>

      {/* 拡張4: 再分類ボタン */}
      <div className="pt-2 border-t border-[var(--color-border)]">
        <div className="flex items-center gap-3">
          <Button
            onClick={handleReclassify}
            variant="outline"
            disabled={isReclassifying}
            className="text-sm"
          >
            {isReclassifying ? '再分類中...' : '全取引を再分類'}
          </Button>
          {reclassifyResult && (
            <span className="text-xs text-[var(--color-text-muted)]">
              {reclassifyResult.updated} 件更新、{reclassifyResult.skipped} 件スキップ
            </span>
          )}
        </div>
        <p className="mt-1 text-xs text-[var(--color-text-muted)]">
          未分類の取引にカテゴリを自動付与します（既分類は変更しません）。
        </p>
      </div>

      {/* 拡張2: デフォルトルール一覧（折りたたみ） */}
      <div className="pt-2 border-t border-[var(--color-border)]">
        <button
          onClick={() => setIsDefaultOpen((v) => !v)}
          className="flex items-center gap-1 text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors"
        >
          {isDefaultOpen ? (
            <ChevronDown className="w-3.5 h-3.5" />
          ) : (
            <ChevronRight className="w-3.5 h-3.5" />
          )}
          デフォルトルールを表示
        </button>
        {isDefaultOpen && (
          <div className="mt-2 space-y-2">
            {Object.entries(CATEGORIES).map(([cat, keywords]) => (
              <div
                key={cat}
                className="rounded-lg border border-[var(--color-border)] bg-[var(--color-background)]/60 px-3 py-2"
              >
                <p className="text-xs font-semibold text-[var(--color-primary)] mb-1">{cat}</p>
                <p className="text-xs text-[var(--color-text-muted)] leading-relaxed">
                  {keywords.join('、')}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
