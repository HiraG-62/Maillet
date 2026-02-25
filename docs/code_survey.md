# card-spending-tracker コードベース調査レポート

> 作成日: 2026-02-20
> 作成者: ashigaru2 (subtask_028_survey)
> 目的: 軍師（Gunshi）のアーキテクチャ設計インプット用調査資料

---

## 1. ディレクトリ構成の全体像

```
card-spending-tracker/
├── app/                               # メインアプリケーションパッケージ
│   ├── __init__.py
│   ├── config.py                      # Settings管理（環境変数をdataclassで管理）
│   ├── api/                           # REST APIレイヤー
│   │   ├── __init__.py
│   │   ├── main.py                    # FastAPIインスタンス + ルータマウント
│   │   ├── routes/                    # APIエンドポイント群
│   │   │   ├── __init__.py
│   │   │   ├── health.py              # GET /api/health → HealthResponse
│   │   │   ├── sync.py                # POST /api/sync → SyncResponse（Gmail同期ロジック）
│   │   │   └── transactions.py        # GET /api/transactions, /export, /summary
│   │   └── schemas/                   # Pydanticレスポンススキーマ
│   │       ├── __init__.py
│   │       ├── response.py            # HealthResponse, SyncResponse, ErrorResponse
│   │       └── transaction.py         # TransactionResponse, MonthlySummaryCard等
│   ├── web/                           # WebUIレイヤー（Jinja2 + htmx）
│   │   ├── __init__.py
│   │   ├── routes.py                  # GET/POSTウェブページ（dashboard, transactions, summary, settings）
│   │   └── auth_routes.py             # OAuth 2.0ルート（/auth/start, /auth/callback, /auth/status）
│   ├── cli/                           # CLIインタフェース
│   │   ├── __init__.py
│   │   └── commands.py                # Click CLIコマンド（sync, summary, setup）
│   ├── database/                      # データベースレイヤー（SQLAlchemy）
│   │   ├── __init__.py
│   │   └── connection.py              # DatabaseConnectionクラス + セッション管理
│   ├── models/                        # SQLAlchemy ORMモデル
│   │   ├── __init__.py
│   │   └── transaction.py             # CardTransactionモデル（テーブル: card_transactions）
│   ├── gmail/                         # Gmail API統合
│   │   ├── __init__.py
│   │   ├── auth.py                    # OAuth 2.0認証 + トークン暗号化/復号化
│   │   ├── client.py                  # GmailClient（list_messages, get_message, ページネーション）
│   │   └── parser.py                  # メール解析（カード会社検出, 金額/日付/店舗抽出）
│   ├── services/                      # ビジネスロジックサービス
│   │   ├── __init__.py
│   │   ├── transaction_service.py     # save_transaction()（重複検出付き）
│   │   └── aggregation_service.py     # 月次集計（by_card, by_month, totals）
│   ├── security/                      # セキュリティユーティリティ
│   │   ├── __init__.py
│   │   ├── rate_limiter.py            # exponential_backoff(), RateLimiterクラス
│   │   ├── sanitizer.py               # HTML/XSSサニタイズ（使用箇所少）
│   │   └── validators.py             # mask_sensitive_data(), validate_email_size(), sanitize_error_message()
│   ├── static/                        # 静的アセット
│   │   └── css/
│   │       └── style.css              # ベーススタイル（CSS変数, navbar, cards, tables, responsive）
│   └── templates/                     # Jinja2 HTMLテンプレート
│       ├── base.html                  # ベーステンプレート（navbar, main, footer）
│       ├── dashboard.html             # 月次合計, カード別明細, 最近の取引, 同期ボタン
│       ├── transactions.html          # 取引一覧（月/カードフィルタ付き）
│       ├── summary.html               # 月次カード別サマリー
│       ├── settings.html              # アラート閾値設定
│       └── partials/                  # htmxテンプレートフラグメント
│           ├── sync_status.html       # 同期操作フィードバック
│           └── transaction_table.html # 再利用可能な取引テーブル
├── alembic/                           # DBマイグレーション
│   ├── env.py
│   └── versions/
├── credentials/                       # OAuthクレデンシャル（git-ignored）
│   ├── credentials.json               # OAuth 2.0クライアントシークレット
│   └── token.pickle                   # 暗号化アクセス/リフレッシュトークン
├── data/                              # SQLiteデータベースファイル
│   └── transactions.db
├── scripts/                           # ユーティリティスクリプト
├── tests/                             # テストスイート（18ファイル, 250テスト）
├── docs/                              # ドキュメント
├── .env                               # 環境変数（git-ignored）
├── .env.example                       # .envテンプレート
├── pyproject.toml                     # Poetry依存関係 + ruff設定
├── poetry.lock                        # ロック済み依存関係バージョン
├── Dockerfile                         # マルチステージDockerビルド
├── docker-compose.yml                 # Docker Compose設定
├── alembic.ini                        # Alembicマイグレーション設定
└── Makefile                           # 自動化タスク
```

