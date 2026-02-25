import { BaseCardParser, parseAmountStr } from './base';

export class JCBParser extends BaseCardParser {
  readonly card_company = 'JCB';
  readonly trusted_domains = ['qa.jcb.co.jp'];
  readonly subject_keywords = ['JCB'];

  extract_amount(email_body: string): number | null {
    const m = email_body.match(/ご利用金額(?:\(速報\))?[:：]\s*([0-9,]+)円/);
    if (!m) return null;
    return this._validate_amount(parseAmountStr(m[1]));
  }
}
