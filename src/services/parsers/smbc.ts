import { BaseCardParser, parseAmountStr, toISOLocal } from './base';

export class SMBCParser extends BaseCardParser {
  readonly card_company = '三井住友';
  readonly trusted_domains = ['contact.vpass.ne.jp', 'vpass.ne.jp'];
  readonly subject_keywords = ['三井住友カード', '三井住友'];

  /** 全角数字・記号を半角に正規化 */
  private _normalizeWidthForAmount(s: string): string {
    return s
      .replace(/[０-９]/g, c => String.fromCharCode(c.charCodeAt(0) - 0xFEE0))
      .replace(/[，]/g, ',')
      .replace(/[￥¥]/g, '');
  }

  extract_amount(email_body: string): number | null {
    const normalized = this._normalizeWidthForAmount(email_body);
    // パターン1: 利用金額: 1,234円 （半角・全角コロン、¥あり/なし）
    const m = normalized.match(/ご?利用金額[:：]\s*¥?\s*([0-9,]+)\s*円?/);
    if (m) return this._validate_amount(parseAmountStr(m[1]));
    return null;
  }

  override extract_transaction_date(email_body: string): string | null {
    // 全角数字を半角に変換してからマッチ
    const normalized = email_body.replace(/[０-９]/g, c =>
      String.fromCharCode(c.charCodeAt(0) - 0xFEE0)
    );
    // 日付+時刻: 利用日: 2026/02/25 10:30 or ご利用日時: 2026/02/25 10:30
    const m = normalized.match(
      /(?:ご?利用日時?|ご利用日)[:：\s]\s*(\d{4})\/(\d{2})\/(\d{2})[\s　]+(\d{2}):(\d{2})/
    );
    if (m) return toISOLocal(+m[1], +m[2], +m[3], +m[4], +m[5]);
    // 日付のみ（時刻なし）
    const m2 = normalized.match(
      /(?:ご?利用日時?|ご利用日)[:：\s]\s*(\d{4})\/(\d{2})\/(\d{2})/
    );
    if (m2) return toISOLocal(+m2[1], +m2[2], +m2[3], 0, 0);
    return super.extract_transaction_date(normalized);
  }
}
