import { executeDB, initDB, queryDB } from '../../lib/database';
import {
  EncryptedKey,
  KeyStoreEntry,
  KeyStoreError,
  LLMProvider,
} from '../../types/llm';

const SCHEMA_SQL = `
  CREATE TABLE IF NOT EXISTS llm_keys (
    provider TEXT PRIMARY KEY,
    encrypted_data TEXT NOT NULL,
    iv TEXT NOT NULL,
    salt TEXT NOT NULL,
    version INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
`;

const SUPPORTED_PROVIDERS: LLMProvider[] = ['openai', 'anthropic', 'google', 'openrouter'];

/**
 * Initialize the LLM key store table
 */
export async function initKeyStore(): Promise<void> {
  await initDB();
  await executeDB(SCHEMA_SQL);
}

/**
 * Derive AES-256 encryption key from user PIN using PBKDF2
 */
async function deriveKey(
  pin: string,
  salt: Uint8Array
): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(pin),
    'PBKDF2',
    false,
    ['deriveKey']
  );

  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt as unknown as BufferSource,
      iterations: 100000,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

/**
 * Encrypt API key using AES-GCM
 */
async function encryptKey(
  apiKey: string,
  userPin: string
): Promise<EncryptedKey> {
  const encoder = new TextEncoder();
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));

  const encKey = await deriveKey(userPin, salt);

  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: iv as BufferSource },
    encKey,
    encoder.encode(apiKey)
  );

  return {
    ciphertext: arrayBufferToBase64(new Uint8Array(encrypted)),
    iv: arrayBufferToBase64(iv),
    salt: arrayBufferToBase64(salt),
    version: 1,
  };
}

/**
 * Decrypt API key using AES-GCM
 */
async function decryptKey(
  encrypted: EncryptedKey,
  userPin: string
): Promise<string> {
  try {
    const salt = base64ToUint8Array(encrypted.salt);
    const iv = base64ToUint8Array(encrypted.iv);
    const ciphertext = base64ToUint8Array(encrypted.ciphertext);

    const encKey = await deriveKey(userPin, salt);

    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: iv as unknown as BufferSource },
      encKey,
      ciphertext as unknown as BufferSource
    );

    return new TextDecoder().decode(decrypted);
  } catch (error) {
    throw new KeyStoreError('Failed to decrypt API key. PIN may be incorrect.');
  }
}

/**
 * Save LLM API key encrypted in the database
 */
export async function saveKey(
  provider: LLMProvider,
  apiKey: string,
  userPin: string
): Promise<void> {
  if (!SUPPORTED_PROVIDERS.includes(provider)) {
    throw new KeyStoreError(`Unsupported provider: ${provider}`);
  }

  await initKeyStore();

  const encrypted = await encryptKey(apiKey, userPin);

  await executeDB(
    `INSERT OR REPLACE INTO llm_keys (provider, encrypted_data, iv, salt, version, updated_at)
     VALUES (?, ?, ?, ?, ?, datetime('now'))`,
    [
      provider,
      encrypted.ciphertext,
      encrypted.iv,
      encrypted.salt,
      encrypted.version,
    ]
  );
}

/**
 * Load and decrypt LLM API key
 */
export async function loadKey(
  provider: LLMProvider,
  userPin: string
): Promise<string | null> {
  await initKeyStore();

  const rows = await queryDB<[string, string, string]>(
    'SELECT encrypted_data, iv, salt FROM llm_keys WHERE provider = ?',
    [provider]
  );

  if (rows.length === 0) {
    return null;
  }

  const [ciphertext, iv, salt] = rows[0];
  const encrypted: EncryptedKey = {
    ciphertext,
    iv,
    salt,
    version: 1,
  };

  return decryptKey(encrypted, userPin);
}

/**
 * Delete LLM API key
 */
export async function deleteKey(provider: LLMProvider): Promise<void> {
  await initKeyStore();
  await executeDB('DELETE FROM llm_keys WHERE provider = ?', [provider]);
}

/**
 * Check if key exists for provider
 */
export async function hasKey(provider: LLMProvider): Promise<boolean> {
  await initKeyStore();

  const rows = await queryDB<[number]>(
    'SELECT COUNT(*) FROM llm_keys WHERE provider = ?',
    [provider]
  );

  return rows.length > 0 && rows[0][0] > 0;
}

/**
 * List all stored LLM providers
 */
export async function listProviders(): Promise<LLMProvider[]> {
  await initKeyStore();

  const rows = await queryDB<[LLMProvider]>(
    'SELECT provider FROM llm_keys ORDER BY updated_at DESC'
  );

  return rows.map((row) => row[0]);
}

/**
 * Get metadata for stored keys (without decrypting)
 */
export async function listKeyMetadata(): Promise<KeyStoreEntry[]> {
  await initKeyStore();

  const rows = await queryDB<[LLMProvider, string, string, string, number, string, string]>(
    `SELECT provider, encrypted_data, iv, salt, version, created_at, updated_at
     FROM llm_keys ORDER BY updated_at DESC`
  );

  return rows.map(([provider, ciphertext, iv, salt, version, createdAt, updatedAt]) => ({
    provider,
    encrypted: {
      ciphertext,
      iv,
      salt,
      version,
    },
    createdAt,
    updatedAt,
  }));
}

/**
 * Helper: Convert Uint8Array to Base64
 */
function arrayBufferToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

/**
 * Helper: Convert Base64 to Uint8Array
 */
function base64ToUint8Array(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}
