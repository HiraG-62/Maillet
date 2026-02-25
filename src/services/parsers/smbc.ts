import { BaseCardParser, parseAmountStr, toISOLocal } from './base';

export class SMBCParser extends BaseCardParser {
  readonly card_company = '三井住友';
  readonly trusted_domains = ['contact.vpass.ne.jp'];
  readonly subject_keywords = ['三井住友カード', '三井住友'];

  extract_amount(email_body: string): number | null {
    const m = email_body.match(/利用金額[:：]\s*([0-9,]+)\s*円/);
    if (!m) return null;
    return this._validate_amount(parseAmountStr(m[1]));
  }

  override extract_transaction_date(email_body: string): string | null {
    const m = email_body.match(
      /利用日[:：]\s*(\d{4})\/(\d{2})\/(\d{2})\s+(\d{2}):(\d{2})/
    );
    if (m) return toISOLocal(+m[1], +m[2], +m[3], +m[4], +m[5]);
    return super.extract_transaction_date(email_body);
  }
}
