# メール解析エンジン テスト計画書

**プロジェクト**: card-spending-tracker
**対象機能**: メール解析エンジン (`app/gmail/parser.py`)
**作成日**: 2026-02-15
**作成者**: 足軽2号 (メール解析テスト専門家)

---

## 1. テスト概要

### 1.1 テスト目的

クレジットカード利用通知メールから**金額・日時・店舗名**を正確に抽出できることを検証する。
対象カード会社は**7社**（三井住友、JCB、楽天、AMEX、dカード、セゾン、エポス/オリコ）。

### 1.2 テスト対象コンポーネント

| コンポーネント | 責務 | ファイルパス |
|--------------|------|------------|
| **送信元ドメイン検証** | 信頼できるドメインからのメールか判定 | `app/gmail/parser.py::is_trusted_domain()` |
| **カード会社判別** | 件名・送信元からカード会社を特定 | `app/gmail/parser.py::detect_card_company()` |
| **金額抽出** | メール本文から利用金額を抽出 | `app/gmail/parser.py::extract_amount()` |
| **日時抽出** | メール本文から利用日時を抽出 | `app/gmail/parser.py::extract_datetime()` |
| **店舗名抽出** | メール本文から利用店舗名を抽出 | `app/gmail/parser.py::extract_merchant()` |
| **重複処理** | 楽天カード速報版・確定版の重複防止 | `app/services/sync_service.py::save_transaction()` |

### 1.3 テスト範囲

| 対象範囲 | 内容 |
|---------|------|
| **対象カード会社** | 三井住友、JCB、楽天、AMEX、dカード、セゾン(非対応明記)、エポス/オリコ(今後対応) |
| **抽出項目** | 金額、利用日時、店舗名 |
| **特殊ケース** | 楽天カード速報版・確定版重複、フィッシングメール誤判定防止 |
| **対象外** | Gmail API連携部分(別テスト)、データベース永続化(別テスト)、UI表示(別テスト) |

---

## 2. テストケース一覧

### 2.1 送信元ドメイン検証テスト

| ID | テスト対象 | 優先度 | テスト階層 | テスト内容 | 期待結果 |
|----|----------|--------|----------|----------|---------|
| T-PARSE-001 | 三井住友ドメイン検証 | Critical | Unit | `from: @contact.vpass.ne.jp` | `is_trusted_domain() → True` |
| T-PARSE-002 | JCBドメイン検証 | Critical | Unit | `from: @qa.jcb.co.jp` | `is_trusted_domain() → True` |
| T-PARSE-003 | 楽天ドメイン検証(メイン) | Critical | Unit | `from: @mail.rakuten-card.co.jp` | `is_trusted_domain() → True` |
| T-PARSE-004 | 楽天ドメイン検証(サブ1) | High | Unit | `from: @mkrm.rakuten.co.jp` | `is_trusted_domain() → True` |
| T-PARSE-005 | 楽天ドメイン検証(サブ2) | High | Unit | `from: @bounce.rakuten-card.co.jp` | `is_trusted_domain() → True` |
| T-PARSE-006 | AMEXドメイン検証(メイン) | High | Unit | `from: @aexp.com` | `is_trusted_domain() → True` |
| T-PARSE-007 | AMEXドメイン検証(サブ1) | High | Unit | `from: @americanexpress.com` | `is_trusted_domain() → True` |
| T-PARSE-008 | AMEXドメイン検証(サブ2) | High | Unit | `from: @email.americanexpress.com` | `is_trusted_domain() → True` |
| T-PARSE-009 | フィッシングドメイン検出 | Critical | Unit | `from: @fake-vpass.com` (偽ドメイン) | `is_trusted_domain() → False` |
| T-PARSE-010 | 不明なドメイン検出 | High | Unit | `from: @unknown-bank.com` | `is_trusted_domain() → False` |
| T-PARSE-011 | セゾンメール非対応警告 | Medium | Unit | セゾン名義のメール受信 | `Warning: セゾンカードはメール配信なし(フィッシング疑い)` |

