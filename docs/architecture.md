# card-spending-tracker アーキテクチャ設計書（最終確定版）

**改訂日**: 2026-02-20
**作成者**: 軍師（Gunshi）— subtask_028_gunshi3（subtask_028_gunshi2の改訂）
**親コマンド**: cmd_028
**入力**: 前版architecture.md、code_survey.md、ソースコード全読、殿の追加方針4件、殿の最終決定3件

---

## 殿の方針と最終決定（本改訂の前提）

### 追加方針（4件）

| # | 方針 | 要約 |
|---|------|------|
| 1 | **本番運用前提** | サーバーデプロイ、HTTPS、環境変数管理、セキュリティ、ログ、監視 |
| 2 | **CI/CD環境整備** | GitHub Actionsで自動テスト・自動デプロイ |
| 3 | **デザイン重視** | 見た目に凝りたい。CSSフレームワーク選定を再検討 |
| 4 | **モバイルファースト** | スマホが主戦場。レスポンシブ必須 |

### 殿の最終決定（3件 — 確定事項、変更不可）

| # | 決定事項 | 詳細 |
|---|----------|------|
| 1 | **デプロイ先: Fly.io** | VPS案は却下。SQLite永続ディスクの都合でFly.ioに決定 |
| 2 | **CSS戦略: Tailwind + DaisyUI** | 軍師推奨案を殿が承認。確定 |
| 3 | **ドメイン: 後日検討** | まずはFly.ioデフォルトドメインで運用開始 |

これら方針と決定により、前版の「個人利用の軽量アプリ」前提から **「本番品質の個人ダッシュボード」** 前提に設計を改訂する。

---

## 1. 現状アーキテクチャ分析

### 1.1 ディレクトリ構成図

```
card-spending-tracker/
├── app/
│   ├── api/                    ← REST APIレイヤー
│   │   ├── main.py             ← FastAPIインスタンス + ルータマウント
│   │   ├── routes/             ← エンドポイント（health, sync, transactions）
│   │   └── schemas/            ← Pydanticレスポンススキーマ
│   ├── web/                    ← WebUIレイヤー（Jinja2 + htmx）
│   │   ├── routes.py           ← 520行: 12ルート + 11ヘルパー ← ★要分割
│   │   ├── auth_routes.py      ← OAuth 2.0コールバック
│   │   └── pin_auth.py         ← PINセッション認証（新規追加済み）
│   ├── cli/                    ← CLIインタフェース（Click）
│   ├── database/               ← SQLAlchemy接続管理
│   ├── models/                 ← ORMモデル（単一テーブル: card_transactions）
│   ├── gmail/                  ← Gmail API統合（auth, client, parser）
│   ├── services/               ← ビジネスロジック
│   │   ├── aggregation_service.py  ← 月次集計
│   │   └── transaction_service.py  ← 保存 + 重複検出
│   ├── security/               ← セキュリティユーティリティ（★未統合）
│   ├── static/css/style.css    ← カスタムCSS（543行）← ★モバイル対応不十分
│   └── templates/              ← Jinja2テンプレート（6ページ + 2パーシャル）
├── alembic/                    ← DBマイグレーション（基盤のみ）
├── credentials/                ← OAuth認証情報（.gitignore対象）
├── data/                       ← SQLiteファイル
├── tests/                      ← 250+テスト / 18ファイル
├── Dockerfile                  ← 存在するが本番最適化未実施
├── docker-compose.yml          ← 開発用構成（TOKEN_ENCRYPTION_KEY欠落）
└── pyproject.toml              ← Poetry + ruff + pytest設定
```

### 1.2 データフロー図

```
[Gmail API]
    │
    ▼
┌──────────────────────────────────────────────────────────────┐
│  Ingestion Layer (メール取得)                                 │
│  ┌─────────┐    ┌──────────┐    ┌──────────────┐            │
│  │ gmail/  │───▶│ gmail/   │───▶│ gmail/       │            │
│  │ auth.py │    │ client.py│    │ parser.py    │            │
│  │ (OAuth) │    │ (Fetch)  │    │ (Extract)    │            │
│  └─────────┘    └──────────┘    └──────┬───────┘            │
│                                         │                    │
│  ★ 現状: sync処理が3箇所に重複          │                    │
│    api/routes/sync.py (226行)           │                    │
│    web/routes.py:web_sync (170行)       ▼                    │
│    cli/commands.py (403行)    ┌──────────────────┐           │
│                               │ services/        │           │
│                               │ transaction_     │           │
│                               │ service.py       │           │
│                               │ (save+dedup)     │           │
│                               └────────┬─────────┘           │
└────────────────────────────────────────┼─────────────────────┘
                                         │
                                         ▼
┌──────────────────────────────────────────────────────────────┐
│  Storage Layer                                                │
│  ┌──────────────────────┐    ┌─────────────────┐             │
│  │ SQLite               │    │ settings.json   │             │
│  │ card_transactions    │    │ (alert閾値)      │             │
│  │ - 単一テーブル設計    │    └─────────────────┘             │
│  │ - UNIQUE: msg_id     │                                    │
│  │ - ★ INDEX不足        │                                    │
│  └──────────┬───────────┘                                    │
└─────────────┼────────────────────────────────────────────────┘
              │
              ▼
┌──────────────────────────────────────────────────────────────┐
│  Presentation Layer                                           │
│  ┌─────────┐  ┌──────────────┐  ┌────────────────────┐      │
│  │ REST API│  │ Web UI       │  │ CLI                │      │
│  │ /api/*  │  │ Jinja2+htmx  │  │ Click              │      │
│  │ (JSON)  │  │ (HTML)       │  │ (stdout)           │      │
│  └─────────┘  └──────────────┘  └────────────────────┘      │
└──────────────────────────────────────────────────────────────┘
```

### 1.3 現在の強み

| 項目 | 評価 | 詳細 |
|------|------|------|
| **レイヤー分離** | ◎ | API / Web / CLI / Services / Models が明確に分離 |
| **テスト基盤** | ○ | 250+テスト、主要パーサーは高カバレッジ、pytest + ruff整備済 |
| **セキュリティ意識** | ○ | OAuth暗号化、XSS対策、PIN認証、CSRF対策（OAuth state） |
| **技術スタック** | ◎ | FastAPI+htmx+SQLite = 個人利用に最適な軽量構成 |
| **htmx活用** | ◎ | カスタムJS=0行、全インタラクションをhtmxで実現 |
| **Docker対応** | ○ | Dockerfile + docker-compose.yml 存在（改善余地あり） |

### 1.4 技術的負債（優先度順）

