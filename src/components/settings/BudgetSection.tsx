import { useState, useEffect } from 'react';
import { useSettingsStore } from '@/stores/settings-store';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { CATEGORIES } from '@/services/category';

export function BudgetSection() {
  const {
    monthly_budget,
    updateSettings,
    categoryBudgets,
    setCategoryBudget,
    removeCategoryBudget,
    categoryRules,
  } = useSettingsStore();
  const [budget, setBudget] = useState<string>(monthly_budget.toString());
  const [error, setError] = useState<string>('');
  const [saved, setSaved] = useState(false);

  // カテゴリ別使用枠の新規追加用ステート
  const [newCategory, setNewCategory] = useState<string>('');
  const [newAmount, setNewAmount] = useState<string>('');
  const [addError, setAddError] = useState<string>('');

  useEffect(() => {
    setBudget(monthly_budget.toString());
  }, [monthly_budget]);

  const handleSave = () => {
    setError('');
    const value = parseFloat(budget);

    if (isNaN(value)) {
      setError('有効な数値を入力してください');
      return;
    }

    if (value <= 0) {
      setError('正の数値を入力してください');
      return;
    }

    updateSettings({ monthly_budget: value });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  // 利用可能なカテゴリ一覧（CATEGORIES のキー + ユーザー定義ルールのカテゴリ名）
  const allCategories = Array.from(
    new Set([
      ...Object.keys(CATEGORIES),
      ...categoryRules.map((r) => r.category).filter(Boolean),
    ])
  );

  // 既に設定済みのカテゴリは選択肢から除外
  const existingCategories = Object.keys(categoryBudgets ?? {});
  const availableCategories = allCategories.filter(
    (c) => !existingCategories.includes(c)
  );

  const handleAddCategoryBudget = () => {
    setAddError('');
    if (!newCategory) {
      setAddError('カテゴリを選択してください');
      return;
    }
    const amount = parseFloat(newAmount);
    if (isNaN(amount) || amount <= 0) {
      setAddError('正の数値を入力してください');
      return;
    }
    setCategoryBudget(newCategory, amount);
    setNewCategory('');
    setNewAmount('');
  };

  const handleCategoryAmountChange = (category: string, value: string) => {
    const amount = parseFloat(value);
    if (!isNaN(amount) && amount > 0) {
      setCategoryBudget(category, amount);
    }
  };

  return (
    <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-background)]/80 p-4 mb-4">
      <h3 className="text-[var(--color-text-primary)] font-semibold mb-3">月間使用枠</h3>
      <div className="space-y-3">
        <Input
          type="number"
          placeholder="使用枠を入力"
          value={budget}
          onChange={(e) => setBudget(e.target.value)}
          min="0"
          step="0.01"
        />
        {error && <p className="text-red-500 text-sm">{error}</p>}
        {saved && <p className="text-[var(--color-success)] text-sm">✅ 保存しました</p>}
        <Button onClick={handleSave} variant="default">
          保存
        </Button>
      </div>

      {/* カテゴリ別使用枠セクション */}
      <div className="mt-6">
        <h4 className="text-[var(--color-text-primary)] font-semibold mb-3">カテゴリ別使用枠</h4>

        {/* 設定済みカテゴリ一覧 */}
        {existingCategories.length > 0 && (
          <div className="space-y-2 mb-4">
            {existingCategories.map((category) => (
              <div
                key={category}
                className="flex items-center gap-2"
              >
                <span className="text-[var(--color-text-primary)] text-sm w-24 shrink-0">
                  {category}
                </span>
                <Input
                  type="number"
                  defaultValue={(categoryBudgets ?? {})[category]?.toString() ?? ''}
                  onBlur={(e) => handleCategoryAmountChange(category, e.target.value)}
                  min="0"
                  step="1"
                  className="flex-1"
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => removeCategoryBudget(category)}
                  className="shrink-0 text-[var(--color-error)] border-[var(--color-error)]/40 hover:bg-[var(--color-error)]/10"
                >
                  削除
                </Button>
              </div>
            ))}
          </div>
        )}

        {/* 新規追加行 */}
        {availableCategories.length > 0 && (
          <div className="flex items-start gap-2 mb-3">
            <select
              value={newCategory}
              onChange={(e) => setNewCategory(e.target.value)}
              className="flex-1 h-9 rounded-md border border-[var(--color-border)] bg-[var(--color-background)] text-[var(--color-text-primary)] text-sm px-2"
            >
              <option value="">カテゴリを選択</option>
              {availableCategories.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
            <Input
              type="number"
              placeholder="金額"
              value={newAmount}
              onChange={(e) => setNewAmount(e.target.value)}
              min="0"
              step="1"
              className="w-32 shrink-0"
            />
            <Button
              variant="default"
              size="sm"
              onClick={handleAddCategoryBudget}
              className="shrink-0"
            >
              追加
            </Button>
          </div>
        )}

        {addError && <p className="text-red-500 text-sm mb-2">{addError}</p>}

        <p className="text-[var(--color-text-secondary)] text-xs">
          カテゴリ別使用枠はグローバル使用枠の内訳です
        </p>
      </div>
    </div>
  );
}
