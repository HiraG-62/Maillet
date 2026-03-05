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

    // パターン1（実メール形式）: ラベルなし単独行「600円」「1,200円」
    const m0 = normalized.match(/^([-]?[0-9,]+)円$/m);
    if (m0) return this._validate_amount(parseAmountStr(m0[1]));

    // パターン2: ラベル + コロン（旧形式フォールバック）
    const m1 = normalized.match(
      /(?:ご?利用金額|金額|お支払い金額)[^:：\n]{0,20}[:：]\s*(?:¥\s*)?([-]?[0-9,]+)\s*円?/
    );
    if (m1) return this._validate_amount(parseAmountStr(m1[1]));

    // パターン3: コロンなしスペース区切り（旧形式フォールバック）
    const m2 = normalized.match(
      /(?:ご?利用金額|金額|お支払い金額)[ \t]{1,5}(?:¥\s*)?([-]?[0-9,]+)\s*円?/
    );
    if (m2) return this._validate_amount(parseAmountStr(m2[1]));

    return null;
  }

  override extract_merchant(email_body: string): string | null {
    // パターン1（実メール形式）: 「利用速報」ヘッダ後の最初の非空行が店名
    const m0 = email_body.match(
      /(?:利用速報|PayPayカード[^\n]*速報)[^\n]*\n\s*\n([^\n]+)/
    );
    if (m0) {
      const s = m0[1].replace(/[\r\n]/g, '').replace(/\s+/g, ' ').trim();
      // 日時行や金額行でないことを確認
      if (s && !/^\d{4}年/.test(s) && !/^\d[\d,]*円$/.test(s)) return s;
    }

    // パターン2: コロン付き「ご利用先：店名」（旧形式フォールバック）
    const m1 = email_body.match(/(?:ご?利用先|加盟店名?)[:：]\s*(.+?)(?=\n|$)/);
    if (m1) {
      const s = m1[1].replace(/[\r\n]/g, '').replace(/\s+/g, ' ').trim();
      if (s) return s;
    }

    // パターン3: コロンなしスペース区切り（旧形式フォールバック）
    const m2 = email_body.match(/(?:ご?利用先|加盟店名?)[ \t\u3000]+(.+?)(?=\n|$)/);
    if (m2) {
      const s = m2[1].replace(/[\r\n]/g, '').replace(/\s+/g, ' ').trim();
      if (s) return s;
    }

    return super.extract_merchant(email_body);
  }

  override extract_transaction_date(email_body: string): string | null {
    const normalized = this._normalize(email_body);

    // パターン1（実メール形式）: 「2026年3月2日 14:03」
    const m0 = normalized.match(
      /(\d{4})年(\d{1,2})月(\d{1,2})日\s+(\d{1,2}):(\d{2})/
    );
    if (m0) return toISOLocal(+m0[1], +m0[2], +m0[3], +m0[4], +m0[5]);

    // パターン2: ラベル付き YYYY/MM/DD HH:MM（旧形式フォールバック）
    const m = normalized.match(
      /(?:ご?利用日時?|利用日)[:：\s]\s*(\d{4})\/(\d{2})\/(\d{2})[\s]+(\d{2}):(\d{2})/
    );
    if (m) return toISOLocal(+m[1], +m[2], +m[3], +m[4], +m[5]);

    // パターン3: ラベル付き日付のみ（旧形式フォールバック）
    const m2 = normalized.match(
      /(?:ご?利用日時?|利用日)[:：\s]\s*(\d{4})\/(\d{2})\/(\d{2})/
    );
    if (m2) return toISOLocal(+m2[1], +m2[2], +m2[3], 0, 0);

    return super.extract_transaction_date(normalized);
  }
}
