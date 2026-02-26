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

import { syncGmailTransactions, getCurrentMonthDateFilter } from '../sync';
import type { SyncResult, SyncProgress } from '@/types/gmail';

// Mock database functions
vi.mock('@/lib/database', () => ({
  initDB: vi.fn(),
  queryDB: vi.fn(),
  executeDB: vi.fn(),
}));

// Mock parsers
vi.mock('@/services/parsers', () => ({
  parse_email_debug: vi.fn(),
  detect_card_company: vi.fn(),
}));

// Mock auth functions
vi.mock('@/services/gmail/auth', () => ({
  refreshToken: vi.fn(),
  saveToken: vi.fn(),
}));

import { initDB, queryDB, executeDB } from '@/lib/database';
import { parse_email_debug, detect_card_company } from '@/services/parsers';
import { refreshToken } from '@/services/gmail/auth';

describe('getCurrentMonthDateFilter', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('当月1日〜翌月1日のフィルタ文字列を返す（2026年2月）', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-02-15T12:00:00'));
    const filter = getCurrentMonthDateFilter();
    expect(filter).toBe('after:2026/02/01 before:2026/03/01');
  });

  it('12月の場合は翌年1月になる', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-12-20T12:00:00'));
    const filter = getCurrentMonthDateFilter();
    expect(filter).toBe('after:2025/12/01 before:2026/01/01');
  });

  it('1月の場合は翌月が2月になる', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T00:00:00'));
    const filter = getCurrentMonthDateFilter();
    expect(filter).toBe('after:2026/01/01 before:2026/02/01');
  });

  it('after: と before: のフォーマットが正しい', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-10T09:00:00'));
    const filter = getCurrentMonthDateFilter();
    expect(filter).toMatch(/^after:\d{4}\/\d{2}\/01 before:\d{4}\/\d{2}\/01$/);
  });
});

