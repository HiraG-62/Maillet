import { BaseCardParser, parseAmountStr, toISOLocal } from './base';

export class AuPayCardParser extends BaseCardParser {
  readonly card_company = 'au PAYカード';
  readonly trusted_domains = [
    'system.kddi-fs.com',
    'email.kddi-fs.com',
  ];
  readonly subject_keywords = ['au PAY カード', 'au PAYカード'];

  extract_amount(email_body: string): number | null {
    const m = email_body.match(
      /(?:ご?利用金額|金額)[:：]\s*([0-9,]+)\s*円/
    );
    if (!m) return null;
    return this._validate_amount(parseAmountStr(m[1]));
  }

  override extract_merchant(email_body: string): string | null {
    // au PAYカード: 「ご利用内容」
    const m = email_body.match(/ご利用内容[:：]\s*(.+?)(?=\n|$)/);
    if (m) {
      const s = m[1].replace(/[\r\n]/g, '').replace(/\s+/g, ' ').trim();
      if (s) return s;
    }
    return super.extract_merchant(email_body);
  }

  override extract_transaction_date(email_body: string): string | null {
    // 例: YYYY/MM/DD HH:MM（推定）
    const m = email_body.match(
      /(?:ご?利用日時?|利用日)[:：\s]\s*(\d{4})\/(\d{2})\/(\d{2})\s+(\d{2}):(\d{2})/
    );
    if (m) return toISOLocal(+m[1], +m[2], +m[3], +m[4], +m[5]);
    return super.extract_transaction_date(email_body);
  }
}
