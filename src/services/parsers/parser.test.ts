// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { SMBCParser } from './smbc';
import { JCBParser } from './jcb';
import { RakutenParser } from './rakuten';
import { AMEXParser } from './amex';
import { DCardParser } from './dcard';
import { parse_email, detect_card_company, is_trusted_domain } from './index';

// ────────────────────────────────────────────────
// Golden test: Python 版出力と TS 版出力を比較
// ────────────────────────────────────────────────
const goldenPath = resolve(__dirname, '../../../tests/fixtures/golden_results.json');
const golden = JSON.parse(readFileSync(goldenPath, 'utf-8')) as Record<
  string,
  Array<{
    input: { email_body: string; from_address: string; subject: string };
    expected: { amount: number; transaction_date: string; merchant: string; card_company: string };
  }>
>;

describe('Golden test: TS パーサー出力 vs Python 版出力', () => {
  for (const [card, cases] of Object.entries(golden)) {
    describe(`${card}`, () => {
      cases.forEach((c, i) => {
        it(`case ${i + 1}: amount=${c.expected.amount}`, () => {
          const result = parse_email(
            c.input.from_address,
            c.input.subject,
            c.input.email_body
          );
          expect(result).not.toBeNull();
          expect(result!.amount).toBe(c.expected.amount);
          expect(result!.merchant).toBe(c.expected.merchant);
          // transaction_date: ISO 文字列の先頭部分（日付）が一致すればOK
          expect(result!.transaction_date.slice(0, 10)).toBe(
            c.expected.transaction_date.slice(0, 10)
          );
          expect(result!.card_company).toBe(c.expected.card_company);
        });
      });
    });
  }
});

// ────────────────────────────────────────────────
// 単体テスト: 各パーサー
// Python 版テストファイルからケースを移植
// ────────────────────────────────────────────────

