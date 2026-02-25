// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { SyncPanel } from '../SyncPanel';
import type { AuthState, SyncProgress, SyncResult } from '@/types/gmail';

vi.mock('@/hooks/useAuth');
vi.mock('@/hooks/useSync');

import { useAuth } from '@/hooks/useAuth';
import { useSync } from '@/hooks/useSync';

const defaultProgress: SyncProgress = {
  current: 0,
  total: 0,
  percentage: 0,
  status: 'idle',
  message: '',
};

const unauthenticatedAuthState: AuthState = {
  isAuthenticated: false,
  token: null,
  expiresAt: null,
};

const authenticatedAuthState: AuthState = {
  isAuthenticated: true,
  token: {
    access_token: 'test-access-token',
    refresh_token: 'test-refresh-token',
    expires_in: 3600,
    token_type: 'Bearer',
    scope: 'https://www.googleapis.com/auth/gmail.readonly',
  },
  expiresAt: Date.now() + 3_600_000,
};

function mockUseAuth(overrides: Partial<ReturnType<typeof useAuth>> = {}) {
  vi.mocked(useAuth).mockReturnValue({
    authState: unauthenticatedAuthState,
    isLoading: false,
    error: null,
    login: vi.fn().mockResolvedValue(undefined),
    logout: vi.fn(),
    refreshToken: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  });
}

function mockUseSync(overrides: Partial<ReturnType<typeof useSync>> = {}) {
  vi.mocked(useSync).mockReturnValue({
    progress: defaultProgress,
    result: null,
    isSyncing: false,
    error: null,
    startSync: vi.fn().mockResolvedValue(undefined),
    cancelSync: vi.fn(),
    reset: vi.fn(),
    ...overrides,
  });
}

describe('SyncPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseAuth();
    mockUseSync();
  });

  describe('unauthenticated state', () => {
    afterEach(() => {
      vi.unstubAllEnvs();
    });

    it('renders Google login button when not authenticated', () => {
      render(<SyncPanel />);
      expect(screen.getByText('Google でログイン')).toBeInTheDocument();
    });

    it('shows prompt text about Gmail sync when configured', () => {
      vi.stubEnv('VITE_GOOGLE_CLIENT_ID', 'test-client-id');
      render(<SyncPanel />);
      expect(screen.getByText(/Gmail からカード利用明細を自動取得/)).toBeInTheDocument();
    });

    it('shows unconfigured message when Google Client ID is not set', () => {
      render(<SyncPanel />);
      expect(screen.getByText(/Gmail連携は設定が必要です/)).toBeInTheDocument();
    });

    it('disables login button when Google Client ID is not configured', () => {
      render(<SyncPanel />);
      expect(screen.getByRole('button', { name: /Google でログイン/ })).toBeDisabled();
    });

    it('shows auth error when present', () => {
      vi.stubEnv('VITE_GOOGLE_CLIENT_ID', 'test-client-id');
      mockUseAuth({ authState: unauthenticatedAuthState, error: 'Auth failed' });
      render(<SyncPanel />);
      expect(screen.getByText('Auth failed')).toBeInTheDocument();
    });

    it('disables login button during loading', () => {
      vi.stubEnv('VITE_GOOGLE_CLIENT_ID', 'test-client-id');
      mockUseAuth({ authState: unauthenticatedAuthState, isLoading: true });
      render(<SyncPanel />);
      expect(screen.getByRole('button', { name: /Google でログイン/ })).toBeDisabled();
    });
  });

  describe('authenticated state', () => {
    beforeEach(() => {
      mockUseAuth({ authState: authenticatedAuthState });
    });

    it('renders sync start button when authenticated and not syncing', () => {
      render(<SyncPanel />);
      expect(screen.getByRole('button', { name: /同期開始/ })).toBeInTheDocument();
    });

    it('renders cancel button when syncing', () => {
      mockUseSync({ isSyncing: true });
      render(<SyncPanel />);
      expect(screen.getByRole('button', { name: /キャンセル/ })).toBeInTheDocument();
    });

    it('shows progress bar when syncing', () => {
      mockUseSync({
        isSyncing: true,
        progress: { current: 5, total: 10, percentage: 50, status: 'syncing', message: '処理中...' },
      });
      render(<SyncPanel />);
      expect(screen.getByText('処理中...')).toBeInTheDocument();
      expect(screen.getByText('50%')).toBeInTheDocument();
      expect(screen.getByText('5 / 10 件処理済み')).toBeInTheDocument();
    });

    it('shows sync result summary after completion', () => {
      const result: SyncResult = {
        total_fetched: 20,
        new_transactions: 5,
        duplicates_skipped: 15,
        parse_errors: 0,
        errors: [],
      };
      mockUseSync({
        result,
        progress: { current: 20, total: 20, percentage: 100, status: 'done', message: '完了' },
      });
      render(<SyncPanel />);
      expect(screen.getByText('同期完了')).toBeInTheDocument();
      expect(screen.getByText('20')).toBeInTheDocument(); // total_fetched
      expect(screen.getByText('5')).toBeInTheDocument(); // new_transactions
      expect(screen.getByText('15')).toBeInTheDocument(); // duplicates_skipped
    });

    it('shows sync error when present', () => {
      mockUseSync({ error: 'Network error' });
      render(<SyncPanel />);
      expect(screen.getByText('Network error')).toBeInTheDocument();
    });
  });
});
