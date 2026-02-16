# 統合テスト計画書 Phase 1: Gmail API連携 + メール解析

**プロジェクト**: card-spending-tracker
**対象範囲**: Gmail API連携 (`app/gmail/auth.py`, `app/gmail/client.py`) + メール解析エンジン (`app/gmail/parser.py`)
**作成日**: 2026-02-16
**統合担当**: 足軽6号
**統合元**: test_plan_gmail_api.md (34ケース) + test_plan_email_parsing.md (71ケース)
**総テストケース数**: 105件

---

## 1. 統合テスト概要

### 1.1 テスト目的

本計画書は、Gmail API連携機能とメール解析エンジンの2つのコンポーネントを統合的にテストするための計画である。

**Gmail API連携（34ケース）**:
- OAuth 2.0認証フローの正常動作（初回認証、トークンリフレッシュ、失効時の再認証）
- メール取得処理の信頼性（クエリフィルタ、ページネーション、差分同期）
- エラーハンドリングの適切性（API障害、ネットワークエラー、権限不足）
- レート制限対策の有効性（Exponential Backoff、リトライロジック）

**メール解析エンジン（71ケース）**:
- クレジットカード利用通知メールから**金額・日時・店舗名**を正確に抽出できることを検証
- 対象カード会社は**7社**（三井住友、JCB、楽天、AMEX、dカード、セゾン、エポス/オリコ）
- 送信元ドメイン検証によるフィッシングメール防止
- 楽天カード速報版・確定版の重複処理

### 1.2 テスト対象コンポーネント

| コンポーネント | ファイルパス | 主要機能 |
|--------------|-------------|---------|
| **OAuth認証** | `app/gmail/auth.py` | トークン取得・リフレッシュ・暗号化保存 |
| **Gmail APIクライアント** | `app/gmail/client.py` | メール取得・差分同期・エラーハンドリング |
| **メール解析エンジン** | `app/gmail/parser.py` | 金額・日時・店舗名抽出、カード会社判別、ドメイン検証 |
| **トークンストレージ** | `credentials/token.pickle` | トークン永続化（暗号化） |
| **重複処理** | `app/services/sync_service.py` | 楽天カード速報版・確定版重複防止 |

### 1.3 テスト実施前提条件

| 項目 | 要件 |
|------|------|
| **Google Cloud設定** | Gmail API有効化、OAuth 2.0クレデンシャル発行済み |
| **環境変数** | `TOKEN_ENCRYPTION_KEY`設定済み |
| **テストアカウント** | テスト用Gmailアカウント（クレジットカード通知メール受信済み） |
| **依存ライブラリ** | `google-api-python-client`, `google-auth-oauthlib`, `BeautifulSoup4`インストール済み |
| **ネットワーク** | インターネット接続可能（Gmail API到達可能） |
| **テストデータ** | `tests/fixtures/sample_emails/` にサンプルメール配置済み |
| **Python** | 3.11以上 |
| **テストフレームワーク** | pytest 8.0以上 |

### 1.4 テスト階層分類

| 階層 | 定義 | 担当 |
|------|------|------|
| **Unit** | 単一関数・メソッドのテスト（外部API呼び出しをモック化） | 足軽 |
| **Integration** | 実際のGmail APIを呼び出すテスト（テストアカウント使用） | 足軽（sandbox環境） |
| **E2E** | 認証〜メール取得〜解析〜DB保存の全フロー検証 | 家老 |

---

## 2. テストケース一覧（105件）

### 2.1 Gmail API連携テスト（34件）

#### 2.1.1 OAuth 2.0認証フローテスト（8件）

