import type { GmailMessage, SyncResult, SyncProgress } from '@/types/gmail';
import { parse_email } from '@/services/parsers';
import { initDB, queryDB, executeDB } from '@/lib/database';

const GMAIL_API_BASE = 'https://gmail.googleapis.com/gmail/v1/users/me';

// Card notification email subjects
const CARD_EMAIL_QUERIES = [
  'subject:ご利用のお知らせ',
  'subject:カードご利用確認',
  'subject:ご利用代金明細',
];

/**
 * Gmail API request with authentication
 */
async function gmailFetch(
  path: string,
  options: RequestInit = {}
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
 * Extract email body recursively from MIME parts
 */
function extractBody(part: Record<string, unknown>, body: string[]): void {
  if (part.mimeType === 'text/plain' && typeof part.body === 'object' && part.body !== null) {
    const bodyObj = part.body as Record<string, unknown>;
    if (typeof bodyObj.data === 'string') {
      body.push(decodeBase64Url(bodyObj.data));
    }
  }
  if (Array.isArray(part.parts)) {
    for (const subpart of part.parts) {
      if (typeof subpart === 'object' && subpart !== null) {
        extractBody(subpart as Record<string, unknown>, body);
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
  const bodyParts: string[] = [];

  const headers = data.payload?.headers || [];
  subject = headers.find(h => h.name === 'Subject')?.value || '';
  fromAddress = headers.find(h => h.name === 'From')?.value || '';

  extractBody(data.payload, bodyParts);
  const body = bodyParts.join('\n');

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
        const parsed = parse_email(fromAddress, subject, body);

        if (!parsed) {
          result.parse_errors++;
          result.errors.push(`Could not parse email ${msg.id}`);
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
