export interface GmailMessage {
  id: string;
  threadId: string;
  payload: {
    headers: Array<{ name: string; value: string }>;
    body?: { data?: string };
    parts?: Array<{
      mimeType: string;
      body: { data?: string };
    }>;
  };
  internalDate: string;
}

export interface SyncResult {
  total_fetched: number;
  new_transactions: number;
  duplicates_skipped: number;
  parse_errors: number;
  errors: string[];
}

export interface SyncProgress {
  current: number;
  total: number;
  percentage: number;
  status: 'idle' | 'syncing' | 'done' | 'error';
  message?: string;
}

export interface GmailAuthConfig {
  clientId: string;
  clientSecret?: string;
  redirectUri: string;
  scope: string[];
}

export interface OAuthToken {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  token_type: string;
  scope: string;
}

export interface AuthState {
  isAuthenticated: boolean;
  token: OAuthToken | null;
  expiresAt: number | null;
}