| ID | テスト対象 | テスト内容 | 優先度 | テスト階層 | 前提条件 | 期待結果 |
|----|----------|----------|-------|----------|---------|---------|
| **T-API-001** | 初回OAuth認証フロー | `credentials.json`のみ存在、`token.pickle`が存在しない状態で認証を実行 | Critical | Integration | Google OAuth設定済み | ブラウザで認証ページが開き、承認後にtoken.pickleが生成される |
| **T-API-002** | トークンの暗号化保存 | 認証成功時にtoken.pickleが暗号化されて保存される | High | Unit | TOKEN_ENCRYPTION_KEY設定済み | Fernet暗号化されたトークンファイルが生成される（生データ読み不可） |
| **T-API-003** | 有効なトークンの再利用 | token.pickleが存在し、有効期限内の場合、再認証せずAPI呼び出しが成功 | Critical | Integration | 有効なtoken.pickle存在 | API呼び出しが即座に成功、再認証フローは発生しない |
| **T-API-004** | トークンの自動リフレッシュ | アクセストークンが期限切れの場合、リフレッシュトークンで自動更新される | Critical | Integration | 期限切れトークン（手動で作成） | リフレッシュトークンで新しいアクセストークンが取得され、API呼び出しが成功 |
| **T-API-005** | リフレッシュトークン失効時の処理 | リフレッシュトークンが無効な場合、`RefreshError`が発生し、再認証が促される | High | Unit | 無効なリフレッシュトークン（モック） | 例外が捕捉され、ユーザーに再認証フローを促すエラーメッセージが表示される |
| **T-API-006** | スコープ検証 | 正しいスコープ（`gmail.readonly`）で認証されることを確認 | Medium | Unit | - | トークンに含まれるスコープが`gmail.readonly`であることを確認 |
| **T-API-007** | 暗号化キー不正時のエラー | `TOKEN_ENCRYPTION_KEY`が未設定の場合、暗号化保存時にエラーが発生 | High | Unit | TOKEN_ENCRYPTION_KEY未設定 | `EnvironmentError`または`ValueError`が発生、エラーメッセージが明示的 |
| **T-API-008** | トークンファイル破損時の処理 | token.pickleが破損している場合、再認証フローにフォールバック | Medium | Unit | 破損したtoken.pickle（手動作成） | ファイル読み込みエラーを捕捉し、再認証フローを開始 |

#### 2.1.2 メール取得機能テスト（8件）

| ID | テスト対象 | テスト内容 | 優先度 | テスト階層 | 前提条件 | 期待結果 |
|----|----------|----------|-------|----------|---------|---------|
| **T-API-009** | 基本クエリによるメール取得 | `from:@contact.vpass.ne.jp`クエリで三井住友カードのメールのみ取得 | Critical | Integration | テストアカウントに三井住友メール存在 | 三井住友カードのメールのみがレスポンスに含まれる |
| **T-API-010** | 複合クエリによるメール取得 | 複数カード会社（`from:(@contact.vpass.ne.jp OR @qa.jcb.co.jp)`）のメール取得 | Critical | Integration | テストアカウントに複数社のメール存在 | 指定した複数ドメインのメールが取得される |
| **T-API-011** | maxResults制限の動作確認 | `maxResults=10`を指定し、10件のみ取得されることを確認 | High | Integration | メールが10件以上存在 | レスポンスに10件のメールが含まれる |
| **T-API-012** | ページネーション処理 | nextPageTokenを使用して全メールを取得 | Critical | Integration | メールが100件以上存在 | 複数ページにわたり全メールが取得される、nextPageToken=Noneで終了 |
| **T-API-013** | 空の検索結果処理 | 存在しないクエリ（`from:nonexistent@example.com`）で空リストが返される | Medium | Integration | - | `messages`が空リスト、エラーは発生しない |
| **T-API-014** | 不正なクエリ構文処理 | Gmail検索構文エラー（`from:`のみ）でHTTP 400エラーが発生 | High | Unit | - | `HttpError` (status=400)が発生、エラーログが記録される |
| **T-API-015** | メッセージID取得のみ | `list()`でメッセージIDリストを取得し、本文は取得しない | Medium | Integration | - | `id`と`threadId`のみを含むメッセージリストが返される |
| **T-API-016** | メッセージ本文取得 | `messages().get(id=message_id, format='full')`でメール本文を取得 | Critical | Integration | メッセージID既知 | 件名、本文、送信元が含まれたメッセージオブジェクトが返される |

#### 2.1.3 差分同期（History API）テスト（5件）

| ID | テスト対象 | テスト内容 | 優先度 | テスト階層 | 前提条件 | 期待結果 |
|----|----------|----------|-------|----------|---------|---------|
| **T-API-017** | 初回historyId取得 | 初回同期時に`historyId`をレスポンスから取得し保存 | High | Integration | - | `messages().list()`のレスポンスに`historyId`が含まれる |
| **T-API-018** | History APIによる差分取得 | 前回の`historyId`を使用して新規メールのみ取得 | Critical | Integration | 前回のhistoryId保存済み | 前回以降に追加されたメッセージのみが返される |
| **T-API-019** | historyId期限切れ処理 | 1週間以上前の`historyId`を指定した場合、HTTP 404エラーが発生 | Medium | Unit | 古いhistoryId（モック） | `HttpError` (status=404)が発生、全件取得にフォールバック |
| **T-API-020** | historyTypesフィルタ | `historyTypes=['messageAdded']`で追加メッセージのみ取得 | High | Integration | 削除・ラベル変更イベント混在 | `messageAdded`イベントのみがレスポンスに含まれる |
| **T-API-021** | History APIのページネーション | 差分同期時もnextPageTokenが存在する場合、全履歴を取得 | Medium | Integration | 大量の差分履歴存在 | 複数ページにわたり全履歴が取得される |