### 2.2 カード会社判別テスト

| ID | テスト対象 | 優先度 | テスト階層 | テスト内容 | 期待結果 |
|----|----------|--------|----------|----------|---------|
| T-PARSE-020 | 三井住友判別(件名) | Critical | Unit | `subject: 【三井住友カード】ご利用のお知らせ` | `detect_card_company() → "三井住友"` |
| T-PARSE-021 | JCB判別(件名) | Critical | Unit | `subject: 【JCB】カードご利用のお知らせ` | `detect_card_company() → "JCB"` |
| T-PARSE-022 | 楽天判別(件名) | Critical | Unit | `subject: 【楽天カード】カード利用のお知らせ` | `detect_card_company() → "楽天"` |
| T-PARSE-023 | AMEX判別(件名) | High | Unit | `subject: 【American Express】カードご利用のお知らせ` | `detect_card_company() → "AMEX"` |
| T-PARSE-024 | dカード判別(件名) | High | Unit | `subject: 【dカード】カードご利用速報` | `detect_card_company() → "dカード"` |
| T-PARSE-025 | 判別不能ケース | Medium | Unit | `subject: カード利用通知` (会社名なし) | `detect_card_company() → None` |

### 2.3 金額抽出テスト

#### 2.3.1 三井住友カード

| ID | テスト対象 | 優先度 | テスト階層 | テスト内容 | 期待結果 |
|----|----------|--------|----------|----------|---------|
| T-PARSE-030 | 三井住友金額抽出(基本) | Critical | Unit | `利用金額: 1,234円` | `amount=1234` |
| T-PARSE-031 | 三井住友金額抽出(全角コロン) | Critical | Unit | `利用金額:5,678円` | `amount=5678` |
| T-PARSE-032 | 三井住友金額抽出(カンマなし) | High | Unit | `利用金額: 100円` | `amount=100` |
| T-PARSE-033 | 三井住友金額抽出(大金額) | Medium | Unit | `利用金額: 1,234,567円` | `amount=1234567` |

#### 2.3.2 JCBカード

| ID | テスト対象 | 優先度 | テスト階層 | テスト内容 | 期待結果 |
|----|----------|--------|----------|----------|---------|
| T-PARSE-040 | JCB金額抽出(基本) | Critical | Unit | `ご利用金額: 2,500円` | `amount=2500` |
| T-PARSE-041 | JCB金額抽出(全角コロン) | Critical | Unit | `ご利用金額:3,000円` | `amount=3000` |
| T-PARSE-042 | JCB金額抽出(速報版) | High | Unit | `ご利用金額(速報): 1,500円` | `amount=1500` |

#### 2.3.3 楽天カード

| ID | テスト対象 | 優先度 | テスト階層 | テスト内容 | 期待結果 |
|----|----------|--------|----------|----------|---------|
| T-PARSE-050 | 楽天金額抽出(基本) | Critical | Unit | `利用金額: 4,500円` | `amount=4500` |
| T-PARSE-051 | 楽天金額抽出(速報版) | High | Unit | `利用金額(速報): 1,200円` | `amount=1200` |
| T-PARSE-052 | 楽天金額抽出(確定版) | High | Unit | `利用金額(確定): 1,200円` | `amount=1200` |

#### 2.3.4 American Express

| ID | テスト対象 | 優先度 | テスト階層 | テスト内容 | 期待結果 |
|----|----------|--------|----------|----------|---------|
| T-PARSE-060 | AMEX金額抽出(基本) | High | Unit | `ご利用金額: 8,900円` | `amount=8900` |
| T-PARSE-061 | AMEX金額抽出(円マーク付) | High | Unit | `金額: ¥ 5,000円` | `amount=5000` |
| T-PARSE-062 | AMEX金額抽出(短縮形) | Medium | Unit | `金額: 3,000円` | `amount=3000` |

