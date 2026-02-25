// @vitest-environment node
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// sessionStorage mock for Node.js environment (PKCE_VERIFIER のみ使用)
const sessionStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => { store[key] = value; },
    removeItem: (key: string) => { delete store[key]; },
    clear: () => { store = {}; },
  };
})();
vi.stubGlobal('sessionStorage', sessionStorageMock);

// localStorage mock for Node.js environment (token storage)
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => { store[key] = value; },
    removeItem: (key: string) => { delete store[key]; },
    clear: () => { store = {}; },
  };
})();
vi.stubGlobal('localStorage', localStorageMock);

import {
  generateCodeVerifier,
  generateCodeChallenge,
  buildAuthUrl,
  isTokenValid,
  saveToken,
  logout,
  getAuthState,
  getAccessToken,
} from '../auth';
import type { GmailAuthConfig, OAuthToken } from '@/types/gmail';

const testConfig: GmailAuthConfig = {
  clientId: 'test-client-id.apps.googleusercontent.com',
  redirectUri: 'http://localhost:5173/auth/callback',
  scope: ['https://www.googleapis.com/auth/gmail.readonly'],
};

const makeToken = (overrides: Partial<OAuthToken> = {}): OAuthToken => ({
  access_token: 'test-access-token',
  expires_in: 3600,
  token_type: 'Bearer',
  scope: 'https://www.googleapis.com/auth/gmail.readonly',
  ...overrides,
});

// ---- generateCodeVerifier ----

describe('generateCodeVerifier', () => {
  it('43文字以上128文字以下の文字列を返す', () => {
    const verifier = generateCodeVerifier();
    expect(verifier.length).toBeGreaterThanOrEqual(43);
    expect(verifier.length).toBeLessThanOrEqual(128);
  });

  it('URL-safe base64 文字のみを含む（+/= を含まない）', () => {
    const verifier = generateCodeVerifier();
    expect(verifier).toMatch(/^[A-Za-z0-9\-_]+$/);
    expect(verifier).not.toContain('+');
    expect(verifier).not.toContain('/');
    expect(verifier).not.toContain('=');
  });

  it('呼び出しごとに異なる値を返す（ランダム性）', () => {
    const v1 = generateCodeVerifier();
    const v2 = generateCodeVerifier();
    expect(v1).not.toBe(v2);
  });
});

// ---- generateCodeChallenge ----

describe('generateCodeChallenge', () => {
  it('URL-safe base64 文字列を返す（=パディングなし）', async () => {
    const verifier = generateCodeVerifier();
    const challenge = await generateCodeChallenge(verifier);
    expect(challenge).toMatch(/^[A-Za-z0-9\-_]+$/);
    expect(challenge).not.toContain('=');
  });

  it('同じ verifier から常に同じ challenge を生成する（決定的）', async () => {
    const verifier = 'deterministic-test-verifier-string-1234567890abcdef';
    const c1 = await generateCodeChallenge(verifier);
    const c2 = await generateCodeChallenge(verifier);
    expect(c1).toBe(c2);
  });

  it('verifier とは異なる値を返す', async () => {
    const verifier = generateCodeVerifier();
    const challenge = await generateCodeChallenge(verifier);
    expect(challenge).not.toBe(verifier);
  });

  it('異なる verifier から異なる challenge を生成する', async () => {
    const c1 = await generateCodeChallenge('verifier-one-aaaaaaaaaaaaaaaaaaaaaaaaaaa');
    const c2 = await generateCodeChallenge('verifier-two-bbbbbbbbbbbbbbbbbbbbbbbbbbb');
    expect(c1).not.toBe(c2);
  });
});

// ---- buildAuthUrl ----