#### 2.1.4 エラーハンドリングテスト（8件）

| ID | テスト対象 | テスト内容 | 優先度 | テスト階層 | 前提条件 | 期待結果 |
|----|----------|----------|-------|----------|---------|---------|
| **T-API-022** | HTTP 401エラー処理（認証失敗） | 無効なトークンでAPI呼び出し時、自動リフレッシュを試行 | Critical | Unit | 無効なアクセストークン（モック） | トークンリフレッシュが実行され、再試行が成功する |
| **T-API-023** | HTTP 403エラー処理（権限不足） | `gmail.modify`が必要な操作で`gmail.readonly`トークンを使用 | High | Unit | 読み取り専用トークン | `HttpError` (status=403)が発生、明確なエラーメッセージが表示される |
| **T-API-024** | HTTP 404エラー処理（メッセージ不存在） | 削除済みメッセージIDを指定した場合、スキップされる | Medium | Unit | 存在しないメッセージID | エラーログが記録され、処理がスキップされる（例外は握りつぶされる） |
| **T-API-025** | HTTP 429エラー処理（レート制限） | レート制限超過時、Exponential Backoffで再試行 | Critical | Unit | レート制限エラー（モック） | 2秒 → 4秒 → 8秒の待機後、最大3回再試行される |
| **T-API-026** | HTTP 500/503エラー処理（サーバーエラー） | Googleサーバーエラー時、固定待機（3秒）後に再試行 | High | Unit | サーバーエラー（モック） | 3秒待機後、最大3回再試行される |
| **T-API-027** | ネットワークタイムアウト処理 | API呼び出しがタイムアウトした場合、再試行される | High | Unit | タイムアウト（モック） | `socket.timeout`が捕捉され、再試行される |
| **T-API-028** | 最大再試行回数超過時の処理 | 3回の再試行後も失敗した場合、例外が発生 | High | Unit | 常に失敗するAPI（モック） | `Exception("API call failed after retries")`が発生 |
| **T-API-029** | 不正なJSONレスポンス処理 | APIレスポンスが不正なJSON形式の場合、パースエラーが処理される | Medium | Unit | 不正なJSON（モック） | `json.JSONDecodeError`が捕捉され、エラーログが記録される |

#### 2.1.5 レート制限対策テスト（4件）

| ID | テスト対象 | テスト内容 | 優先度 | テスト階層 | 前提条件 | 期待結果 |
|----|----------|----------|-------|----------|---------|---------|
| **T-API-030** | Exponential Backoffの実装 | レート制限エラー時、2^n秒の待機時間が計算される | High | Unit | - | 1回目=2秒、2回目=4秒、3回目=8秒の待機時間が設定される |
| **T-API-031** | バッチリクエストの動作確認 | 50件のメッセージIDをバッチリクエストで取得 | Medium | Integration | メッセージID 50件以上 | 1回のAPI呼び出しで50件のメッセージ本文が取得される |
| **T-API-032** | バッチリクエストの上限超過処理 | 51件以上のメッセージを複数バッチに分割して取得 | Medium | Unit | メッセージID 51件以上 | 50件と1件の2回のバッチリクエストに分割される |
| **T-API-033** | クォータ消費の最小化検証 | 差分同期使用時、`list()`より`history()`のクォータ消費が少ない | Low | Integration | 差分同期可能状態 | `history()`が2 units/call、`list()`が5 units/callであることを確認 |

#### 2.1.6 統合テスト（複合シナリオ）（4件）

