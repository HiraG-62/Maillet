import { useState, useEffect } from 'react';
import { useSettingsStore } from '@/stores/settings-store';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export function BudgetSection() {
  const { monthly_budget, updateSettings } = useSettingsStore();
  const [budget, setBudget] = useState<string>(monthly_budget.toString());
  const [error, setError] = useState<string>('');
  const [saved, setSaved] = useState(false);

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

  return (
    <div className="rounded-lg border dark:border-white/10 border-black/10 bg-[var(--color-background)]/80 p-4 mb-4">
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
    </div>
  );
}
