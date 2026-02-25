# プライバシー・セキュリティアーキテクチャ v2

**作成日**: 2026-02-21
**作成者**: 軍師（Gunshi）— subtask_045_gunshi
**親コマンド**: cmd_045
**前版**: v1（subtask_042_gunshi、cmd_042）
**ステータス**: 設計文書（実装待ち）

---

## ✅ 方針修正の背景（v1 → v2）

v1では「デプロイ先はローカル（localhost）のみ、Fly.io撤回」としたが、**殿の真意が確定した**。

| 項目 | v1の誤解 | v2の正しい方針 |
|------|---------|-------------|
| デプロイ先 | ローカルのみ（localhost）| **クラウドサーバー（Fly.io）にデプロイ** |
| データ保存 | ローカルSQLite（サーバー側） | **ブラウザ側のみ**（IndexedDB/OPFS等） |
| サーバーの役割 | ステートフル（DB保持） | **完全ステートレス**（UIのみ配信） |
| 矛盾の有無 | architecture.mdと矛盾していた | architecture.md（Fly.io確定）と整合 |

**この設計は「プライバシーファーストSaaS」型**:
- Webアプリはクラウドサーバー（Fly.io）にデプロイ → インターネット経由でアクセス可能
- サーバーはステートレス → ユーザーデータを**一切保持しない**
- データ（取引、設定、OAuthトークン等）は**ユーザーのブラウザ内**に保存

---

## 1. 新方針の定義

### 1.1 責務分担表

| 層 | 保持するもの | 保持しないもの |
|----|------------|-------------|
| **サーバー（Fly.io）** | UIテンプレート（HTML/CSS/JS）、静的アセット、APIルーティング、ビジネスロジック（パーサー等） | SQLiteデータベース、OAuthトークン、LLM APIキー、取引データ、設定 |
| **クライアント（ブラウザ）** | 全ユーザーデータ（取引、設定、OAuthトークン）、LLM APIキー（BYOK）| — |
| **外部サービス** | — | ユーザーデータ（完全非公開） |

### 1.2 サーバー（Fly.io）が持つもの

```
サーバー側（ステートレス）:
├── Jinja2テンプレート（HTMLの骨格）
├── 静的アセット（CSS: DaisyUI/Tailwind、JS: htmx、Chart.js）
├── FastAPI APIエンドポイント
│   ├── GET / → dashboard.html（初回ページ配信のみ）
│   ├── POST /api/parse/email → メール本文パース（→結果を返すだけ、保存しない）
│   └── GET /api/health → ヘルスチェック
├── ビジネスロジック（必要に応じてサーバーサイド実行）
│   └── parser.py（Python製パーサー → APIとして提供可能）
└── 設定（環境変数）
    └── GOOGLE_CLIENT_ID（クライアントIDのみ — シークレットではない）
```

### 1.3 サーバーが保持しないもの

```
サーバー側に存在しないもの:
├── ❌ SQLite DB（card_transactions.db）
├── ❌ OAuthトークン（token.json, credentials/）
├── ❌ LLM APIキー（BYOK）
├── ❌ 取引データ（金額、店舗名、日付）
├── ❌ メール本文（パース後は即時破棄）
├── ❌ Litestream（サーバーにDBがないので不要）
└── ❌ Cloudflare R2（サーバーにDBがないので不要）
```

### 1.4 クライアント（ブラウザ）が保持するもの

```
ブラウザ内に保存されるもの:
├── 取引データ（IndexedDB or OPFS+SQLite WASM）
│   └── card_transactions テーブル（既存スキーマ）
├── OAuthトークン（Gmail）
│   └── sessionStorage（セッション限定）or IndexedDB（永続）
├── LLM APIキー（BYOK）
│   └── IndexedDB（暗号化保存）
├── アプリ設定
│   └── localStorage（threshold等）
└── OAuth認証状態
    └── sessionStorage（アクセストークン）
```

---

## 2. クライアントサイドDB技術比較

### 2.1 候補技術の概要

| 技術 | 種類 | 概要 |
|------|------|------|
| **IndexedDB** | ネイティブブラウザAPI | オブジェクトストア。全ブラウザ標準搭載 |
| **OPFS + SQLite WASM** | OPFS + WebAssembly | OriginPrivateFileSystem上でSQLiteをWASMで動作 |
| **Dexie.js** | IndexedDBラッパー | IndexedDBをPromiseベースで扱いやすくしたライブラリ |