#### 2.3.5 dカード

| ID | テスト対象 | 優先度 | テスト階層 | テスト内容 | 期待結果 |
|----|----------|--------|----------|----------|---------|
| T-PARSE-070 | dカード金額抽出(基本) | High | Unit | `利用金額: 1,800円` | `amount=1800` |
| T-PARSE-071 | dカード金額抽出(短縮形) | Medium | Unit | `金額: 2,400円` | `amount=2400` |

#### 2.3.6 汎用パターン(フォールバック)

| ID | テスト対象 | 優先度 | テスト階層 | テスト内容 | 期待結果 |
|----|----------|--------|----------|----------|---------|
| T-PARSE-080 | 汎用金額抽出(パターン1) | High | Unit | `ご利用金額: 6,700円` (不明カード) | `amount=6700` |
| T-PARSE-081 | 汎用金額抽出(パターン2) | Medium | Unit | `XXX円形式: 4,200円` | `amount=4200` |
| T-PARSE-082 | 金額抽出失敗ケース | Medium | Unit | 金額情報なしメール | `amount=None` |

### 2.4 利用日時抽出テスト

#### 2.4.1 三井住友カード

| ID | テスト対象 | 優先度 | テスト階層 | テスト内容 | 期待結果 |
|----|----------|--------|----------|----------|---------|
| T-PARSE-090 | 三井住友日時抽出(基本) | Critical | Unit | `利用日: 2026/02/15 14:30` | `datetime=2026-02-15 14:30:00` |
| T-PARSE-091 | 三井住友日時抽出(全角コロン) | High | Unit | `利用日:2026/02/15 14:30` | `datetime=2026-02-15 14:30:00` |

#### 2.4.2 JCBカード

| ID | テスト対象 | 優先度 | テスト階層 | テスト内容 | 期待結果 |
|----|----------|--------|----------|----------|---------|
| T-PARSE-100 | JCB日時抽出(基本) | Critical | Unit | `ご利用日時: 2026/02/15 18:45` | `datetime=2026-02-15 18:45:00` |
| T-PARSE-101 | JCB日時抽出(日本時間) | High | Unit | `ご利用日時(日本時間): 2026/02/15 10:00` | `datetime=2026-02-15 10:00:00` |

#### 2.4.3 楽天カード

| ID | テスト対象 | 優先度 | テスト階層 | テスト内容 | 期待結果 |
|----|----------|--------|----------|----------|---------|
| T-PARSE-110 | 楽天日時抽出(日付のみ) | Critical | Unit | `利用日: 2026/02/15` | `datetime=2026-02-15 00:00:00` |
| T-PARSE-111 | 楽天日時抽出(時刻付) | High | Unit | `利用日: 2026/02/15 12:30` | `datetime=2026-02-15 12:30:00` |

#### 2.4.4 汎用パターン

| ID | テスト対象 | 優先度 | テスト階層 | テスト内容 | 期待結果 |
|----|----------|--------|----------|----------|---------|
| T-PARSE-120 | 汎用日時抽出(ISO形式) | High | Unit | `2026-02-15 14:30` | `datetime=2026-02-15 14:30:00` |
| T-PARSE-121 | 汎用日時抽出(スラッシュ) | High | Unit | `2026/02/15 14:30` | `datetime=2026-02-15 14:30:00` |
| T-PARSE-122 | 日時抽出失敗ケース | Medium | Unit | 日時情報なしメール | `datetime=None` |

### 2.5 店舗名抽出テスト

#### 2.5.1 三井住友カード