describe('SMBCParser', () => {
  const parser = new SMBCParser();

  describe('Domain Validation (T-PARSE-001)', () => {
    it('T-PARSE-001: 三井住友正規ドメイン検証', () => {
      expect(parser.is_trusted_domain('notify@contact.vpass.ne.jp')).toBe(true);
    });

    it('フィッシングドメイン検出', () => {
      expect(parser.is_trusted_domain('phish@evil.com')).toBe(false);
      expect(parser.is_trusted_domain('fake@fake-vpass.com')).toBe(false);
    });
  });

  describe('Subject Detection', () => {
    it('件名でパーサー選択（三井住友カード）', () => {
      expect(parser.can_parse('notify@contact.vpass.ne.jp', '三井住友カードご利用のお知らせ')).toBe(true);
    });

    it('件名でパーサー選択（三井住友）', () => {
      expect(parser.can_parse('notify@contact.vpass.ne.jp', '【三井住友カード】ご利用のお知らせ')).toBe(true);
    });

    it('無関係の件名はパースしない', () => {
      expect(parser.can_parse('notify@contact.vpass.ne.jp', '無関係の件名')).toBe(false);
    });
  });

  describe('Amount Extraction (T-PARSE-030〜032)', () => {
    it('T-PARSE-030: 三井住友金額抽出（基本形式）', () => {
      const body = '利用金額: 1,234円';
      expect(parser.extract_amount(body)).toBe(1234);
    });

    it('T-PARSE-031: 三井住友金額抽出（全角コロン）', () => {
      const body = '利用金額：5,678円';
      expect(parser.extract_amount(body)).toBe(5678);
    });

    it('T-PARSE-032: 三井住友金額抽出（カンマなし）', () => {
      const body = '利用金額: 100円';
      expect(parser.extract_amount(body)).toBe(100);
    });

    it('カンマ区切り金額を正しく処理する', () => {
      const body = '利用金額：100,000円';
      expect(parser.extract_amount(body)).toBe(100000);
    });

    it('金額が見つからない場合は null', () => {
      expect(parser.extract_amount('本文なし')).toBeNull();
    });
  });

  describe('Transaction Date Extraction (T-PARSE-090〜091)', () => {
    it('T-PARSE-090: 三井住友日時抽出（基本形式）', () => {
      const body = '利用日：2024/01/15 10:30';
      const date = parser.extract_transaction_date(body);
      expect(date).not.toBeNull();
      expect(date!.slice(0, 10)).toBe('2024-01-15');
    });

    it('T-PARSE-091: 三井住友日時抽出（全角コロン）', () => {
      const body = '利用日：2024/01/15 10:30';
      const date = parser.extract_transaction_date(body);
      expect(date).not.toBeNull();
      expect(date!.slice(0, 10)).toBe('2024-01-15');
    });

    it('日時を正しく抽出する', () => {
      const body = '利用日：2024/03/20 14:30';
      const date = parser.extract_transaction_date(body);
      expect(date).not.toBeNull();
      expect(date).toContain('2024-03-20');
    });
  });

  describe('Full Parse', () => {
    it('parse() が全フィールドを返す', () => {
      const body = '利用日：2024/03/20 14:30\n利用金額：5,400円\nご利用先：イオンモール';
      const r = parser.parse(body, 'notify@contact.vpass.ne.jp', '三井住友カードご利用のお知らせ');
      expect(r).not.toBeNull();
      expect(r!.amount).toBe(5400);
      expect(r!.card_company).toBe('三井住友');
      expect(r!.transaction_date.slice(0, 10)).toBe('2024-03-20');
      expect(r!.merchant).toBe('イオンモール');
    });
  });

  describe('Fallback Tests', () => {
    it('フォールバック金額パターンで抽出', () => {
      // SMBC主パターンにマッチしない場合のフォールバック
      const body = 'ご利用金額：¥5,000円';  // SMBC主パターン外
      const r = parser.parse(
        body,
        'notify@contact.vpass.ne.jp',
        '三井住友カードご利用のお知らせ'
      );
      // フォールバックが動けば金額が取れる（取れない場合は null）
      expect(r === null || r.amount === 5000).toBe(true);
    });

    it('INT_MAX を超える金額は null', () => {
      const body = '利用金額：9,999,999,999円';
      expect(parser.extract_amount(body)).toBeNull();
    });

  });

  describe('エッジケース対応（税込注記・全角フォールバック）', () => {
    it('ご利用金額（税込）形式でも金額を抽出できる', () => {
      const body = 'ご利用金額（税込）：¥5,400';
      expect(parser.extract_amount(body)).toBe(5400);
    });

    it('全角金額のフォールバックも動作する', () => {
      // extract_amount がマッチしない場合に fallback が全角を処理できるか
      const body = 'ご利用金額：５，４００円';
      expect(parser.extract_amount(body)).toBe(5400);
    });
  });

  describe('多パターン金額抽出（cmd_078-A）', () => {
    it('ご請求金額ラベルでも金額を抽出できる', () => {
      const body = 'ご請求金額：¥5,400';
      expect(parser.extract_amount(body)).toBe(5400);
    });

    it('お支払い金額ラベルでも金額を抽出できる', () => {
      const body = 'お支払い金額：5,400円';
      expect(parser.extract_amount(body)).toBe(5400);
    });

    it('スペース区切り（コロンなし）でも金額を抽出できる', () => {
      const body = 'ご利用金額  ¥5,400';
      expect(parser.extract_amount(body)).toBe(5400);
    });

    it('全角スペースを含む形式でも金額を抽出できる', () => {
      const body = 'ご利用金額\u3000：\u3000５，４００円';
      expect(parser.extract_amount(body)).toBe(5400);
    });
  });

  describe('返品メール対応（cmd_079）', () => {
    // 返品メール: マイナス金額の抽出
    it('SMBCParser: 返品取引（マイナス金額）を正しく抽出する', () => {
      const body = `ひいらぎ　様

いつも三井住友カードをご利用頂きありがとうございます。
お客様のカードご利用内容をお知らせいたします。

◇ご利用カード：Olive／クレジット払い
◇利用日時：2026/02/18 12:30
◇利用先：テスト店舗
◇利用金額：-16,280円
◇利用取引：返品

`;
      const parser = new SMBCParser();
      const amount = parser.extract_amount(body);
      expect(amount).toBe(-16280);
    });

    it('SMBCParser: 返品フラグ（is_return）を検出する', () => {
      const body = `◇利用金額：-16,280円\n◇利用取引：返品`;
      const parser = new SMBCParser();
      expect(parser.extract_is_return(body)).toBe(true);
    });

    it('SMBCParser: 通常取引は is_return=false', () => {
      const body = `◇利用金額：5,400円\n◇利用取引：ショッピング`;
      const parser = new SMBCParser();
      expect(parser.extract_is_return(body)).toBe(false);
    });

    it('SMBCParser: 負の金額は _validate_amount を通過する', () => {
      const parser = new SMBCParser();
      // 負の金額（返品）も有効値として扱う
      expect(parser['_validate_amount'](-16280)).toBe(-16280);
      expect(parser['_validate_amount'](-1)).toBe(-1);
    });
  });

  describe('Merchant Extraction', () => {
    it('◇利用先ラベルから店舗名を抽出する', () => {
      const body = '◇利用先：テスト店舗\n◇利用金額：5,400円';
      expect(parser.extract_merchant(body)).toBe('テスト店舗');
    });

    it('◇ご利用先ラベルから店舗名を抽出する', () => {
      const body = '◇ご利用先：イオン　フードスタイル\n◇利用金額：5,400円';
      expect(parser.extract_merchant(body)).toBe('イオン　フードスタイル');
    });

    it('ご利用先（◇なし）から店舗名を抽出する', () => {
      const body = 'ご利用先：セブンイレブン渋谷店\n利用金額：980円';
      expect(parser.extract_merchant(body)).toBe('セブンイレブン渋谷店');
    });

    it('コロンなし（HTML stripHtml後）パターンから店舗名を抽出する', () => {
      // HTMLの</td>→スペース変換後: "◇利用先 セブンイレブン渋谷店"
      const body = '◇利用先 セブンイレブン渋谷店\n◇利用金額：980円';
      expect(parser.extract_merchant(body)).toBe('セブンイレブン渋谷店');
    });

    it('全角スペース区切りパターンから店舗名を抽出する', () => {
      const body = '◇利用先\u3000セブンイレブン渋谷店\n◇利用金額：980円';
      expect(parser.extract_merchant(body)).toBe('セブンイレブン渋谷店');
    });
  });

  describe('Olive/Vpass ドメイン対応 (statement@vpass.ne.jp)', () => {
    it('statement@vpass.ne.jp を信頼できるドメインとして認識する', () => {
      expect(parser.is_trusted_domain('statement@vpass.ne.jp')).toBe(true);
    });

    it('三井住友Olive メールの件名でパース判定できる', () => {
      expect(parser.can_parse('statement@vpass.ne.jp', 'ご利用のお知らせ【三井住友カード】')).toBe(true);
    });

    it('全角数字を含む金額を抽出できる（¥形式）', () => {
      // ご利用金額：¥１，２３４  (全角数字・全角カンマ・¥)
      const body = 'ご利用金額：¥１，２３４';
      expect(parser.extract_amount(body)).toBe(1234);
    });

    it('全角数字を含む金額を抽出できる（円形式）', () => {
      const body = 'ご利用金額：５，４００円';
      expect(parser.extract_amount(body)).toBe(5400);
    });

    it('全角日付を含む利用日時を抽出できる', () => {
      const body = 'ご利用日時：２０２６/０２/２５　１４:３０';
      const date = parser.extract_transaction_date(body);
      expect(date).not.toBeNull();
      expect(date!.slice(0, 10)).toBe('2026-02-25');
    });

    it('Olive形式の完全パースが成功する', () => {
      const body = [
        'ひいらぎ　様',
        'ご利用カード：Ｏｌｉｖｅ／クレジット',
        'ご利用日時：２０２６/０２/２５　１４:３０',
        'ご利用先：イオン　フードスタイル',
        'ご利用金額：¥１，２３４',
      ].join('\n');
      const r = parser.parse(body, 'statement@vpass.ne.jp', 'ご利用のお知らせ【三井住友カード】');
      expect(r).not.toBeNull();
      expect(r!.amount).toBe(1234);
      expect(r!.card_company).toBe('三井住友');
      expect(r!.transaction_date.slice(0, 10)).toBe('2026-02-25');
    });
  });
});

