import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { AppSettings, CategoryRule } from '@/types/settings';
import { DEFAULT_SETTINGS } from '@/types/settings';

interface SettingsState extends AppSettings {
  updateSettings: (settings: Partial<AppSettings>) => void;
  addCategoryRule: (rule: Omit<CategoryRule, 'id'>) => void;
  removeCategoryRule: (id: string) => void;
  updateCategoryRule: (id: string, updates: Partial<Omit<CategoryRule, 'id'>>) => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      ...DEFAULT_SETTINGS,
      updateSettings: (settings) => set((state) => ({ ...state, ...settings })),
      addCategoryRule: (rule) =>
        set((state) => ({
          categoryRules: [
            ...state.categoryRules,
            { ...rule, id: crypto.randomUUID() },
          ],
        })),
      removeCategoryRule: (id) =>
        set((state) => ({
          categoryRules: state.categoryRules.filter((r) => r.id !== id),
        })),
      updateCategoryRule: (id, updates) =>
        set((state) => ({
          categoryRules: state.categoryRules.map((r) =>
            r.id === id ? { ...r, ...updates } : r
          ),
        })),
    }),
    { name: 'maillet-settings' }
  )
);
