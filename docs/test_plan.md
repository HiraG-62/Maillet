# テスト計画書（最終統合版）

**プロジェクト**: card-spending-tracker
**バージョン**: 1.0.0（最終統合版）
**作成日**: 2026-02-16
**最終統合担当**: 足軽8号
**統合元計画**:
- Part1: Gmail API連携 + メール解析（105ケース）- 足軽6号作成
- Part2: データ層・エッジケース・セキュリティ（122ケース）- 足軽7号作成
- E2E・統合テスト（35ケース）- 足軽5号作成

**総テストケース数**: 256件（重複6件除外後）

---

## 目次

1. [テスト戦略概要](#1-テスト戦略概要)
2. [テストケース一覧](#2-テストケース一覧)
3. [テストデータ準備方針](#3-テストデータ準備方針)
4. [テスト実施時の注意事項](#4-テスト実施時の注意事項)
5. [付録](#5-付録)

---

## 1. テスト戦略概要

### 1.1 テストの目的

本テスト計画は、クレジットカード月間使用額管理システムの**全機能を網羅的に検証**し、以下を保証する:

1. **機能要件の充足**: 設計書に記載された全機能が正しく動作すること
2. **信頼性**: Gmail APIとの連携、メール解析、データ保存が安定して動作すること
3. **セキュリティ**: フィッシング対策、認証情報保護、インジェクション攻撃防御が機能すること
4. **保守性**: エッジケース・異常系でも適切にエラーハンドリングされること

### 1.2 テスト対象システム

```
[User] → [CLI / FastAPI] → [Gmail Sync Service] → [Gmail API]
                ↓                   ↓
         [Summary Service] ← [Parser Service] → [SQLite DB]
```

**主要コンポーネント**:
- **Gmail API連携** (`app/gmail/auth.py`, `app/gmail/client.py`): OAuth認証、メール取得、差分同期
- **メール解析エンジン** (`app/gmail/parser.py`): 7社のカード会社別パターンマッチング、金額・日時・店舗名抽出
- **データ層** (`app/models/transaction.py`, `app/database/connection.py`): SQLite CRUD操作、集計機能
- **サービス層** (`app/services/sync_service.py`, `app/services/summary_service.py`): ビジネスロジック統合
- **CLI/API** (`app/cli.py`, `app/main.py`): ユーザーインターフェース

### 1.3 テストスコープ

| 対象領域 | テスト件数 | 主要検証内容 |
|---------|----------|------------|
| **Gmail API連携** | 34件 | OAuth認証、メール取得、差分同期、エラーハンドリング、レート制限対策 |
| **メール解析** | 65件 | ドメイン検証、カード会社判別、金額/日時/店舗名抽出、重複処理、フィッシング対策 |
| **データ層** | 67件 | CRUD操作、データ整合性、集計機能、トランザクション処理、インデックス |
| **エッジケース** | 30件 | 不正フォーマット、重複処理、API異常、環境エラー |
| **セキュリティ** | 25件 | フィッシング対策、SQLインジェクション、XSS、認証情報保護、OWASP対応 |
| **E2E・統合** | 35件 | ユーザーシナリオ全体、コンポーネント間連携、実運用フロー |
| **合計** | **256件** | - |

### 1.4 テスト階層の定義

| テスト階層 | 定義 | 担当 | 対象ケース数 |
|----------|------|------|-----------|
| **Unit** | 単一関数・メソッドの入出力検証（外部API呼び出しをモック化） | 足軽 | 約150件 |
| **Integration** | コンポーネント間連携、実際のGmail API呼び出し、DB操作検証 | 足軽 | 約70件 |
| **E2E** | ユーザー視点の実利用フロー全体（CLI操作→システム全体→最終出力） | 家老 | 約36件 |

**重要**: E2Eテストは全エージェント操作権限を持つ家老が担当。足軽はUnit/Integrationのみ実施。

### 1.5 テスト優先度

| 優先度 | 定義 | 対象例 |
|-------|------|--------|
| **Critical** | システムのコア機能。失敗時はリリース不可 | OAuth認証、メール同期、金額抽出、DB保存、フィッシング対策 |
| **High** | 重要なユーザーシナリオ。失敗時は修正必須 | 月次集計、差分同期、重複処理、トークン暗号化 |
| **Medium** | 補助機能・エラーハンドリング。失敗時は要検討 | レート制限対策、パース失敗時のフォールバック |
| **Low** | エッジケース・最適化。将来的な改善対象 | 大量データ処理、パフォーマンス検証 |

### 1.6 前提条件

| 項目 | 要件 |
|------|------|
| **Python** | 3.11以上 |
| **SQLite** | 3.35.0以上（JSON関数、ウィンドウ関数サポート） |
| **テストフレームワーク** | pytest 8.0以上、pytest-cov 4.1以上 |
| **依存ライブラリ** | `google-api-python-client`, `google-auth-oauthlib`, `BeautifulSoup4`, `SQLAlchemy 2.0+` |
| **Google Cloud設定** | Gmail API有効化、OAuth 2.0クレデンシャル発行済み |
| **環境変数** | `TOKEN_ENCRYPTION_KEY`設定済み |
| **テストアカウント** | テスト用Gmailアカウント（クレジットカード通知メール受信済み） |
| **ネットワーク** | インターネット接続可能（Gmail API到達可能） |
| **テストデータ** | `tests/fixtures/sample_emails/` にサンプルメール配置済み |

### 1.7 テスト方針

#### 1.7.1 SKIP = FAIL扱い（CLAUDE.md Test Rules遵守）

**SKIP数が1以上の場合、テスト未完了として扱う。** 以下の場合、事前に家老に報告必須:

| SKIP理由 | 対処法 |
|---------|--------|
| credentials.json未配置 | セットアップ手順作成、家老に報告 |
| テストアカウント未準備 | 最低10通のメール準備後に再実行 |
| Gmail API無効化 | セットアップドキュメント追記 |
| ネットワーク到達不可 | Integration Testsをスキップして報告 |
| サンプルメール未配置 | `tests/fixtures/sample_emails/` に配置後に再実行 |

#### 1.7.2 前提条件チェック（Preflight Check）

**テスト実行前に前提条件を確認。満たせない場合は実行せず報告。**

```bash
# 前提条件チェックスクリプト例
python --version  # 3.11以上
poetry install --check  # 依存関係確認
ls credentials/credentials.json  # OAuth設定確認
ls tests/fixtures/sample_emails/*.eml | wc -l  # サンプルメール確認（最低10件）
```

#### 1.7.3 Critical Thinking Rule適用

- **適度な懐疑**: テスト計画の前提・制約を鵜呑みにせず、矛盾や欠落を検証
- **代替案提示**: より安全・高速・高品質なテスト方法を発見した場合、根拠つきで提案
- **問題の早期報告**: 実行中に前提崩れや設計欠陥を検知したら、即座にinboxで共有
- **実行バランス**: 批判的検討と実行速度を両立

#### 1.7.4 Destructive Operation Safety（破壊的操作の禁止）

テスト実行中、以下の操作は**絶対禁止**:
- `rm -rf` （プロジェクト外のパス削除）
- `git push --force` （履歴破壊）
- `git reset --hard` / `git clean -f` （コミット前の作業破棄）
- `sudo`, `chmod -R`, `chown -R` （システム権限変更）
- プロジェクト外のファイル削除・変更

### 1.8 カバレッジ目標

| モジュール | 目標カバレッジ |
|-----------|-------------|
| `app/gmail/auth.py` | 80%以上 |
| `app/gmail/client.py` | 80%以上 |
| `app/gmail/parser.py` | 95%以上 |
| `app/models/transaction.py` | 95%以上 |
| `app/database/connection.py` | 90%以上 |
| `app/services/sync_service.py` | 85%以上 |
| `app/services/summary_service.py` | 90%以上 |

---

## 2. テストケース一覧

### 2.1 Gmail API連携テスト（34件）

#### 2.1.1 OAuth 2.0認証フロー（8件）

| ID | テスト対象 | テスト内容 | 優先度 | テスト階層 | 前提条件 | 期待結果 |
|----|----------|----------|-------|----------|---------|---------|
| T-API-001 | 初回OAuth認証フロー | `credentials.json`のみ存在、`token.pickle`が存在しない状態で認証実行 | Critical | Integration | Google OAuth設定済み | ブラウザで認証ページが開き、承認後にtoken.pickleが生成される |
| T-API-002 | トークンの暗号化保存 | 認証成功時にtoken.pickleが暗号化されて保存される | High | Unit | TOKEN_ENCRYPTION_KEY設定済み | Fernet暗号化されたトークンファイルが生成される（生データ読み不可） |
| T-API-003 | 有効なトークンの再利用 | token.pickleが存在し、有効期限内の場合、再認証せずAPI呼び出しが成功 | Critical | Integration | 有効なtoken.pickle存在 | API呼び出しが即座に成功、再認証フローは発生しない |
| T-API-004 | トークンの自動リフレッシュ | アクセストークンが期限切れの場合、リフレッシュトークンで自動更新される | Critical | Integration | 期限切れトークン（手動で作成） | リフレッシュトークンで新しいアクセストークンが取得され、API呼び出しが成功 |
| T-API-005 | リフレッシュトークン失効時の処理 | リフレッシュトークンが無効な場合、`RefreshError`が発生し、再認証が促される | High | Unit | 無効なリフレッシュトークン（モック） | 例外が捕捉され、ユーザーに再認証フローを促すエラーメッセージが表示される |
| T-API-006 | スコープ検証 | 正しいスコープ（`gmail.readonly`）で認証されることを確認 | Medium | Unit | - | トークンに含まれるスコープが`gmail.readonly`であることを確認 |
| T-API-007 | 暗号化キー不正時のエラー | `TOKEN_ENCRYPTION_KEY`が未設定の場合、暗号化保存時にエラーが発生 | High | Unit | TOKEN_ENCRYPTION_KEY未設定 | `EnvironmentError`または`ValueError`が発生、エラーメッセージが明示的 |
| T-API-008 | トークンファイル破損時の処理 | token.pickleが破損している場合、再認証フローにフォールバック | Medium | Unit | 破損したtoken.pickle（手動作成） | ファイル読み込みエラーを捕捉し、再認証フローを開始 |

#### 2.1.2 メール取得機能（8件）

| ID | テスト対象 | テスト内容 | 優先度 | テスト階層 | 前提条件 | 期待結果 |
|----|----------|----------|-------|----------|---------|---------|
| T-API-009 | 基本クエリによるメール取得 | `from:@contact.vpass.ne.jp`クエリで三井住友カードのメールのみ取得 | Critical | Integration | テストアカウントに三井住友メール存在 | 三井住友カードのメールのみがレスポンスに含まれる |
| T-API-010 | 複合クエリによるメール取得 | 複数カード会社（`from:(@contact.vpass.ne.jp OR @qa.jcb.co.jp)`）のメール取得 | Critical | Integration | テストアカウントに複数社のメール存在 | 指定した複数ドメインのメールが取得される |
| T-API-011 | maxResults制限の動作確認 | `maxResults=10`を指定し、10件のみ取得されることを確認 | High | Integration | メールが10件以上存在 | レスポンスに10件のメールが含まれる |
| T-API-012 | ページネーション処理 | nextPageTokenを使用して全メールを取得 | Critical | Integration | メールが100件以上存在 | 複数ページにわたり全メールが取得される、nextPageToken=Noneで終了 |
| T-API-013 | 空の検索結果処理 | 存在しないクエリ（`from:nonexistent@example.com`）で空リストが返される | Medium | Integration | - | `messages`が空リスト、エラーは発生しない |
| T-API-014 | 不正なクエリ構文処理 | Gmail検索構文エラー（`from:`のみ）でHTTP 400エラーが発生 | High | Unit | - | `HttpError` (status=400)が発生、エラーログが記録される |
| T-API-015 | メッセージID取得のみ | `list()`でメッセージIDリストを取得し、本文は取得しない | Medium | Integration | - | `id`と`threadId`のみを含むメッセージリストが返される |
| T-API-016 | メッセージ本文取得 | `messages().get(id=message_id, format='full')`でメール本文を取得 | Critical | Integration | メッセージID既知 | 件名、本文、送信元が含まれたメッセージオブジェクトが返される |

#### 2.1.3 差分同期（History API）（5件）

| ID | テスト対象 | テスト内容 | 優先度 | テスト階層 | 前提条件 | 期待結果 |
|----|----------|----------|-------|----------|---------|---------|
| T-API-017 | 初回historyId取得 | 初回同期時に`historyId`をレスポンスから取得し保存 | High | Integration | - | `messages().list()`のレスポンスに`historyId`が含まれる |
| T-API-018 | History APIによる差分取得 | 前回の`historyId`を使用して新規メールのみ取得 | Critical | Integration | 前回のhistoryId保存済み | 前回以降に追加されたメッセージのみが返される |
| T-API-019 | historyId期限切れ処理 | 1週間以上前の`historyId`を指定した場合、HTTP 404エラーが発生 | Medium | Unit | 古いhistoryId（モック） | `HttpError` (status=404)が発生、全件取得にフォールバック |
| T-API-020 | historyTypesフィルタ | `historyTypes=['messageAdded']`で追加メッセージのみ取得 | High | Integration | 削除・ラベル変更イベント混在 | `messageAdded`イベントのみがレスポンスに含まれる |
| T-API-021 | History APIのページネーション | 差分同期時もnextPageTokenが存在する場合、全履歴を取得 | Medium | Integration | 大量の差分履歴存在 | 複数ページにわたり全履歴が取得される |

#### 2.1.4 エラーハンドリング（8件）

| ID | テスト対象 | テスト内容 | 優先度 | テスト階層 | 前提条件 | 期待結果 |
|----|----------|----------|-------|----------|---------|---------|
| T-API-022 | HTTP 401エラー処理（認証失敗） | 無効なトークンでAPI呼び出し時、自動リフレッシュを試行 | Critical | Unit | 無効なアクセストークン（モック） | トークンリフレッシュが実行され、再試行が成功する |
| T-API-023 | HTTP 403エラー処理（権限不足） | `gmail.modify`が必要な操作で`gmail.readonly`トークンを使用 | High | Unit | 読み取り専用トークン | `HttpError` (status=403)が発生、明確なエラーメッセージが表示される |
| T-API-024 | HTTP 404エラー処理（メッセージ不存在） | 削除済みメッセージIDを指定した場合、スキップされる | Medium | Unit | 存在しないメッセージID | エラーログが記録され、処理がスキップされる（例外は握りつぶされる） |
| T-API-025 | HTTP 429エラー処理（レート制限） | レート制限超過時、Exponential Backoffで再試行 | Critical | Unit | レート制限エラー（モック） | 2秒 → 4秒 → 8秒の待機後、最大3回再試行される |
| T-API-026 | HTTP 500/503エラー処理（サーバーエラー） | Googleサーバーエラー時、固定待機（3秒）後に再試行 | High | Unit | サーバーエラー（モック） | 3秒待機後、最大3回再試行される |
| T-API-027 | ネットワークタイムアウト処理 | API呼び出しがタイムアウトした場合、再試行される | High | Unit | タイムアウト（モック） | `socket.timeout`が捕捉され、再試行される |
| T-API-028 | 最大再試行回数超過時の処理 | 3回の再試行後も失敗した場合、例外が発生 | High | Unit | 常に失敗するAPI（モック） | `Exception("API call failed after retries")`が発生 |
| T-API-029 | 不正なJSONレスポンス処理 | APIレスポンスが不正なJSON形式の場合、パースエラーが処理される | Medium | Unit | 不正なJSON（モック） | `json.JSONDecodeError`が捕捉され、エラーログが記録される |

#### 2.1.5 レート制限対策（4件）

| ID | テスト対象 | テスト内容 | 優先度 | テスト階層 | 前提条件 | 期待結果 |
|----|----------|----------|-------|----------|---------|---------|
| T-API-030 | Exponential Backoffの実装 | レート制限エラー時、2^n秒の待機時間が計算される | High | Unit | - | 1回目=2秒、2回目=4秒、3回目=8秒の待機時間が設定される |
| T-API-031 | バッチリクエストの動作確認 | 50件のメッセージIDをバッチリクエストで取得 | Medium | Integration | メッセージID 50件以上 | 1回のAPI呼び出しで50件のメッセージ本文が取得される |
| T-API-032 | バッチリクエストの上限超過処理 | 51件以上のメッセージを複数バッチに分割して取得 | Medium | Unit | メッセージID 51件以上 | 50件と1件の2回のバッチリクエストに分割される |
| T-API-033 | クォータ消費の最小化検証 | 差分同期使用時、`list()`より`history()`のクォータ消費が少ない | Low | Integration | 差分同期可能状態 | `history()`が2 units/call、`list()`が5 units/callであることを確認 |

#### 2.1.6 Gmail API統合テスト（1件）

| ID | テスト対象 | テスト内容 | 優先度 | テスト階層 | 前提条件 | 期待結果 |
|----|----------|----------|-------|----------|---------|---------|
| T-API-034 | 初回同期〜差分同期の全フロー | 初回同期でhistoryId保存 → 新規メール受信 → 差分同期で新規メールのみ取得 | Critical | Integration | テストアカウント | 2回目の同期で新規メールのみが取得される（既読メールは重複しない） |

### 2.2 メール解析エンジンテスト（65件）

#### 2.2.1 送信元ドメイン検証（11件）

| ID | テスト対象 | テスト内容 | 優先度 | テスト階層 | 期待結果 |
|----|----------|----------|-------|----------|---------|
| T-PARSE-001 | 三井住友ドメイン検証 | `from: @contact.vpass.ne.jp` | Critical | Unit | `is_trusted_domain() → True` |
| T-PARSE-002 | JCBドメイン検証 | `from: @qa.jcb.co.jp` | Critical | Unit | `is_trusted_domain() → True` |
| T-PARSE-003 | 楽天ドメイン検証(メイン) | `from: @mail.rakuten-card.co.jp` | Critical | Unit | `is_trusted_domain() → True` |
| T-PARSE-004 | 楽天ドメイン検証(サブ1) | `from: @mkrm.rakuten.co.jp` | High | Unit | `is_trusted_domain() → True` |
| T-PARSE-005 | 楽天ドメイン検証(サブ2) | `from: @bounce.rakuten-card.co.jp` | High | Unit | `is_trusted_domain() → True` |
| T-PARSE-006 | AMEXドメイン検証(メイン) | `from: @aexp.com` | High | Unit | `is_trusted_domain() → True` |
| T-PARSE-007 | AMEXドメイン検証(サブ1) | `from: @americanexpress.com` | High | Unit | `is_trusted_domain() → True` |
| T-PARSE-008 | AMEXドメイン検証(サブ2) | `from: @email.americanexpress.com` | High | Unit | `is_trusted_domain() → True` |
| T-PARSE-009 | フィッシングドメイン検出 | `from: @fake-vpass.com` (偽ドメイン) | Critical | Unit | `is_trusted_domain() → False` |
| T-PARSE-010 | 不明なドメイン検出 | `from: @unknown-bank.com` | High | Unit | `is_trusted_domain() → False` |
| T-PARSE-011 | セゾンメール非対応警告 | セゾン名義のメール受信 | Medium | Unit | `Warning: セゾンカードはメール配信なし(フィッシング疑い)` |

#### 2.2.2 カード会社判別（6件）

| ID | テスト対象 | テスト内容 | 優先度 | テスト階層 | 期待結果 |
|----|----------|----------|-------|----------|---------|
| T-PARSE-020 | 三井住友判別(件名) | `subject: 【三井住友カード】ご利用のお知らせ` | Critical | Unit | `detect_card_company() → "三井住友"` |
| T-PARSE-021 | JCB判別(件名) | `subject: 【JCB】カードご利用のお知らせ` | Critical | Unit | `detect_card_company() → "JCB"` |
| T-PARSE-022 | 楽天判別(件名) | `subject: 【楽天カード】カード利用のお知らせ` | Critical | Unit | `detect_card_company() → "楽天"` |
| T-PARSE-023 | AMEX判別(件名) | `subject: 【American Express】カードご利用のお知らせ` | High | Unit | `detect_card_company() → "AMEX"` |
| T-PARSE-024 | dカード判別(件名) | `subject: 【dカード】カードご利用速報` | High | Unit | `detect_card_company() → "dカード"` |
| T-PARSE-025 | 判別不能ケース | `subject: カード利用通知` (会社名なし) | Medium | Unit | `detect_card_company() → None` |

#### 2.2.3 金額抽出（19件）

| ID | テスト対象 | テスト内容 | 優先度 | テスト階層 | 期待結果 |
|----|----------|----------|-------|----------|---------|
| T-PARSE-030 | 三井住友金額抽出(基本) | `利用金額: 1,234円` | Critical | Unit | `amount=1234` |
| T-PARSE-031 | 三井住友金額抽出(全角コロン) | `利用金額:5,678円` | Critical | Unit | `amount=5678` |
| T-PARSE-032 | 三井住友金額抽出(カンマなし) | `利用金額: 100円` | High | Unit | `amount=100` |
| T-PARSE-033 | 三井住友金額抽出(大金額) | `利用金額: 1,234,567円` | Medium | Unit | `amount=1234567` |
| T-PARSE-040 | JCB金額抽出(基本) | `ご利用金額: 2,500円` | Critical | Unit | `amount=2500` |
| T-PARSE-041 | JCB金額抽出(全角コロン) | `ご利用金額:3,000円` | Critical | Unit | `amount=3000` |
| T-PARSE-042 | JCB金額抽出(速報版) | `ご利用金額(速報): 1,500円` | High | Unit | `amount=1500` |
| T-PARSE-050 | 楽天金額抽出(基本) | `利用金額: 4,500円` | Critical | Unit | `amount=4500` |
| T-PARSE-051 | 楽天金額抽出(速報版) | `利用金額(速報): 1,200円` | High | Unit | `amount=1200` |
| T-PARSE-052 | 楽天金額抽出(確定版) | `利用金額(確定): 1,200円` | High | Unit | `amount=1200` |
| T-PARSE-060 | AMEX金額抽出(基本) | `ご利用金額: 8,900円` | High | Unit | `amount=8900` |
| T-PARSE-061 | AMEX金額抽出(円マーク付) | `金額: ¥ 5,000円` | High | Unit | `amount=5000` |
| T-PARSE-062 | AMEX金額抽出(短縮形) | `金額: 3,000円` | Medium | Unit | `amount=3000` |
| T-PARSE-070 | dカード金額抽出(基本) | `利用金額: 1,800円` | High | Unit | `amount=1800` |
| T-PARSE-071 | dカード金額抽出(短縮形) | `金額: 2,400円` | Medium | Unit | `amount=2400` |
| T-PARSE-080 | 汎用金額抽出(パターン1) | `ご利用金額: 6,700円` (不明カード) | High | Unit | `amount=6700` |
| T-PARSE-081 | 汎用金額抽出(パターン2) | `XXX円形式: 4,200円` | Medium | Unit | `amount=4200` |
| T-PARSE-082 | 金額抽出失敗ケース | 金額情報なしメール | Medium | Unit | `amount=None` |

#### 2.2.4 利用日時抽出（11件）

| ID | テスト対象 | テスト内容 | 優先度 | テスト階層 | 期待結果 |
|----|----------|----------|-------|----------|---------|
| T-PARSE-090 | 三井住友日時抽出(基本) | `利用日: 2026/02/15 14:30` | Critical | Unit | `datetime=2026-02-15 14:30:00` |
| T-PARSE-091 | 三井住友日時抽出(全角コロン) | `利用日:2026/02/15 14:30` | High | Unit | `datetime=2026-02-15 14:30:00` |
| T-PARSE-100 | JCB日時抽出(基本) | `ご利用日時: 2026/02/15 18:45` | Critical | Unit | `datetime=2026-02-15 18:45:00` |
| T-PARSE-101 | JCB日時抽出(日本時間) | `ご利用日時(日本時間): 2026/02/15 10:00` | High | Unit | `datetime=2026-02-15 10:00:00` |
| T-PARSE-110 | 楽天日時抽出(日付のみ) | `利用日: 2026/02/15` | Critical | Unit | `datetime=2026-02-15 00:00:00` |
| T-PARSE-111 | 楽天日時抽出(時刻付) | `利用日: 2026/02/15 12:30` | High | Unit | `datetime=2026-02-15 12:30:00` |
| T-PARSE-120 | 汎用日時抽出(ISO形式) | `2026-02-15 14:30` | High | Unit | `datetime=2026-02-15 14:30:00` |
| T-PARSE-121 | 汎用日時抽出(スラッシュ) | `2026/02/15 14:30` | High | Unit | `datetime=2026-02-15 14:30:00` |
| T-PARSE-122 | 日時抽出失敗ケース | 日時情報なしメール | Medium | Unit | `datetime=None` |

#### 2.2.5 店舗名抽出（10件）

| ID | テスト対象 | テスト内容 | 優先度 | テスト階層 | 期待結果 |
|----|----------|----------|-------|----------|---------|
| T-PARSE-130 | 三井住友店舗名抽出(基本) | `ご利用先店名: セブンイレブン` | Critical | Unit | `merchant="セブンイレブン"` |
| T-PARSE-131 | 三井住友店舗名抽出(長文) | `ご利用先店名: Amazon.co.jp マーケットプレイス` | High | Unit | `merchant="Amazon.co.jp マーケットプレイス"` |
| T-PARSE-140 | JCB店舗名抽出(基本) | `ご利用先: ローソン` | Critical | Unit | `merchant="ローソン"` |
| T-PARSE-141 | JCB店舗名抽出(速報版) | `ご利用先(速報): スターバックス` | High | Unit | `merchant="スターバックス"` |
| T-PARSE-150 | 楽天店舗名抽出(基本) | `利用先: ファミリーマート` | Critical | Unit | `merchant="ファミリーマート"` |
| T-PARSE-151 | 楽天店舗名抽出(海外店舗) | `利用先: STARBUCKS SEATTLE USA` | High | Unit | `merchant="STARBUCKS SEATTLE USA"` |
| T-PARSE-160 | 汎用店舗名抽出 | `ご利用先: イオンモール` | High | Unit | `merchant="イオンモール"` |
| T-PARSE-161 | 店舗名抽出失敗ケース | 店舗名情報なしメール | Medium | Unit | `merchant=None` |

#### 2.2.6 重複処理（楽天カード速報版・確定版）（4件）

| ID | テスト対象 | テスト内容 | 優先度 | テスト階層 | 期待結果 |
|----|----------|----------|-------|----------|---------|
| T-PARSE-170 | 速報版メール処理 | 楽天カード速報版メールを処理 | Critical | Integration | DB登録成功、`gmail_message_id=msg_001` |
| T-PARSE-171 | 確定版メール重複検出 | 同じ取引の確定版メールを処理 | Critical | Integration | `IntegrityError` → スキップ、ログ記録 |
| T-PARSE-172 | 異なる取引の処理 | 別の取引の速報版メールを処理 | High | Integration | DB登録成功、`gmail_message_id=msg_002` |
| T-PARSE-173 | 重複スキップログ確認 | 重複メール処理時 | High | Integration | ログに `Duplicate email skipped: msg_001` 記録 |

#### 2.2.7 フィッシングメール誤判定防止（4件）

| ID | テスト対象 | テスト内容 | 優先度 | テスト階層 | 期待結果 |
|----|----------|----------|-------|----------|---------|
| T-PARSE-180 | フィッシングメール検出(偽三井住友) | `from: fake-vpass@example.com`, `subject: 【三井住友カード】` | Critical | Integration | `is_verified=False`, DB未登録、警告ログ |
| T-PARSE-181 | フィッシングメール検出(偽楽天) | `from: rakuten-card@scam.com`, `subject: 【楽天カード】` | Critical | Integration | `is_verified=False`, DB未登録、警告ログ |
| T-PARSE-182 | フィッシングメール検出(偽セゾン) | `from: saison@fake.com`, `subject: 【セゾンカード】利用確認` | High | Integration | 警告: `セゾンはメール配信なし(フィッシング確定)` |
| T-PARSE-183 | 正規メール正常処理 | `from: noreply@contact.vpass.ne.jp`, 三井住友正規メール | Critical | Integration | `is_verified=True`, DB登録成功 |

### 2.3 データ層テスト（67件）

#### 2.3.1 CRUD操作（29件）

**Create（INSERT）操作（12件）**

| ID | テスト対象 | テスト内容 | 優先度 | テスト階層 | 期待結果 |
|----|----------|----------|-------|----------|---------|
| T-DATA-001 | INSERT基本操作 | 全カラムに有効なデータを挿入 | Critical | Unit | レコードが正常に挿入され、idが自動採番される |
| T-DATA-002 | INSERT（merchantがNULL） | merchant列をNULLで挿入 | High | Unit | レコードが正常に挿入される（NULL許容列） |
| T-DATA-003 | INSERT（gmail_message_id重複） | 既存のgmail_message_idと同じ値を挿入 | Critical | Unit | IntegrityError発生、ロールバックされる |
| T-DATA-004 | INSERT（NOT NULL制約違反） | card_companyをNULLで挿入 | Critical | Unit | IntegrityError発生、レコード挿入失敗 |
| T-DATA-005 | INSERT（created_atのDEFAULT値） | created_atを指定せずに挿入 | High | Unit | 現在時刻が自動設定される |
| T-DATA-006 | INSERT（is_verifiedのDEFAULT値） | is_verifiedを指定せずに挿入 | High | Unit | デフォルト値0（False）が設定される |
| T-DATA-007 | INSERT（境界値：金額0円） | amountに0を挿入 | High | Unit | レコードが正常に挿入される |
| T-DATA-008 | INSERT（境界値：金額負数） | amountに-1000を挿入 | Medium | Unit | レコードが挿入される（アプリ層でバリデーション推奨） |
| T-DATA-009 | INSERT（境界値：金額巨額） | amountに999999999（10億円未満）を挿入 | Medium | Unit | レコードが正常に挿入される |
| T-DATA-010 | INSERT（特殊文字を含む店舗名） | merchantに「`<script>alert('XSS')</script>`」を挿入 | High | Unit | レコードが正常に挿入される（SQLインジェクション対策検証） |
| T-DATA-011 | INSERT（日本語店舗名） | merchantに「イオンモール幕張新都心店」を挿入 | Medium | Unit | レコードが正常に挿入される |
| T-DATA-012 | INSERT（日時形式ISO 8601） | transaction_dateに`'2026-02-15 14:30:00'`を挿入 | High | Unit | レコードが正常に挿入される |

**Read（SELECT）操作（8件）**

| ID | テスト対象 | テスト内容 | 優先度 | テスト階層 | 期待結果 |
|----|----------|----------|-------|----------|---------|
| T-DATA-013 | SELECT全件取得 | テーブル全体を取得 | High | Unit | 挿入済み全レコードが返却される |
| T-DATA-014 | SELECT（WHERE card_company） | card_company='三井住友'で絞り込み | High | Unit | 該当レコードのみ返却される |
| T-DATA-015 | SELECT（WHERE is_verified=1） | 信頼できるメールのみ取得 | High | Unit | is_verified=1のレコードのみ返却される |
| T-DATA-016 | SELECT（ORDER BY transaction_date DESC） | 取引日時の降順でソート | Medium | Unit | 最新の取引が最初に返却される |
| T-DATA-017 | SELECT（LIKE検索：merchant） | merchantに'Amazon'を含むレコード検索 | Medium | Unit | 部分一致でヒットする |
| T-DATA-018 | SELECT（日付範囲指定） | transaction_dateが2026-02-01〜2026-02-28の範囲 | High | Unit | 該当期間のレコードのみ返却される |
| T-DATA-019 | SELECT（gmail_message_idでユニーク検索） | 特定のgmail_message_idで検索 | High | Unit | 0件または1件のみ返却される（UNIQUE制約） |
| T-DATA-020 | SELECT（インデックス使用確認） | EXPLAIN QUERY PLANでインデックス使用を確認 | Medium | Unit | idx_card_company, idx_transaction_dateが使用される |

**Update（UPDATE）操作（5件）**

| ID | テスト対象 | テスト内容 | 優先度 | テスト階層 | 期待結果 |
|----|----------|----------|-------|----------|---------|
| T-DATA-021 | UPDATE基本操作 | is_verifiedを0から1に更新 | High | Unit | 対象レコードが更新される |
| T-DATA-022 | UPDATE（merchant修正） | merchantを'Amazon'から'Amazon.co.jp'に修正 | Medium | Unit | レコードが更新される |
| T-DATA-023 | UPDATE（gmail_message_id変更→重複） | 既存のgmail_message_idに変更 | Critical | Unit | IntegrityError発生、ロールバック |
| T-DATA-024 | UPDATE（WHERE条件なし） | WHERE句なしで全レコードのis_verifiedを1に更新 | Medium | Unit | 全レコードが更新される |
| T-DATA-025 | UPDATE（存在しないIDを指定） | id=999999で更新 | Low | Unit | 0件更新（エラーなし） |

**Delete（DELETE）操作（4件）**

| ID | テスト対象 | テスト内容 | 優先度 | テスト階層 | 期待結果 |
|----|----------|----------|-------|----------|---------|
| T-DATA-026 | DELETE基本操作 | 特定のidでレコード削除 | High | Unit | 対象レコードが削除される |
| T-DATA-027 | DELETE（WHERE条件複数） | card_company='楽天' AND is_verified=0で削除 | Medium | Unit | 該当レコードのみ削除される |
| T-DATA-028 | DELETE（全件削除） | WHERE句なしで全削除 | Low | Unit | 全レコードが削除される |
| T-DATA-029 | DELETE（存在しないIDを指定） | id=999999で削除 | Low | Unit | 0件削除（エラーなし） |

#### 2.3.2 データ整合性（12件）

| ID | テスト対象 | テスト内容 | 優先度 | テスト階層 | 期待結果 |
|----|----------|----------|-------|----------|---------|
| T-DATA-030 | UNIQUE制約（gmail_message_id） | 同じgmail_message_idを2回挿入 | Critical | Unit | 2回目でIntegrityError発生 |
| T-DATA-031 | NOT NULL制約（card_company） | card_companyをNULLで挿入 | Critical | Unit | IntegrityError発生 |
| T-DATA-032 | NOT NULL制約（amount） | amountをNULLで挿入 | Critical | Unit | IntegrityError発生 |
| T-DATA-033 | NOT NULL制約（transaction_date） | transaction_dateをNULLで挿入 | Critical | Unit | IntegrityError発生 |
| T-DATA-034 | NOT NULL制約（email_subject） | email_subjectをNULLで挿入 | Critical | Unit | IntegrityError発生 |
| T-DATA-035 | NOT NULL制約（email_from） | email_fromをNULLで挿入 | Critical | Unit | IntegrityError発生 |
| T-DATA-036 | NOT NULL制約（gmail_message_id） | gmail_message_idをNULLで挿入 | Critical | Unit | IntegrityError発生 |
| T-DATA-037 | NULL許容（merchant） | merchantをNULLで挿入 | High | Unit | レコードが正常に挿入される |
| T-DATA-038 | PRIMARY KEY自動採番 | idを指定せずに連続挿入 | High | Unit | id=1, 2, 3...と自動採番される |
| T-DATA-039 | PRIMARY KEY重複挿入 | 明示的に同じidを2回挿入 | High | Unit | 2回目でIntegrityError発生 |
| T-DATA-040 | BOOLEAN型（is_verified） | is_verifiedに0, 1, True, Falseを挿入 | Medium | Unit | 全て正常に挿入され、SQLiteで0/1として保存される |
| T-DATA-041 | TEXT型の文字数制限なし | merchantに10,000文字の文字列を挿入 | Low | Unit | レコードが正常に挿入される（SQLiteのTEXT制限検証） |

#### 2.3.3 集計機能（14件）

**月次集計ビュー（9件）**

| ID | テスト対象 | テスト内容 | 優先度 | テスト階層 | 期待結果 |
|----|----------|----------|-------|----------|---------|
| T-DATA-042 | 月次集計（基本） | 2026-02の三井住友カード利用額を集計 | Critical | Integration | SUM(amount)が正しく計算される |
| T-DATA-043 | 月次集計（複数カード） | 2026-02の全カード会社の合計を集計 | Critical | Integration | カード会社別にグルーピングされる |
| T-DATA-044 | 月次集計（COUNT集計） | 2026-02の取引件数をカウント | High | Integration | COUNT(*)が正しく返却される |
| T-DATA-045 | 月次集計（AVG集計） | 2026-02の平均利用額を算出 | High | Integration | AVG(amount)が正しく計算される |
| T-DATA-046 | 月次集計（is_verified=0除外） | is_verified=0のレコードが集計から除外されるか確認 | Critical | Integration | 信頼できるメール（is_verified=1）のみ集計される |
| T-DATA-047 | 月次集計（ORDER BY total_amount DESC） | 金額降順でソート | Medium | Integration | 最大利用カードが最初に返却される |
| T-DATA-048 | 月次集計（データなし） | 該当月にレコードが0件の場合 | Medium | Integration | 空の結果セットが返却される（エラーなし） |
| T-DATA-049 | 月次集計（境界値：0円レコード含む） | amountが0円のレコードも集計対象 | Medium | Integration | SUM, AVG計算に含まれる |
| T-DATA-050 | 月次集計（strftime関数検証） | transaction_dateから年月を抽出 | High | Integration | 'YYYY-MM'形式で正しくグルーピングされる |

**カスタム集計クエリ（5件）**

| ID | テスト対象 | テスト内容 | 優先度 | テスト階層 | 期待結果 |
|----|----------|----------|-------|----------|---------|
| T-DATA-051 | カード別累計（全期間） | 三井住友カードの累計利用額を集計 | High | Integration | SUM(amount)が正しく計算される |
| T-DATA-052 | 日別集計 | 2026-02-15の日別利用額を集計 | Medium | Integration | strftime('%Y-%m-%d')でグルーピング |
| T-DATA-053 | 店舗別集計（TOP 10） | 利用頻度の高い店舗TOP 10を抽出 | Medium | Integration | GROUP BY merchant, ORDER BY COUNT(*) DESC LIMIT 10 |
| T-DATA-054 | 期間指定集計（3ヶ月間） | 2026-01〜2026-03の3ヶ月間集計 | High | Integration | WHERE transaction_date BETWEEN ... |
| T-DATA-055 | 最大・最小金額取得 | MAX(amount), MIN(amount)を取得 | Medium | Integration | 正しい最大値・最小値が返却される |

#### 2.3.4 トランザクション処理（6件）

| ID | テスト対象 | テスト内容 | 優先度 | テスト階層 | 期待結果 |
|----|----------|----------|-------|----------|---------|
| T-DATA-056 | COMMIT（正常系） | INSERT → COMMIT | Critical | Integration | レコードが永続化される |
| T-DATA-057 | ROLLBACK（異常系） | INSERT → エラー → ROLLBACK | Critical | Integration | レコードが挿入されない |
| T-DATA-058 | IntegrityError時の自動ロールバック | gmail_message_id重複挿入 → 自動ロールバック | Critical | Integration | DB状態が変更前に戻る |
| T-DATA-059 | 複数INSERT → 途中でエラー → 全ロールバック | 3件挿入、2件目でエラー → 全件ロールバック | High | Integration | 1件目、3件目も挿入されない（原子性） |
| T-DATA-060 | トランザクション分離レベル（デフォルト） | SQLiteのデフォルト分離レベルを確認 | Medium | Integration | `PRAGMA read_uncommitted`で確認（デフォルト=0） |
| T-DATA-061 | 同時書き込み（SQLite LOCK） | 2つのトランザクションが同時にINSERT | Low | Integration | 1つはロック待ち → 順次処理される |

#### 2.3.5 インデックス・パフォーマンス（6件）

| ID | テスト対象 | テスト内容 | 優先度 | テスト階層 | 期待結果 |
|----|----------|----------|-------|----------|---------|
| T-DATA-062 | インデックス使用確認（transaction_date） | EXPLAIN QUERY PLAN: WHERE transaction_date BETWEEN ... | High | Unit | idx_transaction_dateが使用される |
| T-DATA-063 | インデックス使用確認（card_company） | EXPLAIN QUERY PLAN: WHERE card_company='三井住友' | High | Unit | idx_card_companyが使用される |
| T-DATA-064 | インデックス使用確認（is_verified） | EXPLAIN QUERY PLAN: WHERE is_verified=1 | High | Unit | idx_is_verifiedが使用される |
| T-DATA-065 | インデックスなしクエリ（merchant） | EXPLAIN QUERY PLAN: WHERE merchant LIKE '%Amazon%' | Medium | Unit | SCAN TABLE（インデックス未使用、期待動作） |
| T-DATA-066 | クエリ実行時間測定（1万件） | 1万件のレコードに対してSELECT実行 | Low | Integration | 100ms以内（参考値、環境依存） |
| T-DATA-067 | インデックス再構築 | REINDEX実行後のクエリパフォーマンス | Low | Integration | パフォーマンス劣化なし |

### 2.4 エッジケーステスト（30件）

| ID | 対象 | テストシナリオ | 期待される防御挙動 | 優先度 | テスト階層 |
|----|------|--------------|-----------------|-------|----------|
| T-EDGE-001 | メール解析 | HTMLタグ不完全（閉じタグなし） | パース失敗を検知、ログ記録、処理スキップ | Critical | Unit |
| T-EDGE-002 | メール解析 | 文字エンコーディング異常（Shift-JIS → UTF-8誤変換） | 文字化け検知、警告ログ、部分的データ保存 | High | Unit |
| T-EDGE-003 | メール解析 | UTF-8 BOM付きメール本文 | BOM除去後に正常パース | Medium | Unit |
| T-EDGE-004 | メール解析 | 金額フィールド欠損（「利用金額」の記載なし） | NULLまたは0円として保存、`is_verified=0`フラグ設定 | Critical | Unit |
| T-EDGE-005 | メール解析 | 日時フィールド欠損（「利用日」の記載なし） | パース失敗、該当メールをスキップ、ログ記録 | Critical | Unit |
| T-EDGE-006 | メール解析 | 店舗名フィールド欠損 | `merchant=NULL`として保存（許容） | Low | Unit |
| T-EDGE-007 | メール解析 | 金額に不正文字（"1,234X円"） | パース失敗、ログ記録、処理スキップ | High | Unit |
| T-EDGE-008 | メール解析 | 金額が0円 | 正常データとして保存（エラーではない） | Medium | Unit |
| T-EDGE-009 | メール解析 | 金額が負の値（"-1,234円"） | パース失敗またはエラーフラグ、ログ記録 | High | Unit |
| T-EDGE-010 | メール解析 | 金額が極端に大きい（100億円超） | オーバーフロー防止、INT上限チェック、警告ログ | High | Unit |
| T-EDGE-011 | メール解析 | 日時が未来の日付（2027年など） | 警告ログ記録、`is_verified=0`フラグ設定 | Medium | Unit |
| T-EDGE-012 | メール解析 | 日時がうるう年境界値（2月29日/30日） | 正常パース（2/29は許容、2/30は拒否） | Medium | Unit |
| T-EDGE-013 | メール解析 | 店舗名が異常に長い（1000文字超） | 切り捨てまたは長さ制限、警告ログ | Low | Unit |
| T-EDGE-014 | メール解析 | 店舗名に特殊文字（改行、NULL文字、制御文字） | サニタイズ処理、危険文字除去 | High | Unit |
| T-EDGE-015 | メール解析 | カード会社判別失敗（件名が未知パターン） | 不明カード会社として記録、`is_verified=0` | Medium | Unit |
| T-EDGE-016 | メール解析 | 複数カード会社名が件名に混在 | 最初にマッチしたカード会社を採用、警告ログ | Low | Unit |
| T-EDGE-017 | 重複処理 | 同一Gmail message IDを2回取得 | 2回目の挿入時にINTEGRITY ERRORでスキップ | Critical | Integration |
| T-EDGE-018 | 重複処理 | 楽天カード速報版→確定版（金額異なる） | 速報版のみ保存、確定版はmessage ID重複でスキップ | High | Integration |
| T-EDGE-019 | 重複処理 | 楽天カード速報版→確定版（金額同じ） | 速報版のみ保存、確定版はmessage ID重複でスキップ | High | Integration |
| T-EDGE-020 | Gmail API | APIレスポンスが空（`messages: []`） | 処理スキップ、ログに「新規メールなし」記録 | Medium | Integration |
| T-EDGE-021 | Gmail API | ページネーション中にnextPageToken=null | ループ終了、取得済みメールのみ処理 | Medium | Integration |
| T-EDGE-022 | Gmail API | メール本文取得時に404エラー（削除済み） | 該当メールをスキップ、ログ記録、次のメールへ | Medium | Integration |
| T-EDGE-023 | Gmail API | 大量メール取得時のメモリ不足 | バッチ処理（100件ずつ）、メモリ使用量監視 | High | Integration |
| T-EDGE-024 | DB保存 | SQLiteファイルが読み取り専用 | エラー検知、ユーザーに権限変更を促すエラーメッセージ | High | Integration |
| T-EDGE-025 | DB保存 | ディスク容量不足 | 挿入失敗検知、明確なエラーメッセージ表示 | High | Integration |
| T-EDGE-026 | DB保存 | トランザクション途中でクラッシュ | ロールバック保証、次回起動時に再試行 | Medium | Integration |
| T-EDGE-027 | OAuth認証 | トークンファイルが破損（pickle読込失敗） | 再認証フロー開始、ユーザーにブラウザ認証を促す | High | Integration |
| T-EDGE-028 | OAuth認証 | リフレッシュトークンが失効済み | RefreshError捕捉、再認証フロー開始 | Critical | Integration |
| T-EDGE-029 | OAuth認証 | credentials.jsonが存在しない | 明確なエラーメッセージ、セットアップガイドへ誘導 | High | Integration |
| T-EDGE-030 | 環境変数 | TOKEN_ENCRYPTION_KEYが未設定 | 暗号化失敗検知、環境変数設定を促すエラー | High | Integration |

### 2.5 セキュリティテスト（25件）

| ID | 対象 | 攻撃シナリオ | 期待される防御挙動 | 優先度 | OWASP分類 |
|----|------|------------|-----------------|-------|-----------|
| T-SEC-001 | フィッシング対策 | 送信元が不正ドメイン（`@fake-vpass.ne.jp`） | ドメイン検証失敗、`is_verified=0`、警告ログ | Critical | A07:2021 認証の失敗 |
| T-SEC-002 | フィッシング対策 | セゾンカードからのメール（セゾンはメール送信しない） | 自動的にフィッシング判定、データ保存しない、警告ログ | Critical | A07:2021 認証の失敗 |
| T-SEC-003 | フィッシング対策 | 件名は正規、ドメインが不正（三井住友を騙る） | ドメインホワイトリストで検証、`is_verified=0` | Critical | A07:2021 認証の失敗 |
| T-SEC-004 | フィッシング対策 | 送信元アドレスのDisplay Name偽装 | Fromヘッダーのドメイン部のみ検証（Display Name無視） | High | A07:2021 認証の失敗 |
| T-SEC-005 | SQLインジェクション | 店舗名に`'; DROP TABLE card_transactions;--`を含む | プレースホルダー使用、エスケープ処理、実行阻止 | Critical | A03:2021 インジェクション |
| T-SEC-006 | SQLインジェクション | 店舗名に`' OR '1'='1`を含む | プレースホルダー使用、SQLとして実行されない | Critical | A03:2021 インジェクション |
| T-SEC-007 | XSS（格納型） | 店舗名に`<script>alert('XSS')</script>`を含む | HTML出力時にエスケープ、スクリプト実行阻止 | Critical | A03:2021 インジェクション |
| T-SEC-008 | XSS（格納型） | 店舗名に`<img src=x onerror=alert(1)>`を含む | HTML出力時にエスケープ、スクリプト実行阻止 | Critical | A03:2021 インジェクション |
| T-SEC-009 | コマンドインジェクション | 店舗名に`; rm -rf /`を含む | コマンド実行機能なし（該当処理なし）、念のためログ監視 | High | A03:2021 インジェクション |
| T-SEC-010 | パストラバーサル | Gmail message IDに`../../../etc/passwd`を含む | ファイル名サニタイズ、危険文字除去 | High | A01:2021 アクセス制御の不備 |
| T-SEC-011 | 認証情報漏洩 | token.pickleファイルが平文で保存 | Fernet暗号化されている、平文保存されていない | Critical | A02:2021 暗号化の失敗 |
| T-SEC-012 | 認証情報漏洩 | ログにOAuthトークンが出力 | トークンをログに出力しない、マスク処理 | Critical | A09:2021 セキュリティログの失敗 |
| T-SEC-013 | 認証情報漏洩 | credentials.jsonが.gitignore対象外 | .gitignoreに含まれる、Gitにコミットされない | Critical | A05:2021 セキュリティ設定ミス |
| T-SEC-014 | APIレート制限 | 429エラー（Rate Limit Exceeded） | Exponential Backoff実装、2秒→4秒→8秒待機 | High | A04:2021 安全でない設計 |
| T-SEC-015 | APIレート制限 | 連続100回のAPI呼び出し | レート制限に到達しない、またはBackoffで回復 | High | A04:2021 安全でない設計 |
| T-SEC-016 | 認証エラー | 401エラー（Unauthorized、トークン期限切れ） | 自動リフレッシュ実行、失敗時は再認証フロー | Critical | A07:2021 認証の失敗 |
| T-SEC-017 | 認証エラー | 403エラー（Forbidden、スコープ不足） | エラーメッセージ表示、スコープ追加方法を案内 | High | A07:2021 認証の失敗 |
| T-SEC-018 | CSRF | FastAPI `/api/sync`エンドポイントへの不正リクエスト | CSRFトークン検証（またはSameSite Cookie） | High | A01:2021 アクセス制御の不備 |
| T-SEC-019 | DoS攻撃 | 極端に大きいHTML（10MB超のメール本文） | サイズ上限チェック、パース前にサイズ検証 | Medium | A04:2021 安全でない設計 |
| T-SEC-020 | 正規表現DoS（ReDoS） | 正規表現に対する悪意のある入力（大量バックトラック） | タイムアウト設定、複雑度の低い正規表現使用 | Medium | A04:2021 安全でない設計 |
| T-SEC-021 | 機密情報漏洩 | SQLiteファイルの権限が777（全ユーザー読取可能） | ファイル権限600推奨、Dockerコンテナ内で適切な権限設定 | High | A05:2021 セキュリティ設定ミス |
| T-SEC-022 | 機密情報漏洩 | エラーメッセージに内部パスが含まれる | 本番環境でスタックトレース非表示、汎用エラーメッセージ | Medium | A09:2021 セキュリティログの失敗 |
| T-SEC-023 | 中間者攻撃（MITM） | OAuth認証時のHTTP接続 | HTTPS強制、証明書検証 | Critical | A02:2021 暗号化の失敗 |
| T-SEC-024 | トークン盗難 | token.pickleファイルが盗まれた場合 | 暗号化されているため、環境変数KEYなしでは復号不可 | High | A02:2021 暗号化の失敗 |
| T-SEC-025 | 依存ライブラリ脆弱性 | google-api-python-clientに既知の脆弱性 | 定期的な依存関係更新、`poetry update`実施 | Medium | A06:2021 脆弱な古いコンポーネント |

### 2.6 E2E・統合テスト（35件）

#### 2.6.1 初回セットアップシナリオ（4件）

| ID | テスト対象 | シナリオ | 優先度 | テスト階層 | 前提条件 | テスト内容 | 期待結果 |
|----|----------|---------|-------|-----------|---------|----------|---------|
| T-E2E-001 | OAuth認証フロー | 初回起動時のOAuth 2.0認証完了 | Critical | E2E | credentials.jsonが存在、token.pickleが存在しない | 1. CLI `sync`コマンド実行<br>2. ブラウザで認証URL自動表示<br>3. Googleログイン & 権限承認<br>4. 認可コード取得<br>5. token.pickle作成確認 | 認証成功メッセージ表示、token.pickleファイル生成、暗号化されたトークン保存 |
| T-E2E-002 | 初回メール全件取得 | OAuth認証後、過去のクレカ通知メール全件取得 | Critical | E2E | OAuth認証済み、SQLite DB初期化済み | 1. CLI `sync`コマンド実行<br>2. Gmail API経由でメール取得（最大500件）<br>3. 各メールを解析・DB保存<br>4. 同期完了メッセージ表示 | "X件の新規取引を追加しました"表示、SQLiteに全取引データ保存、gmail_message_idがユニーク |
| T-E2E-003 | トークン自動リフレッシュ | アクセストークン期限切れ時の自動更新 | Critical | Integration | token.pickleが存在（期限切れ）、リフレッシュトークンが有効 | 1. 期限切れトークンで同期実行<br>2. リフレッシュトークンで自動更新<br>3. 新アクセストークンでAPI呼び出し成功 | エラーなく同期完了、token.pickle更新、ユーザー操作不要 |
| T-E2E-004 | OAuth再認証フロー | リフレッシュトークン失効時の再認証 | High | E2E | token.pickleが存在（リフレッシュトークン失効） | 1. 同期実行<br>2. RefreshError検出<br>3. 再認証フロー開始<br>4. ユーザーに再ログイン促す | "トークンが失効しました。再認証してください"表示、ブラウザで認証URL開く |

#### 2.6.2 日次メール同期シナリオ（5件）

| ID | テスト対象 | シナリオ | 優先度 | テスト階層 | 前提条件 | テスト内容 | 期待結果 |
|----|----------|---------|-------|-----------|---------|----------|---------|
| T-E2E-010 | 差分同期（History API） | 2回目以降の同期で差分のみ取得 | High | Integration | 初回同期完了済み、historyId保存済み、新規メール1件受信 | 1. CLI `sync`実行<br>2. History API呼び出し（前回のhistoryId使用）<br>3. 新規メール1件のみ取得<br>4. DB保存 | "1件の新規取引を追加"表示、全件取得せず差分のみ処理、高速化（API呼び出し削減） |
| T-E2E-011 | 重複メール除外（楽天速報版・確定版） | 同一取引の速報版・確定版メールを1件のみ保存 | High | Integration | 楽天カード速報版メール受信済み、確定版メールも受信 | 1. 速報版メール同期（DB保存成功）<br>2. 確定版メール同期実行<br>3. gmail_message_idで重複検知<br>4. IntegrityErrorで挿入スキップ | "Duplicate email skipped"ログ出力、DBには1件のみ保存、同期処理は継続 |
| T-E2E-012 | 複数カード会社メール混在同期 | 三井住友・JCB・楽天カードのメールを一度に同期 | Critical | E2E | 各カード会社のメールが3件ずつ受信済み | 1. CLI `sync`実行<br>2. 9件のメール取得<br>3. カード会社別パーサー振り分け<br>4. 全メール解析・DB保存 | "9件の新規取引を追加"表示、各カード会社フィールドに正しい値、全メール正常処理 |
| T-E2E-013 | パース失敗時のフォールバック | 金額抽出失敗時の汎用パターン適用 | Medium | Integration | カード会社別パターンで抽出失敗するメール受信 | 1. カード会社別パターンマッチ失敗<br>2. 汎用パターン（FALLBACK_AMOUNT_PATTERN）適用<br>3. 抽出成功 → DB保存 | 警告ログ"Fallback pattern used"出力、金額は正しく抽出、同期処理継続 |
| T-E2E-014 | パース完全失敗時の処理 | 金額・日時が一切抽出できないメールのスキップ | Medium | Integration | 解析不可能なメール（広告メール等） | 1. 全パターンで抽出失敗<br>2. エラーログ記録<br>3. 当該メールスキップ<br>4. 次のメール処理継続 | "Failed to parse email {message_id}"ログ出力、DBに保存されない、処理中断しない |

#### 2.6.3 月次レポート表示シナリオ（4件）

| ID | テスト対象 | シナリオ | 優先度 | テスト階層 | 前提条件 | テスト内容 | 期待結果 |
|----|----------|---------|-------|-----------|---------|----------|---------|
| T-E2E-020 | 月次集計表示（CLI） | 指定月のカード別利用額集計表示 | Critical | E2E | 2026-02の取引データ10件保存済み（三井住友5件、JCB3件、楽天2件） | 1. CLI `summary --month 2026-02`実行<br>2. SQLビュー`monthly_summary`クエリ<br>3. カード会社別集計<br>4. フォーマット出力 | 月: 2026-02、三井住友: 合計X円（5件）、JCB: 合計Y円（3件）、楽天: 合計Z円（2件）、総合計: X+Y+Z円 |
| T-E2E-021 | 全期間集計表示 | 全月の集計データを時系列表示 | High | E2E | 複数月のデータ保存済み（2026-01、2026-02、2026-03） | 1. CLI `summary`（月指定なし）実行<br>2. 全期間データ取得<br>3. 月降順ソート表示 | 2026-03 → 2026-02 → 2026-01の順で表示、各月のカード別集計、月別総合計 |
| T-E2E-022 | 未検証メール除外集計 | is_verified=0のメールを集計から除外 | High | Integration | is_verified=1のデータ8件、is_verified=0のデータ2件（不明ドメイン） | 1. CLI `summary --month 2026-02`実行<br>2. SQLビュークエリ（WHERE is_verified=1） | 集計結果: 8件のみ、不明ドメインメールは合計額に含まれない |
| T-E2E-023 | 空データ月の表示 | データが存在しない月の集計 | Medium | E2E | 2026-05のデータなし | 1. CLI `summary --month 2026-05`実行 | "2026-05の取引データはありません"表示、エラーなく正常終了 |

#### 2.6.4 セキュリティ検証シナリオ（4件）

| ID | テスト対象 | シナリオ | 優先度 | テスト階層 | 前提条件 | テスト内容 | 期待結果 |
|----|----------|---------|-------|-----------|---------|----------|---------|
| T-E2E-030 | 送信元ドメイン検証（信頼できるドメイン） | 三井住友カード公式ドメインからのメール処理 | Critical | Integration | 送信元: `xxx@contact.vpass.ne.jp` | 1. メール同期実行<br>2. ドメインホワイトリスト検証<br>3. is_verified=1でDB保存 | "Verified email from 三井住友"ログ出力、is_verified=1、DB保存成功 |
| T-E2E-031 | フィッシングメール検出 | 不明ドメインからのメールを警告 | Critical | Integration | 送信元: `xxx@fake-vpass-scam.com`（偽装ドメイン） | 1. メール同期実行<br>2. ドメイン検証失敗<br>3. 警告ログ記録<br>4. is_verified=0でDB保存 | "WARNING: Unverified domain detected"ログ出力、is_verified=0、集計には含まれない |
| T-E2E-032 | トークン暗号化保存 | token.pickleが暗号化されている | High | Integration | OAuth認証完了 | 1. token.pickle読み込み<br>2. 平文でないことを確認<br>3. 環境変数`TOKEN_ENCRYPTION_KEY`で復号化成功 | ファイル内容が暗号化バイナリ、正しいキーで復号化可能、誤ったキーで復号化失敗 |
| T-E2E-033 | OAuth スコープ検証 | 必要最小限のスコープのみ使用 | High | Integration | 認証フロー実行中 | 1. 認証URLのスコープ確認<br>2. `gmail.readonly`のみ使用 | スコープ: `https://www.googleapis.com/auth/gmail.readonly`、書き込み権限なし |

#### 2.6.5 エラーハンドリングシナリオ（5件）

| ID | テスト対象 | シナリオ | 優先度 | テスト階層 | 前提条件 | テスト内容 | 期待結果 |
|----|----------|---------|-------|-----------|---------|----------|---------|
| T-E2E-040 | Gmail APIレート制限（429エラー） | レート制限超過時のExponential Backoff | High | Integration | Gmail API: 429レスポンス返却するようモック設定 | 1. 同期実行 → 429エラー<br>2. 2秒待機後リトライ<br>3. 再度429 → 4秒待機<br>4. 3回目成功 | "Rate limit exceeded, retrying in 2s..."ログ出力、最大3回リトライ、最終的に成功 |
| T-E2E-041 | Gmail APIサーバーエラー（500/503） | Googleサーバーエラー時の固定待機リトライ | Medium | Integration | Gmail API: 500エラー返却 | 1. 同期実行 → 500エラー<br>2. 3秒待機後リトライ<br>3. 成功 | "Server error, retrying in 3s..."ログ出力、3秒待機、リトライ成功 |
| T-E2E-042 | Gmail API認証エラー（401） | トークン無効時の自動リフレッシュ | Critical | Integration | 無効なアクセストークン使用 | 1. API呼び出し → 401エラー<br>2. リフレッシュトークンで自動更新<br>3. 新トークンで再試行成功 | "Token expired, refreshing..."ログ出力、token.pickle更新、ユーザー操作不要で成功 |
| T-E2E-043 | ネットワーク切断時の処理 | インターネット接続なし時のエラーハンドリング | Medium | E2E | ネットワーク切断状態 | 1. CLI `sync`実行<br>2. ConnectionErrorキャッチ<br>3. エラーメッセージ表示<br>4. プログラム異常終了なし | "ネットワークエラー: 接続を確認してください"表示、スタックトレースなし、終了コード: 1 |
| T-E2E-044 | SQLiteデータベースロック | 同時書き込み時のロック処理 | Medium | Integration | DB書き込み中に2つ目の同期実行 | 1. 1つ目の同期実行（長時間トランザクション）<br>2. 2つ目の同期実行<br>3. DatabaseLockedErrorキャッチ<br>4. リトライまたはエラーメッセージ | "Database is locked, retrying..."ログ出力、最大5秒待機後リトライ、またはエラーメッセージ表示 |

#### 2.6.6 カード会社別パーサーテスト（統合）（6件）

| ID | テスト対象 | シナリオ | 優先度 | テスト階層 | 前提条件 | テスト内容 | 期待結果 |
|----|----------|---------|-------|-----------|---------|----------|---------|
| T-E2E-050 | 三井住友カードメール解析 | 三井住友カードの利用通知メール解析 | Critical | Integration | 実際のメールサンプル（fixtures/sample_emails/smbc.eml） | 1. メール読み込み<br>2. 金額・日時・店舗名抽出<br>3. Transactionオブジェクト生成 | card_company: "三井住友"、amount: 3500（円）、transaction_date: "2026-02-15 14:30:00"、merchant: "セブンイレブン渋谷店"、is_verified: 1 |
| T-E2E-051 | JCBカードメール解析 | JCBカードの利用通知メール解析 | Critical | Integration | 実際のメールサンプル（fixtures/sample_emails/jcb.eml） | 1. メール読み込み<br>2. 金額・日時・店舗名抽出 | card_company: "JCB"、amount: 12800、transaction_date: "2026-02-14 18:45:00"、merchant: "Amazon.co.jp"、is_verified: 1 |
| T-E2E-052 | 楽天カードメール解析（速報版） | 楽天カード速報版メール解析 | Critical | Integration | 実際のメールサンプル（fixtures/sample_emails/rakuten_preliminary.eml） | 1. メール読み込み<br>2. 金額・日時・店舗名抽出 | card_company: "楽天"、amount: 5400、transaction_date: "2026-02-13 12:00:00"、merchant: "楽天市場"、is_verified: 1 |
| T-E2E-053 | AMEXメール解析 | American Expressメール解析 | High | Integration | 実際のメールサンプル（fixtures/sample_emails/amex.eml） | 1. メール読み込み<br>2. 金額・日時・店舗名抽出 | card_company: "AMEX"、amount: 25000、transaction_date: "2026-02-12"、merchant: "ヨドバシカメラ"、is_verified: 1 |
| T-E2E-054 | dカードメール解析 | dカードメール解析（パターン推測） | High | Integration | 実際のメールサンプル（fixtures/sample_emails/dcard.eml） | 1. メール読み込み<br>2. 金額・日時・店舗名抽出 | card_company: "dカード"、amount: 8900、transaction_date: "2026-02-11"、merchant: "ローソン"、is_verified: 1 |
| T-E2E-055 | 複数カード会社混在処理 | 全カード会社のメールを一括解析 | Critical | Integration | 6社のメールサンプル各1件ずつ | 1. 6件のメール一括処理<br>2. カード会社判別<br>3. カード会社別パーサー適用<br>4. 全件DB保存 | 6件全て正常解析、各カード会社フィールド正確、DB保存成功 |

#### 2.6.7 FastAPI統合テスト（4件）

| ID | テスト対象 | シナリオ | 優先度 | テスト階層 | 前提条件 | テスト内容 | 期待結果 |
|----|----------|---------|-------|-----------|---------|----------|---------|
| T-E2E-060 | FastAPI月次集計エンドポイント | `GET /api/summary/{month}`の動作検証 | High | Integration | 2026-02のデータ10件保存済み | 1. `GET /api/summary/2026-02`リクエスト<br>2. JSONレスポンス取得 | ステータスコード: 200、JSON形式レスポンス、カード会社別集計データ含む |
| T-E2E-061 | FastAPI手動同期エンドポイント | `POST /api/sync`で同期トリガー | High | Integration | OAuth認証済み、新規メール3件受信済み | 1. `POST /api/sync`リクエスト<br>2. 同期処理実行<br>3. レスポンス取得 | ステータスコード: 200、`{"status": "success", "new_transactions": 3}`、DB保存成功 |
| T-E2E-062 | FastAPI Swagger UI | `/docs`でAPI仕様確認 | Medium | E2E | FastAPI起動中 | 1. ブラウザで`http://localhost:8000/docs`アクセス<br>2. Swagger UI表示確認 | Swagger UI正常表示、全エンドポイント一覧表示、Try it out機能動作 |
| T-E2E-063 | FastAPIエラーレスポンス（認証エラー） | 未認証状態でAPI呼び出し時のエラー | High | Integration | token.pickleが存在しない | 1. `POST /api/sync`リクエスト<br>2. 認証エラー検出 | ステータスコード: 401、`{"error": "Not authenticated"}`、エラーメッセージ表示 |

#### 2.6.8 パフォーマンス・スケーラビリティ（3件）

| ID | テスト対象 | シナリオ | 優先度 | テスト階層 | 前提条件 | テスト内容 | 期待結果 |
|----|----------|---------|-------|-----------|---------|----------|---------|
| T-E2E-070 | 大量メール同期 | 500件のメールを一度に同期 | Low | E2E | Gmail受信箱に500件のメール存在 | 1. 初回同期実行<br>2. 500件全メール取得<br>3. パース・DB保存<br>4. 処理時間計測 | 全件正常処理、処理時間: 5分以内（目安）、メモリエラーなし |
| T-E2E-071 | ページネーション処理 | 100件を超えるメールのページネーション取得 | Medium | Integration | Gmail受信箱に200件のメール存在 | 1. API呼び出し（maxResults=100）<br>2. nextPageToken取得<br>3. 2ページ目取得<br>4. 全200件取得完了 | ページネーション正常動作、全200件取得、重複なし |
| T-E2E-072 | 長期間データの集計パフォーマンス | 1年分（12ヶ月）のデータ集計 | Low | E2E | 2025-01〜2025-12の取引データ各100件（計1200件） | 1. CLI `summary`（全期間）実行<br>2. 集計処理時間計測 | 処理時間: 3秒以内、全12ヶ月分表示、メモリエラーなし |

---

## 3. テストデータ準備方針

### 3.1 OAuth認証設定

| 項目 | 準備内容 |
|------|---------|
| Google Cloud Console設定 | Gmail API有効化、OAuth 2.0クライアントID作成（デスクトップアプリ） |
| credentials.json | ダウンロードして`credentials/`に配置 |
| リダイレクトURI | `http://localhost`（ローカル認証フロー用） |
| テスト用スコープ | `https://www.googleapis.com/auth/gmail.readonly` |

### 3.2 テスト用Gmailアカウント

| 要件 | 準備方法 |
|------|---------|
| 専用アカウント作成 | `card-tracker-test@gmail.com`のような専用アカウントを作成 |
| サンプルメール準備 | 実際のクレジットカード通知メールを10〜20通転送 |
| カード会社の多様性 | 三井住友、JCB、楽天の3社のメールを含める |
| メールの時系列分散 | 過去1週間〜1ヶ月の範囲でメールを分散配置（差分同期テスト用） |

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
│   ├── basic.eml
│   ├── large_amount.eml
│   └── no_merchant.eml
├── jcb/
│   ├── basic.eml
│   ├── preliminary.eml
│   └── foreign_shop.eml
├── rakuten/
│   ├── preliminary.eml
│   ├── confirmed.eml
│   └── basic.eml
├── amex/
│   ├── basic.eml
│   └── yen_symbol.eml
├── dcard/
│   ├── basic.eml
│   └── domestic.eml
├── phishing/
│   ├── fake_mitsui_sumitomo.eml
│   ├── fake_rakuten.eml
│   └── fake_saison.eml
└── edge_cases/
    ├── broken_html_unclosed_tags.eml
    ├── encoding_shiftjis_to_utf8.eml
    ├── utf8_bom.eml
    └── (その他30件のエッジケースメール)
```

### 3.4 pytest Fixture定義

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
```

### 3.5 モックオブジェクト（Gmail API エラーレスポンス）

```python
from googleapiclient.errors import HttpError
from unittest.mock import Mock

# T-API-025: 429 Rate Limit
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
```

### 3.6 境界値テストデータ

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
    ],
    "date": [
        "2026-02-29",         # T-EDGE-012: うるう年（2026年は平年→不正）
        "2024-02-29",         # T-EDGE-012: うるう年（2024年は閏年→正常）
        "2027-12-31",         # T-EDGE-011: 未来日付
    ]
}
```

### 3.7 インジェクション攻撃パターン

```python
# T-SEC-005/006: SQLインジェクション
sql_injection_patterns = [
    "'; DROP TABLE card_transactions;--",
    "' OR '1'='1",
    "1' UNION SELECT * FROM card_transactions--",
]

# T-SEC-007/008: XSS攻撃
xss_patterns = [
    "<script>alert('XSS')</script>",
    "<img src=x onerror=alert(1)>",
    "<iframe src='javascript:alert(1)'>",
]

# T-SEC-009: コマンドインジェクション
command_injection_patterns = [
    "; rm -rf /",
    "| cat /etc/passwd",
    "`whoami`",
]
```

---

## 4. テスト実施時の注意事項

### 4.1 CLAUDE.md Test Rules遵守

#### 4.1.1 SKIP = FAIL扱い

**テスト報告でSKIP数が1以上なら「テスト未完了」扱い。** 以下の場合、報告YAMLに「テスト未完了」と明記し、SKIP理由を詳述する。

| SKIP理由 | 対処法 |
|---------|--------|
| credentials.json未配置 | テスト環境セットアップ不足 → セットアップ手順を作成し、家老に報告 |
| テストアカウント未準備 | サンプルメール不足 → 最低10通のメールを準備してから再実行 |
| Gmail API無効化 | Google Cloud設定不足 → セットアップドキュメントに追記 |
| ネットワーク到達不可 | 環境問題 → 実行環境を変更するか、Integration Testsをスキップして報告 |
| サンプルメール未配置 | テストデータ不足 → `tests/fixtures/sample_emails/` に配置してから再実行 |

#### 4.1.2 前提条件チェック（Preflight Check）

**テスト実行前に前提条件を確認。満たせないなら実行せず報告。**

| 前提条件 | 確認方法 | 満たせない場合の対処 |
|---------|---------|------------------|
| Pythonバージョン 3.11+ | `python --version` | バージョンアップまたはpyenv使用 |
| poetryインストール済み | `poetry --version` | 公式手順でインストール |
| 依存ライブラリインストール済み | `poetry install` | 事前実行 |
| pytestインストール済み | `pytest --version` | `poetry add --dev pytest` |
| テストフィクスチャ配置済み | `tests/fixtures/`の存在確認 | テストデータ準備スクリプト実行 |
| SQLiteファイル書込権限 | `touch data/test.db && rm data/test.db` | 権限変更 `chmod 755 data/` |
| 環境変数設定 | `.env`ファイル存在確認 | `.env.example`をコピー |

### 4.2 推奨実行順序（依存関係考慮）

```
Phase 1: Unit Tests（単体）
  → データ層CRUD・整合性（T-DATA-001〜041）
  → データ層インデックス（T-DATA-062〜067）
  → メール解析（ドメイン検証、カード会社判別、抽出処理）（T-PARSE-001〜161）
  → エッジケース（パース失敗系）（T-EDGE-001〜016）
  → セキュリティ（インジェクション攻撃）（T-SEC-005〜010）
  → Gmail API（モック使用）（T-API-001〜033）

Phase 2: Integration Tests（コンポーネント連携）
  → データ層集計・トランザクション（T-DATA-042〜061）
  → メール解析統合（重複処理、フィッシング対策）（T-PARSE-170〜183）
  → エッジケース（Gmail API、DB、OAuth）（T-EDGE-017〜030）
  → セキュリティ（フィッシング対策、認証、API）（T-SEC-001〜004, T-SEC-011〜025）
  → Gmail API（実API使用）（T-API-034）
  → E2E（初回同期、差分同期、月次集計等）（T-E2E-001〜063）

Phase 3: E2E Tests（全体シナリオ）- 家老担当
  → OAuth認証フロー（T-E2E-001〜004）
  → 日次メール同期（T-E2E-010〜014）
  → 月次レポート表示（T-E2E-020〜023）
  → セキュリティ検証（T-E2E-030〜033）
  → エラーハンドリング（T-E2E-040〜044）
  → カード会社別パーサー（T-E2E-050〜055）
  → FastAPI統合（T-E2E-060〜063）
  → パフォーマンス（T-E2E-070〜072）
```

### 4.3 Critical Thinking適用

- **適度な懐疑**: テスト計画の前提・制約を鵜呑みにせず、矛盾や欠落を検証
- **代替案提示**: より安全・高速・高品質なテスト方法を発見した場合、根拠つきで提案
- **問題の早期報告**: 実行中に前提崩れや設計欠陥を検知したら、即座にinboxで家老に共有
- **実行バランス**: 批判的検討と実行速度を両立

### 4.4 テスト実行コマンド

```bash
# 全テスト実行
pytest tests/ -v

# カバレッジ測定付き
pytest --cov=app --cov-report=html

# 階層別実行
pytest -m unit -v              # Unitテストのみ
pytest -m integration -v        # Integrationテストのみ
pytest -m e2e -v                # E2Eテストのみ（家老のみ）

# 優先度別実行
pytest -m critical -v           # Criticalのみ
pytest -m "critical or high" -v # Critical + High

# 分野別実行
pytest tests/test_gmail_api.py -v
pytest tests/test_parser.py -v
pytest tests/test_data_layer.py -v
pytest tests/test_edge_cases.py -v
pytest tests/test_security.py -v
pytest tests/test_e2e.py -v
```

---

## 5. 付録

### 5.1 テストケース総数サマリ

#### 5.1.1 分野別サマリ

| 分野 | テストケース数 |
|------|-------------|
| Gmail API連携 | 34件 |
| メール解析エンジン | 65件 |
| データ層 | 67件 |
| エッジケース | 30件 |
| セキュリティ | 25件 |
| E2E・統合 | 35件 |
| **総計** | **256件** |

#### 5.1.2 階層別サマリ

| テスト階層 | テストケース数 |
|----------|-------------|
| Unit | 約150件 |
| Integration | 約70件 |
| E2E | 約36件 |
| **総計** | **256件** |

#### 5.1.3 優先度別サマリ

| 優先度 | テストケース数 | 割合 |
|-------|-------------|------|
| Critical | 約90件 | 35% |
| High | 約100件 | 39% |
| Medium | 約55件 | 21% |
| Low | 約11件 | 4% |
| **総計** | **256件** | 100% |

### 5.2 OWASP Top 10 対応マトリックス

| OWASP分類 | 該当テストID | カバー率 |
|-----------|------------|---------|
| A01:2021 アクセス制御の不備 | T-SEC-010, T-SEC-018 | 2件 |
| A02:2021 暗号化の失敗 | T-SEC-011, T-SEC-023, T-SEC-024 | 3件 |
| A03:2021 インジェクション | T-SEC-005〜009 | 5件 |
| A04:2021 安全でない設計 | T-SEC-014, T-SEC-015, T-SEC-019, T-SEC-020 | 4件 |
| A05:2021 セキュリティ設定ミス | T-SEC-013, T-SEC-021 | 2件 |
| A06:2021 脆弱な古いコンポーネント | T-SEC-025 | 1件 |
| A07:2021 認証の失敗 | T-SEC-001〜004, T-SEC-016, T-SEC-017 | 6件 |
| A09:2021 セキュリティログの失敗 | T-SEC-012, T-SEC-022 | 2件 |

**カバレッジ**: OWASP Top 10のうち8項目をカバー（未カバー: A08 ソフトウェアとデータの整合性、A10 サーバサイドリクエストフォージェリ）

### 5.3 参考資料

- [Gmail API Testing Guide](https://developers.google.com/workspace/gmail/api/guides/testing)
- [OAuth 2.0 Testing Best Practices](https://developers.google.com/identity/protocols/oauth2/policies)
- [Exponential Backoff Algorithm](https://cloud.google.com/iot/docs/how-tos/exponential-backoff)
- [OWASP Top 10 2021](https://owasp.org/Top10/)
- [pytest Documentation](https://docs.pytest.org/)
- [SQLAlchemy Testing Guide](https://docs.sqlalchemy.org/en/20/orm/session_transaction.html)

### 5.4 既知の制約事項

| 制約 | 影響 | 回避策 |
|------|------|--------|
| Gmail APIレート制限（250 units/sec/user） | Integration Tests大量実行で制限到達の可能性 | テスト間に0.5秒のsleep挿入 |
| historyId有効期限（1週間） | T-API-019の検証が困難 | 古いhistoryIdを手動で生成（過去のバックアップから） |
| OAuth初回認証のブラウザ操作 | T-API-001の自動化困難 | 半自動テスト（手動認証 → 自動検証） |
| トークン暗号化キーの環境依存 | CI/CD環境でテスト失敗の可能性 | .env.testで固定キーを使用 |
| カード会社がメール形式を変更 | パターン抽出失敗の可能性 | 定期的なパターン検証、パース失敗時のログ記録 |

### 5.5 セゾンカード特記事項

**セゾンカードはメール配信を行わない**（セゾンPortalアプリのプッシュ通知のみ）。

- セゾン名義のメールを受信した場合、**フィッシングメール確定**として扱う
- テストケースに含める: T-PARSE-011, T-PARSE-182, T-SEC-002
- README.md、設計ドキュメントに「セゾンカード非対応」を明記

### 5.6 エポス・オリコカード対応

**エポス・オリコカードは今後対応予定**（Phase 2で実メールサンプル収集後にパターン追加）。

---

**最終統合完了日時**: 2026-02-16
**統合元計画書数**: 3ファイル（Part1: 105件、Part2: 122件、E2E: 35件）
**重複除外数**: 6件（T-PARSE-190〜195をT-E2E-050〜055に集約）
**最終テストケース数**: 256件
**次のアクション**: 実装時にこのテスト計画書に基づいてテストコード作成、pytest実行、カバレッジレポート提出