---

## 2. APIエンドポイント一覧

プレフィックス: `/api`、レスポンス形式: JSON（Pydanticスキーマ）

| メソッド | パス | 説明 | 主な依存関係 |
|---------|------|------|------------|
| GET | `/api/health` | サービスヘルス + DB接続確認 | SQLAlchemy engine |
| POST | `/api/sync` | Gmail同期: メール取得→解析→DB保存（重複検出付き） | gmail.auth, gmail.client, gmail.parser, transaction_service |
| GET | `/api/transactions` | 取引一覧（?month=YYYY-MM フィルタ可） | SQLAlchemy, CardTransaction |
| GET | `/api/transactions/export` | CSV エクスポート（UTF-8 BOM、Excel対応） | csv, StreamingResponse |
| GET | `/api/transactions/summary` | 月次カード別集計（?month=YYYY-MM 必須） | aggregation_service |

### /api/sync 詳細
- Gmail検索クエリ: `from:(statement@vpass.ne.jp OR @contact.vpass.ne.jp OR @qa.jcb.co.jp OR @mail.rakuten-card.co.jp OR @aexp.com OR @dcard.docomo.ne.jp)` (ハードコード)
- スキップ理由追跡: `NO_CARD_COMPANY`, `NOT_USAGE_NOTIFICATION`, `NO_AMOUNT`, `NO_DATE`, `UNTRUSTED_DOMAIN`, `DUPLICATE`, `PARSE_ERROR`
- エラー処理: `AuthenticationRequiredError` → 401、`FileNotFoundError` → 500、その他 → 500

---

## 3. Webページ一覧

| メソッド | パス | テンプレート | 説明 |
|---------|------|------------|------|
| GET | `/` | `dashboard.html` | 月次概要: 合計支出, カード別明細, 最近5件の取引, 同期ボタン |
| GET | `/transactions` | `transactions.html` | 取引一覧（?month, ?card_company フィルタ付き） |
| GET | `/web/transactions/filter` | `partials/transaction_table.html` | htmx用テーブルフラグメント（SWAP対象） |
| GET | `/summary` | `summary.html` | 月次カード別サマリー（プログレスバー付き） |
| GET | `/settings` | `settings.html` | アラート閾値設定フォーム |
| POST | `/settings` | — | 設定保存 → `/settings?saved=1` にリダイレクト |
| POST | `/web/sync` | `partials/sync_status.html` | Gmail同期（WebUI版、htmx対応HTMLフラグメント返却） |
| GET | `/auth/start` | — | OAuth 2.0フロー開始 → Googleコンセント画面へリダイレクト |
| GET | `/auth/callback` | — | OAuthコールバック処理 → トークン保存 → ダッシュボードへリダイレクト |
| GET | `/auth/status` | — | 認証ステータスHTMLフラグメント（htmx用） |
| GET | `/auth/status/json` | — | 認証ステータスJSON（APIコンシューマ用） |

