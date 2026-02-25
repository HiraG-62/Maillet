export interface AppSettings {
  monthly_budget: number;
  currency: 'JPY';
  theme: 'dark' | 'light';
  llm_provider: 'anthropic' | 'openai' | null;
  gmail_connected: boolean;
}

export const DEFAULT_SETTINGS: AppSettings = {
  monthly_budget: 0,
  currency: 'JPY',
  theme: 'dark',
  llm_provider: null,
  gmail_connected: false,
};
