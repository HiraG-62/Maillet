import { BaseCardParser, parseAmountStr } from './base';

export class RakutenParser extends BaseCardParser {
  readonly card_company = '楽天';
  readonly trusted_domains = [
    'mail.rakuten-card.co.jp',
    'mkrm.rakuten.co.jp',
    'bounce.rakuten-card.co.jp',
  ];
  readonly subject_keywords = ['楽天カード', '楽天'];

  extract_amount(email_body: string): number | null {
    // Python: r'利用金額(?:\((?:速報|確定)\))?[:：]\s*([0-9,]+)円'
    const m = email_body.match(
      /利用金額(?:\((?:速報|確定)\))?[:：]\s*([0-9,]+)円/
    );
    if (!m) return null;
    return this._validate_amount(parseAmountStr(m[1]));
  }
}