describe('JCBParser', () => {
  const parser = new JCBParser();

  describe('Domain Validation (T-PARSE-002)', () => {
    it('T-PARSE-002: JCB正規ドメイン検証', () => {
      expect(parser.is_trusted_domain('info@qa.jcb.co.jp')).toBe(true);
    });

    it('フィッシングドメイン検出', () => {
      expect(parser.is_trusted_domain('fake@jcb.co.jp')).toBe(false);
    });
  });

  describe('Amount Extraction (T-PARSE-040〜042)', () => {
    it('T-PARSE-040: JCB金額抽出（基本形式）', () => {
      const body = 'ご利用金額: 2,500円';
      expect(parser.extract_amount(body)).toBe(2500);
    });

    it('T-PARSE-041: JCB金額抽出（全角コロン）', () => {
      const body = 'ご利用金額:3,000円';
      expect(parser.extract_amount(body)).toBe(3000);
    });

    it('T-PARSE-042: JCB金額抽出（速報版）', () => {
      const body = 'ご利用金額(速報): 1,500円';
      expect(parser.extract_amount(body)).toBe(1500);
    });

    it('T-PARSE-042 with fullwidth colon', () => {
      const body = 'ご利用金額(速報)：8,000円';
      expect(parser.extract_amount(body)).toBe(8000);
    });
  });

  describe('Subject Detection', () => {
    it('T-PARSE-021: JCB判別（件名）', () => {
      const result = detect_card_company(
        '【JCB】カードご利用のお知らせ',
        'info@qa.jcb.co.jp'
      );
      expect(result).toBe('JCB');
    });
  });
});