### 2.2 比較表

| 比較項目 | IndexedDB | OPFS + SQLite WASM | Dexie.js |
|---------|-----------|-------------------|----------|
| **ブラウザサポート** | ◎ 全ブラウザ（IE11+） | ○ Chrome103+, Firefox111+, Safari16.4+ | ◎ IndexedDB準拠（IE10+） |
| **容量制限** | ○ ~50GB（ディスク依存） | ○ ~50GB（ディスク依存） | ○ IndexedDB準拠 |
| **クエリ能力** | △ key-value + index | ◎ 完全SQL（GROUP BY, JOIN等） | △ key-value + compound queries |
| **既存SQLiteスキーマ親和性** | △ テーブル→オブジェクトストア変換が必要 | ◎ **スキーマそのまま使用可能** | △ 変換が必要 |
| **性能（読み書き）** | ○ 良好 | ◎ ネイティブSQLite相当 | ○ IndexedDB相当 |
| **バンドルサイズ追加** | ◎ 0KB（ネイティブ） | △ sql.js: ~3MB / wa-sqlite: ~600KB | ○ ~50KB |
| **開発コスト** | △ 複雑なAPI、コールバック地獄 | △ WASMセットアップ + SQLite API | ○ Promise/async/awaitで簡潔 |
| **Workerスレッド対応** | ◎ Web Worker内利用可 | ◎ **必須**（OPFSはWorker内のみ） | ◎ Worker対応 |
| **型システム** | △ 型なし（any） | △ SQL文字列 | ○ TypeScript型定義あり |
| **月次集計クエリ** | △ JS側で実装必要 | ◎ SQLでそのまま書ける | △ JS側で実装必要 |
| **成熟度** | ◎ 長年の実績 | △ 比較的新しい（2022〜） | ◎ 多数の採用実績 |

### 2.3 SQLite WASMの実装例

```javascript
// wa-sqlite を使用したクライアントサイドDB初期化
import SQLiteESMFactory from 'wa-sqlite/dist/wa-sqlite.mjs';
import { IDBBatchAtomicVFS } from 'wa-sqlite/src/IDBBatchAtomicVFS.js';

async function initDB() {
  const module = await SQLiteESMFactory();
  const sqlite3 = SQLite.Factory(module);

  // IndexedDB上にSQLiteファイルを永続化
  const vfs = await IDBBatchAtomicVFS.create('card-tracker', module);
  sqlite3.vfs_register(vfs, true);

  const db = await sqlite3.open_v2('card-tracker.db');

  // 既存スキーマをそのまま使用可能
  await sqlite3.exec(db, `
    CREATE TABLE IF NOT EXISTS card_transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      msg_id TEXT UNIQUE NOT NULL,
      amount INTEGER NOT NULL,
      merchant TEXT,
      transaction_date DATE,
      card_company TEXT,
      category TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  return { sqlite3, db };
}

