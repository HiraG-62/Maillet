import { db, type SecureStoreRow } from '@/lib/database';
import { initDB } from '@/lib/database';

const CRYPTO_KEY_ID = 'gmail_token_crypto_key';
const REFRESH_TOKEN_ID = 'gmail_encrypted_refresh_token';

function arrayBufferToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function base64ToUint8Array(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

async function getOrCreateCryptoKey(): Promise<CryptoKey> {
  await initDB();
  const stored = await db.secure_store.get(CRYPTO_KEY_ID);
  if (stored?.value && stored.value instanceof CryptoKey) {
    return stored.value;
  }

  const key = await crypto.subtle.generateKey(
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );

  await db.secure_store.put({ key: CRYPTO_KEY_ID, value: key } as SecureStoreRow);
  return key;
}

export async function saveRefreshToken(token: string): Promise<void> {
  const cryptoKey = await getOrCreateCryptoKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encoder = new TextEncoder();

  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    cryptoKey,
    encoder.encode(token)
  );

  await db.secure_store.put({
    key: REFRESH_TOKEN_ID,
    value: {
      encrypted_data: arrayBufferToBase64(new Uint8Array(encrypted)),
      iv: arrayBufferToBase64(iv),
    },
  } as SecureStoreRow);
}

export async function loadRefreshToken(): Promise<string | null> {
  try {
    await initDB();
    const stored = await db.secure_store.get(REFRESH_TOKEN_ID);
    if (!stored?.value || typeof stored.value !== 'object') return null;

    const { encrypted_data, iv } = stored.value as {
      encrypted_data: string;
      iv: string;
    };
    if (!encrypted_data || !iv) return null;

    const cryptoKey = await getOrCreateCryptoKey();
    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: base64ToUint8Array(iv) as unknown as BufferSource },
      cryptoKey,
      base64ToUint8Array(encrypted_data) as unknown as BufferSource
    );

    return new TextDecoder().decode(decrypted);
  } catch {
    return null;
  }
}

export async function deleteRefreshToken(): Promise<void> {
  await initDB();
  await db.secure_store.delete(REFRESH_TOKEN_ID);
}

export async function migrateTokensFromLocalStorage(): Promise<void> {
  const oldRefreshToken = localStorage.getItem('gmail_refresh_token');
  if (!oldRefreshToken) return;

  await saveRefreshToken(oldRefreshToken);

  const oldAccessToken = localStorage.getItem('gmail_access_token');
  if (oldAccessToken) {
    sessionStorage.setItem('gmail_access_token', oldAccessToken);
  }
  const oldExpiresAt = localStorage.getItem('gmail_expires_at');
  if (oldExpiresAt) {
    sessionStorage.setItem('gmail_expires_at', oldExpiresAt);
  }
  const oldTokenType = localStorage.getItem('gmail_token_type');
  if (oldTokenType) {
    sessionStorage.setItem('gmail_token_type', oldTokenType);
  }
  const oldScope = localStorage.getItem('gmail_scope');
  if (oldScope) {
    sessionStorage.setItem('gmail_scope', oldScope);
  }

  localStorage.removeItem('gmail_access_token');
  localStorage.removeItem('gmail_refresh_token');
  localStorage.removeItem('gmail_expires_at');
  localStorage.removeItem('gmail_token_type');
  localStorage.removeItem('gmail_scope');
}
