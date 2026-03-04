import type { GmailAuthConfig, OAuthToken, AuthState } from '@/types/gmail';
import {
  saveRefreshToken,
  loadRefreshToken,
  deleteRefreshToken,
  migrateTokensFromLocalStorage,
} from './token-store';

const STORAGE_KEYS = {
  ACCESS_TOKEN: 'gmail_access_token',
  EXPIRES_AT: 'gmail_expires_at',
  TOKEN_TYPE: 'gmail_token_type',
  SCOPE: 'gmail_scope',
  PKCE_VERIFIER: 'pkce_verifier',
} as const;

export class AuthError extends Error {
  constructor(
    message: string,
    public readonly code: string
  ) {
    super(message);
    this.name = 'AuthError';
  }
}

/**
 * PKCE code_verifier を生成（43-128 文字の URL-safe base64 文字列）
 */
export function generateCodeVerifier(): string {
  const array = new Uint8Array(64);
  crypto.getRandomValues(array);
  return btoa(String.fromCharCode(...array))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

/**
 * code_verifier から code_challenge を生成（SHA-256 + base64url）
 */
export async function generateCodeChallenge(verifier: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(verifier);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return btoa(String.fromCharCode(...new Uint8Array(digest)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

/**
 * Google OAuth 認証 URL を生成する
 */
export function buildAuthUrl(config: GmailAuthConfig, codeChallenge: string): string {
  const params = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: config.redirectUri,
    response_type: 'code',
    scope: config.scope.join(' '),
    code_challenge: codeChallenge,
    code_challenge_method: 'S256',
    access_type: 'offline',
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
}

/**
 * OAuth 認証開始 — Google の同意画面にリダイレクト
 */
export async function startGmailAuth(config: GmailAuthConfig): Promise<void> {
  const verifier = generateCodeVerifier();
  const challenge = await generateCodeChallenge(verifier);
  sessionStorage.setItem(STORAGE_KEYS.PKCE_VERIFIER, verifier);
  window.location.href = buildAuthUrl(config, challenge);
}

/**
 * 認証コードをアクセストークンに交換する
 */
export async function exchangeCodeForToken(
  code: string,
  verifier: string,
  config: GmailAuthConfig
): Promise<OAuthToken> {
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: config.clientId,
      redirect_uri: config.redirectUri,
      code_verifier: verifier,
      grant_type: 'authorization_code',
      ...(config.clientSecret ? { client_secret: config.clientSecret } : {}),
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new AuthError(`Token exchange failed: ${errorText}`, 'TOKEN_EXCHANGE_FAILED');
  }

  const token = (await response.json()) as OAuthToken;
  await saveToken(token);
  sessionStorage.removeItem(STORAGE_KEYS.PKCE_VERIFIER);
  return token;
}

/**
 * リフレッシュトークンを使ってアクセストークンを更新する
 */
export async function refreshToken(
  refreshTokenStr: string,
  config: GmailAuthConfig
): Promise<OAuthToken> {
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      refresh_token: refreshTokenStr,
      client_id: config.clientId,
      grant_type: 'refresh_token',
      ...(config.clientSecret ? { client_secret: config.clientSecret } : {}),
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new AuthError(`Token refresh failed: ${errorText}`, 'TOKEN_REFRESH_FAILED');
  }

  const token = (await response.json()) as OAuthToken;
  // refresh_token はリフレッシュ時に返されないことがある。既存値を保持
  if (!token.refresh_token) {
    token.refresh_token = refreshTokenStr;
  }
  await saveToken(token);
  return token;
}

/**
 * トークンを保存する
 * access_token等の短命データ → sessionStorage
 * refresh_token → IndexedDB暗号化保存
 */
export async function saveToken(token: OAuthToken): Promise<void> {
  sessionStorage.setItem(STORAGE_KEYS.ACCESS_TOKEN, token.access_token);
  sessionStorage.setItem(STORAGE_KEYS.EXPIRES_AT, String(Date.now() + token.expires_in * 1000));
  sessionStorage.setItem(STORAGE_KEYS.TOKEN_TYPE, token.token_type);
  sessionStorage.setItem(STORAGE_KEYS.SCOPE, token.scope);
  if (token.refresh_token) {
    await saveRefreshToken(token.refresh_token);
  }
}

/**
 * sessionStorageからアクセストークンを取得する
 */
export function getAccessToken(): string | null {
  return sessionStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN);
}

/**
 * トークンが有効かどうかを確認する（存在 + 有効期限）
 */
export function isTokenValid(): boolean {
  const token = sessionStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN);
  if (!token) return false;
  const expiresAt = sessionStorage.getItem(STORAGE_KEYS.EXPIRES_AT);
  if (!expiresAt) return false;
  return Date.now() < parseInt(expiresAt, 10);
}

