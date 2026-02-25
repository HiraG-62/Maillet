export interface ParsedTransaction {
  amount: number;
  transaction_date: string;
  merchant: string;
  card_company: string;
  raw_text: string;
  is_return?: boolean;
}

export const INT_MAX = 2_147_483_647;
export const MAX_MERCHANT_LENGTH = 1000;

export const FALLBACK_AMOUNT_PATTERN =
  /(?:ご?利用金額|金額|お支払い金額)[:：]\s*¥?\s*([0-9,]+)\s*円/;

export const FALLBACK_DATETIME_PATTERNS: RegExp[] = [
  /(?:ご?利用日時?|利用日)[:：]\s*(\d{4})-(\d{2})-(\d{2})\s+(\d{2}):(\d{2})/,
  /(?:ご?利用日時?|利用日)[:：]\s*(\d{4})\/(\d{2})\/(\d{2})\s+(\d{2}):(\d{2})/,
];

export const FALLBACK_MERCHANT_PATTERN =
  /(?:ご?利用先|店舗名|加盟店)[:：]\s*(.+?)(?=\n|$)/;

export function parseAmountStr(s: string): number {
  return parseInt(s.replace(/,/g, ''), 10);
}

export function toISOLocal(
  year: number, month: number, day: number,
  hour: number, minute: number
): string {
  const d = new Date(year, month - 1, day, hour, minute);
  return d.toISOString();
}

export abstract class BaseCardParser {
  abstract readonly card_company: string;
  abstract readonly trusted_domains: string[];
  abstract readonly subject_keywords: string[];

  can_parse(from_address: string, subject: string): boolean {
    return this._check_domain(from_address) && this._check_subject(subject);
  }

  is_trusted_domain(from_address: string): boolean {
    return this._check_domain(from_address);
  }

  abstract extract_amount(email_body: string): number | null;

  extract_transaction_date(email_body: string): string | null {
    for (const pattern of FALLBACK_DATETIME_PATTERNS) {
      const m = email_body.match(pattern);
      if (m) {
        return toISOLocal(+m[1], +m[2], +m[3], +m[4], +m[5]);
      }
    }
    return null;
  }

  extract_merchant(email_body: string): string | null {
    const m = email_body.match(FALLBACK_MERCHANT_PATTERN);
    if (!m) return null;
    let merchant = m[1]
      .replace(/[\r\n]/g, ' ')
      .replace(/[\x00-\x1f]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
    if (merchant.length > MAX_MERCHANT_LENGTH) {
      merchant = merchant.slice(0, MAX_MERCHANT_LENGTH);
    }
    return merchant || null;
  }

  parse(
    email_body: string,
    from_address: string,
    subject: string
  ): ParsedTransaction | null {
    if (!this.can_parse(from_address, subject)) return null;
    const amount =
      this.extract_amount(email_body) ??
      this._extract_amount_fallback(email_body);
    if (amount === null) return null;
    const transaction_date = this.extract_transaction_date(email_body);
    if (!transaction_date) return null;
    const merchant = this.extract_merchant(email_body) ?? '';
    return {
      amount,
      transaction_date,
      merchant,
      card_company: this.card_company,
      raw_text: email_body,
    };
  }

  protected _check_domain(from_address: string): boolean {
    const addr = from_address.toLowerCase();
    return this.trusted_domains.some(
      (d) => addr.endsWith('@' + d) || addr.includes('@' + d)
    );
  }

  protected _check_subject(subject: string): boolean {
    return this.subject_keywords.some((kw) => subject.includes(kw));
  }

  protected _validate_amount(value: number): number | null {
    if (isNaN(value) || Math.abs(value) > INT_MAX) return null;
    return value;
  }

  protected _extract_amount_fallback(email_body: string): number | null {
    const m = email_body.match(FALLBACK_AMOUNT_PATTERN);
    if (!m) return null;
    return this._validate_amount(parseAmountStr(m[1]));
  }
}