| ID | テスト対象 | 優先度 | テスト階層 | テスト内容 | 期待結果 |
|----|----------|--------|----------|----------|---------|
| T-PARSE-130 | 三井住友店舗名抽出(基本) | Critical | Unit | `ご利用先店名: セブンイレブン` | `merchant="セブンイレブン"` |
| T-PARSE-131 | 三井住友店舗名抽出(長文) | High | Unit | `ご利用先店名: Amazon.co.jp マーケットプレイス` | `merchant="Amazon.co.jp マーケットプレイス"` |

#### 2.5.2 JCBカード

| ID | テスト対象 | 優先度 | テスト階層 | テスト内容 | 期待結果 |
|----|----------|--------|----------|----------|---------|
| T-PARSE-140 | JCB店舗名抽出(基本) | Critical | Unit | `ご利用先: ローソン` | `merchant="ローソン"` |
| T-PARSE-141 | JCB店舗名抽出(速報版) | High | Unit | `ご利用先(速報): スターバックス` | `merchant="スターバックス"` |

#### 2.5.3 楽天カード

| ID | テスト対象 | 優先度 | テスト階層 | テスト内容 | 期待結果 |
|----|----------|--------|----------|----------|---------|
| T-PARSE-150 | 楽天店舗名抽出(基本) | Critical | Unit | `利用先: ファミリーマート` | `merchant="ファミリーマート"` |
| T-PARSE-151 | 楽天店舗名抽出(海外店舗) | High | Unit | `利用先: STARBUCKS SEATTLE USA` | `merchant="STARBUCKS SEATTLE USA"` |

#### 2.5.4 汎用パターン

| ID | テスト対象 | 優先度 | テスト階層 | テスト内容 | 期待結果 |
|----|----------|--------|----------|----------|---------|
| T-PARSE-160 | 汎用店舗名抽出 | High | Unit | `ご利用先: イオンモール` | `merchant="イオンモール"` |
| T-PARSE-161 | 店舗名抽出失敗ケース | Medium | Unit | 店舗名情報なしメール | `merchant=None` |

### 2.6 重複処理テスト(楽天カード速報版・確定版)

| ID | テスト対象 | 優先度 | テスト階層 | テスト内容 | 期待結果 |
|----|----------|--------|----------|----------|---------|
| T-PARSE-170 | 速報版メール処理 | Critical | Integration | 楽天カード速報版メールを処理 | DB登録成功、`gmail_message_id=msg_001` |
| T-PARSE-171 | 確定版メール重複検出 | Critical | Integration | 同じ取引の確定版メールを処理 | `IntegrityError` → スキップ、ログ記録 |
| T-PARSE-172 | 異なる取引の処理 | High | Integration | 別の取引の速報版メールを処理 | DB登録成功、`gmail_message_id=msg_002` |
| T-PARSE-173 | 重複スキップログ確認 | High | Integration | 重複メール処理時 | ログに `Duplicate email skipped: msg_001` 記録 |

### 2.7 フィッシングメール誤判定防止テスト

| ID | テスト対象 | 優先度 | テスト階層 | テスト内容 | 期待結果 |
|----|----------|--------|----------|----------|---------|
| T-PARSE-180 | フィッシングメール検出(偽三井住友) | Critical | Integration | `from: fake-vpass@example.com`, `subject: 【三井住友カード】` | `is_verified=False`, DB未登録、警告ログ |
| T-PARSE-181 | フィッシングメール検出(偽楽天) | Critical | Integration | `from: rakuten-card@scam.com`, `subject: 【楽天カード】` | `is_verified=False`, DB未登録、警告ログ |
| T-PARSE-182 | フィッシングメール検出(偽セゾン) | High | Integration | `from: saison@fake.com`, `subject: 【セゾンカード】利用確認` | 警告: `セゾンはメール配信なし(フィッシング確定)` |
| T-PARSE-183 | 正規メール正常処理 | Critical | Integration | `from: noreply@contact.vpass.ne.jp`, 三井住友正規メール | `is_verified=True`, DB登録成功 |

### 2.8 統合テスト(E2E)