| ID | テスト対象 | テスト内容 | 優先度 | テスト階層 | 前提条件 | 期待結果 |
|----|----------|----------|-------|----------|---------|---------|
| **T-API-034** | 初回同期〜差分同期の全フロー | 初回同期でhistoryId保存 → 新規メール受信 → 差分同期で新規メールのみ取得 | Critical | Integration | テストアカウント | 2回目の同期で新規メールのみが取得される（既読メールは重複しない） |
| **T-API-035** | トークンリフレッシュ中の同期継続 | 同期中にトークンが期限切れになった場合、自動リフレッシュして処理継続 | High | Integration | 期限切れ直前のトークン | トークンリフレッシュが発生し、同期処理が正常完了する |
| **T-API-036** | 複数ページ取得中のレート制限発生 | ページネーション処理中にレート制限が発生した場合、Backoff後に継続 | Medium | Unit | レート制限発生（モック） | 待機後、nextPageTokenを使用して処理が継続される |
| **T-API-037** | 500件上限の初回同期 | 500件以上のメールが存在する場合、500件まで取得し、nextPageTokenを保存 | Medium | Integration | メール500件以上存在 | 500件が取得され、残りは次回同期で取得される（履歴保持） |

---

### 2.2 メール解析エンジンテスト（71件）

#### 2.2.1 送信元ドメイン検証テスト（11件）

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

#### 2.2.2 カード会社判別テスト（6件）

| ID | テスト対象 | 優先度 | テスト階層 | テスト内容 | 期待結果 |
|----|----------|--------|----------|----------|---------|
| T-PARSE-020 | 三井住友判別(件名) | Critical | Unit | `subject: 【三井住友カード】ご利用のお知らせ` | `detect_card_company() → "三井住友"` |
| T-PARSE-021 | JCB判別(件名) | Critical | Unit | `subject: 【JCB】カードご利用のお知らせ` | `detect_card_company() → "JCB"` |
| T-PARSE-022 | 楽天判別(件名) | Critical | Unit | `subject: 【楽天カード】カード利用のお知らせ` | `detect_card_company() → "楽天"` |
| T-PARSE-023 | AMEX判別(件名) | High | Unit | `subject: 【American Express】カードご利用のお知らせ` | `detect_card_company() → "AMEX"` |
| T-PARSE-024 | dカード判別(件名) | High | Unit | `subject: 【dカード】カードご利用速報` | `detect_card_company() → "dカード"` |
| T-PARSE-025 | 判別不能ケース | Medium | Unit | `subject: カード利用通知` (会社名なし) | `detect_card_company() → None` |

#### 2.2.3 金額抽出テスト（19件）

| ID | テスト対象 | 優先度 | テスト階層 | テスト内容 | 期待結果 |
|----|----------|--------|----------|----------|---------|
| **三井住友カード（4件）** |
| T-PARSE-030 | 三井住友金額抽出(基本) | Critical | Unit | `利用金額: 1,234円` | `amount=1234` |
| T-PARSE-031 | 三井住友金額抽出(全角コロン) | Critical | Unit | `利用金額:5,678円` | `amount=5678` |
| T-PARSE-032 | 三井住友金額抽出(カンマなし) | High | Unit | `利用金額: 100円` | `amount=100` |
| T-PARSE-033 | 三井住友金額抽出(大金額) | Medium | Unit | `利用金額: 1,234,567円` | `amount=1234567` |
| **JCBカード（3件）** |
| T-PARSE-040 | JCB金額抽出(基本) | Critical | Unit | `ご利用金額: 2,500円` | `amount=2500` |
| T-PARSE-041 | JCB金額抽出(全角コロン) | Critical | Unit | `ご利用金額:3,000円` | `amount=3000` |
| T-PARSE-042 | JCB金額抽出(速報版) | High | Unit | `ご利用金額(速報): 1,500円` | `amount=1500` |
| **楽天カード（3件）** |
| T-PARSE-050 | 楽天金額抽出(基本) | Critical | Unit | `利用金額: 4,500円` | `amount=4500` |
| T-PARSE-051 | 楽天金額抽出(速報版) | High | Unit | `利用金額(速報): 1,200円` | `amount=1200` |
| T-PARSE-052 | 楽天金額抽出(確定版) | High | Unit | `利用金額(確定): 1,200円` | `amount=1200` |
| **American Express（3件）** |
| T-PARSE-060 | AMEX金額抽出(基本) | High | Unit | `ご利用金額: 8,900円` | `amount=8900` |
| T-PARSE-061 | AMEX金額抽出(円マーク付) | High | Unit | `金額: ¥ 5,000円` | `amount=5000` |
| T-PARSE-062 | AMEX金額抽出(短縮形) | Medium | Unit | `金額: 3,000円` | `amount=3000` |
| **dカード（2件）** |
| T-PARSE-070 | dカード金額抽出(基本) | High | Unit | `利用金額: 1,800円` | `amount=1800` |
| T-PARSE-071 | dカード金額抽出(短縮形) | Medium | Unit | `金額: 2,400円` | `amount=2400` |
| **汎用パターン（3件）** |
| T-PARSE-080 | 汎用金額抽出(パターン1) | High | Unit | `ご利用金額: 6,700円` (不明カード) | `amount=6700` |
| T-PARSE-081 | 汎用金額抽出(パターン2) | Medium | Unit | `XXX円形式: 4,200円` | `amount=4200` |
| T-PARSE-082 | 金額抽出失敗ケース | Medium | Unit | 金額情報なしメール | `amount=None` |

