import { BaseCardParser, parseAmountStr, toISOLocal } from './base';

export class PayPayCardParser extends BaseCardParser {
  readonly card_company = 'PayPayカード';
  readonly trusted_domains = ['mail.paypay-card.co.jp'];
  readonly subject_keywords = ['PayPayカード'];

  /** 全角数字・記号を半角に正規化 */
  private _normalize(s: string): string {
    return s
      .replace(/[０-９]/g, c => String.fromCharCode(c.charCodeAt(0) - 0xFEE0))
      .replace(/[，]/g, ',')
      .replace(/[￥¥\u00A5]/g, '')
      .replace(/\u3000/g, ' ')
      .replace(/[−△]/g, '-');
  }

  extract_amount(email_body: string): number | null {
    const normalized = this._normalize(email_body);

    // パターン1: ラベル + コロン（注記あり/なし）
    // 例: ご利用金額：3,500円 / 金額：¥980 / ご利用金額（税込）：5,400円
    const m1 = normalized.match(
      /(?:ご?利用金額|金額|お支払い金額)[^:：\n]{0,20}[:：]\s*(?:¥\s*)?([-]?[0-9,]+)\s*円?/
    );
    if (m1) return this._validate_amount(parseAmountStr(m1[1]));

    // パターン2: コロンなしスペース区切り（HTMLテーブルのstripHtml後）
    // 例: ご利用金額 3,500円
    const m2 = normalized.match(
      /(?:ご?利用金額|金額|お支払い金額)[ \t]{1,5}(?:¥\s*)?([-]?[0-9,]+)\s*円?/
    );
    if (m2) return this._validate_amount(parseAmountStr(m2[1]));

    return null;
  }

  override extract_merchant(email_body: string): string | null {
    // パターン1: コロン付き「ご利用先：店名」「加盟店名：店名」「利用先：店名」
    const m1 = email_body.match(/(?:ご?利用先|加盟店名?)[:：]\s*(.+?)(?=\n|$)/);
    if (m1) {
      const s = m1[1].replace(/[\r\n]/g, '').replace(/\s+/g, ' ').trim();
      if (s) return s;
    }

    // パターン2: コロンなしスペース区切り（HTMLテーブル由来）
    // 例: ご利用先 コンビニ渋谷店
    const m2 = email_body.match(/(?:ご?利用先|加盟店名?)[ \t\u3000]+(.+?)(?=\n|$)/);
    if (m2) {
      const s = m2[1].replace(/[\r\n]/g, '').replace(/\s+/g, ' ').trim();
      if (s) return s;
    }

    return super.extract_merchant(email_body);
  }

  override extract_transaction_date(email_body: string): string | null {
    const normalized = this._normalize(email_body);

    // パターン1: 日付+時刻（コロン付き/スペース区切り）
    // 例: ご利用日時：2026/03/04 10:30 / 利用日 2026/03/04 10:30
    const m = normalized.match(
      /(?:ご?利用日時?|利用日)[:：\s]\s*(\d{4})\/(\d{2})\/(\d{2})[\s]+(\d{2}):(\d{2})/
    );
    if (m) return toISOLocal(+m[1], +m[2], +m[3], +m[4], +m[5]);

    // パターン2: 日付のみ（時刻なし）
    const m2 = normalized.match(
      /(?:ご?利用日時?|利用日)[:：\s]\s*(\d{4})\/(\d{2})\/(\d{2})/
    );
    if (m2) return toISOLocal(+m2[1], +m2[2], +m2[3], 0, 0);

    return super.extract_transaction_date(normalized);
  }
}