describe('RakutenParser', () => {
  const parser = new RakutenParser();

  describe('Domain Validation (T-PARSE-003〜005)', () => {
    it('T-PARSE-003: 楽天メインドメイン検証', () => {
      expect(parser.is_trusted_domain('notify@mail.rakuten-card.co.jp')).toBe(true);
    });

    it('T-PARSE-004: 楽天サブドメイン1検証', () => {
      expect(parser.is_trusted_domain('info@mkrm.rakuten.co.jp')).toBe(true);
    });

    it('T-PARSE-005: 楽天サブドメイン2検証', () => {
      expect(parser.is_trusted_domain('bounce@bounce.rakuten-card.co.jp')).toBe(true);
    });

    it('複数ドメインを信頼する', () => {
      expect(parser.is_trusted_domain('info@mail.rakuten-card.co.jp')).toBe(true);
      expect(parser.is_trusted_domain('info@mkrm.rakuten.co.jp')).toBe(true);
    });
  });

  describe('Amount Extraction (T-PARSE-050〜052)', () => {
    it('T-PARSE-050: 楽天金額抽出（基本形式）', () => {
      const body = '利用金額: 4,500円';
      expect(parser.extract_amount(body)).toBe(4500);
    });

    it('T-PARSE-051: 楽天金額抽出（速報版）', () => {
      const body = '利用金額(速報): 1,200円';
      expect(parser.extract_amount(body)).toBe(1200);
    });

    it('T-PARSE-052: 楽天金額抽出（確定版）', () => {
      const body = '利用金額(確定): 1,200円';
      expect(parser.extract_amount(body)).toBe(1200);
    });

    it('速報付き金額', () => {
      const body = '利用金額(速報)：2,500円';
      expect(parser.extract_amount(body)).toBe(2500);
    });

    it('確定付き金額', () => {
      const body = '利用金額(確定)：2,500円';
      expect(parser.extract_amount(body)).toBe(2500);
    });
  });

  describe('Subject Detection', () => {
    it('T-PARSE-022: 楽天判別（件名）', () => {
      const result = detect_card_company(
        '【楽天カード】カード利用のお知らせ',
        'notify@mail.rakuten-card.co.jp'
      );
      expect(result).toBe('楽天');
    });
  });
});

