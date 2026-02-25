// @vitest-environment node
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';

// localStorage mock for Node.js environment
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

import { syncGmailTransactions } from '../sync';
import type { SyncResult, SyncProgress } from '@/types/gmail';

// Mock database functions
vi.mock('@/lib/database', () => ({
  initDB: vi.fn(),
  queryDB: vi.fn(),
  executeDB: vi.fn(),
}));

// Mock parsers
vi.mock('@/services/parsers', () => ({
  parse_email: vi.fn(),
}));

import { initDB, queryDB, executeDB } from '@/lib/database';
import { parse_email } from '@/services/parsers';

describe('Gmail Sync Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    localStorage.setItem('gmail_access_token', 'mock-token');
  });

  afterEach(() => {
    vi.useRealTimers();
    localStorage.removeItem('gmail_access_token');
  });

  describe('decodeEmailBody', () => {
    it('should decode base64url string correctly', () => {
      // Test: Standard base64url (Gmail format with URL-safe characters)
      const encoded = 'SGVsbG8gV29ybGQ'; // "Hello World"
      const padded = encoded + '='.repeat((4 - (encoded.length % 4)) % 4);
      const binary = atob(padded.replace(/-/g, '+').replace(/_/g, '/'));
      const decoded = new TextDecoder().decode(
        new Uint8Array(binary.split('').map(c => c.charCodeAt(0)))
      );
      expect(decoded).toBe('Hello World');
    });

    it('should handle base64url with - and _ characters', () => {
      // Gmail often uses URL-safe characters: - instead of +, _ instead of /
      const encoded = 'VGVzdC1EZWN_ZQ'; // Test-Decode in base64url
      const padded = encoded + '='.repeat((4 - (encoded.length % 4)) % 4);
      const binary = atob(padded.replace(/-/g, '+').replace(/_/g, '/'));
      const decoded = new TextDecoder().decode(
        new Uint8Array(binary.split('').map(c => c.charCodeAt(0)))
      );
      expect(decoded).toContain('Test');
    });

    it('should handle UTF-8 encoded strings', () => {
      // UTF-8: "日本語" encoded as base64
      const encoded = '5pel5pys6Kqe';
      const padded = encoded + '='.repeat((4 - (encoded.length % 4)) % 4);
      const binary = atob(padded.replace(/-/g, '+').replace(/_/g, '/'));
      const decoded = new TextDecoder().decode(
        new Uint8Array(binary.split('').map(c => c.charCodeAt(0)))
      );
      expect(decoded).toBe('日本語');
    });
  });

  describe('SyncResult initialization', () => {
    it('should initialize with correct default values', () => {
      const result: SyncResult = {
        total_fetched: 0,
        new_transactions: 0,
        duplicates_skipped: 0,
        parse_errors: 0,
        errors: [],
      };

      expect(result.total_fetched).toBe(0);
      expect(result.new_transactions).toBe(0);
      expect(result.duplicates_skipped).toBe(0);
      expect(result.parse_errors).toBe(0);
      expect(result.errors).toHaveLength(0);
    });

    it('should accumulate error messages', () => {
      const result: SyncResult = {
        total_fetched: 0,
        new_transactions: 0,
        duplicates_skipped: 0,
        parse_errors: 0,
        errors: [],
      };

      result.errors.push('Error 1');
      result.errors.push('Error 2');

      expect(result.errors).toHaveLength(2);
      expect(result.errors).toEqual(['Error 1', 'Error 2']);
    });
  });

  describe('syncGmailTransactions with mocked API', () => {
    it('should return SyncResult with 0 messages when no emails found', async () => {
      vi.mocked(initDB).mockResolvedValue(undefined);

      // Mock gmailFetch to return no messages
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ messages: [] }),
      });

      const result = await syncGmailTransactions();

      expect(result.total_fetched).toBe(0);
      expect(result.new_transactions).toBe(0);
      expect(result.duplicates_skipped).toBe(0);
      expect(initDB).toHaveBeenCalled();
    });

    it('should skip duplicate transactions', async () => {
      vi.mocked(initDB).mockResolvedValue(undefined);
      vi.mocked(queryDB).mockResolvedValue([[1]]); // isDuplicate returns true

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          messages: [{ id: 'msg_001', threadId: 'thread_001' }],
        }),
      });

      const result = await syncGmailTransactions();

      expect(result.total_fetched).toBe(1);
      expect(result.duplicates_skipped).toBe(1);
      expect(result.new_transactions).toBe(0);
    });

    it('should handle parse errors gracefully', async () => {
      vi.mocked(initDB).mockResolvedValue(undefined);
      vi.mocked(queryDB).mockResolvedValue([[0]]); // isDuplicate returns false
      vi.mocked(parse_email).mockReturnValue(null); // Parse fails

      global.fetch = vi.fn()
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({
            messages: [{ id: 'msg_001', threadId: 'thread_001' }],
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({ messages: [] }),
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({ messages: [] }),
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({
            payload: {
              headers: [
                { name: 'Subject', value: 'Test' },
                { name: 'From', value: 'test@example.com' },
              ],
              body: { data: '' },
            },
          }),
        });

      const result = await syncGmailTransactions();

      expect(result.parse_errors).toBe(1);
      expect(result.new_transactions).toBe(0);
    });

    it('should call progress callback with correct status updates', async () => {
      vi.mocked(initDB).mockResolvedValue(undefined);
      vi.mocked(queryDB).mockResolvedValue([[0]]); // isDuplicate returns false

      global.fetch = vi.fn()
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({
            messages: [{ id: 'msg_001', threadId: 'thread_001' }],
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({ messages: [] }),
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({ messages: [] }),
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({
            payload: {
              headers: [
                { name: 'Subject', value: 'Test' },
                { name: 'From', value: 'test@example.com' },
              ],
              body: { data: '' },
            },
          }),
        });

      vi.mocked(parse_email).mockReturnValue({
        amount: 1000,
        merchant: 'Test Merchant',
        transaction_date: '2026-02-24T00:00:00',
        card_company: 'SMBC',
        raw_text: 'test',
      });

      vi.mocked(executeDB).mockResolvedValue({ changes: 1 });

      const progressUpdates: SyncProgress[] = [];
      const p = syncGmailTransactions(progress => {
        progressUpdates.push(progress);
      });
      await vi.runAllTimersAsync();
      const result = await p;

      // Should have at least a final 'done' status
      const finalUpdate = progressUpdates[progressUpdates.length - 1];
      expect(finalUpdate.status).toBe('done');
      expect(finalUpdate.percentage).toBe(100);
      expect(result.new_transactions).toBe(1);
    });

    it('should handle authentication errors', async () => {
      localStorage.removeItem('gmail_access_token'); // No token
      vi.mocked(initDB).mockResolvedValue(undefined);

      const result = await syncGmailTransactions();

      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0]).toContain('未認証');
    });

    it('should handle API 401 errors', async () => {
      vi.mocked(initDB).mockResolvedValue(undefined);

      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        json: async () => ({}),
      });

      const result = await syncGmailTransactions();

      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0]).toContain('期限切れ');
    });

    it('should accumulate transaction counts correctly', async () => {
      vi.mocked(initDB).mockResolvedValue(undefined);
      vi.mocked(queryDB).mockResolvedValue([[0]]); // All are new

      global.fetch = vi.fn()
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({
            messages: [
              { id: 'msg_001', threadId: 'thread_001' },
              { id: 'msg_002', threadId: 'thread_002' },
            ],
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({ messages: [] }),
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({ messages: [] }),
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({
            payload: {
              headers: [
                { name: 'Subject', value: 'Test 1' },
                { name: 'From', value: 'test1@example.com' },
              ],
              body: { data: '' },
            },
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({
            payload: {
              headers: [
                { name: 'Subject', value: 'Test 2' },
                { name: 'From', value: 'test2@example.com' },
              ],
              body: { data: '' },
            },
          }),
        });

      vi.mocked(parse_email).mockReturnValue({
        amount: 1000,
        merchant: 'Test Merchant',
        transaction_date: '2026-02-24T00:00:00',
        card_company: 'SMBC',
        raw_text: 'test',
      });

      vi.mocked(executeDB).mockResolvedValue({ changes: 1 });

      const p = syncGmailTransactions();
      await vi.runAllTimersAsync();
      const result = await p;

      expect(result.total_fetched).toBe(2);
      expect(result.new_transactions).toBe(2);
    });

    it('should extract body from HTML-only emails (no text/plain part)', async () => {
      vi.mocked(initDB).mockResolvedValue(undefined);
      vi.mocked(queryDB).mockResolvedValue([[0]]); // not duplicate

      // HTML-only email body in base64 (Node.js Buffer)
      // Content: "<p>利用金額：1,000円</p>"
      const htmlBody = '<p>利用金額：1,000円</p>';
      const htmlBase64 = Buffer.from(htmlBody, 'utf-8').toString('base64');

      global.fetch = vi.fn()
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({
            messages: [{ id: 'msg_html_only', threadId: 'thread_html' }],
          }),
        })
        // Other CARD_EMAIL_QUERIES return empty
        .mockResolvedValueOnce({
          ok: true, status: 200,
          json: async () => ({ messages: [] }),
        })
        .mockResolvedValueOnce({
          ok: true, status: 200,
          json: async () => ({ messages: [] }),
        })
        // getMessage for msg_html_only — HTML-only, no text/plain
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({
            payload: {
              mimeType: 'multipart/alternative',
              headers: [
                { name: 'Subject', value: '三井住友カードご利用のお知らせ' },
                { name: 'From', value: 'notify@contact.vpass.ne.jp' },
              ],
              body: { size: 0 },
              parts: [
                {
                  mimeType: 'text/html',
                  body: { data: htmlBase64 },
                },
              ],
            },
          }),
        });

      vi.mocked(parse_email).mockReturnValue({
        amount: 1000,
        merchant: 'テスト店舗',
        transaction_date: '2026-02-25T00:00:00.000Z',
        card_company: '三井住友',
        raw_text: '利用金額：1,000円',
      });
      vi.mocked(executeDB).mockResolvedValue({ changes: 1 });

      const p = syncGmailTransactions();
      await vi.runAllTimersAsync();
      const result = await p;

      // HTML body was extracted → parse_email called with non-empty body → transaction saved
      expect(result.parse_errors).toBe(0);
      expect(result.new_transactions).toBe(1);

      // parse_email should have been called with the HTML-stripped body containing 利用金額
      expect(parse_email).toHaveBeenCalledWith(
        'notify@contact.vpass.ne.jp',
        '三井住友カードご利用のお知らせ',
        expect.stringContaining('利用金額')
      );
    });
  });
});