| # | 負債 | 影響度 | 場所 | 新規/既知 |
|---|------|--------|------|-----------|
| **TD-1** | sync処理の3重複（API / Web / CLI） | 高 | sync.py, routes.py, commands.py | 既知 |
| **TD-2** | routes.py肥大化（520行、12ルート+11ヘルパー） | 高 | web/routes.py | 既知 |
| **TD-3** | DBアクセスの非DI化（毎回`os.getenv()`） | 中 | 全ルートハンドラ | 既知 |
| **TD-4** | セキュリティモジュール未統合 | 中 | security/*.py | 既知 |
| **TD-5** | parser.pyのif/elif分岐（5社ハードコード） | 中 | gmail/parser.py | 既知 |
| **TD-6** | settings.json + .env の二重管理 | 低 | routes.py, config.py | 既知 |
| **TD-7** | DBインデックス不足（transaction_date, card_company） | 低 | models/transaction.py | 既知 |
| **TD-8** | 型ヒント不足（routes.py, auth.py） | 低 | 複数ファイル | 既知 |
| **TD-9** | モバイル対応不十分（ブレークポイント1つ、640pxのみ） | **高** | style.css | ★新規 |
| **TD-10** | CI/CDパイプライン不在 | **高** | .github/ 未作成 | ★新規 |
| **TD-11** | docker-compose.yml: TOKEN_ENCRYPTION_KEY欠落 | 中 | docker-compose.yml | ★新規 |
| **TD-12** | 本番デプロイ構成未整備（HTTPS、監視、バックアップ） | **高** | インフラ全般 | ★新規 |
| **TD-13** | テンプレート内のインラインスタイル混在 | 低 | transactions.html, summary.html | ★新規 |

---

## 2. フロントエンド戦略（全面改訂）

### 2.1 CSS戦略

殿の方針「デザイン重視」「モバイルファースト」を受け、前版のPure CSS推奨を撤回し再評価する。

#### 比較表

| 観点 | A: Pure CSS維持 | B: Tailwind CSS | C: Bootstrap 5 | D: Tailwind+DaisyUI（推奨） |
|------|----------------|-----------------|-----------------|---------------------------|
| **デザイン品質**（殿: 凝りたい） | △ 全て手作り | ○ ユーティリティ | ○ 既製コンポーネント | **◎ テーマ付きコンポーネント** |
| **モバイルファースト**（殿: スマホ主戦場） | × BP1つのみ | ◎ sm/md/lg/xl組込 | ○ グリッド体系 | **◎ Tailwind継承** |
| **ダークモード** | × 手動実装 | ○ dark:プレフィックス | △ 手動 | **◎ data-theme切替** |
| **導入コスト** | ◎ 0時間 | △ テンプレ全書換6-8h | △ テンプレ全書換6-8h | **△ テンプレ全書換6-8h** |
| **デザイン一貫性** | △ 手動管理 | ○ ユーティリティ | ◎ コンポーネント | **◎ テーマ+コンポーネント** |
| **htmx互換性** | ◎ | ◎ | ◎ | **◎** |
| **学習コスト** | ◎ CSS知識のみ | △ クラス名暗記 | △ 独自体系 | **△ Tailwind+DaisyUI** |
| **テーマカスタマイズ** | △ CSS変数手動 | ○ tailwind.config | △ Sassオーバーライド | **◎ 30+テーマ+カスタム** |
| **コンポーネント数** | × なし | × なし（ユーティリティのみ） | ◎ 豊富 | **◎ btn,card,navbar等** |
| **バンドルサイズ(CDN)** | ◎ 12KB | △ ~300KB | △ ~200KB | **○ ~350KB** |

#### 殿のニーズ適合度スコア

| 要件 | Pure CSS | Tailwind | Bootstrap | Tailwind+DaisyUI |
|------|----------|----------|-----------|------------------|
| 本番品質デザイン | 2/5 | 3/5 | 4/5 | **5/5** |
| モバイルファースト | 1/5 | 5/5 | 4/5 | **5/5** |
| 開発効率 | 3/5 | 3/5 | 4/5 | **5/5** |
| 保守性 | 2/5 | 4/5 | 3/5 | **4/5** |
| **合計** | **8/20** | **15/20** | **15/20** | **19/20** |

#### 確定: D（Tailwind CSS + DaisyUI）★殿承認済

**前版からの変更理由:**

前版では「543行のCSSは管理可能、フレームワーク導入は過剰」と判断した。しかし殿の新方針を踏まえると:

1. **デザイン重視**: Pure CSSで「凝った」UIを実現するには相当なCSSスキルと時間が必要。DaisyUIは30+テーマとプロフェッショナルなコンポーネント群を即座に提供する
2. **モバイルファースト**: 現状CSSはブレークポイント1つ(640px)で、テーブルがモバイルで溢れる。Tailwindのレスポンシブユーティリティ(sm:/md:/lg:)はモバイルファーストが設計の基本
3. **ダークモード**: DaisyUIなら`data-theme="dark"`の1属性で完全なダークモード実現。Pure CSSでは全色定義の手動二重化が必要
4. **テンプレート書換コスト**: どのフレームワークを選んでもモバイルファースト対応にはテンプレート書換が必要。書き換えるならDaisyUIのコンポーネントを使う方が効率的

**導入方式:**

```html
<!-- base.html に追加（CDN方式: ビルドステップ不要） -->
<link href="https://cdn.jsdelivr.net/npm/daisyui@4/dist/full.min.css" rel="stylesheet">
<script src="https://cdn.tailwindcss.com"></script>
```

CDN方式を推奨する理由:
- Node.jsビルドパイプラインが不要（Python onlyのスタック維持）
- 個人利用アプリでCDNサイズ(~350KB)は許容範囲
- 本番最適化が必要になった場合は Tailwind standalone CLI をDockerビルドに追加可能

### 2.2 JS/フレームワーク戦略

殿の方針を受け、SPA移行の是非を評価する。

#### 比較表

| 観点 | A: htmx+Jinja2維持（推奨） | B: React SPA | C: Vue SPA | D: Svelte SPA | E: Astro |
|------|---------------------------|-------------|------------|---------------|----------|
| **現スタックとの親和性** | ◎ そのまま | × 全面書換 | × 全面書換 | × 全面書換 | △ 部分移行可 |
| **ビルドシステム** | ◎ 不要 | × Vite+npm必須 | × Vite+npm必須 | × Vite+npm必須 | × Vite+npm必須 |
| **バンドルサイズ** | ◎ htmx: 14KB | × 45KB+ | △ 30KB+ | ○ 5KB+ | ◎ 最小限 |
| **サーバー統合** | ◎ 同一プロセス | × 別プロジェクト | × 別プロジェクト | × 別プロジェクト | △ アダプタ |
| **学習コスト** | ◎ なし | × JSX+hooks | × Composition API | ○ シンプル構文 | △ Islands概念 |
| **デザイン自由度** | ◎ CSS次第 | ◎ CSS次第 | ◎ CSS次第 | ◎ CSS次第 | ◎ CSS次第 |
| **モバイル対応** | ◎ CSS次第 | ◎ CSS次第 | ◎ CSS次第 | ◎ CSS次第 | ◎ CSS次第 |
| **移行コスト** | ◎ 0時間 | × 40-60時間 | × 40-60時間 | × 30-40時間 | × 20-30時間 |
| **2プロジェクト管理** | ◎ 不要 | × 必要 | × 必要 | × 必要 | × 必要 |

#### 推奨: A（htmx + Jinja2 維持 + Chart.js追加）

**判断根拠:**

殿が求める「デザイン重視」「モバイルファースト」は **CSSレイヤーの問題** であり、JSフレームワークの問題ではない。Tailwind+DaisyUIはhtmx+Jinja2と完全互換であり、SPA化する理由がない。

SPA化のデメリット:
1. **2プロジェクト管理**: フロントエンド(Node.js) + バックエンド(Python) の二重管理が発生
2. **API変換**: 現在のWeb routes(HTML返却)を全てJSON API化する必要あり
3. **移行コスト**: 最低30時間以上の書き換え。6ページ+2パーシャルのアプリに対して投資対効果が悪い
4. **機能同等**: htmx+DaisyUIで同等のUI品質が実現可能

**Chart.js統合（前版と同じ）:**

```html
<!-- summary.html に追加 -->
<div class="card bg-base-100 shadow-xl">
  <div class="card-body">
    <h2 class="card-title">支出推移（過去12ヶ月）</h2>
    <div hx-get="/web/chart/monthly" hx-trigger="load" hx-swap="innerHTML">
      <span class="loading loading-spinner loading-lg"></span>
    </div>
  </div>
</div>
```

### 2.3 モバイルファースト実装方針

#### 現状の問題

```css
/* 現在: デスクトップファーストの単一ブレークポイント */
@media (max-width: 640px) {
  /* モバイル用の上書き（31行のみ） */
}
```

問題点:
- ブレークポイントが1つだけ（640px）
- デスクトップ→モバイルの順で書かれている（デスクトップファースト）
- テーブルがモバイルで横溢れする
- ハンバーガーメニューなし
- タッチターゲットサイズ未考慮

#### モバイルファースト設計原則

Tailwindのレスポンシブシステムを採用:

```
ベース（接頭辞なし）= モバイル（~639px）← ★ここがデフォルト
sm: = 640px以上（大型スマホ/小型タブレット）
md: = 768px以上（タブレット）
lg: = 1024px以上（デスクトップ）
```

#### 画面別モバイル対応方針

| 画面 | モバイル表示 | デスクトップ表示 |
|------|-------------|-----------------|
| **ナビゲーション** | DaisyUI drawer（ハンバーガーメニュー） | 横並びナビバー |
| **ダッシュボード** | カード縦積み、金額を大きく表示 | カード横並びグリッド |
| **取引一覧** | カード型リスト（日付・店舗・金額） | テーブル表示 |
| **月次サマリー** | 縦積みカード + 横スクロールテーブル | テーブル表示 |
| **グラフ** | 縦長の棒グラフ | 横長の棒グラフ |
| **設定** | フルwidth入力欄 | コンパクトフォーム |

#### 取引一覧のモバイル表示例

```html
<!-- モバイル: カード型リスト / デスクトップ: テーブル -->

