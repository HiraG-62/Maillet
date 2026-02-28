import type { GmailMessage, SyncResult, SyncProgress, GmailAuthConfig, SyncDateRange } from '@/types/gmail';
import { parse_email_debug, detect_card_company } from '@/services/parsers';
import { initDB, executeDB } from '@/lib/database';
import { getSyncedMessageIds } from '@/lib/transactions';
import { refreshToken } from './auth';

const GMAIL_API_BASE = 'https://gmail.googleapis.com/gmail/v1/users/me';

function getGmailConfig(): GmailAuthConfig {
  return {
    clientId: import.meta.env.VITE_GOOGLE_CLIENT_ID ?? '',
    clientSecret: import.meta.env.VITE_GOOGLE_CLIENT_SECRET,
    redirectUri: `${window.location.origin}${import.meta.env.BASE_URL}`,
    scope: ['https://www.googleapis.com/auth/gmail.readonly'],
  };
}

// Card notification email subjects
const CARD_EMAIL_QUERIES = [
  'subject:ご利用のお知らせ',
  'subject:カードご利用確認',
  'subject:ご利用代金明細',
];

/**
 * Gmail API request with authentication and automatic token refresh on 401
 */
async function gmailFetch(
  path: string,
  options: RequestInit = {},
  _retry = false
): Promise<Record<string, unknown>> {
  const token = localStorage.getItem('gmail_access_token');
  if (!token) throw new Error('Gmail未認証');

  const response = await fetch(`${GMAIL_API_BASE}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });

  if (response.status === 401) {
    if (!_retry) {
      const storedRefreshToken = localStorage.getItem('gmail_refresh_token');
      if (storedRefreshToken) {
        try {
          await refreshToken(storedRefreshToken, getGmailConfig());
          return gmailFetch(path, options, true);
        } catch {
          // リフレッシュ失敗 → トークン削除して再認証要求
        }
      }
    }
    localStorage.removeItem('gmail_access_token');
    localStorage.removeItem('gmail_refresh_token');
    throw new Error('Gmail認証期限切れ。再認証が必要です。');
  }

  if (!response.ok) {
    throw new Error(`Gmail API error: ${response.status}`);
  }

  return response.json();
}

/**
 * 当月の Gmail API 日付フィルタ文字列を生成する
 * 例: "after:2026/02/01 before:2026/03/01"
 */
export function getCurrentMonthDateFilter(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth(); // 0-indexed (0=Jan, 1=Feb, ...)
  const startMonth = String(month + 1).padStart(2, '0');
  // 翌月の1日 = 当月末の翌日
  const nextMonth = new Date(year, month + 1, 1);
  const endYear = nextMonth.getFullYear();
  const endMonth = String(nextMonth.getMonth() + 1).padStart(2, '0');
  return `after:${year}/${startMonth}/01 before:${endYear}/${endMonth}/01`;
}

function formatGmailDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}/${m}/${d}`;
}

/**
 * Fetch message list
 */
async function listMessages(
  query: string,
  maxResults = 50
): Promise<Array<{ id: string; threadId: string }>> {
  const params = new URLSearchParams({ q: query, maxResults: String(maxResults) });
  const data = (await gmailFetch(`/messages?${params}`)) as unknown as {
    messages?: Array<{ id: string; threadId: string }>;
  };
  return data.messages || [];
}

/**
 * Decode base64url string (Gmail format)
 */
function decodeBase64Url(data: string): string {
  // Add padding if needed
  const padded = data + '='.repeat((4 - (data.length % 4)) % 4);
  const binary = atob(padded.replace(/-/g, '+').replace(/_/g, '/'));
  return new TextDecoder().decode(new Uint8Array(binary.split('').map(c => c.charCodeAt(0))));
}

/**
 * Strip HTML tags and decode common HTML entities for text extraction
 */
function stripHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(?:p|div|tr|li|h[1-6])>/gi, '\n')
    .replace(/<\/td>/gi, ' ')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&yen;/g, '¥')
    .replace(/&#165;/g, '¥')
    .replace(/\r\n|\r/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/**
 * Extract email body recursively from MIME parts
 */
function extractBody(
  part: Record<string, unknown>,
  textParts: string[],
  htmlParts: string[]
): void {
  const mimeType = part.mimeType as string | undefined;
  const bodyObj = part.body as Record<string, unknown> | undefined;

  if (mimeType === 'text/plain' && bodyObj && typeof bodyObj.data === 'string') {
    textParts.push(decodeBase64Url(bodyObj.data));
  } else if (mimeType === 'text/html' && bodyObj && typeof bodyObj.data === 'string') {
    htmlParts.push(decodeBase64Url(bodyObj.data));
  }

  if (Array.isArray(part.parts)) {
    for (const subpart of part.parts) {
      if (typeof subpart === 'object' && subpart !== null) {
        extractBody(subpart as Record<string, unknown>, textParts, htmlParts);
      }
    }
  }
}

/**
 * Fetch message metadata only (subject and from address) — lightweight, no body
 */
async function getMessageMetadata(
  messageId: string
): Promise<{ subject: string; fromAddress: string }> {
  const data = (await gmailFetch(
    `/messages/${messageId}?format=metadata&metadataHeaders=Subject&metadataHeaders=From&fields=id,payload/headers`
  )) as unknown as GmailMessage;

  const headers = data.payload?.headers || [];
  const subject = headers.find(h => h.name === 'Subject')?.value || '';
  const fromAddress = headers.find(h => h.name === 'From')?.value || '';
  return { subject, fromAddress };
}

/**
 * Fetch full message body (fields restricted to payload for efficiency)
 */
async function getMessageBody(messageId: string): Promise<string> {
  const data = (await gmailFetch(
    `/messages/${messageId}?format=full&fields=id,payload`
  )) as unknown as GmailMessage;

  const textParts: string[] = [];
  const htmlParts: string[] = [];
  extractBody(data.payload as unknown as Record<string, unknown>, textParts, htmlParts);
  // Prefer text/plain; fallback to stripped text/html (many Japanese card emails are HTML-only)
  return textParts.length > 0
    ? textParts.join('\n')
    : htmlParts.length > 0
      ? stripHtml(htmlParts.join('\n'))
      : '';
}

/**
 * Save transaction to database
 */
async function saveTransaction(
  gmailMessageId: string,
  fromAddress: string,
  subject: string,
  amount: number,
  merchant: string,
  transactionDate: string,
  cardCompany: string
): Promise<void> {
  await executeDB(
    `INSERT INTO card_transactions
      (card_company, amount, merchant, transaction_date, description,
       gmail_message_id, email_from, email_subject, is_verified)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      cardCompany,
      amount,
      merchant,
      transactionDate,
      '',
      gmailMessageId,
      fromAddress,
      subject,
      0,
    ]
  );
}

interface ProcessResult {
  saved: boolean;
  parseError: boolean;
  errorMsg?: string;
}

/**
 * Fetch, parse, and save a single message
 */
async function processMessage(msg: { id: string }): Promise<ProcessResult> {
  try {
    // Step 1: Lightweight metadata fetch (subject + from only)
    const { subject, fromAddress } = await getMessageMetadata(msg.id);

    // Step 2: Pre-filter — skip emails not recognized as card notifications
    if (!detect_card_company(subject, fromAddress)) {
      return { saved: false, parseError: false };
    }

    // Step 3: Full body fetch (only for confirmed card notification emails)
    const body = await getMessageBody(msg.id);
    const { result: parsed, debug: parseDebug } = parse_email_debug(fromAddress, subject, body);

    if (!parsed) {
      const preview = body.length > 0 ? body.slice(0, 80).replace(/\n/g, ' ') : '(本文空)';
      return {
        saved: false,
        parseError: true,
        errorMsg: `Could not parse email ${msg.id}: from="${fromAddress}" subj="${subject}" body_len=${body.length} preview="${preview}" [${parseDebug}]`,
      };
    }

    await saveTransaction(
      msg.id,
      fromAddress,
      subject,
      parsed.amount,
      parsed.merchant,
      parsed.transaction_date,
      parsed.card_company
    );
    return { saved: true, parseError: false };
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    return { saved: false, parseError: false, errorMsg: `Failed to process email ${msg.id}: ${errMsg}` };
  }
}

/**
 * Main sync function
 */
export async function syncGmailTransactions(
  onProgress: (progress: SyncProgress) => void = () => {},
  dateRange?: SyncDateRange
): Promise<SyncResult> {
  const result: SyncResult = {
    total_fetched: 0,
    new_transactions: 0,
    duplicates_skipped: 0,
    parse_errors: 0,
    errors: [],
  };

  try {
    await initDB();

    // Fetch all card notification emails
    const allMessages = [];
    const dateFilter = dateRange
      ? `after:${formatGmailDate(dateRange.after)} before:${formatGmailDate(dateRange.before)}`
      : getCurrentMonthDateFilter();
    for (const query of CARD_EMAIL_QUERIES) {
      try {
        const msgs = await listMessages(`${query} ${dateFilter}`, 500);
        allMessages.push(...msgs);
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : String(err);
        result.errors.push(`Query '${query}' failed: ${errMsg}`);
      }
    }

    // Remove duplicates by message ID
    const uniqueMessages = Array.from(
      new Map(allMessages.map(m => [m.id, m])).values()
    );
    result.total_fetched = uniqueMessages.length;

    // Diff sync: pre-filter already-synced messages (1 DB query)
    const syncedIds = new Set(await getSyncedMessageIds());
    const newMessages = uniqueMessages.filter(msg => !syncedIds.has(msg.id));
    result.duplicates_skipped = uniqueMessages.length - newMessages.length;

    // Parallel fetch: process in batches of 25 (Gmail API rate limit: 250 queries/sec/user)
    const BATCH_SIZE = 25;
    for (let i = 0; i < newMessages.length; i += BATCH_SIZE) {
      const batch = newMessages.slice(i, i + BATCH_SIZE);
      const processed = Math.min(i + BATCH_SIZE, newMessages.length);

      onProgress({
        current: processed,
        total: newMessages.length,
        percentage: Math.round((processed / newMessages.length) * 100),
        status: 'syncing',
        message: `メール処理中: ${processed}/${newMessages.length}`,
      });

      const batchResults = await Promise.allSettled(batch.map(msg => processMessage(msg)));

      for (const r of batchResults) {
        if (r.status === 'fulfilled') {
          const { saved, parseError, errorMsg } = r.value;
          if (saved) {
            result.new_transactions++;
          } else if (parseError) {
            result.parse_errors++;
            if (errorMsg) result.errors.push(errorMsg);
          } else if (errorMsg) {
            result.errors.push(errorMsg);
          }
        } else {
          const errMsg = r.reason instanceof Error ? r.reason.message : String(r.reason);
          result.errors.push(`Failed to process batch item: ${errMsg}`);
        }
      }

      // Rate limit between batches (1 second per batch of 5)
      if (i + BATCH_SIZE < newMessages.length) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    onProgress({
      current: result.total_fetched,
      total: result.total_fetched,
      percentage: 100,
      status: 'done',
      message: `同期完了: ${result.new_transactions}件新規、${result.duplicates_skipped}件重複`,
    });
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    result.errors.push(errMsg);

    onProgress({
      current: 0,
      total: 0,
      percentage: 0,
      status: 'error',
      message: errMsg,
    });
  }

  return result;
}
