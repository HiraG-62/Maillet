// @vitest-environment happy-dom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useAuth } from '../useAuth';
import type { AuthState } from '@/types/gmail';
import * as authModule from '@/services/gmail/auth';

vi.mock('@/services/gmail/auth', () => ({
  getAuthState: vi.fn(),
  startGmailAuth: vi.fn(),
  logout: vi.fn(),
  refreshToken: vi.fn(),
  handleAuthCallback: vi.fn(),
}));

const unauthenticatedState: AuthState = {
  isAuthenticated: false,
  token: null,
  expiresAt: null,
};

const authenticatedState: AuthState = {
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

describe('useAuth', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(authModule.getAuthState).mockReturnValue(unauthenticatedState);
    window.history.replaceState({}, '', '/');
  });

  describe('初期状態', () => {
    it('isAuthenticated=false で初期化される', async () => {
      const { result } = renderHook(() => useAuth());
      await act(async () => {});

      expect(result.current.authState.isAuthenticated).toBe(false);
      expect(result.current.authState.token).toBeNull();
      expect(result.current.error).toBeNull();
    });

    it('isLoading は初期値 false', async () => {
      const { result } = renderHook(() => useAuth());
      await act(async () => {});

      expect(result.current.isLoading).toBe(false);
    });

    it('マウント時に getAuthState() を呼び出す', async () => {
      renderHook(() => useAuth());
      await act(async () => {});

      expect(authModule.getAuthState).toHaveBeenCalled();
    });
  });

  describe('セッションストレージからのトークン復元', () => {
    it('getAuthState() が認証済み状態を返す場合、authState が更新される', async () => {
      vi.mocked(authModule.getAuthState).mockReturnValue(authenticatedState);

      const { result } = renderHook(() => useAuth());
      await act(async () => {});

      expect(result.current.authState.isAuthenticated).toBe(true);
      expect(result.current.authState.token).not.toBeNull();
      expect(result.current.authState.expiresAt).not.toBeNull();
    });

    it('getAuthState() が未認証を返す場合は token=null', async () => {
      vi.mocked(authModule.getAuthState).mockReturnValue(unauthenticatedState);

      const { result } = renderHook(() => useAuth());
      await act(async () => {});

      expect(result.current.authState.token).toBeNull();
      expect(result.current.authState.expiresAt).toBeNull();
    });
  });

  describe('logout', () => {
    it('logout() を呼ぶと未認証状態になる', async () => {
      vi.mocked(authModule.getAuthState).mockReturnValue(authenticatedState);

      const { result } = renderHook(() => useAuth());
      await act(async () => {});

      expect(result.current.authState.isAuthenticated).toBe(true);

      act(() => {
        result.current.logout();
      });

      expect(authModule.logout).toHaveBeenCalled();
      expect(result.current.authState.isAuthenticated).toBe(false);
      expect(result.current.authState.token).toBeNull();
    });

    it('logout() で error もクリアされる', async () => {
      vi.mocked(authModule.getAuthState).mockReturnValue(unauthenticatedState);
      vi.mocked(authModule.startGmailAuth).mockRejectedValue(new Error('login failed'));

      const { result } = renderHook(() => useAuth());
      await act(async () => {});

      await act(async () => {
        await result.current.login();
      });
      expect(result.current.error).toBe('login failed');

      act(() => {
        result.current.logout();
      });
      expect(result.current.error).toBeNull();
    });

    it('logout() は authModule.logout() を呼び出す', async () => {
      const { result } = renderHook(() => useAuth());
      await act(async () => {});

      act(() => {
        result.current.logout();
      });

      expect(authModule.logout).toHaveBeenCalledOnce();
    });
  });

  describe('OAuth コールバック処理', () => {
    it('URL に ?code= がある場合、handleAuthCallback を呼ぶ', async () => {
      window.history.replaceState({}, '', '/?code=test-auth-code&state=test-state');
      vi.mocked(authModule.handleAuthCallback).mockResolvedValue(null);
      vi.mocked(authModule.getAuthState).mockReturnValue(authenticatedState);

      renderHook(() => useAuth());
      await act(async () => {});

      expect(authModule.handleAuthCallback).toHaveBeenCalled();
    });

    it('URL に ?code= がない場合、handleAuthCallback を呼ばない', async () => {
      window.history.replaceState({}, '', '/');

      renderHook(() => useAuth());
      await act(async () => {});

      expect(authModule.handleAuthCallback).not.toHaveBeenCalled();
    });

    it('handleAuthCallback 失敗時は error が設定される', async () => {
      window.history.replaceState({}, '', '/?code=bad-code');
      vi.mocked(authModule.handleAuthCallback).mockRejectedValue(new Error('callback failed'));

      const { result } = renderHook(() => useAuth());
      await act(async () => {});

      expect(result.current.error).toBe('callback failed');
    });
  });
});