/**
 * 現在の認証状態を取得する
 * refresh_tokenはIndexedDBから非同期で読み取る
 */
export async function getAuthState(): Promise<AuthState> {
  await migrateTokensFromLocalStorage();

  const accessToken = getAccessToken();
  const expiresAtStr = sessionStorage.getItem(STORAGE_KEYS.EXPIRES_AT);
  const expiresAt = expiresAtStr ? parseInt(expiresAtStr, 10) : null;
  const authenticated = isTokenValid();

  if (!authenticated || !accessToken) {
    const storedRefresh = await loadRefreshToken();
    return {
      isAuthenticated: false,
      token: storedRefresh ? { access_token: '', expires_in: 0, token_type: 'Bearer', scope: '', refresh_token: storedRefresh } : null,
      expiresAt: null,
    };
  }

  const storedRefreshToken = await loadRefreshToken();
  const oauthToken: OAuthToken = {
    access_token: accessToken,
    expires_in: expiresAt ? Math.floor((expiresAt - Date.now()) / 1000) : 0,
    token_type: sessionStorage.getItem(STORAGE_KEYS.TOKEN_TYPE) ?? 'Bearer',
    scope: sessionStorage.getItem(STORAGE_KEYS.SCOPE) ?? '',
    ...(storedRefreshToken ? { refresh_token: storedRefreshToken } : {}),
  };

  return { isAuthenticated: true, token: oauthToken, expiresAt };
}

/**
 * ログアウト（全トークン削除）
 */
export async function logout(): Promise<void> {
  sessionStorage.removeItem(STORAGE_KEYS.ACCESS_TOKEN);
  sessionStorage.removeItem(STORAGE_KEYS.EXPIRES_AT);
  sessionStorage.removeItem(STORAGE_KEYS.TOKEN_TYPE);
  sessionStorage.removeItem(STORAGE_KEYS.SCOPE);
  sessionStorage.removeItem(STORAGE_KEYS.PKCE_VERIFIER);
  // Clean up any remaining localStorage keys from pre-migration
  localStorage.removeItem('gmail_access_token');
  localStorage.removeItem('gmail_refresh_token');
  localStorage.removeItem('gmail_expires_at');
  localStorage.removeItem('gmail_token_type');
  localStorage.removeItem('gmail_scope');
  await deleteRefreshToken();
}

/**
 * OAuth callback を処理する（/auth/callback ページで呼び出す）
 * Singleton promise パターン: 複数の useAuth() インスタンスが同時に呼んでも
 * token exchange は1回だけ実行される（authorization code 二重使用による 400 を防止）
 */
let _callbackPromise: Promise<OAuthToken | null> | null = null;

export async function handleAuthCallback(config: GmailAuthConfig): Promise<OAuthToken | null> {
  if (_callbackPromise) {
    return _callbackPromise;
  }

  const params = new URLSearchParams(window.location.search);
  const code = params.get('code');
  const verifier = sessionStorage.getItem(STORAGE_KEYS.PKCE_VERIFIER);

  if (!code || !verifier) {
    return null;
  }

  _callbackPromise = exchangeCodeForToken(code, verifier, config);
  try {
    return await _callbackPromise;
  } finally {
    _callbackPromise = null;
  }
}
