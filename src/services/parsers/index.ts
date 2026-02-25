import type { BaseCardParser, ParsedTransaction } from './base';
import { SMBCParser } from './smbc';
import { JCBParser } from './jcb';
import { RakutenParser } from './rakuten';
import { AMEXParser } from './amex';
import { DCardParser } from './dcard';

export { BaseCardParser } from './base';
export type { ParsedTransaction } from './base';
export { SMBCParser } from './smbc';
export { JCBParser } from './jcb';
export { RakutenParser } from './rakuten';
export { AMEXParser } from './amex';
export { DCardParser } from './dcard';

const PARSERS: BaseCardParser[] = [
  new SMBCParser(),
  new JCBParser(),
  new RakutenParser(),
  new AMEXParser(),
  new DCardParser(),
];

export function get_parser(card_company: string): BaseCardParser | null {
  return PARSERS.find((p) => p.card_company === card_company) ?? null;
}

export function parse_email(
  from_address: string,
  subject: string,
  body: string
): ParsedTransaction | null {
  for (const parser of PARSERS) {
    if (parser.can_parse(from_address, subject)) {
      return parser.parse(body, from_address, subject);
    }
  }
  return null;
}

/** parse失敗時の診断情報を返す */
export function parse_email_debug(
  from_address: string,
  subject: string,
  body: string
): { result: ParsedTransaction | null; debug: string } {
  for (const parser of PARSERS) {
    if (parser.can_parse(from_address, subject)) {
      const result = parser.parse(body, from_address, subject);
      if (result === null) {
        const amount = parser.extract_amount(body);
        const date = parser.extract_transaction_date(body);
        const debug = `parser=${parser.card_company} amount=${amount} date=${date}`;
        return { result: null, debug };
      }
      return { result, debug: '' };
    }
  }
  return { result: null, debug: 'no_parser_matched' };
}

export function detect_card_company(
  subject: string,
  from_address: string
): string | null {
  for (const parser of PARSERS) {
    if (parser.can_parse(from_address, subject)) {
      return parser.card_company;
    }
  }
  return null;
}

export function is_trusted_domain(
  from_address: string,
  card_company: string
): boolean {
  const parser = get_parser(card_company);
  return parser?.is_trusted_domain(from_address) ?? false;
}