#### 2.2.4 利用日時抽出テスト（11件）

| ID | テスト対象 | 優先度 | テスト階層 | テスト内容 | 期待結果 |
|----|----------|--------|----------|----------|---------|
| **三井住友カード（2件）** |
| T-PARSE-090 | 三井住友日時抽出(基本) | Critical | Unit | `利用日: 2026/02/15 14:30` | `datetime=2026-02-15 14:30:00` |
| T-PARSE-091 | 三井住友日時抽出(全角コロン) | High | Unit | `利用日:2026/02/15 14:30` | `datetime=2026-02-15 14:30:00` |
| **JCBカード（2件）** |
| T-PARSE-100 | JCB日時抽出(基本) | Critical | Unit | `ご利用日時: 2026/02/15 18:45` | `datetime=2026-02-15 18:45:00` |
| T-PARSE-101 | JCB日時抽出(日本時間) | High | Unit | `ご利用日時(日本時間): 2026/02/15 10:00` | `datetime=2026-02-15 10:00:00` |
| **楽天カード（2件）** |
| T-PARSE-110 | 楽天日時抽出(日付のみ) | Critical | Unit | `利用日: 2026/02/15` | `datetime=2026-02-15 00:00:00` |
| T-PARSE-111 | 楽天日時抽出(時刻付) | High | Unit | `利用日: 2026/02/15 12:30` | `datetime=2026-02-15 12:30:00` |
| **汎用パターン（3件）** |
| T-PARSE-120 | 汎用日時抽出(ISO形式) | High | Unit | `2026-02-15 14:30` | `datetime=2026-02-15 14:30:00` |
| T-PARSE-121 | 汎用日時抽出(スラッシュ) | High | Unit | `2026/02/15 14:30` | `datetime=2026-02-15 14:30:00` |
| T-PARSE-122 | 日時抽出失敗ケース | Medium | Unit | 日時情報なしメール | `datetime=None` |

#### 2.2.5 店舗名抽出テスト（10件）

| ID | テスト対象 | 優先度 | テスト階層 | テスト内容 | 期待結果 |
|----|----------|--------|----------|----------|---------|
| **三井住友カード（2件）** |
| T-PARSE-130 | 三井住友店舗名抽出(基本) | Critical | Unit | `ご利用先店名: セブンイレブン` | `merchant="セブンイレブン"` |
| T-PARSE-131 | 三井住友店舗名抽出(長文) | High | Unit | `ご利用先店名: Amazon.co.jp マーケットプレイス` | `merchant="Amazon.co.jp マーケットプレイス"` |
| **JCBカード（2件）** |
| T-PARSE-140 | JCB店舗名抽出(基本) | Critical | Unit | `ご利用先: ローソン` | `merchant="ローソン"` |
| T-PARSE-141 | JCB店舗名抽出(速報版) | High | Unit | `ご利用先(速報): スターバックス` | `merchant="スターバックス"` |
| **楽天カード（2件）** |
| T-PARSE-150 | 楽天店舗名抽出(基本) | Critical | Unit | `利用先: ファミリーマート` | `merchant="ファミリーマート"` |
| T-PARSE-151 | 楽天店舗名抽出(海外店舗) | High | Unit | `利用先: STARBUCKS SEATTLE USA` | `merchant="STARBUCKS SEATTLE USA"` |
| **汎用パターン（2件）** |
| T-PARSE-160 | 汎用店舗名抽出 | High | Unit | `ご利用先: イオンモール` | `merchant="イオンモール"` |
| T-PARSE-161 | 店舗名抽出失敗ケース | Medium | Unit | 店舗名情報なしメール | `merchant=None` |