| ID | テスト対象 | 優先度 | テスト階層 | テスト内容 | 期待結果 |
|----|----------|--------|----------|----------|---------|
| T-PARSE-190 | 三井住友E2Eパース | Critical | E2E | 実メール形式のサンプルを入力 | 金額・日時・店舗名すべて正確に抽出、DB登録成功 |
| T-PARSE-191 | JCB E2Eパース | Critical | E2E | 実メール形式のサンプルを入力 | 金額・日時・店舗名すべて正確に抽出、DB登録成功 |
| T-PARSE-192 | 楽天E2Eパース | Critical | E2E | 実メール形式のサンプルを入力 | 金額・日時・店舗名すべて正確に抽出、DB登録成功 |
| T-PARSE-193 | AMEX E2Eパース | High | E2E | 実メール形式のサンプルを入力 | 金額・日時・店舗名すべて正確に抽出、DB登録成功 |
| T-PARSE-194 | dカードE2Eパース | High | E2E | 実メール形式のサンプルを入力 | 金額・日時・店舗名すべて正確に抽出、DB登録成功 |
| T-PARSE-195 | 複数社混在処理 | High | E2E | 三井住友、JCB、楽天のメールを連続処理 | すべて正確に抽出、カード会社別に分類 |

---

## 3. テストデータ準備方針

### 3.1 サンプルメール作成方法

#### 3.1.1 実メールサンプル収集(推奨)

**方法**:
1. ユーザーから実際の利用通知メールを提供してもらう
2. 個人情報(カード番号下4桁、氏名等)をマスキング
3. `tests/fixtures/sample_emails/` に保存

**メリット**:
- 実際のメール形式を100%反映
- パターン検証の精度が最高

**デメリット**:
- 初回テスト実施までに時間がかかる
- 全カード会社のメールを集めるのが困難

#### 3.1.2 公式サンプルベースの模擬メール作成

**方法**:
1. カード会社公式サイトのサンプルメールを参照
2. 設計ドキュメントのパターン定義に基づき模擬メールを作成
3. `tests/fixtures/sample_emails/` に保存

**サンプルメール構造**:

```
From: noreply@contact.vpass.ne.jp
To: user@example.com
Subject: 【三井住友カード】ご利用のお知らせ
Date: 2026-02-15T14:30:00+09:00

━━━━━━━━━━━━━━━━━━━━━━━━━
三井住友カードをご利用いただき、ありがとうございます。
下記の通りカードをご利用されました。
━━━━━━━━━━━━━━━━━━━━━━━━━

利用金額: 1,234円
利用日: 2026/02/15 14:30
ご利用先店名: セブンイレブン
カード番号: ************1234

━━━━━━━━━━━━━━━━━━━━━━━━━
```

#### 3.1.3 テストデータファイル構造

```
tests/fixtures/sample_emails/
├── mitsui_sumitomo/
│   ├── basic.eml                  # 基本パターン
│   ├── large_amount.eml            # 大金額(カンマ複数)
│   └── no_merchant.eml             # 店舗名なしケース
├── jcb/
│   ├── basic.eml                  # 基本パターン
│   ├── preliminary.eml             # 速報版
│   └── foreign_shop.eml            # 海外利用
├── rakuten/
│   ├── preliminary.eml             # 速報版
│   ├── confirmed.eml               # 確定版(同一取引)
│   └── basic.eml                  # 基本パターン
├── amex/
│   ├── basic.eml                  # 基本パターン
│   └── yen_symbol.eml              # ¥マーク付き金額
├── dcard/
│   ├── basic.eml                  # 基本パターン
│   └── domestic.eml                # 国内利用
├── phishing/
│   ├── fake_mitsui_sumitomo.eml   # 偽三井住友
│   ├── fake_rakuten.eml            # 偽楽天
│   └── fake_saison.eml             # 偽セゾン(メール配信なし)
└── README.md                       # サンプルメール説明書
```