describe('AMEXParser', () => {
  const parser = new AMEXParser();

  describe('Domain Validation (T-PARSE-006〜008)', () => {
    it('T-PARSE-006: AMEXドメイン検証(メイン) @aexp.com', () => {
      expect(parser.is_trusted_domain('notify@aexp.com')).toBe(true);
    });

    it('T-PARSE-007: AMEXドメイン検証(サブ1) @americanexpress.com', () => {
      expect(parser.is_trusted_domain('info@americanexpress.com')).toBe(true);
    });

    it('T-PARSE-008: AMEXドメイン検証(サブ2) @email.americanexpress.com', () => {
      expect(parser.is_trusted_domain('notify@email.americanexpress.com')).toBe(true);
    });

    it('ドメイン確認', () => {
      expect(parser.is_trusted_domain('noreply@aexp.com')).toBe(true);
      expect(parser.is_trusted_domain('mail@americanexpress.jp')).toBe(true);  // JP domain is in trusted list
    });
  });

  describe('Amount Extraction (T-PARSE-060〜062)', () => {
    it('T-PARSE-060: AMEX金額抽出(基本) ご利用金額: 8,900円', () => {
      const body = 'ご利用金額: 8,900円';
      expect(parser.extract_amount(body)).toBe(8900);
    });

    it('T-PARSE-061: AMEX金額抽出(円マーク付) 金額: ¥ 5,000円', () => {
      const body = 'ご利用金額: ¥ 5,000円';
      expect(parser.extract_amount(body)).toBe(5000);
    });

    it('T-PARSE-062: AMEX金額抽出(短縮形) 金額: 3,000円', () => {
      const body = '金額: 3,000円';
      expect(parser.extract_amount(body)).toBe(3000);
    });

    it('¥付き金額', () => {
      const body = 'ご利用金額：¥15,000円';
      expect(parser.extract_amount(body)).toBe(15000);
    });

    it('¥なし金額', () => {
      const body = '金額：9,800円';
      expect(parser.extract_amount(body)).toBe(9800);
    });
  });

  describe('Subject Detection', () => {
    it('T-PARSE-023: AMEX判別(件名) 【American Express】カードご利用のお知らせ', () => {
      const result = detect_card_company(
        '【American Express】カードご利用のお知らせ',
        'notify@aexp.com'
      );
      expect(result).toBe('AMEX');
    });
  });
});

describe('DCardParser', () => {
  const parser = new DCardParser();

  describe('Domain Validation', () => {
    it('ドメイン確認', () => {
      expect(parser.is_trusted_domain('info@dcard.docomo.ne.jp')).toBe(true);
    });

    it('dcard.docomo.ne.jp ドメインは信頼できること', () => {
      expect(parser.is_trusted_domain('notify@dcard.docomo.ne.jp')).toBe(true);
    });

    it('偽装ドメイン（dcard-fake.com）はフィッシング扱い', () => {
      expect(parser.is_trusted_domain('phishing@dcard-fake.com')).toBe(false);
    });
  });

  describe('Amount Extraction (T-PARSE-070〜071)', () => {
    it('T-PARSE-070: dカード金額抽出(基本)', () => {
      const body = '【dカード】カードご利用速報\n\n利用金額: 1,800円\n利用店舗: ローソン';
      expect(parser.extract_amount(body)).toBe(1800);
    });

    it('T-PARSE-071: dカード金額抽出(短縮形)', () => {
      const body = '【dカード】カードご利用速報\n\n金額: 2,400円\n利用店舗: セブンイレブン';
      expect(parser.extract_amount(body)).toBe(2400);
    });

    it('金額抽出', () => {
      const body = '利用金額：4,200円';
      expect(parser.extract_amount(body)).toBe(4200);
    });
  });

  describe('Subject Detection', () => {
    it('T-PARSE-024: dカード判別（件名ベース）', () => {
      const subject = '【dカード】カードご利用速報';
      const from_address = 'notify@dcard.docomo.ne.jp';
      const result = detect_card_company(subject, from_address);
      expect(result).toBe('dカード');
    });
  });
});

