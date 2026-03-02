export interface CategoryRule {
  id: string;
  keyword: string;
  category: string;
  // SmartClassify extension fields (existing rules treat undefined as 'user')
  merchantPattern?: string;
  confidence?: number;
  source?: 'user' | 'ai' | 'system';
  userConfirmed?: boolean;
  appliedCount?: number;
  createdAt?: string;
}

export interface AppSettings {
  monthly_budget: number;
  currency: 'JPY';
  theme: 'dark' | 'light';
  llm_provider: 'anthropic' | 'openai' | null;
  gmail_connected: boolean;
  categoryRules: CategoryRule[];
  categoryBudgets: Record<string, number>;
}

export const DEFAULT_SETTINGS: AppSettings = {
  monthly_budget: 0,
  currency: 'JPY',
  theme: 'dark',
  llm_provider: null,
  gmail_connected: false,
  categoryRules: [],
  categoryBudgets: {},
};