<!-- モバイル用カード（md以下で表示） -->
<div class="md:hidden space-y-2">
  {% for tx in transactions %}
  <div class="card bg-base-100 shadow-sm">
    <div class="card-body p-3">
      <div class="flex justify-between items-center">
        <div>
          <p class="font-bold">{{ tx.merchant }}</p>
          <p class="text-sm text-base-content/60">{{ tx.date }} · {{ tx.card }}</p>
        </div>
        <p class="text-lg font-bold">¥{{ "{:,}".format(tx.amount) }}</p>
      </div>
    </div>
  </div>
  {% endfor %}
</div>

<!-- デスクトップ用テーブル（md以上で表示） -->
<div class="hidden md:block overflow-x-auto">
  <table class="table table-zebra">
    ...
  </table>
</div>
```

#### PWA対応（推奨）

モバイルファーストを徹底するなら、PWA（Progressive Web App）化を推奨:

```json
// static/manifest.json
{
  "name": "Card Spending Tracker",
  "short_name": "支出管理",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#ffffff",
  "theme_color": "#2563eb",
  "icons": [
    { "src": "/static/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/static/icon-512.png", "sizes": "512x512", "type": "image/png" }
  ]
}
```

効果:
- スマホのホーム画面に追加可能（ネイティブアプリ風）
- ブラウザのアドレスバーが消え、全画面表示
- 将来のプッシュ通知対応の基盤

### 2.4 コンポーネント・テンプレート方針

DaisyUI導入に伴い、テンプレート構成を改訂:

```
templates/
├── base.html                  ← ★改訂: DaisyUI drawer + テーマ切替
│   ├── <meta name="viewport"> ← 維持
│   ├── DaisyUI CDN            ← ★追加
│   ├── Tailwind CDN           ← ★追加
│   ├── htmx CDN               ← 維持
│   └── drawer layout          ← ★新規: モバイルナビ
├── _macros.html               ← ★新規: 共通Jinja2マクロ
│   ├── stat_card()            ← DaisyUI statカード
│   ├── transaction_card()     ← モバイル用取引カード
│   ├── currency(amount)       ← 金額フォーマット（¥1,234）
│   ├── trend_badge(pct)       ← 前月比バッジ（↑+5%/↓-3%）
│   └── theme_toggle()         ← ダークモード切替ボタン
├── dashboard.html             ← ★改訂: DaisyUI stat + card
├── transactions.html          ← ★改訂: モバイル=カード/PC=テーブル
├── summary.html               ← ★改訂: + Chart.jsグラフ
├── settings.html              ← ★改訂: DaisyUI form
└── partials/
    ├── sync_status.html       ← ★改訂: DaisyUI alert
    ├── transaction_table.html ← ★改訂: DaisyUI table + zebra
    └── monthly_chart.html     ← ★新規: Chart.jsグラフ
