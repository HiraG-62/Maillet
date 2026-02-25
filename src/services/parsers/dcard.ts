import { BaseCardParser, parseAmountStr } from './base';

export class DCardParser extends BaseCardParser {
  readonly card_company = 'dカード';
  readonly trusted_domains = ['dcard.docomo.ne.jp'];
  readonly subject_keywords = ['dカード'];

  extract_amount(email_body: string): number | null {
    // Python: r'(?:利用金額|金額)[:：]\s*([0-9,]+)円'
    const m = email_body.match(/(?:利用金額|金額)[:：]\s*([0-9,]+)円/);
    if (!m) return null;
    return this._validate_amount(parseAmountStr(m[1]));
  }
}
