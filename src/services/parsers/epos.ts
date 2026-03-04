import { BaseCardParser, parseAmountStr, toISOLocal } from './base';

// 件名・本文フォーマットは推定（実メールで要検証）
export class EposCardParser extends BaseCardParser {
  readonly card_company = 'エポスカード';
  readonly trusted_domains = ['01epos.jp'];
  readonly subject_keywords = ['エポスカード'];

  extract_amount(email_body: string): number | null {
    const m = email_body.match(
      /(?:ご?利用金額|金額)[:：]\s*([0-9,]+)\s*円/
    );
    if (!m) return null;
    return this._validate_amount(parseAmountStr(m[1]));
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