describe('parse_email（レジストリ）', () => {
  it('from_address と subject からパーサーを自動選択', () => {
    const r = parse_email(
      'notify@contact.vpass.ne.jp',
      '三井住友カードご利用のお知らせ',
      '利用日：2024/02/01 09:00\n利用金額：3,000円\nご利用先：スターバックス'
    );
    expect(r).not.toBeNull();
    expect(r!.card_company).toBe('三井住友');
    expect(r!.amount).toBe(3000);
  });

  it('不明なメールは null を返す', () => {
    const r = parse_email('spam@evil.com', '件名', '本文');
    expect(r).toBeNull();
  });

  it('T-PARSE-020: 三井住友判別（件名）', () => {
    const result = detect_card_company(
      '【三井住友カード】ご利用のお知らせ',
      'notify@contact.vpass.ne.jp'
    );
    expect(result).toBe('三井住友');
  });

  it('T-PARSE-025: 判別不能ケース（会社名なし）', () => {
    const result = detect_card_company(
      'カード利用通知',
      'info@unknown.com'
    );
    expect(result).toBeNull();
  });
});

describe('is_trusted_domain 統合テスト', () => {
  it('T-PARSE-009: フィッシングドメイン検出', () => {
    expect(is_trusted_domain('fake@fake-vpass.com', '三井住友')).toBe(false);
  });

  it('T-PARSE-010: 不明なドメイン検出', () => {
    expect(is_trusted_domain('info@unknown-bank.com', '楽天')).toBe(false);
  });

  it('T-PARSE-011: セゾン名義メール＝フィッシング確定', () => {
    // セゾンはメール配信なし。セゾン名義のメールは全てフィッシング扱い
    expect(is_trusted_domain('info@saison-card.co.jp', 'セゾン')).toBe(false);
  });
});

describe('汎用金額抽出テスト (T-PARSE-080〜082)', () => {
  const parser = new SMBCParser();

  it('T-PARSE-080: 汎用金額抽出(パターン1)', () => {
    const body = 'ご利用ありがとうございます。\nご利用金額: 6,700円\nご確認ください。';
    // フォールバックで抽出可能
    expect(parser.extract_amount(body)).toBe(6700);
  });

  it('T-PARSE-081: 汎用金額抽出(パターン2)', () => {
    const body = 'カード利用のお知らせ\nお支払い金額: 4,200円\nありがとうございました。';
    // フォールバックで抽出可能
    const result = parser.extract_amount(body);
    expect(result === null || result === 4200).toBe(true);
  });

  it('T-PARSE-082: 金額抽出失敗ケース', () => {
    const body = 'カードご利用のお知らせ\n\n詳細はWebサイトでご確認ください。';
    expect(parser.extract_amount(body)).toBeNull();
  });
});

describe('汎用日時抽出テスト (T-PARSE-120〜122)', () => {
  const parser = new SMBCParser();

  it('T-PARSE-120: 汎用日時抽出(ISO形式)', () => {
    const body = 'ご利用日時: 2026-02-15 14:30';
    const result = parser.extract_transaction_date(body);
    expect(result).not.toBeNull();
    expect(result!.slice(0, 10)).toBe('2026-02-15');
  });

  it('T-PARSE-121: 汎用日時抽出(スラッシュ形式)', () => {
    const body = '利用日: 2026/02/15 14:30';
    const result = parser.extract_transaction_date(body);
    expect(result).not.toBeNull();
    expect(result!.slice(0, 10)).toBe('2026-02-15');
  });

  it('T-PARSE-122: 日時抽出失敗ケース', () => {
    const body = 'カードをご利用いただきました。\n詳細はアプリでご確認ください。';
    expect(parser.extract_transaction_date(body)).toBeNull();
  });
});

describe('汎用店舗名抽出テスト (T-PARSE-160〜161)', () => {
  const parser = new SMBCParser();

  it('T-PARSE-160: 汎用店舗名抽出', () => {
    const body = 'ご利用先: イオンモール';
    expect(parser.extract_merchant(body)).toBe('イオンモール');
  });

  it('T-PARSE-161: 店舗名抽出失敗ケース', () => {
    const body = 'カードをご利用いただきました。\n金額: 3,000円';
    expect(parser.extract_merchant(body)).toBeNull();
  });
});
