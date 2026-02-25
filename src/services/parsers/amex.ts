import { BaseCardParser, parseAmountStr } from './base';

export class AMEXParser extends BaseCardParser {
  readonly card_company = 'AMEX';
  readonly trusted_domains = [
    'aexp.com',
    'americanexpress.com',
    'americanexpress.jp',
    'email.americanexpress.com',
  ];
  readonly subject_keywords = ['American Express', 'AMEX', 'アメックス'];

  extract_amount(email_body: string): number | null {
    // Python: r'(?:ご利用金額|金額)[:：]\s*¥?\s*([0-9,]+)円?'
    const m = email_body.match(/(?:ご利用金額|金額)[:：]\s*¥?\s*([0-9,]+)円?/);
    if (!m) return null;
    return this._validate_amount(parseAmountStr(m[1]));
  }
}