// 月次集計（既存のPythonクエリをそのまま移植可能）
async function getMonthlySummary(sqlite3, db, year, month) {
  const rows = [];
  await sqlite3.exec(db, `
    SELECT card_company, SUM(amount) as total, COUNT(*) as count
    FROM card_transactions
    WHERE strftime('%Y-%m', transaction_date) = '${year}-${String(month).padStart(2, '0')}'
    GROUP BY card_company
    ORDER BY total DESC
  `, (row, cols) => {
    rows.push(Object.fromEntries(cols.map((c, i) => [c, row[i]])));
  });
  return rows;
}
```

### 2.4 推奨案：OPFS + SQLite WASM（wa-sqlite）

**推奨理由:**

1. **既存SQLiteスキーマを完全再利用**: `card_transactions`テーブルはそのまま使用可能。Pythonで書いたクエリ（GROUP BY、SUM等）をJSにほぼそのまま移植できる
2. **SQL能力**: 月次集計、カード会社別集計、期間フィルタ等の複雑なクエリが標準SQLで書ける
3. **性能**: SQLiteネイティブのクエリ最適化が使える（カーソル走査不要）
4. **バンドルサイズ**: wa-sqlite（~600KB）はsql.js（~3MB）より小さい

**唯一の注意点**: Safari16.3以前は未対応。現時点（2026年）では問題なし（Safari16.4+が標準）。

**代替案（低リスク・低工数）**: Dexie.jsをPhase Cの初期実装に使用し、複雑なクエリが必要になった時点でSQLite WASMに移行する段階的アプローチも有効。

---

## 3. Gmail OAuth整合性

### 3.1 新方針との整合性

v1の方針3（フロントエンドOAuth）は、新方針（サーバーステートレス）と**完全に整合**する。

- フロントエンドOAuth: ブラウザでOAuth認証 → トークンをブラウザに保持 → Gmail APIをブラウザから直接呼び出し
- 新方針SaaS: サーバーはトークンを一切持たない

つまり「フロントエンドOAuth（v1の方針3B）」は**新方針では必須要件**となる。

### 3.2 フロントエンドOAuthフロー（PKCE）

```
ブラウザ                          Google OAuth               Fly.ioサーバー
    │                                   │                          │
    │◀── アプリURL（https://...fly.io）──┼──────────────────────────│
    │                                   │                          │
    │ ① 認証ボタンをクリック              │                          │
    │───── code_verifier 生成 ──────────│                          │
    │───── PKCE code_challenge 計算 ────│                          │
    │──── Google OAuth リダイレクト ─────▶│                          │
    │                                   │                          │
    │ ② Google同意画面                   │                          │
    │◀──── authorization_code ──────────│                          │
    │                                   │                          │
    │ ③ トークン交換（ブラウザ→Google直接）│                          │
    │──── POST /token + code_verifier ──▶│                          │
    │◀──── access_token, refresh_token ─│                          │
    │                                   │                          │
    │ ④ Gmail API呼び出し（ブラウザから直接）                          │
    │──── GET /gmail/v1/users/me/messages（Bearerトークン） ──────────▶ Gmail API
    │◀──── メール一覧/本文 ───────────────────────────────────────── Gmail API
    │                                   │                          │
    │ ⑤ メールパース                     │                          │
    │─── POST /api/parse/email（メール本文）──────────────────────────▶│
    │◀─── 取引データ（JSON） ─────────────────────────────────────────│
    │   ★サーバーはメール本文を保存しない   │                          │
    │                                   │                          │
    │ ⑥ データをブラウザDBに保存           │                          │
    │─── IndexedDB/SQLite WASMに書き込み（ローカル処理）               │
    │                                   │                          │
    ★ トークンはブラウザのsessionStorageのみ。サーバーには送信しない
```

### 3.3 現行コードからの変更点

| ファイル | 現行 | 新方針での変更 |
|---------|------|-------------|
| `app/web/auth_routes.py` | `/auth/start`, `/auth/callback`（サーバー側OAuth） | **廃止**。ブラウザのJSに移管 |
| `app/gmail/auth.py` | `_save_encrypted_token`, `_load_encrypted_token` | **廃止**。サーバーはトークン不保持 |
| `credentials/token.json` | 暗号化OAuthトークン保存 | **廃止**。ブラウザのsessionStorageに移管 |
| `credentials/credentials.json` | OAuthクライアントシークレット（サーバー側） | `client_id`のみFly.io環境変数で公開配信、`client_secret`は**PKCEにより不要** |
| `app/static/js/` | なし | `gmail_auth.js`（新規）: PKCE OAuth + Gmail API呼び出し |
| `app/templates/` | 現行維持 | Gmail認証ボタンUI追加 |

### 3.4 GOOGLE_CLIENT_ID の配信方法

PKCEフローでは`client_secret`はブラウザに不要（セキュリティ上も配置不可）。`client_id`は公開情報であり、サーバーからテンプレートに注入:

```python
# app/web/routes/dashboard.py
@router.get("/")
def dashboard(request: Request):
    return templates.TemplateResponse("dashboard.html", {
        "request": request,
        "google_client_id": os.getenv("GOOGLE_CLIENT_ID", ""),
        # client_secret は一切渡さない
    })
```

---

## 4. BYOK LLM整合性

### 4.1 ブラウザ直接呼び出しの可否

主要LLM APIのCORSポリシー確認:

| プロバイダー | ブラウザ直接呼び出し | 備考 |
|------------|-----------------|------|
| **Anthropic** | ✅ 可能（CORS許可） | `Authorization: x-api-key` ヘッダー使用 |
| **OpenAI** | ✅ 可能（CORS許可） | `Authorization: Bearer sk-...` ヘッダー使用 |

サーバーを経由せず、ブラウザから直接LLM APIを呼び出せる。

### 4.2 ブラウザ内APIキー管理

```javascript
// LLM APIキーのブラウザ内暗号化保存
// ユーザーのパスフレーズ（PINやパスワード）で暗号化

