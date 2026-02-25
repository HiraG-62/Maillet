export type LLMProvider = 'openai' | 'anthropic' | 'google' | 'openrouter';

export interface LLMConfig {
  provider: LLMProvider;
  apiKey: string; // 暗号化後はUIには表示しない
  model?: string;
  baseUrl?: string; // カスタムエンドポイント用
}

export interface EncryptedKey {
  ciphertext: string; // Base64エンコードされた暗号文
  iv: string; // Base64エンコードされた初期化ベクトル
  salt: string; // Base64エンコードされたソルト
  version: number; // 暗号化スキーマバージョン
}

export interface KeyStoreEntry {
  provider: LLMProvider;
  encrypted: EncryptedKey;
  createdAt: string; // ISO 8601
  updatedAt: string;
}

export class KeyStoreError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'KeyStoreError';
  }
}
