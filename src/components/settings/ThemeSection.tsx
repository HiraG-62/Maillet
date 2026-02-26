import { useEffect, useState } from 'react';
import { Check, Palette } from 'lucide-react';
import { useSettingsStore } from '@/stores/settings-store';
import { Switch } from '@/components/ui/switch';
import { THEME_COLORS, type ThemeColorId } from '@/lib/theme-colors';
import { applyThemeColor, saveThemeColor, loadThemeColor } from '@/lib/apply-theme-color';

export function ThemeSection() {
  const { theme, updateSettings } = useSettingsStore();
  const [isDark, setIsDark] = useState(theme === 'dark');
  const [selectedColor, setSelectedColor] = useState<ThemeColorId>(loadThemeColor);

  useEffect(() => {
    setIsDark(theme === 'dark');
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    // ダークモード切替時にテーマカラーも再適用
    applyThemeColor(selectedColor, theme === 'dark');
  }, [theme, selectedColor]);

  const handleToggle = (checked: boolean) => {
    setIsDark(checked);
    const newTheme = checked ? 'dark' : 'light';
    updateSettings({ theme: newTheme });

    if (checked) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    applyThemeColor(selectedColor, checked);
  };

  const handleColorChange = (colorId: ThemeColorId) => {
    applyThemeColor(colorId, isDark);
    saveThemeColor(colorId);
    setSelectedColor(colorId);
  };

  return (
    <div className="space-y-4">
      <div className="rounded-lg border dark:border-white/10 border-black/10 bg-[var(--color-background)]/80 p-4">
        <h3 className="text-[var(--color-text-primary)] font-semibold mb-3">テーマ</h3>
        <div className="flex items-center justify-between">
          <span className="text-[var(--color-text-secondary)]">ダークモード</span>
          <Switch checked={isDark} onCheckedChange={handleToggle} />
        </div>
      </div>

      <div className="rounded-lg border dark:border-white/10 border-black/10 bg-[var(--color-background)]/80 p-4">
        <div className="flex items-center gap-2 mb-3">
          <Palette className="w-4 h-4 text-[var(--color-primary)]" />
          <h3 className="text-[var(--color-text-primary)] font-semibold">テーマカラー</h3>
        </div>
        <p className="text-sm text-[var(--color-text-muted)] mb-4">
          アプリのアクセントカラーを選択
        </p>
        <div className="flex flex-wrap gap-3">
          {THEME_COLORS.map(color => (
            <button
              key={color.id}
              onClick={() => handleColorChange(color.id)}
              className="flex flex-col items-center gap-1.5 p-2 rounded-xl hover:bg-[var(--color-surface-elevated)] transition-colors"
              title={color.name}
            >
              <div
                className="relative w-10 h-10 rounded-full shadow-md"
                style={{ backgroundColor: isDark ? color.dark.primary : color.light.primary }}
              >
                {selectedColor === color.id && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <Check className="w-5 h-5 text-white" />
                  </div>
                )}
              </div>
              <span className="text-xs text-[var(--color-text-muted)]">{color.name}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