describe('Gmail Sync Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    localStorage.setItem('gmail_access_token', 'mock-token');
    // Default: all emails pass the card notification pre-filter
    vi.mocked(detect_card_company).mockReturnValue('SMBC');
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
      vi.mocked(queryDB).mockResolvedValue([['msg_001']]); // getSyncedMessageIds: msg_001 already synced

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
      vi.mocked(queryDB).mockResolvedValue([]); // isDuplicateWithMerchant: no record found
      vi.mocked(parse_email_debug).mockReturnValue({ result: null, debug: 'parser=三井住友 amount=null date=null' }); // Parse fails

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
        // getMessageMetadata(msg_001)
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({
            id: 'msg_001',
            payload: {
              headers: [
                { name: 'Subject', value: 'Test' },
                { name: 'From', value: 'test@example.com' },
              ],
            },
          }),
        })
        // getMessageBody(msg_001)
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
      vi.mocked(queryDB).mockResolvedValue([]); // isDuplicateWithMerchant: no record found

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
        // getMessageMetadata(msg_001)
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({
            id: 'msg_001',
            payload: {
              headers: [
                { name: 'Subject', value: 'Test' },
                { name: 'From', value: 'test@example.com' },
              ],
            },
          }),
        })
        // getMessageBody(msg_001)
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

      vi.mocked(parse_email_debug).mockReturnValue({
        result: {
          amount: 1000,
          merchant: 'Test Merchant',
          transaction_date: '2026-02-24T00:00:00',
          card_company: 'SMBC',
          raw_text: 'test',
        },
        debug: '',
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

    it('should handle API 401 errors when no refresh token', async () => {
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

    it('should auto-refresh token and retry when 401 with valid refresh_token', async () => {
      vi.mocked(initDB).mockResolvedValue(undefined);
      vi.mocked(queryDB).mockResolvedValue([]); // isDuplicateWithMerchant: no record found

      localStorage.setItem('gmail_refresh_token', 'valid_refresh_token');

      vi.mocked(refreshToken).mockImplementation(async () => {
        localStorage.setItem('gmail_access_token', 'new_access_token');
        return {
          access_token: 'new_access_token',
          expires_in: 3600,
          token_type: 'Bearer',
          scope: 'https://www.googleapis.com/auth/gmail.readonly',
          refresh_token: 'valid_refresh_token',
        };
      });

      global.fetch = vi.fn()
        // listMessages: query 1 → 1 message
        .mockResolvedValueOnce({
          ok: true, status: 200,
          json: async () => ({ messages: [{ id: 'msg_001', threadId: 'thread_001' }] }),
        })
        // listMessages: query 2 → empty
        .mockResolvedValueOnce({
          ok: true, status: 200,
          json: async () => ({ messages: [] }),
        })
        // listMessages: query 3 → empty
        .mockResolvedValueOnce({
          ok: true, status: 200,
          json: async () => ({ messages: [] }),
        })
        // getMessageMetadata(msg_001) → success
        .mockResolvedValueOnce({
          ok: true, status: 200,
          json: async () => ({
            id: 'msg_001',
            payload: {
              headers: [
                { name: 'Subject', value: 'Test Subject' },
                { name: 'From', value: 'test@example.com' },
              ],
            },
          }),
        })
        // getMessageBody → 401 (triggers auto-refresh)
        .mockResolvedValueOnce({
          ok: false, status: 401,
        })
        // getMessageBody retry after refresh → success
        .mockResolvedValueOnce({
          ok: true, status: 200,
          json: async () => ({
            payload: {
              headers: [
                { name: 'Subject', value: 'Test Subject' },
                { name: 'From', value: 'test@example.com' },
              ],
              body: { data: '' },
            },
          }),
        });

      vi.mocked(parse_email_debug).mockReturnValue({
        result: null,
        debug: 'parser failed',
      });

      const result = await syncGmailTransactions();

      expect(refreshToken).toHaveBeenCalledWith('valid_refresh_token', expect.any(Object));
      // 認証エラーは発生していない（parse_error になる）
      expect(result.errors.every(e => !e.includes('期限切れ'))).toBe(true);
      // refresh_token は削除されていない
      expect(localStorage.getItem('gmail_refresh_token')).toBe('valid_refresh_token');

      localStorage.removeItem('gmail_refresh_token');
    });

    it('should accumulate transaction counts correctly', async () => {
      vi.mocked(initDB).mockResolvedValue(undefined);
      vi.mocked(queryDB).mockResolvedValue([]); // isDuplicateWithMerchant: no record found

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
        // getMessageMetadata(msg_001) — parallel batch
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({
            id: 'msg_001',
            payload: {
              headers: [
                { name: 'Subject', value: 'Test 1' },
                { name: 'From', value: 'test1@example.com' },
              ],
            },
          }),
        })
        // getMessageMetadata(msg_002) — parallel batch
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({
            id: 'msg_002',
            payload: {
              headers: [
                { name: 'Subject', value: 'Test 2' },
                { name: 'From', value: 'test2@example.com' },
              ],
            },
          }),
        })
        // getMessageBody(msg_001)
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
        // getMessageBody(msg_002)
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

      vi.mocked(parse_email_debug).mockReturnValue({
        result: {
          amount: 1000,
          merchant: 'Test Merchant',
          transaction_date: '2026-02-24T00:00:00',
          card_company: 'SMBC',
          raw_text: 'test',
        },
        debug: '',
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
      vi.mocked(queryDB).mockResolvedValue([]); // isDuplicateWithMerchant: no record found

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
        // getMessageMetadata for msg_html_only
        .mockResolvedValueOnce({
          ok: true, status: 200,
          json: async () => ({
            id: 'msg_html_only',
            payload: {
              headers: [
                { name: 'Subject', value: '三井住友カードご利用のお知らせ' },
                { name: 'From', value: 'notify@contact.vpass.ne.jp' },
              ],
            },
          }),
        })
        // getMessageBody for msg_html_only — HTML-only, no text/plain
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

      vi.mocked(parse_email_debug).mockReturnValue({
        result: {
          amount: 1000,
          merchant: 'テスト店舗',
          transaction_date: '2026-02-25T00:00:00.000Z',
          card_company: '三井住友',
          raw_text: '利用金額：1,000円',
        },
        debug: '',
      });
      vi.mocked(executeDB).mockResolvedValue({ changes: 1 });

      const p = syncGmailTransactions();
      await vi.runAllTimersAsync();
      const result = await p;

      // HTML body was extracted → parse_email called with non-empty body → transaction saved
      expect(result.parse_errors).toBe(0);
      expect(result.new_transactions).toBe(1);

      // parse_email_debug should have been called with the HTML-stripped body containing 利用金額
      expect(parse_email_debug).toHaveBeenCalledWith(
        'notify@contact.vpass.ne.jp',
        '三井住友カードご利用のお知らせ',
        expect.stringContaining('利用金額')
      );
    });
  });
});