### 3.2 サンプルメール仕様書

各カード会社のサンプルメールに必要な要素:

| カード会社 | 送信元 | 件名 | 本文項目 |
|----------|-------|------|---------|
| **三井住友** | `noreply@contact.vpass.ne.jp` | `【三井住友カード】ご利用のお知らせ` | 利用金額、利用日、ご利用先店名、カード番号 |
| **JCB** | `info@qa.jcb.co.jp` | `【JCB】カードご利用のお知らせ` | ご利用金額、ご利用日時(日本時間)、ご利用先 |
| **楽天** | `noreply@mail.rakuten-card.co.jp` | `【楽天カード】カード利用のお知らせ` | 利用金額、利用日、利用先、利用者 |
| **AMEX** | `noreply@email.americanexpress.com` | `【American Express】カードご利用のお知らせ` | ご利用金額、利用日時、ご利用先 |
| **dカード** | `info@dcard.docomo.ne.jp` | `【dカード】カードご利用速報` | 利用金額、ご利用日時、利用場所(国内/海外) |

---

## 4. テスト実施前提条件

### 4.1 環境要件

| 項目 | 要件 |
|------|------|
| **Python** | 3.11以上 |
| **テストフレームワーク** | pytest 8.0以上 |
| **依存ライブラリ** | `app/gmail/parser.py` で使用する正規表現、BeautifulSoup4 |
| **テストデータ** | `tests/fixtures/sample_emails/` にサンプルメール配置済み |

### 4.2 前提条件チェックリスト

- [ ] `app/gmail/parser.py` が実装済み
- [ ] 各カード会社の抽出パターン定義が完了
- [ ] サンプルメールが `tests/fixtures/sample_emails/` に配置済み
- [ ] SQLiteデータベーススキーマが定義済み(`gmail_message_id UNIQUE制約`)
- [ ] pytest実行環境が構築済み

---

## 5. テスト実施手順

### 5.1 Unitテスト実施手順

```bash
# 1. テストデータ配置確認
ls tests/fixtures/sample_emails/

# 2. Unitテスト実行(送信元ドメイン検証)
pytest tests/test_parser.py::TestDomainVerification -v

# 3. Unitテスト実行(カード会社判別)
pytest tests/test_parser.py::TestCompanyDetection -v

# 4. Unitテスト実行(金額抽出)
pytest tests/test_parser.py::TestAmountExtraction -v

# 5. Unitテスト実行(日時抽出)
pytest tests/test_parser.py::TestDatetimeExtraction -v

# 6. Unitテスト実行(店舗名抽出)
pytest tests/test_parser.py::TestMerchantExtraction -v

# 7. 全Unitテスト実行
pytest tests/test_parser.py -v
```

### 5.2 Integrationテスト実施手順

```bash
# 1. 重複処理テスト(楽天カード速報版・確定版)
pytest tests/test_integration.py::TestDuplicateHandling -v

# 2. フィッシングメール誤判定防止テスト
pytest tests/test_integration.py::TestPhishingDetection -v

# 3. 全Integrationテスト実行
pytest tests/test_integration.py -v
```

### 5.3 E2Eテスト実施手順

```bash
# 注意: E2Eテストは家老が担当(全エージェント操作権限必要)
# 足軽はUnitテスト・Integrationテストのみ実施

# 1. 全E2Eテスト実行(家老のみ)
pytest tests/test_e2e.py -v

# 2. カバレッジ測定
pytest tests/ --cov=app/gmail/parser --cov-report=html
```

---

## 6. テスト成功基準

### 6.1 Unitテスト成功基準