#### 2.2.6 重複処理テスト（楽天カード速報版・確定版）（4件）

| ID | テスト対象 | 優先度 | テスト階層 | テスト内容 | 期待結果 |
|----|----------|--------|----------|----------|---------|
| T-PARSE-170 | 速報版メール処理 | Critical | Integration | 楽天カード速報版メールを処理 | DB登録成功、`gmail_message_id=msg_001` |
| T-PARSE-171 | 確定版メール重複検出 | Critical | Integration | 同じ取引の確定版メールを処理 | `IntegrityError` → スキップ、ログ記録 |
| T-PARSE-172 | 異なる取引の処理 | High | Integration | 別の取引の速報版メールを処理 | DB登録成功、`gmail_message_id=msg_002` |
| T-PARSE-173 | 重複スキップログ確認 | High | Integration | 重複メール処理時 | ログに `Duplicate email skipped: msg_001` 記録 |

#### 2.2.7 フィッシングメール誤判定防止テスト（4件）

| ID | テスト対象 | 優先度 | テスト階層 | テスト内容 | 期待結果 |
|----|----------|--------|----------|----------|---------|
| T-PARSE-180 | フィッシングメール検出(偽三井住友) | Critical | Integration | `from: fake-vpass@example.com`, `subject: 【三井住友カード】` | `is_verified=False`, DB未登録、警告ログ |
| T-PARSE-181 | フィッシングメール検出(偽楽天) | Critical | Integration | `from: rakuten-card@scam.com`, `subject: 【楽天カード】` | `is_verified=False`, DB未登録、警告ログ |
| T-PARSE-182 | フィッシングメール検出(偽セゾン) | High | Integration | `from: saison@fake.com`, `subject: 【セゾンカード】利用確認` | 警告: `セゾンはメール配信なし(フィッシング確定)` |
| T-PARSE-183 | 正規メール正常処理 | Critical | Integration | `from: noreply@contact.vpass.ne.jp`, 三井住友正規メール | `is_verified=True`, DB登録成功 |

#### 2.2.8 統合テスト（E2E）（6件）

| ID | テスト対象 | 優先度 | テスト階層 | テスト内容 | 期待結果 |
|----|----------|--------|----------|----------|---------|
| T-PARSE-190 | 三井住友E2Eパース | Critical | E2E | 実メール形式のサンプルを入力 | 金額・日時・店舗名すべて正確に抽出、DB登録成功 |
| T-PARSE-191 | JCB E2Eパース | Critical | E2E | 実メール形式のサンプルを入力 | 金額・日時・店舗名すべて正確に抽出、DB登録成功 |
| T-PARSE-192 | 楽天E2Eパース | Critical | E2E | 実メール形式のサンプルを入力 | 金額・日時・店舗名すべて正確に抽出、DB登録成功 |
| T-PARSE-193 | AMEX E2Eパース | High | E2E | 実メール形式のサンプルを入力 | 金額・日時・店舗名すべて正確に抽出、DB登録成功 |
| T-PARSE-194 | dカードE2Eパース | High | E2E | 実メール形式のサンプルを入力 | 金額・日時・店舗名すべて正確に抽出、DB登録成功 |
| T-PARSE-195 | 複数社混在処理 | High | E2E | 三井住友、JCB、楽天のメールを連続処理 | すべて正確に抽出、カード会社別に分類 |

---

## 3. テストデータ準備方針（統合版）

### 3.1 OAuth認証設定

| 項目 | 準備内容 |
|------|---------|
| **Google Cloud Console設定** | Gmail API有効化、OAuth 2.0クライアントID作成（デスクトップアプリ） |
| **credentials.json** | ダウンロードして`credentials/`に配置 |
| **リダイレクトURI** | `http://localhost`（ローカル認証フロー用） |
| **テスト用スコープ** | `https://www.googleapis.com/auth/gmail.readonly` |

### 3.2 テスト用Gmailアカウント

| 要件 | 準備方法 |
|------|---------|
| **専用アカウント作成** | `card-tracker-test@gmail.com`のような専用アカウントを作成 |
| **サンプルメール準備** | 実際のクレジットカード通知メールを10〜20通転送 |
| **カード会社の多様性** | 三井住友、JCB、楽天の3社のメールを含める |
| **メールの時系列分散** | 過去1週間〜1ヶ月の範囲でメールを分散配置（差分同期テスト用） |

### 3.3 サンプルメール作成方法

