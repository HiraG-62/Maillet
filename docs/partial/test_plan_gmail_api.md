# Gmail API連携テスト計画書

**プロジェクト**: card-spending-tracker
**対象モジュール**: `app/gmail/auth.py`, `app/gmail/client.py`
**作成日**: 2026-02-15
**担当**: 足軽1号（Gmail API連携テスト専門家）

---

## 1. Gmail API連携テスト概要

### 1.1 テスト目的

Gmail API連携機能の網羅的なテストを実施し、以下を検証する:

- **OAuth 2.0認証フロー**の正常動作（初回認証、トークンリフレッシュ、失効時の再認証）
- **メール取得処理**の信頼性（クエリフィルタ、ページネーション、差分同期）
- **エラーハンドリング**の適切性（API障害、ネットワークエラー、権限不足）
- **レート制限対策**の有効性（Exponential Backoff、リトライロジック）

### 1.2 テスト対象コンポーネント

| モジュール | ファイルパス | 主要機能 |
|-----------|-------------|---------|
| OAuth認証 | `app/gmail/auth.py` | トークン取得・リフレッシュ・暗号化保存 |
| Gmail APIクライアント | `app/gmail/client.py` | メール取得・差分同期・エラーハンドリング |
| トークンストレージ | `credentials/token.pickle` | トークン永続化（暗号化） |

### 1.3 テスト実施前提条件

| 項目 | 要件 |
|------|------|
| **Google Cloud設定** | Gmail API有効化、OAuth 2.0クレデンシャル発行済み |
| **環境変数** | `TOKEN_ENCRYPTION_KEY`設定済み |
| **テストアカウント** | テスト用Gmailアカウント（クレジットカード通知メール受信済み） |
| **依存ライブラリ** | `google-api-python-client`, `google-auth-oauthlib`インストール済み |
| **ネットワーク** | インターネット接続可能（Gmail API到達可能） |

### 1.4 テスト階層分類

| 階層 | 定義 | 担当 |
|------|------|------|
| **Unit** | 単一関数・メソッドのテスト（外部API呼び出しをモック化） | 足軽 |
| **Integration** | 実際のGmail APIを呼び出すテスト（テストアカウント使用） | 足軽（sandbox環境） |
| **E2E** | 認証〜メール取得〜DB保存の全フロー検証 | 家老 |

---

## 2. テストケース一覧

### 2.1 OAuth 2.0認証フローテスト

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

### 2.2 メール取得機能テスト

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

### 2.3 差分同期（History API）テスト

| ID | テスト対象 | テスト内容 | 優先度 | テスト階層 | 前提条件 | 期待結果 |
|----|----------|----------|-------|----------|---------|---------|
| **T-API-017** | 初回historyId取得 | 初回同期時に`historyId`をレスポンスから取得し保存 | High | Integration | - | `messages().list()`のレスポンスに`historyId`が含まれる |
| **T-API-018** | History APIによる差分取得 | 前回の`historyId`を使用して新規メールのみ取得 | Critical | Integration | 前回のhistoryId保存済み | 前回以降に追加されたメッセージのみが返される |
| **T-API-019** | historyId期限切れ処理 | 1週間以上前の`historyId`を指定した場合、HTTP 404エラーが発生 | Medium | Unit | 古いhistoryId（モック） | `HttpError` (status=404)が発生、全件取得にフォールバック |
| **T-API-020** | historyTypesフィルタ | `historyTypes=['messageAdded']`で追加メッセージのみ取得 | High | Integration | 削除・ラベル変更イベント混在 | `messageAdded`イベントのみがレスポンスに含まれる |
| **T-API-021** | History APIのページネーション | 差分同期時もnextPageTokenが存在する場合、全履歴を取得 | Medium | Integration | 大量の差分履歴存在 | 複数ページにわたり全履歴が取得される |

### 2.4 エラーハンドリングテスト

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

### 2.5 レート制限対策テスト

| ID | テスト対象 | テスト内容 | 優先度 | テスト階層 | 前提条件 | 期待結果 |
|----|----------|----------|-------|----------|---------|---------|
| **T-API-030** | Exponential Backoffの実装 | レート制限エラー時、2^n秒の待機時間が計算される | High | Unit | - | 1回目=2秒、2回目=4秒、3回目=8秒の待機時間が設定される |
| **T-API-031** | バッチリクエストの動作確認 | 50件のメッセージIDをバッチリクエストで取得 | Medium | Integration | メッセージID 50件以上 | 1回のAPI呼び出しで50件のメッセージ本文が取得される |
| **T-API-032** | バッチリクエストの上限超過処理 | 51件以上のメッセージを複数バッチに分割して取得 | Medium | Unit | メッセージID 51件以上 | 50件と1件の2回のバッチリクエストに分割される |
| **T-API-033** | クォータ消費の最小化検証 | 差分同期使用時、`list()`より`history()`のクォータ消費が少ない | Low | Integration | 差分同期可能状態 | `history()`が2 units/call、`list()`が5 units/callであることを確認 |

### 2.6 統合テスト（複合シナリオ）

| ID | テスト対象 | テスト内容 | 優先度 | テスト階層 | 前提条件 | 期待結果 |
|----|----------|----------|-------|----------|---------|---------|
| **T-API-034** | 初回同期〜差分同期の全フロー | 初回同期でhistoryId保存 → 新規メール受信 → 差分同期で新規メールのみ取得 | Critical | Integration | テストアカウント | 2回目の同期で新規メールのみが取得される（既読メールは重複しない） |
| **T-API-035** | トークンリフレッシュ中の同期継続 | 同期中にトークンが期限切れになった場合、自動リフレッシュして処理継続 | High | Integration | 期限切れ直前のトークン | トークンリフレッシュが発生し、同期処理が正常完了する |
| **T-API-036** | 複数ページ取得中のレート制限発生 | ページネーション処理中にレート制限が発生した場合、Backoff後に継続 | Medium | Unit | レート制限発生（モック） | 待機後、nextPageTokenを使用して処理が継続される |
| **T-API-037** | 500件上限の初回同期 | 500件以上のメールが存在する場合、500件まで取得し、nextPageTokenを保存 | Medium | Integration | メール500件以上存在 | 500件が取得され、残りは次回同期で取得される（履歴保持） |

