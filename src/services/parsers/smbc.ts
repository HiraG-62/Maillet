import { BaseCardParser, ParsedTransaction, parseAmountStr, toISOLocal } from './base';

export class SMBCParser extends BaseCardParser {
  readonly card_company = '三井住友';
  readonly trusted_domains = ['contact.vpass.ne.jp', 'vpass.ne.jp'];
  readonly subject_keywords = ['三井住友カード', '三井住友'];

  /** 全角数字・記号を半角に正規化 */
  private _normalizeWidthForAmount(s: string): string {
    return s
      .replace(/[０-９]/g, c => String.fromCharCode(c.charCodeAt(0) - 0xFEE0))
      .replace(/[，]/g, ',')
      .replace(/[￥¥\u00A5]/g, '')  // ¥(U+00A5), ￥(U+FFE5) どちらも除去
      .replace(/\u3000/g, ' ')     // 全角スペースを半角に
      .replace(/[−△]/g, '-');     // 全角マイナス・三角記号→半角マイナス
  }

  extract_amount(email_body: string): number | null {
    const normalized = this._normalizeWidthForAmount(email_body);

    // パターン1: 各種ラベル + コロン（注記あり/なし）
    // 例: ご利用金額：¥5,400 / ご請求金額（税込）：5,400円 / お支払い金額：5,400 / ◇利用金額：-16,280円
    const m1 = normalized.match(
      /(?:ご?利用金額|ご請求金額|お支払い金額|合計金額)[^:：\n]{0,20}[:：]\s*(?:¥\s*)?([-]?[0-9,]+)\s*円?/
    );
    if (m1) return this._validate_amount(parseAmountStr(m1[1]));

    // パターン2: コロンなしスペース区切り（テーブル形式）
    // 例: ご利用金額  ¥5,400
    const m2 = normalized.match(
      /(?:ご?利用金額|ご請求金額|お支払い金額)[ \t]{1,5}(?:¥\s*)?([-]?[0-9,]+)\s*円?/
    );
    if (m2) return this._validate_amount(parseAmountStr(m2[1]));

    // パターン3: 金額ラベルと金額が改行でまたがる（空白のみ許可）
    // 例: "ご利用金額：\n¥5,400"
    const m3 = normalized.match(
      /(?:ご?利用金額|ご請求金額|お支払い金額)[^:：\n]{0,20}[:：]\s+([-]?[0-9,]{3,})\s*円?/
    );
    if (m3) return this._validate_amount(parseAmountStr(m3[1]));

    return null;
  }

  extract_is_return(email_body: string): boolean {
    // ◇利用取引：返品 / 利用取引: 返品 などのパターンに対応
    return /(?:◇)?利用取引[:：\s]+返品/.test(email_body);
  }

  override extract_merchant(email_body: string): string | null {
    // SMBC 特有: ◇ご利用先 / ◇利用先
    // パターン1: コロンあり（テキストメール標準）
    // 例: ◇利用先：セブンイレブン / ご利用先：イオン
    const m1 = email_body.match(/◇?ご?利用先[:：]\s*(.+?)(?=\n|$)/);
    if (m1) {
      const s = m1[1].replace(/[\r\n]/g, '').replace(/[ \t]+/g, ' ').trim();
      if (s) return s;
    }

    // パターン2: コロンなし + スペース区切り（HTMLメールのstripHtml後）
    // 例: ◇利用先 セブンイレブン / ◇ご利用先　イオン（全角スペース）
    const m2 = email_body.match(/◇ご?利用先[　 ]+(.+?)(?=\n|◇|$)/);
    if (m2) {
      const s = m2[1].replace(/[\r\n]/g, '').replace(/[ \t]+/g, ' ').trim();
      if (s) return s;
    }

    return super.extract_merchant(email_body);
  }

  override parse(
    email_body: string,
    from_address: string,
    subject: string
  ): ParsedTransaction | null {
    const result = super.parse(email_body, from_address, subject);
    if (!result) return null;
    return { ...result, is_return: this.extract_is_return(email_body) };
  }

  protected override _extract_amount_fallback(email_body: string): number | null {
    // 全角正規化してからフォールバックパターンでマッチ
    return super._extract_amount_fallback(this._normalizeWidthForAmount(email_body));
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