```

**Jinja2マクロ例:**

```html
{# _macros.html #}
{% macro stat_card(title, value, description="", badge_type="") %}
<div class="stat">
  <div class="stat-title">{{ title }}</div>
  <div class="stat-value {% if badge_type == 'danger' %}text-error{% endif %}">
    {{ value }}
  </div>
  {% if description %}
  <div class="stat-desc">{{ description }}</div>
  {% endif %}
</div>
{% endmacro %}

{% macro transaction_card(tx) %}
<div class="card bg-base-100 shadow-sm border border-base-300">
  <div class="card-body p-3">
    <div class="flex justify-between items-center">
      <div class="min-w-0 flex-1 mr-2">
        <p class="font-bold truncate">{{ tx.merchant }}</p>
        <p class="text-sm opacity-60">{{ tx.transaction_date }} · {{ tx.card_company }}</p>
      </div>
      <p class="text-lg font-bold whitespace-nowrap">¥{{ "{:,}".format(tx.amount) }}</p>
    </div>
  </div>
</div>
{% endmacro %}
```

---

## 3. バックエンド構造改善案

### 3.1 sync処理の統合（TD-1解消: 最優先）

現状の問題: 同一のsyncロジックが3箇所に存在（DRY違反）

```
現状:                              改善後:

api/routes/sync.py ─┐             ┌──────────────────────┐
                     ├─ 重複 ──▶  │ services/            │
web/routes.py        │             │ sync_service.py      │
  :web_sync() ──────┤             │ ├─ SyncService       │
                     │             │ │  .sync_all()       │
cli/commands.py ────┘             │ │  .process_message()│
                                   │ └─ SyncResult       │
                                   └────────┬─────────────┘
                                            │
                                   ┌────────┼────────┐
                                   ▼        ▼        ▼
                                 API      Web      CLI
                               (JSON)   (HTML)   (stdout)
```

**sync_service.py 設計:**

```python
@dataclass
class SyncResult:
    new_count: int
    total_fetched: int
    skip_reasons: dict[str, int]
    errors: list[str]

class SyncService:
    def __init__(self, gmail_client, parser, transaction_service):
        ...

    def sync_all(self, session, max_results=100) -> SyncResult:
        """全メール取得 → 解析 → 保存（共通ロジック）"""
        ...

    def _process_message(self, session, msg) -> str:
        """1件処理: 成功='saved', スキップ=SkipReason, エラー='error'"""
        ...
```

各レイヤーはSyncResultを受けて自分のフォーマットで返却するだけ。

### 3.2 routes.py分割（TD-2解消）

現状520行を論理ドメインで分割:

```
web/
├── routes.py          → web/routes/__init__.py（ルータ集約）
├── routes/
│   ├── dashboard.py   ← GET /（ダッシュボード）
│   ├── transactions.py ← GET /transactions, /web/transactions/filter
│   ├── summary.py     ← GET /summary
│   ├── settings.py    ← GET/POST /settings
│   ├── sync.py        ← POST /web/sync（SyncServiceを呼ぶだけ）
│   └── chart.py       ← ★新規: GET /web/chart/monthly（Chart.jsデータ）
├── auth_routes.py     ← 変更なし
└── pin_auth.py        ← 変更なし
```

### 3.3 DBアクセスのDI化（TD-3解消）

```python
# 改善: FastAPI Depends で統一
def get_db_session():
    """FastAPI dependency: DB session provider"""
    settings = get_settings()
    db_path = settings.DATABASE_PATH
    with get_session(db_path) as session:
        yield session

# 使用例
@web_router.get("/")
def dashboard(request: Request, session: Session = Depends(get_db_session)):
    monthly_total = get_total_by_month(session, year, month)
    ...
```

### 3.4 構造化ログ導入（本番運用要件）

```python
# app/logging_config.py（新規）
import structlog

def setup_logging(log_level: str = "INFO", json_output: bool = True):
    """構造化ログ設定。本番=JSON、開発=コンソール"""
    structlog.configure(
        processors=[
            structlog.contextvars.merge_contextvars,
            structlog.processors.add_log_level,
            structlog.processors.TimeStamper(fmt="iso"),
            structlog.processors.JSONRenderer() if json_output
            else structlog.dev.ConsoleRenderer(),
        ],
        wrapper_class=structlog.make_filtering_bound_logger(log_level),
    )

# 使用例
log = structlog.get_logger()
log.info("sync_completed", new_count=5, total=100, duration_ms=1234)
# → {"event":"sync_completed","new_count":5,"total":100,"duration_ms":1234,...}
```

pyproject.toml への追加: `structlog = "^24.0"`

### 3.5 改善後のモジュール依存関係図

```
                    ┌─────────────┐
                    │  main.py    │
                    │  (FastAPI)  │
                    └──────┬──────┘
                           │
          ┌────────────────┼────────────────┐
          ▼                ▼                ▼
    ┌──────────┐    ┌──────────┐    ┌──────────┐
    │ API      │    │ Web      │    │ Auth     │
    │ routes/  │    │ routes/  │    │ routes   │
    └─────┬────┘    └─────┬────┘    └──────────┘
          │               │
          └───────┬───────┘
                  ▼
          ┌──────────────┐
          │  Services    │
          ├──────────────┤
          │ sync_service │ ← ★新規（TD-1解消）
          │ aggregation  │
          │ transaction  │
          └──────┬───────┘
                 │
          ┌──────┼──────┐
          ▼      ▼      ▼
    ┌────────┐ ┌────┐ ┌──────┐
    │ Gmail  │ │ DB │ │Config│
    │ auth   │ │    │ │      │
    │ client │ │    │ │      │
    │ parser │ │    │ │      │
    └────────┘ └────┘ └──────┘

    ★ 横断関心事（新規）:
    ┌──────────────────┐
    │ logging_config   │ ← structlog
    │ middleware/      │ ← リクエストログ、セキュリティヘッダ
    └──────────────────┘
```

---

## 4. 本番運用設計（Fly.io 確定）

> ★殿の最終決定: デプロイ先は **Fly.io** に確定（VPS案は却下）。SQLite永続ディスク（Volumes）でデータ保持。

### 4.1 fly.toml 設計

```toml
# fly.toml — Fly.io アプリケーション設定
app = "card-spending-tracker"
primary_region = "nrt"  # 東京リージョン

[build]
  dockerfile = "Dockerfile"

[http_service]
  internal_port = 8000
  force_https = true
  auto_stop_machines = true   # ★コスト最適化: アクセスがない時はマシン停止
  auto_start_machines = true  # アクセス時に自動起動
  min_machines_running = 0    # 完全停止可（個人利用なのでコスト優先）

[http_service.concurrency]
  type = "requests"
  hard_limit = 250
  soft_limit = 200

[[vm]]
  memory = "256mb"            # 個人利用に十分
  cpu_kind = "shared"
  cpus = 1

[mounts]
  source = "card_data"        # fly volumes create で作成
  destination = "/data"       # SQLite永続ボリューム
  initial_size = 1            # 1GB

[checks]
  [checks.health]
    type = "http"
    port = 8000
    path = "/health"
    interval = "30s"
    timeout = "5s"
    grace_period = "10s"

[env]
  DATABASE_PATH = "/data/card_transactions.db"
  LOG_LEVEL = "INFO"
  LOG_FORMAT = "json"
```

**fly.toml 設計のポイント:**

| 設定項目 | 値 | 理由 |
|---------|-----|------|
| `primary_region` | `nrt` (東京) | 日本国内の低レイテンシ |
| `auto_stop_machines` | `true` | 個人利用。非アクセス時は0円 |
| `memory` | 256MB | FastAPI + SQLite の個人利用に十分 |
| `mounts` | `/data` | SQLiteファイルの永続化。ボリュームはマシン停止でも保持 |
| `force_https` | `true` | Fly.ioが自動HTTPS提供（証明書管理不要） |

### 4.2 Dockerfile（Fly.io向け調整）

```dockerfile
# === Build stage ===
FROM python:3.12-slim AS builder

RUN pip install poetry==1.7.1
WORKDIR /app
COPY pyproject.toml poetry.lock* ./
RUN poetry export -f requirements.txt --output requirements.txt --without-hashes

# === Runtime stage ===
FROM python:3.12-slim

# Litestream インストール（SQLiteバックアップ用）
ADD https://github.com/benbjohnson/litestream/releases/download/v0.3.13/litestream-v0.3.13-linux-amd64.tar.gz /tmp/litestream.tar.gz
RUN tar -C /usr/local/bin -xzf /tmp/litestream.tar.gz && rm /tmp/litestream.tar.gz

RUN groupadd -r appuser && useradd -r -g appuser -d /app appuser
WORKDIR /app

# 依存のみ先にインストール（レイヤーキャッシュ活用）
COPY --from=builder /app/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# アプリコード
COPY app/ app/
COPY alembic/ alembic/
COPY alembic.ini .
COPY litestream.yml /etc/litestream.yml

# データディレクトリ（Fly.io Volume マウント先）
# /data はfly.tomlの[mounts]でVolume化される
RUN mkdir -p /data && chown -R appuser:appuser /app /data

USER appuser
EXPOSE 8000

# ヘルスチェック
HEALTHCHECK --interval=30s --timeout=10s --retries=3 --start-period=40s \
    CMD python -c "import httpx; httpx.get('http://localhost:8000/health').raise_for_status()"

# 起動コマンド: Litestream がSQLiteをレプリケーションしつつ、uvicornを起動
# alembic upgrade head → マイグレーション実行後にサーバー起動
CMD ["litestream", "replicate", "-exec", "sh -c 'alembic upgrade head && uvicorn app.api.main:app --host 0.0.0.0 --port 8000'"]
```

**前版からの変更点:**

| 項目 | 前版 | 今版 |
|------|------|------|
| Python | 3.11 | **3.12**（タスク指定） |
| SQLiteパス | `/app/data/` | **`/data/`**（Fly.ioボリュームマウント先） |
| Litestream | Docker Compose sidecar | **同一コンテナ内蔵**（Fly.ioはsidecar非対応） |
| 起動コマンド | `alembic + uvicorn` | **`litestream replicate -exec "alembic + uvicorn"`** |
| 非rootユーザー | ✅ | ✅（維持） |

### 4.3 Litestream + 永続ボリューム構成

#### アーキテクチャ図

```
┌──────────────────────────────────────────────────────┐
│  Fly.io Machine (nrt / 東京)                          │
│                                                       │
│  ┌─────────────────────────────────────────────────┐ │
│  │  litestream replicate -exec "..."                │ │
│  │                                                   │ │
│  │  ┌──────────────────────┐  ┌─────────────────┐  │ │
│  │  │  uvicorn (FastAPI)   │  │  Litestream     │  │ │
│  │  │  :8000               │  │  (WAL監視)       │  │ │
│  │  │  ┌──────────────┐   │  │  ┌───────────┐  │  │ │
│  │  │  │  SQLite DB   │───│──│─▶│ WAL → S3  │  │  │ │
│  │  │  │  /data/*.db  │   │  │  │ streaming │  │  │ │
│  │  │  └──────────────┘   │  │  └───────────┘  │  │ │
│  │  └──────────────────────┘  └────────┬────────┘  │ │
│  └──────────────────────────────────────┼──────────┘ │
│                                          │            │
│  ┌─────────────┐                        │            │
│  │ Fly Volume  │                        │            │
│  │ card_data   │                        │            │
│  │ /data (1GB) │                        │            │
│  └─────────────┘                        │            │
└──────────────────────────────────────────┼────────────┘
                                           │
                                           ▼
                                ┌─────────────────────┐
                                │  Cloudflare R2      │
                                │  card-tracker-backup│
                                │  (S3互換ストレージ)  │
                                │  無料枠: 10GB/月     │
                                └─────────────────────┘
```

#### Fly.io Volume セットアップ

```bash
# 1. ボリューム作成（東京リージョン）
fly volumes create card_data --region nrt --size 1

# 2. fly.tomlの[mounts]が自動的に /data にマウント
```

#### litestream.yml

```yaml
# litestream.yml — SQLite → Cloudflare R2 レプリケーション
dbs:
  - path: /data/card_transactions.db
    replicas:
      - type: s3
        endpoint: https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com
        bucket: card-tracker-backup
        path: replica
        access-key-id: ${LITESTREAM_ACCESS_KEY_ID}
        secret-access-key: ${LITESTREAM_SECRET_ACCESS_KEY}
        retention: 720h           # 30日保持
        retention-check-interval: 1h
```

#### 復旧手順

```bash
# 障害時のDB復旧
fly ssh console
litestream restore -o /data/card_transactions.db /data/card_transactions.db
```

### 4.4 シークレット管理

Fly.ioのシークレット管理は `fly secrets set` で行う。環境変数としてアプリに自動注入される。

```bash
# === 必須シークレット ===
fly secrets set APP_PIN=<4-8桁のPIN>
fly secrets set SESSION_SECRET=<64文字以上のランダム文字列>
fly secrets set TOKEN_ENCRYPTION_KEY=<Fernet.generate_key()で生成>

# === Gmail OAuth ===
fly secrets set GOOGLE_CLIENT_ID=<OAuth Client ID>
fly secrets set GOOGLE_CLIENT_SECRET=<OAuth Client Secret>

# === Litestream (Cloudflare R2) ===
fly secrets set LITESTREAM_ACCESS_KEY_ID=<R2 API Token>
fly secrets set LITESTREAM_SECRET_ACCESS_KEY=<R2 API Secret>
fly secrets set R2_ACCOUNT_ID=<Cloudflare Account ID>
```

**3層管理方式（開発〜本番）:**

| 環境 | 方式 | 詳細 |
|------|------|------|
| **ローカル開発** | `.env` ファイル | `.env.example` をコピーして使用。`.gitignore`済み |
| **CI/CD** | GitHub Secrets | テスト用の最小限シークレット |
| **本番（Fly.io）** | `fly secrets set` | Fly.ioが暗号化保存、環境変数として自動注入 |

**docker-compose.yml修正（ローカル開発用）:**

```yaml
# docker-compose.yml に追加が必要
environment:
  - TOKEN_ENCRYPTION_KEY=${TOKEN_ENCRYPTION_KEY}  # ★現状欠落（TD-11）
```

### 4.5 デプロイフロー

#### 初回デプロイ（手動）

```bash
# 1. Fly.io CLIインストール
curl -L https://fly.io/install.sh | sh

# 2. ログイン
fly auth login

# 3. アプリ作成
fly launch --name card-spending-tracker --region nrt --no-deploy

# 4. ボリューム作成
fly volumes create card_data --region nrt --size 1

# 5. シークレット設定（上記4.4参照）
fly secrets set APP_PIN=xxx SESSION_SECRET=xxx ...

# 6. 初回デプロイ
fly deploy

# 7. 動作確認
fly open
fly logs
```

#### 以降の自動デプロイ（GitHub Actions）

```
開発者PC                    GitHub                    Fly.io
    │                         │                         │
    ├── git push ────────────▶│                         │
    │                         ├── test.yml              │
    │                         │   ├── ruff lint          │
    │                         │   ├── ruff format        │
    │                         │   └── pytest             │
    │                         │   ✅ pass                │
    │                         ├── deploy.yml             │
    │                         │   └── flyctl deploy ───▶│
    │                         │                         ├── Docker build
    │                         │                         ├── alembic upgrade
    │                         │                         └── uvicorn start
    │                         │   ✅ deploy success      │
    │   ◀── ntfy通知 ─────────│                         │
```

#### ロールバック

```bash
# Fly.ioのロールバック（直前リリースに戻す）
fly releases
fly deploy --image registry.fly.io/card-spending-tracker:v<N>

# または特定のcommitに戻す
git checkout <previous-sha>
fly deploy
```

### 4.6 コスト試算

| 項目 | コスト | 備考 |
|------|--------|------|
| **Fly.io Machines** | **$0〜$5/月** | auto_stop=trueなら停止中は$0。常時起動でも~$5/月 |
| **Fly.io Volume (1GB)** | **$0.15/月** | 1GBで$0.15/GB/月 |
| **Cloudflare R2** | **$0** | 無料枠: 10GB/月 + 1M Class Aリクエスト |
| **GitHub Actions** | **$0** | パブリックリポ無料 / プライベートは2,000分/月無料 |
| **ドメイン** | **$0（当面）** | Fly.ioデフォルトドメイン使用。独自ドメインは後日 |
| **合計** | **ほぼ$0〜$5/月** | 個人利用（auto_stop利用）なら実質無料 |

**Fly.io無料枠の詳細:**
- 3つの shared-cpu-1x VMs（256MB RAM）
- 3GBの永続ボリューム
- 160GBのアウトバウンド転送
- 個人利用ダッシュボードには十分すぎる枠

### 4.7 ログ・監視

| レイヤー | ツール | 役割 | コスト |
|---------|--------|------|--------|
| **アプリログ** | structlog (JSON) | 構造化ログ出力 | 無料 |
| **ログ閲覧** | `fly logs` | Fly.ioビルトインログ | 無料 |
| **エラー通知** | ntfy.sh | エラー発生時のプッシュ通知 | 無料 |
| **ヘルスチェック** | Fly.io built-in + UptimeRobot | HTTP監視 + ダウン通知 | 無料 |
| **ログ永続化（オプション）** | Better Stack (旧Logtail) | SaaS型ログ検索 | 無料枠: 1GB/月 |

**Grafana/Loki/Prometheusは非推奨**: 個人利用アプリに対してインフラ負荷が過大。

**structlog + ntfy連携例:**

```python
# app/logging_config.py
import structlog
import httpx

class NtfyHandler:
    """ERRORレベル以上をntfyにプッシュ通知"""
    def __init__(self, topic: str):
        self.topic = topic

    def __call__(self, logger, method_name, event_dict):
        if event_dict.get("level", "").upper() in ("ERROR", "CRITICAL"):
            httpx.post(
                f"https://ntfy.sh/{self.topic}",
                data=f"⚠️ {event_dict.get('event', 'unknown error')}",
                headers={"Priority": "high"},
            )
        return event_dict
```

### 4.8 SQLiteバックアップ戦略

Litestream（4.3で設定済み）によるリアルタイムレプリケーションが主戦略。

| 方式 | A: Litestream（採用） | B: cron + .backup | C: Volume snapshot |
|------|---------------------|-------------------|-------------------|
| **RPO（目標復旧点）** | 秒単位 | cron間隔（1時間〜） | スナップ間隔 |
| **設定難度** | 低（YAML設定のみ） | 低 | 中（Fly.io依存） |
| **コスト** | 無料（R2無料枠内） | 無料 | Fly.ioスナップ: $0.15/GB |
| **自動復旧** | ◎ `litestream restore` | △ 手動コピー | △ 手動復元 |
| **WAL対応** | ◎ WALをストリーミング | △ .backup中ロック | × 不明 |

バックアップ先: **Cloudflare R2**（無料枠10GB/月、S3互換API、egress無料）

---

## 5. CI/CDパイプライン設計（新規）

### 5.1 GitHub Actionsワークフロー設計

#### ワークフロー全体図

```
PR作成/更新時:          mainマージ時:
┌──────────┐           ┌──────────┐
│ test.yml │           │deploy.yml│
├──────────┤           ├──────────┤
│ ruff lint│           │ test     │ ← 同じテスト
│ ruff fmt │           │ ↓        │
│ pytest   │           │ docker   │ ← Docker build + push
│ coverage │           │ build    │
└──────────┘           │ ↓        │
                       │ deploy   │ ← SSH or PaaS CLI
                       └──────────┘
```

#### test.yml（PR時: lint + test）

```yaml
# .github/workflows/test.yml
name: Test

on:
  pull_request:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-python@v5
        with:
          python-version: "3.12"

      - name: Install dependencies
        run: |
          pip install poetry
          poetry install

      - name: Lint (ruff)
        run: |
          poetry run ruff check .
          poetry run ruff format --check .

      - name: Test (pytest)
        env:
          DATABASE_PATH: ":memory:"
          TOKEN_ENCRYPTION_KEY: "test-key-for-ci-only"
          SESSION_SECRET: "test-secret"
        run: |
          poetry run pytest --cov=app --cov-report=term-missing --cov-report=xml

      - name: Upload coverage
        uses: codecov/codecov-action@v4
        with:
          file: coverage.xml
        if: always()
```

#### deploy.yml（main push時: テスト + Fly.ioデプロイ）

```yaml
# .github/workflows/deploy.yml
name: Deploy

on:
  push:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-python@v5
        with:
          python-version: "3.12"

      - name: Install dependencies
        run: |
          pip install poetry
          poetry install

      - name: Lint (ruff)
        run: |
          poetry run ruff check .
          poetry run ruff format --check .

      - name: Test (pytest)
        env:
          DATABASE_PATH: ":memory:"
          TOKEN_ENCRYPTION_KEY: "test-key-for-ci-only"
          SESSION_SECRET: "test-secret"
        run: |
          poetry run pytest --cov=app --cov-report=term-missing

  deploy:
    needs: test
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: superfly/flyctl-actions/setup-flyctl@master

      - name: Deploy to Fly.io
        run: flyctl deploy --remote-only
        env:
          FLY_API_TOKEN: ${{ secrets.FLY_API_TOKEN }}

      - name: Notify success
        if: success()
        run: |
          curl -d "✅ card-spending-tracker deployed (${{ github.sha }})" \
               -H "Priority: default" \
               https://ntfy.sh/${{ secrets.NTFY_TOPIC }}
        continue-on-error: true

      - name: Notify failure
        if: failure()
        run: |
          curl -d "❌ card-spending-tracker deploy FAILED (${{ github.sha }})" \
               -H "Priority: high" \
               -H "Tags: warning" \
               https://ntfy.sh/${{ secrets.NTFY_TOPIC }}
        continue-on-error: true
```

**GitHub Secretsに設定が必要な値:**

| Secret名 | 用途 |
|-----------|------|
| `FLY_API_TOKEN` | `fly tokens create deploy -x 999999h` で生成 |
| `NTFY_TOPIC` | ntfyの通知トピック名（任意文字列） |

### 5.2 デプロイフロー図

```
開発者PC                    GitHub                  Fly.io (nrt)
    │                         │                       │
    ├── git push ────────────▶│                       │
    │                         ├── test job             │
    │                         │   ├── ruff lint        │
    │                         │   ├── ruff format      │
    │                         │   └── pytest           │
    │                         │   ✅ pass              │
    │                         ├── deploy job           │
    │                         │   └── flyctl deploy ──▶│
    │                         │                       ├── Docker build (remote)
    │                         │                       ├── alembic upgrade head
    │                         │                       └── litestream replicate
    │                         │                       │   -exec "uvicorn ..."
    │   ◀── ntfy通知 ─────────│   ✅ success          │
```

### 5.3 テスト戦略

| テスト種別 | 実行場所 | テスト数 | 所要時間（目安） |
|-----------|---------|---------|----------------|
| **ruff lint** | CI | - | ~5秒 |
| **ruff format** | CI | - | ~5秒 |
| **pytest (unit + integration)** | CI | 250+ | ~30秒 |
| **カバレッジ計測** | CI | - | pytest同時 |

**CI実行保証:**
- 全テストがCI環境で実行可能なことを確認する（ファイルパス依存、環境変数依存を解消）
- Gmail API関連テストはモック使用（現状もモック化済み）
- SQLiteは`:memory:`モードでCI実行（ファイルI/O不要）

**今後の追加候補:**
- mypy（型チェック）: improvement_ideas A5-001
- Docker build テスト: イメージが正常にビルドできることを検証
- E2Eテスト: Playwright等によるブラウザテスト（将来課題）

---

## 6. 中期機能の実装計画

### 6.1 カテゴリ自動分類（G-002 / A7-001）

**推奨アプローチ: 2フェーズ段階実装**（前版と同一）

| 観点 | Phase 1: ルールベース（先行） | Phase 2: LLMハイブリッド |
|------|-------------------------------|--------------------------|
| **精度** | 70-80%（辞書マッチ） | 95%+（学習済み+LLM） |
| **コスト** | ¥0 | 月数十円（Haiku利用） |
| **実装時間** | 2-3時間 | 4-6時間（Phase 1前提） |
| **外部依存** | なし | Anthropic API |

**DBスキーマ変更案:**

```sql
ALTER TABLE card_transactions ADD COLUMN category VARCHAR(50);
ALTER TABLE card_transactions ADD COLUMN category_confidence REAL DEFAULT 1.0;
ALTER TABLE card_transactions ADD COLUMN category_source VARCHAR(20) DEFAULT 'rule';

CREATE TABLE merchant_categories (
    id INTEGER PRIMARY KEY,
    merchant_pattern VARCHAR(200) UNIQUE NOT NULL,
    category VARCHAR(50) NOT NULL,
    source VARCHAR(20) DEFAULT 'rule',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_merchant_pattern ON merchant_categories(merchant_pattern);
```

### 6.2 プラグイン型パーサー（G-004）

**推奨: Strategy Pattern + レジストリ**（前版と同一）

```python
# app/gmail/parsers/base.py
class CardParser(ABC):
    @property
    @abstractmethod
    def company_name(self) -> str: ...

    @property
    @abstractmethod
    def trusted_domains(self) -> list[str]: ...

    @abstractmethod
    def extract_amount(self, body: str) -> int | None: ...
    # ...

# app/gmail/parsers/__init__.py (レジストリ)
_PARSERS: dict[str, CardParser] = {}

def register(parser_class):
    instance = parser_class()
    _PARSERS[instance.company_name] = instance
    return parser_class
```

### 6.3 月次グラフ（A1-001 / A3-001）

**Chart.js + DaisyUIカード統合:**

```python
# app/web/routes/chart.py（新規）
@router.get("/web/chart/monthly")
def monthly_chart(request: Request, months: int = 12, session=Depends(get_db_session)):
    """Chart.js canvas + データを含むHTMLフラグメント"""
    data = aggregation_service.monthly_trend(session, months)
    return templates.TemplateResponse("partials/monthly_chart.html", {
        "request": request, "chart_data": json.dumps(data)
    })
```

```html
<!-- partials/monthly_chart.html -->
<canvas id="monthlyChart" class="w-full" height="300"></canvas>
<script>
  new Chart(document.getElementById('monthlyChart'), {
    type: 'bar',
    data: {{ chart_data|safe }},
    options: {
      responsive: true,
      plugins: { legend: { position: 'bottom' } }
    }
  });
</script>
```

---

## 7. 段階的移行計画（改訂）

前版の4フェーズに殿の新方針（本番運用・CI/CD・デザイン・モバイル）を統合し、5フェーズに再構成。

### Phase 1: CI/CD基盤構築（最優先）

> **目的**: 全ての変更に安全網を張る。これ以降のPhaseは全てCIの恩恵を受ける

| # | タスク | 推定コスト | 効果 |
|---|--------|-----------|------|
| P1-1 | GitHub Actions: test.yml（lint + pytest） | 低（1-2h） | 全PRに自動テスト |
| P1-2 | docker-compose.yml修正（TOKEN_ENCRYPTION_KEY追加） | 低（30min） | TD-11解消 |
| P1-3 | Dockerfile マルチステージビルド化 | 低（1h） | イメージサイズ最適化 |
| P1-4 | config.py に DATABASE_PATH 追加 + 環境変数整理 | 低（1h） | 設定一元化 |

### Phase 2: バックエンドリファクタリング

> **目的**: フロントエンド改修の前に、バックエンド基盤を安定させる

| # | タスク | 推定コスト | 効果 | 依存 |
|---|--------|-----------|------|------|
| P2-1 | sync_service.py 作成（TD-1解消） | 中（3-4h） | DRY違反解消 | P1-1 |
| P2-2 | DBアクセスDI化（TD-3解消） | 低（2h） | テスタビリティ向上 | P1-4 |
| P2-3 | routes.py分割（TD-2解消） | 中（2-3h） | 保守性向上 | P2-1 |
| P2-4 | DBインデックス追加（TD-7解消） | 低（30min） | クエリ性能向上 | なし |
| P2-5 | structlog導入 | 低（1-2h） | 構造化ログ | P1-4 |

### Phase 3: フロントエンドモダナイゼーション

> **目的**: デザイン重視 + モバイルファーストの実現。最も工数が大きいPhase

| # | タスク | 推定コスト | 効果 | 依存 |
|---|--------|-----------|------|------|
| P3-1 | base.html: DaisyUI + Tailwind CDN追加 + drawerレイアウト | 中（2-3h） | モバイルナビ基盤 | なし |
| P3-2 | _macros.html: 共通Jinja2マクロ作成 | 低（1-2h） | コンポーネント共通化 | P3-1 |
| P3-3 | dashboard.html: DaisyUI stat + card | 中（2-3h） | デザイン改善 | P3-1 |
| P3-4 | transactions.html: モバイルカード + PCテーブル | 中（2-3h） | モバイル対応 | P3-2 |
| P3-5 | summary.html: DaisyUI + Chart.js | 中（3-4h） | グラフ + デザイン | P3-2, P2-2 |
| P3-6 | settings.html: DaisyUI form | 低（1h） | デザイン統一 | P3-1 |
| P3-7 | ダークモード対応（DaisyUIテーマ切替） | 低（1h） | テーマ機能 | P3-1 |
| P3-8 | PWA manifest + アイコン | 低（1h） | ホーム画面追加 | P3-1 |

**Phase 3 合計推定: 13-18時間**（足軽4名で分担すれば1セッションで完了可能）

### Phase 4: 本番デプロイ（Fly.io）

> **目的**: Fly.ioに本番デプロイし、HTTPS（自動）+ 監視 + バックアップを整備

| # | タスク | 推定コスト | 効果 | 依存 |
|---|--------|-----------|------|------|
| P4-1 | Fly.ioアプリ作成 + fly.toml + Volume作成 | 低（1h） | 本番環境構築 | なし |
| P4-2 | fly secrets set（シークレット設定） | 低（30min） | セキュリティ | P4-1 |
| P4-3 | deploy.yml（GitHub Actions → flyctl deploy） | 中（2h） | CD完成 | P1-1, P4-1 |
| P4-4 | Litestream + Cloudflare R2設定 | 低（1-2h） | データ保護 | P4-1 |
| P4-5 | UptimeRobot設定 | 低（30min） | 死活監視 | P4-1 |
| P4-6 | ntfyデプロイ通知 + エラー通知連携 | 低（1h） | 通知 | P2-5 |

### Phase 5: 機能拡張

> **目的**: 本番安定後に機能を追加

| # | タスク | 推定コスト | 効果 | 依存 |
|---|--------|-----------|------|------|
| P5-1 | カテゴリ分類（ルールベース） | 中（3-4h） | 支出構造可視化 | P2-4 |
| P5-2 | カテゴリ別円グラフ | 低（2h） | カテゴリ可視化 | P5-1, P3-5 |
| P5-3 | プラグイン型パーサー移行 | 中（3-4h） | 拡張性向上 | P2-1 |
| P5-4 | カテゴリ分類（LLMハイブリッド） | 中（4-6h） | 精度向上 | P5-1 |
| P5-5 | フリーワード検索 | 低（2h） | 取引検索改善 | P2-4 |
| P5-6 | セキュリティモジュール統合（TD-4解消） | 低（2h） | 防御力向上 | なし |

### 実行順序図

```
Phase 1（CI/CD基盤）   Phase 2（Backend）   Phase 3（Frontend）    Phase 4（Deploy）   Phase 5（機能）
───────────────────────────────────────────────────────────────────────────────────────────────────
P1-1 GH Actions ───── P2-1 sync統合 ───── P3-1 base.html ─────── P4-1 Fly.io構築
P1-2 compose修正       P2-2 DI化            P3-2 macros            P4-2 secrets設定
P1-3 Dockerfile        P2-3 routes分割      P3-3 dashboard         P4-3 deploy.yml ── P5-1 カテゴリ
P1-4 config整理 ────── P2-4 INDEX           P3-4 transactions      P4-4 Litestream+R2  P5-2 円グラフ
                       P2-5 structlog ────── P3-5 summary+chart     P4-5 UptimeRobot   P5-3 パーサー
                                            P3-6 settings          P4-6 ntfy通知       P5-4 LLM
                                            P3-7 ダークモード                           P5-5 検索
                                            P3-8 PWA                                   P5-6 セキュリティ
```

### 重要な制約事項

1. **個人利用ダッシュボード**: マイクロサービス化、GraphQL、WebSocket等は不要。ただし本番品質は確保する
2. **現スタック維持**: FastAPI + htmx + Jinja2 + SQLite を維持。SPA移行は行わない。CSS層のみDaisyUI化
3. **段階的移行**: 各Phaseの完了後に動作確認。一度に全てを変えない
4. **テスト維持**: リファクタリング時は既存テスト全PASSを必ず確認（CIが保証）
5. **Phase 1最優先**: CI/CDが全ての安全網。他のPhaseより先に完成させること

---

## 付録A: 技術選定根拠まとめ

| 選定項目 | 推奨 | 次善 | 非推奨 | 根拠 |
|----------|------|------|--------|------|
| **CSS** | **Tailwind+DaisyUI** ★確定 | Tailwind単体 | Pure CSS維持 | デザイン重視+モバイルファースト。殿承認済 |
| **JS** | htmx + Chart.js | htmx + Alpine.js | React SPA | デザインはCSS層の問題。SPA化は投資対効果なし |
| **デプロイ** | **Fly.io** ★確定 | — | — | SQLite永続ディスク対応。殿がVPS却下、Fly.io決定 |
| **CI/CD** | **GitHub Actions** ★確定 | — | — | エコシステム統合、無料枠十分 |
| **ログ** | **structlog + ntfy** | Loguru | print() | 構造化JSON + エラー即時通知 |
| **バックアップ** | **Litestream → R2** | cron + .backup | なし | リアルタイムレプリケーション、無料 |
| **監視** | **UptimeRobot** | Uptime Kuma | Grafana | SaaS型で管理不要。個人利用に最適 |
| **グラフ** | Chart.js (CDN) | CSS-only bar | D3.js | CDN 1行で導入。D3.jsは過剰 |
| **カテゴリ** | ルール→LLM段階 | LLMのみ | ルールのみ | ルール先行で即効果、LLM追加で精度向上 |
| **パーサー** | Strategy Pattern | Factory | if/elif維持 | 拡張性、テスト独立化 |
| **DB** | SQLite維持 | — | PostgreSQL | 個人利用に十分。Litestreamで信頼性も確保 |

---

## 付録B: 殿の決定履歴と残存判断事項

### 決定済み事項

| # | 事項 | 決定 | 決定日 |
|---|------|------|--------|
| 1 | デプロイ先 | **Fly.io**（VPS却下） | 2026-02-20 |
| 2 | CSS戦略 | **Tailwind + DaisyUI**（軍師推奨案承認） | 2026-02-20 |
| 3 | ドメイン | **後日検討**（Fly.ioデフォルトドメインで運用開始） | 2026-02-20 |

### 中期的な判断事項（未決定）

4. **Chart.js導入可否**: 月次推移グラフが必要か
5. **カテゴリ分類の優先度**: Phase 5で実装するか、前倒しするか
6. **LLM（Claude API）利用の可否**: カテゴリ分類Phase 2で使用。月額数十円
7. **ダークモード**: DaisyUIなら低コスト実装可能だが、優先度の確認

---

*作成: 軍師（Gunshi）| subtask_028_gunshi3 | cmd_028 | 2026-02-20*
*前版: subtask_028_gunshi2（2026-02-20）からの改訂。殿の最終決定（Fly.io確定、Tailwind+DaisyUI確定）を反映*