describe('buildAuthUrl', () => {
  it('Google 認証エンドポイントの URL を返す', () => {
    const url = buildAuthUrl(testConfig, 'test-challenge');
    expect(url).toContain('https://accounts.google.com/o/oauth2/v2/auth');
  });

  it('client_id を含む', () => {
    const url = buildAuthUrl(testConfig, 'challenge');
    const parsed = new URL(url);
    expect(parsed.searchParams.get('client_id')).toBe(testConfig.clientId);
  });

  it('redirect_uri を含む', () => {
    const url = buildAuthUrl(testConfig, 'challenge');
    const parsed = new URL(url);
    expect(parsed.searchParams.get('redirect_uri')).toBe(testConfig.redirectUri);
  });

  it('PKCE パラメータ（code_challenge, code_challenge_method=S256）を含む', () => {
    const challenge = 'test-challenge-abc123';
    const url = buildAuthUrl(testConfig, challenge);
    const parsed = new URL(url);
    expect(parsed.searchParams.get('code_challenge')).toBe(challenge);
    expect(parsed.searchParams.get('code_challenge_method')).toBe('S256');
  });

  it('response_type=code を含む', () => {
    const url = buildAuthUrl(testConfig, 'challenge');
    const parsed = new URL(url);
    expect(parsed.searchParams.get('response_type')).toBe('code');
  });

  it('scope 配列をスペース区切りで結合する', () => {
    const multiScopeConfig: GmailAuthConfig = {
      ...testConfig,
      scope: [
        'https://www.googleapis.com/auth/gmail.readonly',
        'https://www.googleapis.com/auth/userinfo.email',
      ],
    };
    const url = buildAuthUrl(multiScopeConfig, 'challenge');
    const parsed = new URL(url);
    const scope = parsed.searchParams.get('scope') ?? '';
    expect(scope).toContain('https://www.googleapis.com/auth/gmail.readonly');
    expect(scope).toContain('https://www.googleapis.com/auth/userinfo.email');
    expect(scope).toContain(' ');
  });

  it('access_type=offline を含む', () => {
    const url = buildAuthUrl(testConfig, 'challenge');
    const parsed = new URL(url);
    expect(parsed.searchParams.get('access_type')).toBe('offline');
  });
});

// ---- isTokenValid ----

describe('isTokenValid', () => {
  beforeEach(() => { logout(); sessionStorageMock.clear(); });
  afterEach(() => { logout(); sessionStorageMock.clear(); });

  it('トークンがない場合は false を返す', () => {
    expect(isTokenValid()).toBe(false);
  });

  it('有効なトークンが保存されている場合は true を返す', () => {
    saveToken(makeToken());
    expect(isTokenValid()).toBe(true);
  });

  it('有効期限切れのトークンは false を返す', () => {
    // expires_in: -1 で即期限切れのトークンを保存
    saveToken(makeToken({ expires_in: -1 }));
    expect(isTokenValid()).toBe(false);
  });

  it('logout 後は false を返す', () => {
    saveToken(makeToken());
    logout();
    expect(isTokenValid()).toBe(false);
  });
});

// ---- saveToken / getAccessToken / logout ----

describe('saveToken / getAccessToken / logout', () => {
  beforeEach(() => { logout(); sessionStorageMock.clear(); });
  afterEach(() => { logout(); sessionStorageMock.clear(); });

  it('saveToken でアクセストークンが保存される', () => {
    saveToken(makeToken({ access_token: 'my-access-token' }));
    expect(getAccessToken()).toBe('my-access-token');
  });

  it('saveToken でリフレッシュトークンが保存される', () => {
    saveToken(makeToken({ refresh_token: 'my-refresh-token' }));
    // getAuthState 経由でリフレッシュトークンが正しく保存されたか確認
    const state = getAuthState();
    expect(state.token?.refresh_token).toBe('my-refresh-token');
  });

  it('refresh_token がない場合は保存しない', () => {
    saveToken(makeToken());
    const state = getAuthState();
    expect(state.token?.refresh_token).toBeUndefined();
  });

  it('logout でトークンが削除される', () => {
    saveToken(makeToken({ refresh_token: 'refresh' }));
    logout();
    expect(getAccessToken()).toBeNull();
    expect(getAuthState().isAuthenticated).toBe(false);
    expect(isTokenValid()).toBe(false);
  });
});

// ---- getAuthState ----

describe('getAuthState', () => {
  beforeEach(() => { logout(); sessionStorageMock.clear(); });
  afterEach(() => { logout(); sessionStorageMock.clear(); });

  it('未認証時は isAuthenticated=false を返す', () => {
    const state = getAuthState();
    expect(state.isAuthenticated).toBe(false);
    expect(state.token).toBeNull();
    expect(state.expiresAt).toBeNull();
  });

  it('有効なトークン時は isAuthenticated=true を返す', () => {
    saveToken(makeToken());
    const state = getAuthState();
    expect(state.isAuthenticated).toBe(true);
    expect(state.token).not.toBeNull();
    expect(state.expiresAt).not.toBeNull();
  });

  it('expiresAt は将来の時刻を指す', () => {
    saveToken(makeToken({ expires_in: 3600 }));
    const state = getAuthState();
    expect(state.expiresAt).toBeGreaterThan(Date.now());
  });

  it('logout 後は未認証状態に戻る', () => {
    saveToken(makeToken());
    logout();
    const state = getAuthState();
    expect(state.isAuthenticated).toBe(false);
  });
});