---

## 4. モジュール依存関係

### app/api/main.py
```
fastapi → FastAPI, StaticFiles
app.api.routes → transactions, sync, health
app.web.auth_routes → auth_router
app.web.routes → web_router
```

### app/web/routes.py
```
fastapi → APIRouter, Form, Request
fastapi.responses → HTMLResponse, RedirectResponse
fastapi.templating → Jinja2Templates
sqlalchemy → select, func, extract
app.database.connection → get_session
app.models.transaction → CardTransaction
app.services.aggregation_service → get_monthly_by_card, get_total_by_month
app.api.routes.sync → GMAIL_QUERY, SkipReason（定数/Enum共有）
# 遅延インポート（web_sync内）:
#   app.gmail.auth, googleapiclient, app.gmail.client, app.gmail.parser
#   app.services.transaction_service
```

### app/web/auth_routes.py
```
google_auth_oauthlib.flow → Flow
app.gmail.auth → SCOPES, _load_encrypted_token, _save_encrypted_token（プライベート関数参照）
```

### app/api/routes/sync.py
```
googleapiclient.discovery → build
app.gmail.auth → authenticate, AuthenticationRequiredError
app.gmail.client → GmailClient
app.gmail.parser → detect_card_company, extract_amount, extract_transaction_date, extract_merchant, is_usage_notification
app.services.transaction_service → save_transaction
app.database.connection → get_session
```

### app/api/routes/transactions.py
```
fastapi → APIRouter, HTTPException, Query
fastapi.responses → StreamingResponse
app.api.schemas.transaction → TransactionResponse, MonthlySummaryResponse, MonthlySummaryCard
app.database.connection → get_session
app.models.transaction → CardTransaction
app.services.aggregation_service → get_monthly_by_card, get_total_by_month
```

### app/services/aggregation_service.py
```
sqlalchemy → select, func, extract, Select
sqlalchemy.orm → Session
app.models.transaction → CardTransaction
```

### app/services/transaction_service.py
```
sqlalchemy.orm → Session
sqlalchemy.exc → IntegrityError
app.models.transaction → CardTransaction
```

### app/gmail/parser.py
```
re, logging
email.utils → parseaddr
datetime → datetime
```

---

## 5. フロントエンド技術スタック

