import { useState, useEffect, useCallback } from 'react';
import type { AuthState, GmailAuthConfig } from '@/types/gmail';
import {
  startGmailAuth,
  logout as authLogout,
  refreshToken as authRefreshToken,
  getAuthState,
  handleAuthCallback,
} from '@/services/gmail/auth';

const GMAIL_CONFIG: GmailAuthConfig = {
  clientId: (import.meta.env.VITE_GOOGLE_CLIENT_ID as string) ?? '',
  redirectUri:
    (import.meta.env.VITE_GOOGLE_REDIRECT_URI as string) ??
    `${window.location.origin}/auth/callback`,
  scope: ['https://www.googleapis.com/auth/gmail.readonly'],
};

interface UseAuthReturn {
  authState: AuthState;
  isLoading: boolean;
  error: string | null;
  login: () => Promise<void>;
  logout: () => void;
  refreshToken: () => Promise<void>;
}

export function useAuth(): UseAuthReturn {
  const [authState, setAuthState] = useState<AuthState>({
    isAuthenticated: false,
    token: null,
    expiresAt: null,
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const init = async () => {
      const params = new URLSearchParams(window.location.search);
      if (params.has('code')) {
        setIsLoading(true);
        try {
          await handleAuthCallback(GMAIL_CONFIG);
          window.history.replaceState({}, '', window.location.pathname);
        } catch (err) {
          setError(err instanceof Error ? err.message : String(err));
        } finally {
          setIsLoading(false);
        }
      }
      setAuthState(getAuthState());
    };
    init();
  }, []);

  const login = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      await startGmailAuth(GMAIL_CONFIG);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setIsLoading(false);
    }
    // startGmailAuth redirects the page; isLoading stays true if redirect succeeds
  }, []);

  const logout = useCallback(() => {
    authLogout();
    setAuthState({ isAuthenticated: false, token: null, expiresAt: null });
    setError(null);
  }, []);

  const refreshToken = useCallback(async () => {
    if (!authState.token?.refresh_token) {
      setError('No refresh token available');
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      await authRefreshToken(authState.token.refresh_token, GMAIL_CONFIG);
      setAuthState(getAuthState());
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsLoading(false);
    }
  }, [authState.token]);

  return { authState, isLoading, error, login, logout, refreshToken };
}