#### 3.3.1 実メールサンプル収集（推奨）

**方法**:
1. ユーザーから実際の利用通知メールを提供してもらう
2. 個人情報（カード番号下4桁、氏名等）をマスキング
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

#### 3.3.2 テストデータファイル構造

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

### 3.4 サンプルメール仕様書

各カード会社のサンプルメールに必要な要素:

| カード会社 | 送信元 | 件名 | 本文項目 |
|----------|-------|------|---------|
| **三井住友** | `noreply@contact.vpass.ne.jp` | `【三井住友カード】ご利用のお知らせ` | 利用金額、利用日、ご利用先店名、カード番号 |
| **JCB** | `info@qa.jcb.co.jp` | `【JCB】カードご利用のお知らせ` | ご利用金額、ご利用日時(日本時間)、ご利用先 |
| **楽天** | `noreply@mail.rakuten-card.co.jp` | `【楽天カード】カード利用のお知らせ` | 利用金額、利用日、利用先、利用者 |
| **AMEX** | `noreply@email.americanexpress.com` | `【American Express】カードご利用のお知らせ` | ご利用金額、利用日時、ご利用先 |
| **dカード** | `info@dcard.docomo.ne.jp` | `【dカード】カードご利用速報` | 利用金額、ご利用日時、利用場所(国内/海外) |

### 3.5 モックデータ

| テストケース | モックデータ | 準備方法 |
|-------------|-------------|---------|
| **T-API-005** | 無効なリフレッシュトークン | `unittest.mock`で`google.auth.exceptions.RefreshError`を発生させる |
| **T-API-014** | 不正なクエリ構文 | `googleapiclient.errors.HttpError`（status=400）をモック |
| **T-API-025** | レート制限エラー | `HttpError`（status=429）をモックし、リトライロジックを検証 |
| **T-API-026** | サーバーエラー | `HttpError`（status=500/503）をモック |
| **T-API-029** | 不正なJSONレスポンス | API呼び出しの戻り値を`'invalid json'`（文字列）にモック |

### 3.6 テスト環境変数

```bash
# .env.test
TOKEN_ENCRYPTION_KEY=test-encryption-key-32-characters-long
GMAIL_TEST_ACCOUNT=card-tracker-test@gmail.com
DATABASE_PATH=data/test_transactions.db
```

---

## 4. テスト実行方針

### 4.1 テスト実行順序

1. **Unit Tests** (Gmail API: 21件 + メール解析: 57件 = 78件)
   - モックを使用した単体テスト
   - Gmail APIへの実通信なし
   - 高速実行可能

2. **Integration Tests** (Gmail API: 13件 + メール解析: 8件 = 21件)
   - 実際のGmail APIを使用
   - テストアカウント必須
   - レート制限に注意（順次実行）

3. **E2E Tests** (メール解析: 6件)
   - 家老が担当（足軽はスキップ）
   - 認証〜メール取得〜解析〜DB保存の全フロー検証

### 4.2 テスト実行コマンド

```bash
# Unitテストのみ実行（高速）
pytest tests/test_gmail_auth.py tests/test_gmail_client.py tests/test_parser.py -m unit

# Integrationテストのみ実行（実API使用）
pytest tests/test_gmail_auth.py tests/test_gmail_client.py tests/test_integration.py -m integration --slow

# 全テスト実行（カバレッジ測定）
pytest tests/ --cov=app/gmail --cov-report=html

# セクション別実行
pytest tests/test_gmail_auth.py -v                 # OAuth認証テスト
pytest tests/test_gmail_client.py -v               # メール取得テスト
pytest tests/test_parser.py::TestDomainVerification -v  # ドメイン検証テスト
pytest tests/test_parser.py::TestAmountExtraction -v    # 金額抽出テスト
pytest tests/test_integration.py::TestDuplicateHandling -v  # 重複処理テスト
```

### 4.3 成功基準

| 基準 | 目標値 |
|------|-------|
| **テストカバレッジ（Gmail API）** | 80%以上（`app/gmail/auth.py`, `app/gmail/client.py`） |
| **テストカバレッジ（メール解析）** | 95%以上（`app/gmail/parser.py`） |
| **全テスト成功率** | 100%（**SKIP=0**） |
| **Integration Tests成功率** | 95%以上（Gmail API依存のため、まれに失敗許容） |
| **レート制限テスト** | Exponential Backoffが3回成功すること |

