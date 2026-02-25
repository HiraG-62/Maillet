import type { GmailMessage, SyncResult, SyncProgress, GmailAuthConfig } from '@/types/gmail';
import { parse_email_debug } from '@/services/parsers';
import { initDB, queryDB, executeDB } from '@/lib/database';
import { refreshToken } from './auth';

const GMAIL_API_BASE = 'https://gmail.googleapis.com/gmail/v1/users/me';

function getGmailConfig(): GmailAuthConfig {
  return {
    clientId: import.meta.env.VITE_GOOGLE_CLIENT_ID ?? '',
    clientSecret: import.meta.env.VITE_GOOGLE_CLIENT_SECRET,
    redirectUri: import.meta.env.VITE_GOOGLE_REDIRECT_URI ?? '',
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
 * Fetch message details (subject, from, body)
 */
async function getMessage(
  messageId: string
): Promise<{ messageId: string; subject: string; fromAddress: string; body: string }> {
  const data = (await gmailFetch(`/messages/${messageId}?format=full`)) as unknown as GmailMessage;

  let subject = '';
  let fromAddress = '';
  const textParts: string[] = [];
  const htmlParts: string[] = [];

  const headers = data.payload?.headers || [];
  subject = headers.find(h => h.name === 'Subject')?.value || '';
  fromAddress = headers.find(h => h.name === 'From')?.value || '';

  extractBody(data.payload as unknown as Record<string, unknown>, textParts, htmlParts);
  // Prefer text/plain; fallback to stripped text/html (many Japanese card emails are HTML-only)
  const body = textParts.length > 0
    ? textParts.join('\n')
    : htmlParts.length > 0
      ? stripHtml(htmlParts.join('\n'))
      : '';

  return { messageId, subject, fromAddress, body };
}

/**
 * Check if transaction already exists (by gmail_message_id)
 */
async function isDuplicate(gmailMessageId: string): Promise<boolean> {
  const results = await queryDB<[number]>(
    'SELECT COUNT(*) as cnt FROM card_transactions WHERE gmail_message_id = ?',
    [gmailMessageId]
  );
  return results.length > 0 && results[0][0] > 0;
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

/**
 * Main sync function
 */
export async function syncGmailTransactions(
  onProgress: (progress: SyncProgress) => void = () => {}
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
    for (const query of CARD_EMAIL_QUERIES) {
      try {
        const msgs = await listMessages(query, 50);
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

    // Process each message
    for (let i = 0; i < uniqueMessages.length; i++) {
      const msg = uniqueMessages[i];
      const percentage = Math.round(((i + 1) / uniqueMessages.length) * 100);

      onProgress({
        current: i + 1,
        total: uniqueMessages.length,
        percentage,
        status: 'syncing',
        message: `メール処理中: ${i + 1}/${uniqueMessages.length}`,
      });

      try {
        // Check if already in DB
        if (await isDuplicate(msg.id)) {
          result.duplicates_skipped++;
          continue;
        }

        // Fetch email details
        const { subject, fromAddress, body } = await getMessage(msg.id);

        // Parse using TypeScript parsers
        const { result: parsed, debug: parseDebug } = parse_email_debug(fromAddress, subject, body);

        // ▼ DEBUG: 問題メールの本文全体をダンプ（cmd_079）
        if (msg.id === '19c70bc40b6bd310') {
          console.log(
            '[DEBUG:19c70bc40b6bd310] body_len=' + body.length + '\n' +
            '===== BODY START =====\n' +
            body +
            '\n===== BODY END ====='
          );
          // UI エラーにも追加（コンソールが確認できない場合の代替）
          result.errors.push(
            '[DEBUG_BODY:19c70bc40b6bd310]\n' +
            '=====\n' + body.slice(0, 1500) + '\n====='
          );
        }
        // ▲ DEBUG END

        if (!parsed) {
          result.parse_errors++;
          const preview = body.length > 0 ? body.slice(0, 80).replace(/\n/g, ' ') : '(本文空)';
          result.errors.push(
            `Could not parse email ${msg.id}: from="${fromAddress}" subj="${subject}" body_len=${body.length} preview="${preview}" [${parseDebug}]`
          );
          continue;
        }

        // Save to database
        await saveTransaction(
          msg.id,
          fromAddress,
          subject,
          parsed.amount,
          parsed.merchant,
          parsed.transaction_date,
          parsed.card_company
        );

        result.new_transactions++;

        // Rate limiting (1 second per email)
        await new Promise(resolve => setTimeout(resolve, 1000));
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : String(err);
        result.errors.push(`Failed to process email ${msg.id}: ${errMsg}`);
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
