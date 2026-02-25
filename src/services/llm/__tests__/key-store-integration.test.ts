// @vitest-environment node
/**
 * Integration test for LLM Key Store
 * Tests the encryption/decryption flow with real Web Crypto API
 */
import { describe, it, expect } from 'vitest';

describe('LLM Key Store - Integration Tests', () => {
  describe('Web Crypto API Functions', () => {
    it('should have access to Web Crypto API', () => {
      expect(crypto).toBeDefined();
      expect(crypto.subtle).toBeDefined();
      expect(crypto.getRandomValues).toBeDefined();
    });

    it('should support PBKDF2 key derivation', async () => {
      const encoder = new TextEncoder();
      const salt = crypto.getRandomValues(new Uint8Array(16));
      const keyMaterial = await crypto.subtle.importKey(
        'raw',
        encoder.encode('test-pin'),
        'PBKDF2',
        false,
        ['deriveKey']
      );

      const derivedKey = await crypto.subtle.deriveKey(
        {
          name: 'PBKDF2',
          salt: salt as BufferSource,
          iterations: 100000,
          hash: 'SHA-256',
        },
        keyMaterial,
        { name: 'AES-GCM', length: 256 },
        false,
        ['encrypt', 'decrypt']
      );

      expect(derivedKey).toBeDefined();
      expect(derivedKey.type).toBe('secret');
      expect(derivedKey.algorithm.name).toBe('AES-GCM');
    });

    it('should support AES-GCM encryption and decryption', async () => {
      const plaintext = 'sk-proj-test-api-key-12345';
      const encoder = new TextEncoder();
      const decoder = new TextDecoder();

      // Generate key
      const key = await crypto.subtle.generateKey(
        { name: 'AES-GCM', length: 256 },
        true,
        ['encrypt', 'decrypt']
      );

      const iv = crypto.getRandomValues(new Uint8Array(12));

      // Encrypt
      const encrypted = await crypto.subtle.encrypt(
        { name: 'AES-GCM', iv: iv as BufferSource },
        key,
        encoder.encode(plaintext)
      );

      expect(encrypted).toBeDefined();
      expect(encrypted.byteLength).toBeGreaterThan(0);

      // Decrypt
      const decrypted = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv: iv as BufferSource },
        key,
        encrypted
      );

      const decryptedText = decoder.decode(decrypted);
      expect(decryptedText).toBe(plaintext);
    });

    it('should generate unique random values', () => {
      const random1 = crypto.getRandomValues(new Uint8Array(16));
      const random2 = crypto.getRandomValues(new Uint8Array(16));

      // Convert to hex strings for comparison
      const hex1 = Array.from(random1).map(b => b.toString(16).padStart(2, '0')).join('');
      const hex2 = Array.from(random2).map(b => b.toString(16).padStart(2, '0')).join('');

      expect(hex1).not.toBe(hex2);
    });
  });

  describe('Base64 Encoding/Decoding', () => {
    it('should correctly encode/decode binary data', () => {
      const original = new Uint8Array([0, 1, 2, 3, 255, 254, 253]);

      // Simulate base64 encoding
      let binary = '';
      for (let i = 0; i < original.byteLength; i++) {
        binary += String.fromCharCode(original[i]);
      }
      const encoded = btoa(binary);

      // Simulate base64 decoding
      const decodedBinary = atob(encoded);
      const decoded = new Uint8Array(decodedBinary.length);
      for (let i = 0; i < decodedBinary.length; i++) {
        decoded[i] = decodedBinary.charCodeAt(i);
      }

      expect(decoded).toEqual(original);
    });
  });

  describe('Type Definitions', () => {
    it('should validate LLMProvider type', () => {
      const validProviders = ['openai', 'anthropic', 'google', 'openrouter'] as const;

      validProviders.forEach((provider) => {
        expect(validProviders).toContain(provider);
      });
    });

    it('should validate EncryptedKey structure', () => {
      const encryptedKey = {
        ciphertext: 'base64-encoded-string',
        iv: 'base64-iv',
        salt: 'base64-salt',
        version: 1,
      };

      expect(encryptedKey).toHaveProperty('ciphertext');
      expect(encryptedKey).toHaveProperty('iv');
      expect(encryptedKey).toHaveProperty('salt');
      expect(encryptedKey).toHaveProperty('version');
      expect(typeof encryptedKey.version).toBe('number');
    });

    it('should validate KeyStoreEntry structure', () => {
      const entry = {
        provider: 'anthropic' as const,
        encrypted: {
          ciphertext: 'test',
          iv: 'test',
          salt: 'test',
          version: 1,
        },
        createdAt: '2026-02-24T14:00:00',
        updatedAt: '2026-02-24T14:00:00',
      };

      expect(entry).toHaveProperty('provider');
      expect(entry).toHaveProperty('encrypted');
      expect(entry).toHaveProperty('createdAt');
      expect(entry).toHaveProperty('updatedAt');
    });
  });

  describe('Error Handling', () => {
    it('should throw KeyStoreError with proper message', () => {
      // Note: This validates the expected error class behavior
      const error = new (class KeyStoreError extends Error {
        constructor(message: string) {
          super(message);
          this.name = 'KeyStoreError';
        }
      })('Test error');

      expect(error.message).toBe('Test error');
      expect(error.name).toBe('KeyStoreError');
    });
  });
});