async function saveLlmKey(provider, apiKey, userPin) {
  // PBKDF2でPINからAES-256キーを導出
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw', encoder.encode(userPin), 'PBKDF2', false, ['deriveKey']
  );
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const encKey = await crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: 100000, hash: 'SHA-256' },
    keyMaterial, { name: 'AES-GCM', length: 256 }, false, ['encrypt']
  );

  // AES-GCMで暗号化
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    encKey,
    encoder.encode(apiKey)
  );

  // IndexedDBに保存（salt + iv + 暗号文）
  await db.put('llm_keys', {
    provider,
    salt: Array.from(salt),
    iv: Array.from(iv),
    data: Array.from(new Uint8Array(encrypted)),
  });
}

// LLMカテゴリ分類（ブラウザから直接Anthropic API呼び出し）
async function classifyMerchant(merchant, apiKey) {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 50,
      messages: [{
        role: 'user',
        content: `店舗名「${merchant}」のカテゴリを一語で答えよ: 食費/交通/娯楽/日用品/医療/通信/サブスク/その他`,
      }],
    }),
  });
  return response.json();
}
```

### 4.3 サーバー経由との比較

| 項目 | ブラウザ直接呼び出し（新方針） | サーバー経由（旧方針） |
|------|--------------------------|------------------|
| **プライバシー** | ◎ APIキーがサーバーに届かない | △ サーバーにAPIキーを保持 |
| **実装コスト** | ○ JS側のみ実装 | △ Python + JS両方実装 |
| **APIキー露出リスク** | △ XSSでブラウザキーが漏洩する可能性 | △ サーバー侵害でAPIキーが漏洩 |
| **BYOK実現** | ◎ 完全なユーザー管理 | ○ サーバーがBYOKとして中継 |
| **コスト** | ◎ サーバーコスト増加なし | △ APIキー管理エンドポイント必要 |

**推奨**: ブラウザ直接呼び出し。XSSリスクはContent Security Policy（CSP）で緩和可能。

---

## 5. Fly.io復元計画

### 5.1 アーカイブからの復元

cmd_044でアーカイブされたファイル: `docs/archive/fly.toml`, `docs/archive/litestream.yml`

新方針ではサーバーがステートレスのため、**Litestreamは不要**。fly.tomlは「DBボリュームなし」で再設定。

### 5.2 新fly.toml（ステートレス版）

```toml
# fly.toml — プライバシーファーストSaaS（ステートレス版）
# サーバーはUIのみ配信。DBなし、ボリュームなし。
app = "card-spending-tracker"
primary_region = "nrt"  # 東京リージョン

[build]
  dockerfile = "Dockerfile"

[http_service]
  internal_port = 8000
  force_https = true
  auto_stop_machines = true   # コスト最適化: 非アクセス時はマシン停止
  auto_start_machines = true
  min_machines_running = 0    # 完全停止可（個人利用ならコスト優先）

[http_service.concurrency]
  type = "requests"
  hard_limit = 250
  soft_limit = 200

[[vm]]
  memory = "256mb"            # UIのみ配信なら128MBでも十分
  cpu_kind = "shared"
  cpus = 1

# ★ [mounts] セクションは削除（サーバーにDBを持たないため）
# ★ Litestream は不要（サーバーにDBを持たないため）

[env]
  LOG_LEVEL = "INFO"
  LOG_FORMAT = "json"
  # DATABASE_PATH は不要（サーバーにDBなし）

[checks]
  [checks.health]
    type = "http"
    port = 8000
    path = "/health"
    interval = "30s"
    timeout = "5s"
    grace_period = "10s"
```

### 5.3 新Dockerfile（ステートレス版）

v1のDockerfileからLitestream関連を削除:

```dockerfile
# === Build stage ===
FROM python:3.12-slim AS builder

RUN pip install poetry==1.7.1
WORKDIR /app
COPY pyproject.toml poetry.lock* ./
RUN poetry export -f requirements.txt --output requirements.txt --without-hashes

