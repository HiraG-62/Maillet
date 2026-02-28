// @vitest-environment node
import { describe, it, expect, beforeEach } from 'vitest';
import { useSettingsStore } from '../settings-store';
import { DEFAULT_SETTINGS } from '@/types/settings';

describe('useSettingsStore', () => {
  beforeEach(() => {
    useSettingsStore.setState({ ...DEFAULT_SETTINGS });
  });

  it('初期状態がDEFAULT_SETTINGSと一致する', () => {
    const state = useSettingsStore.getState();
    expect(state.monthly_budget).toBe(DEFAULT_SETTINGS.monthly_budget);
    expect(state.theme).toBe(DEFAULT_SETTINGS.theme);
    expect(state.categoryRules).toEqual([]);
    expect(state.categoryBudgets).toEqual({});
    expect(state.gmail_connected).toBe(false);
  });

  describe('updateSettings', () => {
    it('monthly_budget を更新できる', () => {
      useSettingsStore.getState().updateSettings({ monthly_budget: 100000 });
      expect(useSettingsStore.getState().monthly_budget).toBe(100000);
    });

    it('theme を light に変更できる', () => {
      useSettingsStore.getState().updateSettings({ theme: 'light' });
      expect(useSettingsStore.getState().theme).toBe('light');
    });

    it('複数フィールドを一括更新できる', () => {
      useSettingsStore.getState().updateSettings({
        monthly_budget: 50000,
        gmail_connected: true,
        llm_provider: 'anthropic',
      });
      const state = useSettingsStore.getState();
      expect(state.monthly_budget).toBe(50000);
      expect(state.gmail_connected).toBe(true);
      expect(state.llm_provider).toBe('anthropic');
    });

    it('他のフィールドは変更されない', () => {
      useSettingsStore.getState().updateSettings({ monthly_budget: 30000 });
      expect(useSettingsStore.getState().theme).toBe(DEFAULT_SETTINGS.theme);
      expect(useSettingsStore.getState().categoryRules).toEqual([]);
    });
  });

  describe('addCategoryRule', () => {
    it('カテゴリルールを追加できる', () => {
      useSettingsStore.getState().addCategoryRule({ keyword: 'スタバ', category: '食費' });
      const rules = useSettingsStore.getState().categoryRules;
      expect(rules).toHaveLength(1);
      expect(rules[0].keyword).toBe('スタバ');
      expect(rules[0].category).toBe('食費');
      expect(rules[0].id).toBeDefined();
    });

    it('複数のルールを追加できる', () => {
      useSettingsStore.getState().addCategoryRule({ keyword: 'スタバ', category: '食費' });
      useSettingsStore.getState().addCategoryRule({ keyword: 'JR', category: '交通費' });
      expect(useSettingsStore.getState().categoryRules).toHaveLength(2);
    });

    it('追加されたルールにIDが自動付与される', () => {
      useSettingsStore.getState().addCategoryRule({ keyword: 'test', category: 'テスト' });
      const rule = useSettingsStore.getState().categoryRules[0];
      expect(typeof rule.id).toBe('string');
      expect(rule.id.length).toBeGreaterThan(0);
    });
  });

  describe('removeCategoryRule', () => {
    it('IDで指定したルールを削除できる', () => {
      useSettingsStore.getState().addCategoryRule({ keyword: 'スタバ', category: '食費' });
      const id = useSettingsStore.getState().categoryRules[0].id;
      useSettingsStore.getState().removeCategoryRule(id);
      expect(useSettingsStore.getState().categoryRules).toHaveLength(0);
    });

    it('存在しないIDを指定しても他のルールは残る', () => {
      useSettingsStore.getState().addCategoryRule({ keyword: 'スタバ', category: '食費' });
      useSettingsStore.getState().removeCategoryRule('non-existent-id');
      expect(useSettingsStore.getState().categoryRules).toHaveLength(1);
    });

    it('複数ルールのうち指定IDのみ削除される', () => {
      useSettingsStore.getState().addCategoryRule({ keyword: 'A', category: 'cat1' });
      useSettingsStore.getState().addCategoryRule({ keyword: 'B', category: 'cat2' });
      const rules = useSettingsStore.getState().categoryRules;
      useSettingsStore.getState().removeCategoryRule(rules[0].id);
      const remaining = useSettingsStore.getState().categoryRules;
      expect(remaining).toHaveLength(1);
      expect(remaining[0].keyword).toBe('B');
    });
  });

  describe('updateCategoryRule', () => {
    it('キーワードを更新できる', () => {
      useSettingsStore.getState().addCategoryRule({ keyword: '古い', category: '食費' });
      const id = useSettingsStore.getState().categoryRules[0].id;
      useSettingsStore.getState().updateCategoryRule(id, { keyword: '新しい' });
      expect(useSettingsStore.getState().categoryRules[0].keyword).toBe('新しい');
    });

    it('カテゴリを更新できる', () => {
      useSettingsStore.getState().addCategoryRule({ keyword: 'test', category: '食費' });
      const id = useSettingsStore.getState().categoryRules[0].id;
      useSettingsStore.getState().updateCategoryRule(id, { category: '交通費' });
      expect(useSettingsStore.getState().categoryRules[0].category).toBe('交通費');
    });

    it('存在しないIDを更新しても他は変わらない', () => {
      useSettingsStore.getState().addCategoryRule({ keyword: 'A', category: '食費' });
      useSettingsStore.getState().updateCategoryRule('invalid-id', { keyword: 'Z' });
      expect(useSettingsStore.getState().categoryRules[0].keyword).toBe('A');
    });
  });

  describe('setCategoryBudget', () => {
    it('カテゴリ予算をセットできる', () => {
      useSettingsStore.getState().setCategoryBudget('食費', 30000);
      expect(useSettingsStore.getState().categoryBudgets['食費']).toBe(30000);
    });

    it('複数のカテゴリ予算をセットできる', () => {
      useSettingsStore.getState().setCategoryBudget('食費', 30000);
      useSettingsStore.getState().setCategoryBudget('交通費', 10000);
      const budgets = useSettingsStore.getState().categoryBudgets;
      expect(budgets['食費']).toBe(30000);
      expect(budgets['交通費']).toBe(10000);
    });

    it('既存の予算を上書きできる', () => {
      useSettingsStore.getState().setCategoryBudget('食費', 30000);
      useSettingsStore.getState().setCategoryBudget('食費', 50000);
      expect(useSettingsStore.getState().categoryBudgets['食費']).toBe(50000);
    });
  });

  describe('removeCategoryBudget', () => {
    it('カテゴリ予算を削除できる', () => {
      useSettingsStore.getState().setCategoryBudget('食費', 30000);
      useSettingsStore.getState().removeCategoryBudget('食費');
      expect(useSettingsStore.getState().categoryBudgets['食費']).toBeUndefined();
    });

    it('存在しないカテゴリを削除しても他は残る', () => {
      useSettingsStore.getState().setCategoryBudget('食費', 30000);
      useSettingsStore.getState().removeCategoryBudget('存在しない');
      expect(useSettingsStore.getState().categoryBudgets['食費']).toBe(30000);
    });

    it('削除後は空オブジェクトになる', () => {
      useSettingsStore.getState().setCategoryBudget('食費', 30000);
      useSettingsStore.getState().removeCategoryBudget('食費');
      expect(Object.keys(useSettingsStore.getState().categoryBudgets)).toHaveLength(0);
    });
  });
});