### CSSフレームワーク
- **種別**: カスタムCSS（Bootstrap/Tailwind等の外部CSSフレームワーク依存なし）
- **仕様**: CSS3 + CSS変数（`:root`）
- **カラーパレット**: `--primary` (#2563eb), `--danger` (#dc3545), `--warning` (#f59e0b), `--success` (#198754)
- **フォント**: システムフォント + "Noto Sans JP"（日本語）
- **レスポンシブ**: コンテナ最大幅960px
- **スタイル要素**: navbar（sticky）, cards, buttons, tables, forms, progress bars, badges

### JavaScript / htmx
- **htmx バージョン**: 2.0.4（CDN: `https://unpkg.com/htmx.org@2.0.4`）
- **カスタムJS**: ゼロ（全てhtmxで賄う）
- **htmx使用箇所**:
  - `hx-get="/auth/status"` → ダッシュボードの認証ステータス読み込み
  - `hx-get="/web/transactions/filter"` → 取引ページのフィルタ適用
  - `hx-post="/web/sync"` → ダッシュボードの同期ボタン
  - `hx-target`, `hx-swap`, `hx-indicator` でDOM更新

### base.html 構造
```html
<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>{% block title %}{% endblock %}</title>
  <link rel="stylesheet" href="/static/css/style.css">
  <script src="https://unpkg.com/htmx.org@2.0.4"></script>
</head>
<body>
  <nav class="navbar">...</nav>
  <main class="container">
    {% block content %}{% endblock %}
  </main>
  <footer>...</footer>
</body>
</html>
```

### テンプレート一覧

| テンプレート | 役割 | 説明 |
|------------|------|------|
| `base.html` | レイアウト | 親テンプレート（navbar, main, footer, title/content ブロック） |
| `dashboard.html` | ページ | 月次合計, カード別明細, 同期ボタン, 最近5件の取引 |
| `transactions.html` | ページ | 取引一覧（月/カードフィルタドロップダウン + transaction_table partial） |
| `summary.html` | ページ | 月次カード別サマリー（プログレスバー） |
| `settings.html` | ページ | アラート閾値フォーム + 保存ボタン |
| `partials/sync_status.html` | フラグメント | 同期フィードバック（成功/認証必要/エラー）スキップ理由内訳付き |
| `partials/transaction_table.html` | フラグメント | 再利用可能な取引テーブル（thead, tbody, tfoot） |

---

## 6. データベース・ORM

### ORM情報
- **ORM**: SQLAlchemy
- **バージョン**: ^2.0.25（Declarative Base使用）
- **DBエンジン**: SQLite

### モデル一覧

**CardTransaction**（テーブル: `card_transactions`）

| カラム | 型 | 制約 | 説明 |
|--------|-----|------|------|
| `id` | Integer | PRIMARY KEY, autoincrement | 自動採番ID |
| `card_company` | String | NOT NULL | カード会社名（例: "三井住友", "JCB", "楽天", "AMEX", "dカード"） |
| `amount` | Integer | NOT NULL | 取引金額（円） |
| `transaction_date` | DateTime | NOT NULL | 取引日時 |
| `merchant` | String | NULLABLE | 店舗名 |
| `email_subject` | String | NOT NULL | 元メール件名 |
| `email_from` | String | NOT NULL | 送信元メールアドレス |
| `gmail_message_id` | String | NOT NULL, UNIQUE | GmailメッセージID（重複検出キー） |
| `is_verified` | Boolean | DEFAULT False | 手動確認フラグ |
| `created_at` | DateTime | DEFAULT utcnow | レコード作成タイムスタンプ |

### インデックス
- `gmail_message_id`: UNIQUE制約（重複取引防止の主キー）
- その他インデックス: 明示的な追加インデックスなし（`transaction_date`, `card_company` へのインデックス未設定）

### DBファイルの場所
- **デフォルト**: `data/transactions.db`（SQLiteファイル）
- **Docker**: `/app/data/transactions.db`（ボリュームマップ）
- **環境変数**: `DATABASE_URL` または `DATABASE_PATH`

### テーブル設計の特徴
- 単一テーブル設計（非正規化）
- リレーション無し
- セーブポイントを使ったネスト型トランザクション（重複時の分離ロールバック）

---

## 7. 設定管理

### 環境変数一覧（.env.example から）

| 変数名 | デフォルト値 | 説明 | 必須 |
|--------|------------|------|------|
| `GOOGLE_CREDENTIALS_PATH` | `credentials/credentials.json` | OAuth 2.0クライアントシークレットファイル | Gmail使用時必須 |
| `GMAIL_CREDENTIALS_PATH` | 同上 | GOOGLE_CREDENTIALS_PATHの別名 | 不要 |
| `GOOGLE_TOKEN_PATH` | `credentials/token.pickle` | 暗号化OAuthトークン保存先 | 自動作成 |
| `TOKEN_ENCRYPTION_KEY` | （空） | トークンファイルのFernet暗号化キー | **必須** |
| `DATABASE_PATH` | `data/transactions.db` | SQLiteデータベースファイルパス | 不要 |
| `DATABASE_URL` | `sqlite:///./data/transactions.db` | SQLAlchemy接続URL | 不要 |
| `ALERT_THRESHOLD` | `100000` | アラート閾値（円） | 不要 |
| `LOG_LEVEL` | `INFO` | Pythonロギングレベル | 不要 |
| `API_HOST` / `HOST` | `0.0.0.0` | FastAPIサーバーホスト | 不要 |
| `API_PORT` / `PORT` | `8000` | FastAPIサーバーポート | 不要 |

### config.py の設計
- `python-dotenv` で `.env` ファイルをロード
- `Settings` dataclass + `@lru_cache` によるシングルトンパターン
- `get_settings()` でキャッシュ済みインスタンスを返す

### Docker設定

**Dockerfile**
- ベースイメージ: `python:3.11-slim`
- Poetry 1.7.1 インストール
- 非rootユーザー: `appuser`（UID 1000）
- 起動コマンド: `uvicorn app.api.main:app --host 0.0.0.0 --port 8000`

**docker-compose.yml**
- サービス: `app`
- ボリューム: `./data:/app/data`（DB永続化）, `./credentials:/app/credentials`（OAuthトークン）
- ポート: `8000:8000`
- ヘルスチェック: `curl http://localhost:8000/health`（30秒間隔, 10秒タイムアウト, 3回リトライ, 40秒スタート期間）
- 再起動ポリシー: `unless-stopped`

---

## 8. テストカバレッジ状況

### テストファイル一覧

| ファイル | テスト数 | カバレッジ対象 |
|---------|---------|--------------|
| `test_parser_foundation.py` | 44 | ドメイン検証, カード検出, 通知パターン |
| `test_edge_cases.py` | 31 | HTMLエンコーディング, BOM, 欠損フィールド, オーバーフロー, うるう年 |
| `test_security.py` | 25 | フィッシング検出, SQLi, XSS, コマンドインジェクション, CSRF, DoS, ReDoS |
| `test_api.py` | 24 | healthエンドポイント, transactions, summary, syncエンドポイント |
| `test_cli.py` | 14 | CLIコマンド（sync, summary, setup） |
| `test_e2e.py` | 15 | カード会社パーサー統合, フォールバックパターン, 重複検出 |
| `test_real_gmail_e2e.py` | 13 | リアルGmail API統合（クレデンシャルなしはスキップ） |
| `test_parser_amount_extraction.py` | 11 | 全カード会社（SMBC, JCB, 楽天, AMEX, dCard）金額抽出 |
| `test_database.py` | 16 | 接続, CRUD, ロールバック, インデックス |
| `test_models.py` | 10 | モデルインスタンス化, repr, 制約 |
| `test_auth.py` | 8 | OAuthフロー, トークン暗号化/復号化, 自動リフレッシュ |
| `test_parser_fallback.py` | 8 | 汎用フォールバックパターン（金額, 日付, 店舗） |
| `test_duplicate_detection.py` | 8 | 重複メッセージID処理, is_verifiedデフォルト |
| `test_gmail_client.py` | 8 | メッセージリスト, 取得, ページネーション |
| `test_aggregation.py` | 5 | 月次集計（サマリー, 件数, 平均） |
| `test_parser_amex.py` | 7 | AMEX専用金額/日付抽出 |
| `test_parser_dcard.py` | 5 | dCard専用抽出 |
| `test_csv_export.py` | 10 | CSV形式, UTF-8 BOM, フィルタリング |
| **合計** | **250** | |

### カバレッジサマリー
- **全体**: 約11%（1,137ステートメント中1,011が未カバー）
- **高カバレッジ**: `app/models/transaction.py` (~95%)
- **ゼロカバレッジ**:
  - `app/api/main.py`（ルータ設定のみのため）
  - `app/api/routes/health.py`
  - `app/api/routes/sync.py`
  - `app/api/routes/transactions.py`
  - `app/web/routes.py`（WebUIルート; モック複雑）
  - `app/web/auth_routes.py`
  - `app/config.py`

---

## 9. 技術的負債・改善点（観察事項）

### コードの重複
1. **`_extract_email_body()` 関数**: `app/api/routes/sync.py` と `app/web/routes.py` に同一実装が存在。routes.pyのコメントで「DRY違反を意識して受け入れたプロトタイプ」と記載あり。
2. **Gmail同期ロジック**: `/api/sync` と `/web/sync` にほぼ同一のビジネスロジック（取得→解析→保存）が並存。レスポンス形式（JSONとHTML）のみ異なる。共有サービスレイヤーへの抽出が望ましい。

### 大きすぎるファイル
1. **`app/web/routes.py`**（520行）: 12ルートハンドラー + 11ヘルパー関数。ドメイン別分割（dashboard, transactions, summary, settings, sync, auth）が検討に値する。
2. **`app/cli/commands.py`**（403行）: CLIコマンドにビジネスロジックが混在。サービスレイヤーへの委譲が望ましい。
3. **`app/gmail/parser.py`**（298行）: カード会社別ハードコードパターンが多数。パターンレジストリ/ファクトリーパターンが有効かもしれない。
4. **`app/api/routes/sync.py`**（226行）: 単一エンドポイントにロングハンドラー関数。メール処理をサービスレイヤーに抽出すべき。

### 型ヒントの不足
- `app/web/routes.py`: 主要なリターン型のみアノテーション; 多数のパラメータが未アノテーション
- `app/gmail/auth.py`: `authenticate()` の戻り型アノテーション欠如
- CLIコマンド: Clickデコレータ推論に依存、Pythonネイティブアノテーション不足

### セキュリティ上の懸念（観察のみ）
1. **レートリミッター**: `RateLimiter`クラスが `app/security/rate_limiter.py` に存在するがAPIエンドポイントに未統合
2. **エラーメッセージのサニタイズ**: `sanitize_error_message()` が存在するが全エラーパスで一貫して使用されていない
3. **センシティブ情報のログマスク**: `mask_sensitive_data()` が存在するが全ログ箇所で一貫して呼ばれていない
4. **メールサイズ検証**: `validate_email_size()` が存在するが実際の処理フローで使用されていない

### 一貫性の欠如
1. **DBアクセスパターン**: 全ルートで `get_session(db_path)` を使うが `db_path` は毎回 `os.getenv()` で取得。依存性注入（FastAPI Depends）で統一すべき。
2. **設定の保存先**: アラート閾値は `settings.json` ファイルに保存（DBではない）。スキーマ変更時のマイグレーションパスが不明確。
3. **エラーレスポンス**: APIは `HTTPException` + ステータスコードを返すが、WebルートはHTMLエラーページを返すこともある（一貫したエラーUIなし）。

### アーキテクチャ上の懸念
1. **非同期処理の欠如**: 全I/O（DB, Gmail API）が同期処理。async/awaitによる並行性改善の余地あり。
2. **リポジトリパターン不採用**: SQLAlchemyクエリがルートに直書き。テスタビリティ向上のためにリポジトリパターンの導入が有効。
3. **ページネーション未実装**: WebUIの取引一覧は全件取得; 大量データ（10,000件以上）で性能劣化する可能性。
4. **キャッシュ未実装**: 月次集計などの重いクエリにキャッシュなし。
5. **Alembicマイグレーション**: `alembic/` ディレクトリは存在するが、バージョンファイルがgit管理されているか不明。

---

## まとめ

本プロジェクトは、Gmailの通知メールからクレジットカード利用明細を自動収集・可視化するFastAPI製Webアプリケーション。API/WebUI/CLI/Database/Servicesとレイヤー分離が明確で、OAuth 2.0認証・XSS対策・SQLインジェクション対策など基本的なセキュリティが実装済み。フロントエンドはhtmxを活用したシンプルな構成。

**軍師へのインプットポイント**:
- `/api/sync` と `/web/sync` の重複ロジック統合が最優先の設計課題
- DBアクセスの依存性注入化でテスタビリティが大幅向上する
- セキュリティモジュール（rate_limiter, sanitizer, validators）が作られているが未統合 → 統合設計が必要
- 非同期対応・ページネーション・キャッシュは将来スケールアップ時の候補