# === Runtime stage ===
FROM python:3.12-slim

RUN groupadd -r appuser && useradd -r -g appuser -d /app appuser
WORKDIR /app

COPY --from=builder /app/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY app/ app/
COPY alembic/ alembic/
COPY alembic.ini .

# ★ litestream インストール削除（サーバーにDBなし）
# ★ /data ボリューム不要

RUN mkdir -p /app && chown -R appuser:appuser /app

USER appuser
EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=10s --retries=3 --start-period=20s \
    CMD python -c "import httpx; httpx.get('http://localhost:8000/health').raise_for_status()"

# ★ litestream replicate 削除。単純なuvicorn起動
# ★ alembic upgrade head も削除（サーバーにDBなし）
CMD ["uvicorn", "app.api.main:app", "--host", "0.0.0.0", "--port", "8000"]
```

### 5.4 必要シークレット（簡略化）

サーバーステートレス化でシークレット数が大幅削減:

```bash
# 必要なシークレット（新方針）
fly secrets set GOOGLE_CLIENT_ID=<OAuthクライアントID>  # client_secretは不要（PKCE）
fly secrets set APP_PIN=<4-8桁のPIN>                   # UI認証用（オプション）
fly secrets set SESSION_SECRET=<セッション鍵>

# ★ 削除されるシークレット（旧方針のもの）
# TOKEN_ENCRYPTION_KEY — トークンをサーバーに保存しないため不要
# GOOGLE_CLIENT_SECRET — PKCEでは不要
# LITESTREAM_ACCESS_KEY_ID — Litestream不要
# LITESTREAM_SECRET_ACCESS_KEY — Litestream不要
# R2_ACCOUNT_ID — R2不要
```

### 5.5 コスト試算（新方針）

| 項目 | 旧方針（ステートフル） | 新方針（ステートレス） |
|------|-------------------|------------------|
| Fly.io Volume | $0.15/GB/月 | **$0（ボリュームなし）** |
| Cloudflare R2 | $0（無料枠内） | **$0（R2不要）** |
| Fly.io Machines | $0〜$5/月 | **$0〜$5/月（同じ）** |
| **合計** | ~$0.15〜$5.15/月 | **~$0〜$5/月（さらに低コスト）** |

---

## 6. 移行パス（段階的）

### 6.1 フェーズ定義

| フェーズ | 内容 | 担当 | 依存 | 推定工数 |
|---------|------|------|------|---------|
| **Phase A** | 設計文書確定（本タスク） | 軍師 | なし | 完了 |
| **Phase B** | Fly.io設定復元 + サーバーステートレス化 | 足軽 | Phase A | 中（4-6h） |
| **Phase C** | クライアントサイドDB実装（SQLite WASM） | 足軽 | Phase B | 高（15-20h） |
| **Phase D** | データ移行ツール（サーバーDB → クライアントDB） | 足軽 | Phase B | 中（5-8h） |

### 6.2 Phase B: Fly.io復元 + ステートレス化（詳細）

| # | タスク | 内容 | 工数 |
|---|--------|------|------|
| B-1 | fly.toml復元 | docs/archive/fly.toml → プロジェクトルート。[mounts]削除、Litestream設定削除 | 30min |
| B-2 | Dockerfile改訂 | Litestreamインストール・起動コマンド削除 | 30min |
| B-3 | サーバー側OAuthコード廃止 | auth_routes.py の `/auth/start`, `/auth/callback` を削除または無効化 | 1h |
| B-4 | config.py整理 | TOKEN_ENCRYPTION_KEY, GOOGLE_TOKEN_PATH 等の不要設定を削除 | 30min |
| B-5 | /api/parse/email 新設 | メール本文を受け取り、Pythonパーサーで解析して返す（保存しない）API | 2h |
| B-6 | ヘルスチェックエンドポイント確認 | GET /health が正常動作することを確認 | 30min |
| B-7 | Fly.ioデプロイ実行 | fly deploy + 動作確認 | 1h |

### 6.3 Phase C: クライアントサイドDB実装（詳細）

**フロントエンドOAuth（Gmail）の実装:**

| # | タスク | 内容 | 工数 |
|---|--------|------|------|
| C-1 | wa-sqlite導入 | CDNまたはnpmでwa-sqlite組み込み。DBスキーマ初期化 | 2h |
| C-2 | gmail_auth.js作成 | PKCE OAuth実装。Google OAuth → アクセストークン取得 | 3h |
| C-3 | Gmail API呼び出しJS | メール一覧取得 → 本文取得 → /api/parse/email送信 → 結果をDBに保存 | 4h |
| C-4 | テンプレート更新 | Gmail認証ボタン、同期ボタン、クライアントDB読み取り表示 | 4h |
| C-5 | BYOK LLM UI | APIキー入力フォーム → IndexedDB暗号化保存 | 2h |
| C-6 | 設定移行 | settings.json（サーバー側）→ localStorage/IndexedDB | 2h |
| C-7 | テスト | 既存テストへの影響確認（サーバー側テストはAPI変更のみ） | 3h |

### 6.4 Phase D: データ移行ツール（詳細）

既存のサーバーサイドSQLite（`data/transactions.db`）から新クライアントサイドDBへの移行ツール:

| # | タスク | 内容 | 工数 |
|---|--------|------|------|
| D-1 | エクスポートAPI | GET /api/export → サーバーDBの全データをJSON配列で返す（一時エンドポイント） | 2h |
| D-2 | インポートJS | JSON → SQLite WASMへのバルクインサート | 2h |
| D-3 | 移行UIウィザード | ワンクリック移行。進捗表示、エラーハンドリング | 2h |
| D-4 | 移行エンドポイント廃止 | 移行完了後、D-1のエンドポイントを削除 | 1h |

### 6.5 既存テストへの影響

274件のテストに対する新方針の影響:

| テスト種別 | 影響 | 対応 |
|-----------|------|------|
| パーサーテスト（gmail/parser.py） | **影響なし** | サーバー側でも/api/parse/emailとして提供継続 |
| OAuthテスト（auth_routes.py） | **削除対象** | サーバー側OAuthコードを廃止するため |
| DBテスト（models, services） | **Phase B〜Cで段階削除** | サーバーにDBを持たなくなるため |
| APIテスト（api/routes） | **一部変更** | /api/parse/email 追加、sync系API廃止 |
| Webルートテスト（web/routes） | **一部変更** | DBアクセスなしのルート化 |

**推奨**: Phase Bでサーバー側テストは暫定維持（`mark.skip`で無効化）。Phase Cの実装完了後にJS側E2Eテストを新設。

---

## 7. データフロー図（新アーキテクチャ）

### 7.1 全体構成図

```
                        インターネット
                             │
                    ┌────────▼────────────┐
                    │  Fly.io サーバー     │
                    │  （ステートレス）     │
                    │                    │
                    │  FastAPI           │
                    │  ├─ HTML/CSS/JS配信 │
                    │  └─ /api/parse/    │
                    │     email（パース）  │
                    │                   │
                    │  ★DBなし           │
                    │  ★トークンなし      │
                    │  ★ユーザーデータなし │
                    └────────┬───────────┘
                             │ HTTPS
                    ┌────────▼────────────────────────────────────────┐
                    │  ユーザーのブラウザ                                │
                    │                                                  │
                    │  ┌────────────────────────────────────────────┐  │
                    │  │ アプリケーション層（HTML + htmx + JS）        │  │
                    │  │  ├─ ダッシュボード表示                        │  │
                    │  │  ├─ 取引一覧・フィルター                       │  │
                    │  │  └─ 設定画面（BYOK、閾値等）                   │  │
                    │  └──────────────┬─────────────────────────────┘  │
                    │                  │ 読み書き                        │
                    │  ┌───────────────▼─────────────────────────────┐  │
                    │  │ データ層（SQLite WASM / IndexedDB）            │  │
                    │  │  card_transactions テーブル                   │  │
                    │  │  llm_keys（暗号化）                           │  │
                    │  │  settings                                    │  │
                    │  └─────────────────────────────────────────────┘  │
                    │                                                  │
                    └──────────┬─────────────────┬────────────────────┘
                               │ HTTPS           │ HTTPS
                  ┌────────────▼───────┐  ┌──────▼────────────────┐
                  │  Gmail API         │  │  Anthropic/OpenAI API  │
                  │  （メール取得）      │  │  （カテゴリ分類）       │
                  │  ★OAuth: PKCE      │  │  ★BYOK APIキー         │
                  │  ★トークン: ブラウザ │  │  ★サーバー経由なし     │
                  └────────────────────┘  └────────────────────────┘