- [ ] 送信元ドメイン検証テスト(T-PARSE-001〜011): 11件すべてPASS
- [ ] カード会社判別テスト(T-PARSE-020〜025): 6件すべてPASS
- [ ] 金額抽出テスト(T-PARSE-030〜082): 19件すべてPASS
- [ ] 利用日時抽出テスト(T-PARSE-090〜122): 11件すべてPASS
- [ ] 店舗名抽出テスト(T-PARSE-130〜161): 10件すべてPASS
- [ ] **SKIP件数: 0件** (SKIP=FAILと同等扱い)

### 6.2 Integrationテスト成功基準

- [ ] 重複処理テスト(T-PARSE-170〜173): 4件すべてPASS
- [ ] フィッシングメール誤判定防止テスト(T-PARSE-180〜183): 4件すべてPASS
- [ ] **SKIP件数: 0件**

### 6.3 E2Eテスト成功基準

- [ ] 主要3社(三井住友、JCB、楽天)E2Eテスト(T-PARSE-190〜192): 3件すべてPASS
- [ ] AMEX、dカードE2Eテスト(T-PARSE-193〜194): 2件すべてPASS
- [ ] 複数社混在処理テスト(T-PARSE-195): 1件PASS
- [ ] **SKIP件数: 0件**

### 6.4 カバレッジ目標

| ファイル | カバレッジ目標 |
|---------|-------------|
| `app/gmail/parser.py` | **95%以上** |
| `app/services/sync_service.py` (重複処理部分) | **90%以上** |

---

## 7. リスクと注意事項

### 7.1 リスク

| リスク | 影響度 | 軽減策 |
|-------|-------|--------|
| **カード会社がメール形式を変更** | 高 | 定期的なパターン検証、パース失敗時のログ記録 |
| **実メールサンプル不足** | 中 | 公式サンプルベースの模擬メールで代替、Phase 2で実メール収集 |
| **AMEX・dカードのパターン不確定** | 中 | 低確度パターンとして実装、Phase 2で実メール検証 |
| **フィッシングメール誤判定** | 低 | 送信元ドメインホワイトリスト方式で厳格化 |

### 7.2 注意事項

1. **セゾンカード**: メール配信なし。セゾン名義のメール受信は**フィッシング確定**として扱う。
2. **楽天カード重複**: 速報版・確定版の2通メールが送信される可能性あり。`gmail_message_id` で重複防止。
3. **JCB速報版**: 加盟店情報到着前の速報のため、実際の金額・店舗名と異なる場合あり。
4. **テスト実行順序**: Unit → Integration → E2E の順に実行。
5. **SKIP禁止**: テスト報告でSKIP件数が1以上なら「テスト未完了」扱い。

---

## 8. セゾンカード特記事項

**セゾンカードはメール配信を行わない**(セゾンPortalアプリのプッシュ通知のみ)。

### 対応方針

- セゾン名義のメールを受信した場合、**フィッシングメール確定**として扱う
- テストケースに含める:
  - `T-PARSE-011`: セゾンメール非対応警告
  - `T-PARSE-182`: フィッシングメール検出(偽セゾン)

### ドキュメント記載

- README.md、設計ドキュメントに「セゾンカード非対応」を明記
- ユーザーに事前告知

---

## 9. エポス・オリコカード対応

**エポス・オリコカードは今後対応予定**。

### 対応方針

- Phase 2で実メールサンプル収集後にパターン追加
- テストケースは将来的に追加(現時点では未定義)

---

## 付録: テストケース総数サマリ

| テスト階層 | テストケース数 | 優先度Critical | 優先度High | 優先度Medium | 優先度Low |
|----------|-------------|--------------|----------|------------|----------|
| **Unit** | 57件 | 25件 | 22件 | 10件 | 0件 |
| **Integration** | 8件 | 5件 | 3件 | 0件 | 0件 |
| **E2E** | 6件 | 3件 | 3件 | 0件 | 0件 |
| **合計** | **71件** | **33件** | **28件** | **10件** | **0件** |

---

**テスト計画書作成完了**: 2026-02-15
**次のアクション**: テストデータ準備 → pytest実装 → テスト実行
