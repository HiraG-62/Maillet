import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@/styles/globals.css';
import { App } from '@/app/App';
import { applyThemeColor, loadThemeColor } from '@/lib/apply-theme-color';

// マイグレーション: 旧キー → 新キーへデータ移行
const OLD_SETTINGS_KEY = 'card-tracker-settings';
const NEW_SETTINGS_KEY = 'maillet-settings';
const oldSettingsData = localStorage.getItem(OLD_SETTINGS_KEY);
if (oldSettingsData && !localStorage.getItem(NEW_SETTINGS_KEY)) {
  localStorage.setItem(NEW_SETTINGS_KEY, oldSettingsData);
  localStorage.removeItem(OLD_SETTINGS_KEY);
}

// テーマをLocalStorageから復元（フラッシュ防止）
try {
  const stored = localStorage.getItem(NEW_SETTINGS_KEY);
  const theme = stored ? (JSON.parse(stored)?.state?.theme ?? 'dark') : 'dark';
  if (theme === 'light') {
    document.documentElement.classList.remove('dark');
  } else {
    document.documentElement.classList.add('dark');
  }
} catch {
  document.documentElement.classList.add('dark');
}

// テーマカラーをLocalStorageから復元
const savedColorId = loadThemeColor();
const isDark = document.documentElement.classList.contains('dark');
applyThemeColor(savedColorId, isDark);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