### 4.4 SKIP条件（CLAUDE.md Test Rulesより）

**SKIP = FAIL扱い**。以下の条件でSKIPする場合、事前に家老に報告必須:

| SKIP理由 | 対処法 |
|---------|--------|
| **credentials.json未配置** | テスト環境セットアップ不足 → セットアップ手順を作成し、家老に報告 |
| **テストアカウント未準備** | サンプルメール不足 → 最低10通のメールを準備してから再実行 |
| **Gmail API無効化** | Google Cloud設定不足 → セットアップドキュメントに追記 |
| **ネットワーク到達不可** | 環境問題 → 実行環境を変更するか、Integration Testsをスキップして報告 |
| **サンプルメール未配置** | テストデータ不足 → `tests/fixtures/sample_emails/` に配置してから再実行 |

**重要**: SKIPが発生した場合、報告YAMLに「テスト未完了」と明記し、SKIP理由を詳述する。

---

## 5. 既知の制約事項・注意点

### 5.1 テスト実行上の制約

| 制約 | 影響 | 回避策 |
|------|------|--------|
| **レート制限（250 units/sec/user）** | Integration Tests大量実行で制限到達の可能性 | テスト間に0.5秒のsleep挿入 |
| **historyId有効期限（1週間）** | T-API-019の検証が困難 | 古いhistoryIdを手動で生成（過去のバックアップから） |
| **OAuth初回認証のブラウザ操作** | T-API-001の自動化困難 | 半自動テスト（手動認証 → 自動検証） |
| **トークン暗号化キーの環境依存** | CI/CD環境でテスト失敗の可能性 | .env.testで固定キーを使用 |
| **カード会社がメール形式を変更** | パターン抽出失敗の可能性 | 定期的なパターン検証、パース失敗時のログ記録 |

### 5.2 セゾンカード特記事項

**セゾンカードはメール配信を行わない**（セゾンPortalアプリのプッシュ通知のみ）。

- セゾン名義のメールを受信した場合、**フィッシングメール確定**として扱う
- テストケースに含める: `T-PARSE-011`, `T-PARSE-182`
- README.md、設計ドキュメントに「セゾンカード非対応」を明記

### 5.3 エポス・オリコカード対応

**エポス・オリコカードは今後対応予定**（Phase 2で実メールサンプル収集後にパターン追加）。

---

## 6. テストケース総数サマリ

### 6.1 階層別サマリ

| テスト階層 | Gmail API | メール解析 | 合計 |
|----------|----------|----------|------|
| **Unit** | 21件 | 57件 | **78件** |
| **Integration** | 13件 | 8件 | **21件** |
| **E2E** | 0件 | 6件 | **6件** |
| **総計** | **34件** | **71件** | **105件** |

### 6.2 優先度別サマリ

| 優先度 | Gmail API | メール解析 | 合計 |
|-------|----------|----------|------|
| **Critical** | 10件 | 33件 | **43件** |
| **High** | 12件 | 28件 | **40件** |
| **Medium** | 11件 | 10件 | **21件** |
| **Low** | 1件 | 0件 | **1件** |
| **総計** | **34件** | **71件** | **105件** |

### 6.3 機能別サマリ

| 機能カテゴリ | テストケース数 |
|------------|-------------|
| **OAuth認証フロー** | 8件 |
| **メール取得機能** | 8件 |
| **差分同期（History API）** | 5件 |
| **Gmail APIエラーハンドリング** | 8件 |
| **レート制限対策** | 4件 |
| **Gmail API統合テスト** | 4件 |
| **送信元ドメイン検証** | 11件 |
| **カード会社判別** | 6件 |
| **金額抽出** | 19件 |
| **日時抽出** | 11件 |
| **店舗名抽出** | 10件 |
| **重複処理（楽天）** | 4件 |
| **フィッシング防止** | 4件 |
| **メール解析E2E** | 6件 |
| **総計** | **105件** |

---

## 7. 参考資料

- [Gmail API Testing Guide](https://developers.google.com/workspace/gmail/api/guides/testing)
- [OAuth 2.0 Testing Best Practices](https://developers.google.com/identity/protocols/oauth2/policies)
- [Exponential Backoff Algorithm](https://cloud.google.com/iot/docs/how-tos/exponential-backoff)

---

**Phase 1統合完了**: 2026-02-16
**次のアクション**: Phase 2統合（DB層 + システム統合 + セキュリティ）に引き継ぎ
