import { useEffect, useState } from 'react';
import { useSettingsStore } from '@/stores/settings-store';
import { Switch } from '@/components/ui/switch';

export function ThemeSection() {
  const { theme, updateSettings } = useSettingsStore();
  const [isDark, setIsDark] = useState(theme === 'dark');

  useEffect(() => {
    setIsDark(theme === 'dark');
    // DOM も同期
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [theme]);

  const handleToggle = (checked: boolean) => {
    setIsDark(checked);
    const newTheme = checked ? 'dark' : 'light';
    updateSettings({ theme: newTheme });

    // Apply to DOM
    if (checked) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  };

  return (
    <div className="rounded-lg border border-white/10 bg-[#12121a]/80 p-4 mb-4">
      <h3 className="text-slate-200 font-semibold mb-3">テーマ</h3>
      <div className="flex items-center justify-between">
        <span className="text-slate-300">ダークモード</span>
        <Switch checked={isDark} onCheckedChange={handleToggle} />
      </div>
    </div>
  );
}