---

## 3. テストデータ準備方針

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

### 3.3 モックデータ

| テストケース | モックデータ | 準備方法 |
|-------------|-------------|---------|
| **T-API-005** | 無効なリフレッシュトークン | `unittest.mock`で`google.auth.exceptions.RefreshError`を発生させる |
| **T-API-014** | 不正なクエリ構文 | `googleapiclient.errors.HttpError`（status=400）をモック |
| **T-API-025** | レート制限エラー | `HttpError`（status=429）をモックし、リトライロジックを検証 |
| **T-API-026** | サーバーエラー | `HttpError`（status=500/503）をモック |
| **T-API-029** | 不正なJSONレスポンス | API呼び出しの戻り値を`'invalid json'`（文字列）にモック |

### 3.4 テスト環境変数

```bash
# .env.test
TOKEN_ENCRYPTION_KEY=test-encryption-key-32-characters-long
GMAIL_TEST_ACCOUNT=card-tracker-test@gmail.com
DATABASE_PATH=data/test_transactions.db
```

---

## 4. テスト実行方針

### 4.1 テスト実行順序

1. **Unit Tests** (T-API-002, T-API-005, T-API-006, T-API-007, T-API-008, T-API-014, T-API-022〜T-API-030, T-API-032, T-API-036)
   - モックを使用した単体テスト
   - Gmail APIへの実通信なし
   - 高速実行可能

2. **Integration Tests** (T-API-001, T-API-003, T-API-004, T-API-009〜T-API-021, T-API-031, T-API-033〜T-API-035, T-API-037)
   - 実際のGmail APIを使用
   - テストアカウント必須
   - レート制限に注意（順次実行）

3. **E2E Tests**
   - 家老が担当（足軽はスキップ）
   - 認証〜メール取得〜DB保存の全フロー検証

### 4.2 テスト実行コマンド

```bash
# Unitテストのみ実行（高速）
pytest tests/test_gmail_auth.py tests/test_gmail_client.py -m unit

# Integrationテストのみ実行（実API使用）
pytest tests/test_gmail_auth.py tests/test_gmail_client.py -m integration --slow

# 全テスト実行（カバレッジ測定）
pytest tests/ --cov=app/gmail --cov-report=html
```

### 4.3 成功基準

| 基準 | 目標値 |
|------|-------|
| **テストカバレッジ** | 80%以上（`app/gmail/auth.py`, `app/gmail/client.py`） |
| **全テスト成功率** | 100%（SKIP=0） |
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

### 5.2 テストケース優先順位の判断基準

| 優先度 | 基準 | 該当テストケース数 |
|-------|------|------------------|
| **Critical** | システム動作に必須、失敗時は機能停止 | 10件 |
| **High** | 重要な機能、失敗時はユーザー体験に大きな影響 | 12件 |
| **Medium** | 補助的機能、失敗時は一部機能制限 | 11件 |
| **Low** | 最適化関連、失敗時も動作可能 | 1件 |

### 5.3 参考資料

- [Gmail API Testing Guide](https://developers.google.com/workspace/gmail/api/guides/testing)
- [OAuth 2.0 Testing Best Practices](https://developers.google.com/identity/protocols/oauth2/policies)
- [Exponential Backoff Algorithm](https://cloud.google.com/iot/docs/how-tos/exponential-backoff)

---

## 6. テスト実装例

### 6.1 Unitテスト例（T-API-005: リフレッシュトークン失効時の処理）

```python
# tests/test_gmail_auth.py
import pytest
from unittest.mock import patch, MagicMock
from google.auth.exceptions import RefreshError
from app.gmail.auth import authenticate_gmail

def test_refresh_error_prompts_reauthentication():
    """T-API-005: リフレッシュトークン失効時、再認証が促される"""
    with patch('app.gmail.auth.load_token') as mock_load:
        mock_creds = MagicMock()
        mock_creds.valid = False
        mock_creds.expired = True
        mock_creds.refresh_token = 'invalid_refresh_token'
        mock_creds.refresh.side_effect = RefreshError('Token revoked')
        mock_load.return_value = mock_creds

        with pytest.raises(RefreshError) as exc_info:
            authenticate_gmail()

        assert 'Token revoked' in str(exc_info.value)
        # ユーザーに再認証を促すログが記録されることを確認
        # （実装に応じてログ検証を追加）
```

### 6.2 Integrationテスト例（T-API-009: 基本クエリによるメール取得）

```python
# tests/test_gmail_client.py
import pytest
from app.gmail.client import GmailClient

@pytest.mark.integration
@pytest.mark.slow
def test_fetch_emails_with_basic_query():
    """T-API-009: 基本クエリで三井住友カードのメールのみ取得"""
    client = GmailClient()
    query = 'from:@contact.vpass.ne.jp'
    messages = client.fetch_emails(query=query, max_results=10)

    assert len(messages) > 0, "三井住友カードのメールが取得されませんでした"

    for msg in messages:
        # メールの送信元を検証（実装に応じて調整）
        assert '@contact.vpass.ne.jp' in msg['from'].lower()
```

---

**テスト計画書作成完了**
**次のアクション**: 家老レビュー待ち → 承認後、テスト実装フェーズへ移行
