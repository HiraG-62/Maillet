import { THEME_COLORS, ThemeColorId, DEFAULT_THEME_COLOR, STORAGE_KEY } from './theme-colors';

export function applyThemeColor(colorId: ThemeColorId, isDark: boolean): void {
  const color = THEME_COLORS.find(c => c.id === colorId) ?? THEME_COLORS[0];
  const vars = isDark ? color.dark : color.light;
  const root = document.documentElement;

  root.style.setProperty('--color-primary', vars.primary);
  root.style.setProperty('--color-primary-hover', vars.primaryHover);
  root.style.setProperty('--color-primary-foreground', vars.primaryForeground);
  root.style.setProperty('--color-primary-light', vars.primaryLight);
  root.style.setProperty('--gradient-bg',
    `linear-gradient(180deg, ${vars.gradientFrom} 0%, ${vars.gradientMid} 50%, ${vars.gradientTo} 100%)`
  );
  root.style.setProperty('--card-border-color', vars.cardBorder);

  // shadow-glow もテーマカラーに合わせて更新
  const hex = vars.primary;
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const opacity = isDark ? 0.15 : 0.12;
  root.style.setProperty('--shadow-glow', `0 0 24px rgba(${r}, ${g}, ${b}, ${opacity})`);
}

export function saveThemeColor(colorId: ThemeColorId): void {
  localStorage.setItem(STORAGE_KEY, colorId);
}

export function loadThemeColor(): ThemeColorId {
  const saved = localStorage.getItem(STORAGE_KEY) as ThemeColorId | null;
  return saved && THEME_COLORS.some(c => c.id === saved) ? saved : DEFAULT_THEME_COLOR;
}
