import type { GmailAuthConfig, OAuthToken, AuthState } from '@/types/gmail';

const STORAGE_KEYS = {
  ACCESS_TOKEN: 'gmail_access_token',
  REFRESH_TOKEN: 'gmail_refresh_token',
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
  saveToken(token);
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
  saveToken(token);
  return token;
}

/**
 * トークンをローカルストレージに保存する
 */
export function saveToken(token: OAuthToken): void {
  localStorage.setItem(STORAGE_KEYS.ACCESS_TOKEN, token.access_token);
  localStorage.setItem(STORAGE_KEYS.EXPIRES_AT, String(Date.now() + token.expires_in * 1000));
  localStorage.setItem(STORAGE_KEYS.TOKEN_TYPE, token.token_type);
  localStorage.setItem(STORAGE_KEYS.SCOPE, token.scope);
  if (token.refresh_token) {
    localStorage.setItem(STORAGE_KEYS.REFRESH_TOKEN, token.refresh_token);
  }
}

/**
 * ローカルストレージからアクセストークンを取得する
 */
export function getAccessToken(): string | null {
  return localStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN);
}

/**
 * トークンが有効かどうかを確認する（存在 + 有効期限）
 */
export function isTokenValid(): boolean {
  const token = localStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN);
  if (!token) return false;
  const expiresAt = localStorage.getItem(STORAGE_KEYS.EXPIRES_AT);
  if (!expiresAt) return false;
  return Date.now() < parseInt(expiresAt, 10);
}

/**
 * 現在の認証状態を取得する
 */
export function getAuthState(): AuthState {
  const accessToken = getAccessToken();
  const expiresAtStr = localStorage.getItem(STORAGE_KEYS.EXPIRES_AT);
  const expiresAt = expiresAtStr ? parseInt(expiresAtStr, 10) : null;
  const authenticated = isTokenValid();

  if (!authenticated || !accessToken) {
    return { isAuthenticated: false, token: null, expiresAt: null };
  }

  const storedRefreshToken = localStorage.getItem(STORAGE_KEYS.REFRESH_TOKEN);
  const oauthToken: OAuthToken = {
    access_token: accessToken,
    expires_in: expiresAt ? Math.floor((expiresAt - Date.now()) / 1000) : 0,
    token_type: localStorage.getItem(STORAGE_KEYS.TOKEN_TYPE) ?? 'Bearer',
    scope: localStorage.getItem(STORAGE_KEYS.SCOPE) ?? '',
    ...(storedRefreshToken ? { refresh_token: storedRefreshToken } : {}),
  };

  return { isAuthenticated: true, token: oauthToken, expiresAt };
}

/**
 * ログアウト（全トークン削除）
 */
export function logout(): void {
  localStorage.removeItem(STORAGE_KEYS.ACCESS_TOKEN);
  localStorage.removeItem(STORAGE_KEYS.REFRESH_TOKEN);
  localStorage.removeItem(STORAGE_KEYS.EXPIRES_AT);
  localStorage.removeItem(STORAGE_KEYS.TOKEN_TYPE);
  localStorage.removeItem(STORAGE_KEYS.SCOPE);
  sessionStorage.removeItem(STORAGE_KEYS.PKCE_VERIFIER);
}

/**
 * OAuth callback を処理する（/auth/callback ページで呼び出す）
 */
export async function handleAuthCallback(config: GmailAuthConfig): Promise<OAuthToken | null> {
  const params = new URLSearchParams(window.location.search);
  const code = params.get('code');
  const verifier = sessionStorage.getItem(STORAGE_KEYS.PKCE_VERIFIER);

  if (!code || !verifier) {
    return null;
  }

  return exchangeCodeForToken(code, verifier, config);
}