```

### 7.2 Gmail同期フロー（詳細）

```
[ブラウザ] ──① OAuth認証ボタンクリック──▶ [Google OAuth]
             ②◀── authorization_code ──────┘
             ③── code_verifier + code ──▶ [Google OAuth]
             ④◀── access_token ────────────┘
             ⑤── Gmail APIリクエスト ────▶ [Gmail API]
             ⑥◀── メール本文 ──────────────┘
             ⑦── POST /api/parse/email ──▶ [Fly.ioサーバー]
             ⑧◀── 取引データ（JSON）─────────┘
             ⑨── IndexedDB書き込み（ローカル処理）
             ⑩── UI更新（htmxで部分更新）
```

### 7.3 旧アーキテクチャとの比較

```
旧（ステートフルサーバー）:              新（ステートレスサーバー）:

ブラウザ → サーバー → Google OAuth      ブラウザ → Google OAuth
        ← トークン保存（サーバー）               ← トークン（ブラウザ保持）
サーバー → Gmail API                   ブラウザ → Gmail API
        ← メール → SQLite DB（サーバー）         ← メール → /api/parse → DB（ブラウザ）

★ サーバーに多くのデータが集中            ★ サーバーには何も残らない
```

---

## 8. プライバシーポリシー要点（v2対応）

### 8.1 サーバーに送信されるデータ

| 送信データ | タイミング | 保存されるか |
|-----------|----------|------------|
| Webページリクエスト（URL、ブラウザ情報） | 全ページアクセス時 | **アクセスログ（Fly.io側）のみ。アプリには保存しない** |
| メール本文（Gmail API経由） | 同期実行時 | **保存しない**（パース処理後即時破棄） |
| パース済み取引データ（/api/parse/emailレスポンス）| 同期実行時 | **保存しない**（ブラウザが受け取り、ブラウザDBに保存） |

### 8.2 サーバーに送信されないデータ

| 非送信データ | 保存場所 |
|------------|--------|
| OAuthトークン（Gmail） | ブラウザのsessionStorage |
| LLM APIキー（BYOK） | ブラウザのIndexedDB（暗号化） |
| 取引データ（金額、店舗、日付） | ブラウザのIndexedDB/SQLite WASM |
| 設定（閾値等） | ブラウザのlocalStorage |
| カード会社情報 | ブラウザのDB |

### 8.3 ユーザーへの注意事項

1. **データはブラウザに紐付く**: データはブラウザのストレージ（IndexedDB/OPFS）に保存される。**別のブラウザや別のデバイスからは閲覧できない**
2. **ブラウザクリアでデータ消失**: ブラウザのデータクリア（シークレットモードの終了、「ブラウザデータを削除」）でデータが消える可能性がある。**定期的なエクスポートを推奨**
3. **Gmail認証はセッション限定**: アクセストークンはsessionStorageに保存。ブラウザを閉じると再認証が必要
4. **LLM APIキーの管理**: BYOKで入力したAPIキーはブラウザ内に暗号化保存。ユーザーのPIN/パスフレーズが漏洩するとAPIキーも危険
5. **サーバーのアクセスログ**: Fly.ioのインフラレベルでアクセスログ（IP、URL）が記録される場合がある（Fly.io社のプライバシーポリシーに準拠）

### 8.4 外部通信一覧

| 通信先 | 目的 | 送信データ | ユーザー制御 |
|--------|------|-----------|-----------|
| Fly.io（サーバー） | UI取得・メールパース | URLリクエスト + メール本文（パース時のみ） | 常時 |
| Google OAuth | Gmail認証 | client_id + PKCE challenge | 認証ボタンで明示的開始 |
| Gmail API | メール取得 | OAuthアクセストークン（ブラウザ管理） | 同期ボタンで明示的開始 |
| Anthropic/OpenAI API | カテゴリ分類 | 店舗名 + 金額のみ | BYOK設定時のみ。未設定なら通信なし |
| CDN（DaisyUI/Tailwind/htmx） | 静的アセット | なし（GET要求のみ） | 常時（変更不可） |

---

## 9. v1からの変更点サマリー

| 項目 | v1（cmd_042） | v2（cmd_045） |
|------|------------|------------|
| デプロイ先 | localhost専用 | **Fly.io（SaaS）** |
| サーバー役割 | ステートフル（DBあり） | **ステートレス（DBなし）** |
| データ保存場所 | サーバーのSQLite | **ブラウザのIndexedDB/SQLite WASM** |
| Fly.io | ❌ 撤回 | ✅ **復元（ステートレス版）** |
| Litestream | ❌ 削除 | ❌ **引き続き不要（サーバーにDBなし）** |
| R2バックアップ | ❌ 削除 | ❌ **引き続き不要** |
| OAuthトークン | サーバーのtoken.json | **ブラウザのsessionStorage** |
| LLMキー（BYOK） | サーバー側暗号化保存 | **ブラウザ内暗号化保存** |
| pickle→JSON移行 | ✅ 有効（subtask_044b） | ✅ **引き続き有効（Phase B廃止まで）** |
| start.sh/Dockerfile簡素化 | ✅ 有効（cmd_044） | ✅ **引き続き有効** |
| コスト | ~$0.15〜$5.15/月 | **~$0〜$5/月（ボリューム不要）** |

---

## トレードオフ分析

### 新方針（プライバシーファーストSaaS）の評価

| 観点 | メリット | デメリット |
|------|---------|-----------|
| **プライバシー** | サーバーにユーザーデータが一切ない。最高水準 | — |
| **アクセス性** | インターネット経由でどこからでもアクセス可能 | データはブラウザに紐付き → 別デバイスからは閲覧不可 |
| **コスト** | ボリューム不要でFly.io費用がさらに低減 | — |
| **実装コスト** | — | 大規模なフロントエンドリファクタリングが必要（Phase B-D: 25-35h） |
| **データ耐久性** | — | ブラウザデータクリアでデータ消失リスク |
| **既存テスト** | — | OAuthテスト、DBテスト等の廃止・改修が必要 |
| **ユーザビリティ** | SaaSとして運用可能（複数端末は除く） | 別デバイスからデータ閲覧不可（エクスポート/インポートで対応） |
| **セキュリティ** | サーバー侵害でユーザーデータが漏洩しない | XSS攻撃でブラウザデータが漏洩するリスク（CSPで緩和） |

### 旧方針（localhost専用）との比較

| 観点 | localhost専用（v1） | プライバシーファーストSaaS（v2）|
|------|-------------------|------------------------------|
| アクセス性 | △ 自宅PCのみ | ◎ どこからでも |
| データプライバシー | ◎ 完全ローカル | ◎ サーバーにデータなし |
| 実装コスト | ◎ 変更最小 | △ 大規模JS実装必要 |
| Fly.io | ❌ 無効 | ✅ 有効（ステートレス） |

**殿の最終決定**: v2（プライバシーファーストSaaS）を採用。

---

## 付録: 保留中の設計事項

### ブラウザデータのバックアップ/エクスポート戦略

サーバーにデータがないため、ユーザーが責任を持つ:

| 方式 | 実装コスト | ユーザービリティ | 推奨度 |
|------|-----------|--------------|-------|
| **A: JSON/CSVエクスポートボタン** | 低（1-2h） | ○ ダウンロードして保管 | ★★★ |
| **B: SQLiteファイルダウンロード** | 低（1h） | △ 技術者向け | ★★☆ |
| **C: 他デバイスへQRコード転送** | 高（5-8h） | ○ モバイル対応 | ★☆☆（将来検討） |

**推奨**: Phase Cの一部としてA（JSONエクスポートボタン）を実装。

### Content Security Policy（XSSリスク緩和）

```http
Content-Security-Policy:
  default-src 'self';
  script-src 'self' https://cdn.jsdelivr.net https://cdn.tailwindcss.com;
  connect-src 'self' https://accounts.google.com https://oauth2.googleapis.com
              https://gmail.googleapis.com https://api.anthropic.com https://api.openai.com;
  style-src 'self' https://cdn.jsdelivr.net;
  frame-ancestors 'none'
```

ブラウザ内APIキーのXSSリスクをCSPで緩和する。

---

*v2作成: 軍師（Gunshi）| subtask_045_gunshi | cmd_045 | 2026-02-21*
*v1（cmd_042）を全面改訂。殿の確定方針「サーバーデプロイ＋クライアントサイドDB」を反映*
*参照: architecture.md（Fly.io確定）、v1 privacy_architecture.md、auth_routes.py、auth.py、config.py*
