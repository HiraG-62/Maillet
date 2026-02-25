# card-spending-tracker Web UI アーキテクチャ設計書

**作成日**: 2026-02-19
**作成者**: 軍師（Gunshi）
**タスクID**: subtask_017b
**親コマンド**: cmd_017

---

## 1. フロントエンド技術選定

### 比較表

| 基準 | Jinja2 (SSR) | Jinja2 + htmx | Jinja2 + Alpine.js |
|------|-------------|---------------|-------------------|
| **実装速度** | ★★★ 最速 | ★★★ 最速 | ★★ やや遅い |
| **JS記述量** | ゼロ | ゼロ（HTML属性のみ） | 中（Alpine構文） |
| **同期ボタンUX** | ✗ ページ全体リロード | ✓ 部分更新+ローディング表示 | ✓ 部分更新 |
| **フィルタ操作** | ✗ ページ遷移必須 | ✓ 部分更新可能 | ✓ 部分更新可能 |
| **追加依存** | なし | htmx (14KB, CDN可) | Alpine.js (15KB, CDN可) |
| **学習コスト** | 低 | 低（HTML属性を覚えるだけ） | 中（独自ディレクティブ構文） |
| **プロトタイプ適性** | 〇 十分 | ◎ 最適 | 〇 十分 |
| **拡張性** | △ SPA化時に全書き直し | 〇 段階的に強化可能 | 〇 段階的に強化可能 |

### 最終判断: Jinja2 + htmx

**根拠**:

1. **殿の最優先要望=同期ボタン**: `POST /sync` は数秒〜数十秒かかる処理。Pure SSRだとページ全体が白くなり、二重クリックリスクもある。htmxなら `hx-post="/sync"` と `hx-indicator` 属性を付けるだけでローディング表示+部分更新が実現する。JSを1行も書かずに済む。

2. **実装速度=Pure SSRとほぼ同等**: htmxは「HTML属性を追加するだけ」で動く。テンプレートの書き方はJinja2そのもの。追加学習コストはほぼゼロ。

3. **プロトタイプ品質で十分**: htmxはサーバーからHTMLフラグメントを返すだけ。React/Vue等のSPA的な複雑さは皆無。「動くプロトタイプ」としては最適解。

4. **Alpine.jsを選ばない理由**: 本アプリは表示系が中心で、クライアント側のリッチなインタラクション（ドラッグ&ドロップ、リアルタイムバリデーション等）は不要。htmxで十分すぎるユースケース。

---

## 2. ディレクトリ構造設計

### 設計方針

- 既存 `app/api/` は一切変更しない（APIは引き続き `/api/*` で動作）
- Web UI用ルーティングを `app/web/` に新設
- テンプレートは `app/templates/`、静的ファイルは `app/static/` に配置（FastAPIの慣習に従う）
- `app/api/main.py` にテンプレート・静的ファイル・Webルーターのマウントを追加

### 完成後のディレクトリ構造

```
card-spending-tracker/
├── app/
│   ├── api/
│   │   ├── main.py               # FastAPIアプリ本体 ← 【変更】Web UI統合
│   │   ├── routes/
│   │   │   ├── health.py         # 既存（変更なし）
│   │   │   ├── sync.py           # 既存（変更なし）
│   │   │   └── transactions.py   # 既存（変更なし）
│   │   └── schemas/              # 既存（変更なし）
│   │
│   ├── web/                      # 【新規】Web UI ルーティング
│   │   ├── __init__.py
│   │   └── routes.py             # HTML返却ルート（GET /, /transactions, /summary, /settings）
│   │
│   ├── templates/                # 【新規】Jinja2テンプレート
│   │   ├── base.html             # 共通レイアウト（ナビ、ヘッダー、フッター）
│   │   ├── dashboard.html        # ダッシュボード（トップページ）
│   │   ├── transactions.html     # 取引一覧
│   │   ├── summary.html          # 月次集計
│   │   ├── settings.html         # 設定画面
│   │   └── partials/             # htmx部分更新用フラグメント
│   │       ├── sync_status.html  # 同期結果表示フラグメント
│   │       ├── transaction_table.html  # 取引テーブル（フィルタ結果）
│   │       └── alert_form.html   # アラート設定フォーム
│   │
│   ├── static/                   # 【新規】静的ファイル
│   │   ├── css/
│   │   │   └── style.css         # アプリケーションCSS
│   │   └── js/
│   │       └── htmx.min.js       # htmx 2.0（CDNフォールバック付き）
│   │
│   ├── cli/                      # 既存（変更なし）
│   ├── database/                 # 既存（変更なし）
│   ├── gmail/                    # 既存（変更なし）
│   ├── models/                   # 既存（変更なし）
│   ├── security/                 # 既存（変更なし）
│   └── services/                 # 既存（変更なし）
│
├── data/                         # 既存（変更なし）
├── settings.json                 # 【新規】ユーザー設定ファイル（アラートしきい値等）
└── ...
```

### main.py 変更箇所（最小限）

```python
# app/api/main.py への追加（既存コードは変更しない）

from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from app.web.routes import web_router

# Static files & templates
app.mount("/static", StaticFiles(directory="app/static"), name="static")

# Web UI routes (HTML pages)
app.include_router(web_router)
```

既存APIルーターとの共存:
- `/api/*` → 既存JSON APIルーター（変更なし）
- `/` `/transactions` `/summary` `/settings` → 新規Web UIルーター（HTML返却）
- `/static/*` → 静的ファイル配信

---

## 3. 画面・ルーティング設計

### URL設計

| URL | Method | 返却形式 | 画面名 | 概要 |
|-----|--------|---------|--------|------|
| `GET /` | GET | HTML | ダッシュボード | 今月集計 + 直近取引5件 + 同期ボタン + アラート状態 |
| `GET /transactions` | GET | HTML | 取引一覧 | 全取引のテーブル表示（月・カード会社フィルタ付き） |
| `GET /summary` | GET | HTML | 月次集計 | カード会社別の月次サマリー |
| `GET /settings` | GET | HTML | 設定 | アラートしきい値、表示設定 |
| `POST /web/sync` | POST | HTML fragment | 同期実行 | htmxから呼ばれ、結果フラグメントを返す |
| `GET /web/transactions/filter` | GET | HTML fragment | フィルタ結果 | htmxから呼ばれ、テーブルフラグメントを返す |
| `POST /web/settings/alert` | POST | HTML fragment | 設定保存 | htmxから呼ばれ、保存結果フラグメントを返す |

### 画面詳細設計

#### 画面1: ダッシュボード（GET /）

殿が最初に見る画面。**一目で今月の状況がわかる**ことが最重要。

```
┌──────────────────────────────────────────────────┐
│ 💳 Card Spending Tracker            [Nav Links]  │
├──────────────────────────────────────────────────┤
│                                                  │
│  今月の利用額       ¥ 123,456                    │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │
│  しきい値: ¥100,000  ⚠ 超過中                    │
│                                                  │
│  ┌────────────────────────────────────────────┐  │
│  │ カード別内訳                                │  │
│  │  三井住友   ¥ 78,000  (12件)   ████████▌   │  │
│  │  JCB       ¥ 35,456  ( 5件)   ████▌       │  │
│  │  楽天      ¥ 10,000  ( 2件)   █▌          │  │
│  └────────────────────────────────────────────┘  │
│                                                  │
│  [🔄 Gmail同期]  最終同期: 2026-02-19 09:00      │
│  ← htmx: hx-post="/web/sync"                    │
│     クリック→ローディング表示→結果フラグメント    │
│                                                  │
│  直近の取引                                      │
│  ┌────────────────────────────────────────────┐  │
│  │ 日付       │ カード   │ 店舗     │ 金額   │  │
│  │ 02/19 10:30│ 三井住友 │ Amazon   │ ¥3,500 │  │
│  │ 02/18 15:20│ JCB     │ コンビニ │ ¥1,200 │  │
│  │ 02/18 12:00│ 三井住友 │ ランチ   │ ¥1,000 │  │
│  │ 02/17 20:15│ 楽天    │ 楽天市場 │ ¥5,000 │  │
│  │ 02/16 09:00│ 三井住友 │ 交通費   │ ¥2,000 │  │
│  └────────────────────────────────────────────┘  │
│  [すべての取引を見る →]                           │
│                                                  │
└──────────────────────────────────────────────────┘
```

**バックエンドデータ取得**:
- `get_total_by_month(session, year, month)` → 今月合計
- `get_monthly_by_card(session, year, month)` → カード別内訳
- `session.query(CardTransaction).order_by(...desc()).limit(5)` → 直近5件
- `settings.json` → アラートしきい値

#### 画面2: 取引一覧（GET /transactions）

```
┌──────────────────────────────────────────────────┐
│ 取引一覧                                         │
├──────────────────────────────────────────────────┤
│                                                  │
│  フィルタ:                                       │
│  月: [2026-02 ▼]  カード: [全て ▼]               │
│  ← htmx: hx-get="/web/transactions/filter"       │
│     hx-trigger="change" hx-target="#tx-table"    │
│                                                  │
│  <div id="tx-table">                             │
│  ┌──────────────────────────────────────────┐    │
│  │ # │ 日付       │ カード   │ 店舗   │ 金額│    │
│  │ 1 │ 02/19 10:30│ 三井住友 │ Amazon │¥3500│    │
│  │ 2 │ 02/18 15:20│ JCB     │ コンビニ│¥1200│    │
│  │...│            │         │        │     │    │
│  └──────────────────────────────────────────┘    │
│  </div>                                          │
│                                                  │
│  合計: ¥123,456 (19件)                           │
│                                                  │
└──────────────────────────────────────────────────┘
```

**バックエンドデータ取得**:
- `session.query(CardTransaction).filter(...)` → フィルタ付き取引一覧
- フィルタはサービス層を直接呼ぶ（API経由ではない）

#### 画面3: 月次集計（GET /summary）

```
┌──────────────────────────────────────────────────┐
│ 月次集計                                         │
├──────────────────────────────────────────────────┤
│                                                  │
│  月: [2026-02 ▼]                                 │
│  ← htmx: hx-get="/summary?month=YYYY-MM"        │
│                                                  │
│  ┌────────────────────────────────────────────┐  │
│  │ カード会社  │ 利用額     │ 件数 │ 平均    │  │
│  │ 三井住友    │ ¥ 78,000  │  12  │ ¥6,500 │  │
│  │ JCB        │ ¥ 35,456  │   5  │ ¥7,091 │  │
│  │ 楽天       │ ¥ 10,000  │   2  │ ¥5,000 │  │
│  ├────────────────────────────────────────────┤  │
│  │ 合計       │ ¥123,456  │  19  │ ¥6,498 │  │
│  └────────────────────────────────────────────┘  │
│                                                  │
│  前月比: +¥12,345 (+11.1%)                       │
│                                                  │
└──────────────────────────────────────────────────┘
```

**バックエンドデータ取得**:
- `get_monthly_by_card(session, year, month)` → カード別サマリー
- `get_total_by_month(session, year, month)` → 合計
- `get_total_by_month(session, prev_year, prev_month)` → 前月比較

#### 画面4: 設定（GET /settings）

```
┌──────────────────────────────────────────────────┐
│ 設定                                             │
├──────────────────────────────────────────────────┤
│                                                  │
│  アラート設定                                    │
│  ┌────────────────────────────────────────────┐  │
│  │ 月間アラートしきい値: [100000] 円           │  │
│  │ [保存]                                      │  │
│  │ ← hx-post="/web/settings/alert"             │  │
│  └────────────────────────────────────────────┘  │
│                                                  │
│  システム情報                                    │
│  ┌────────────────────────────────────────────┐  │
│  │ バージョン: 0.1.0                           │  │
│  │ DB状態: 接続済                               │  │
│  │ 取引件数: 156件                              │  │
│  │ 最終同期: 2026-02-19 09:00                  │  │
│  └────────────────────────────────────────────┘  │
│                                                  │
└──────────────────────────────────────────────────┘
```

**バックエンドデータ取得**:
- `settings.json` → しきい値読み込み/保存
- `GET /api/health` の内部ロジック流用 → DB状態
- `session.query(func.count(CardTransaction.id))` → 総件数

---

## 4. 既存エンドポイントとの統合方針

### 方針: サービス層直接呼び出し（API経由にしない）

| 既存エンドポイント | Web UIでの使い方 | 理由 |
|------------------|-----------------|------|
| `GET /api/transactions` | **使わない** — `aggregation_service` / SQLAlchemy直接 | Web UIはSSR。HTMLテンプレートにデータを渡すだけ。HTTP往復は無駄 |
| `GET /api/transactions/summary` | **使わない** — `get_monthly_by_card()` 直接呼び出し | 同上 |
| `POST /api/sync` | **使わない** — sync処理ロジックを共通化して呼ぶ | 同一プロセス内でHTTP呼び出しは非効率 |
| `GET /api/health` | **使わない** — `get_engine()` で直接接続確認 | 同上 |

### アーキテクチャ図

```
                    ┌──────────────────────┐
                    │   Browser (User)     │
                    └─────┬────────────────┘
                          │
              ┌───────────┴───────────┐
              │                       │
        HTML Request            JSON Request
              │                       │
    ┌─────────▼────────┐    ┌────────▼────────┐
    │  app/web/routes   │    │ app/api/routes   │
    │  (returns HTML)   │    │ (returns JSON)   │
    └─────────┬────────┘    └────────┬────────┘
              │                       │
              └───────────┬───────────┘
                          │
                ┌─────────▼─────────┐
                │  app/services/     │  ← 共通サービス層
                │  - aggregation     │
                │  - transaction     │
                │  - (sync_service)  │
                └─────────┬─────────┘
                          │
                ┌─────────▼─────────┐
                │  app/database/     │
                │  SQLite            │
                └───────────────────┘
```

**利点**: Web UIとJSON APIが同じサービス層を共有。ロジック重複なし。

### sync処理の共通化

現在 `app/api/routes/sync.py` の `sync_gmail()` 関数にすべてのロジックが直書きされている。これをサービス層に分離すれば、Web UIルートからもAPI ルートからも呼べる。

**ただし**: sync_service.py の分離はロードマップ A-5 タスクであり、今回のプロトタイプでは **Web UI用のsync処理を `app/web/routes.py` に直接書く**（既存sync.pyのロジックを参考にコピー）。サービス分離はPhase A-5で実施。

→ プロトタイプ品質を優先し、DRY違反は許容する。

---

## 5. プロトタイプ実装範囲

### 今回実装するもの（cmd_017スコープ）

| 項目 | 実装内容 | 備考 |
|------|---------|------|
| ダッシュボード画面 | 今月集計、カード別内訳、直近5件、同期ボタン | SMBCを最上位表示 |
| 取引一覧画面 | テーブル表示、月フィルタ | htmxでフィルタ時の部分更新 |
| 月次集計画面 | カード別テーブル、合計行 | 前月比は後回し可 |
| 設定画面 | アラートしきい値の読み書き | settings.json ベース |
| Gmail同期ボタン | POST /web/sync → htmx部分更新 | ローディング表示あり |
| しきい値アラート表示 | ダッシュボードに超過警告 | 10万円デフォルト |
| レスポンシブCSS | スマホでも最低限閲覧可能 | 完璧なレスポンシブは後回し |
| htmx統合 | CDN読み込み + 同期・フィルタ連携 | htmx 2.0 |

### 後回しにするもの

| 項目 | 理由 | 実装時期 |
|------|------|---------|
| グラフ・チャート表示 | Chart.js追加が必要、プロトタイプでは表で十分 | Phase B以降 |
| 前月比較 | 計算は簡単だがUI設計に時間がかかる | Phase B |
| ページネーション | 初期段階では取引数が少ない（全件表示で問題なし） | 取引数増加後 |
| 認証・ログイン | ローカル利用前提。localhost:8000に外部からアクセスされない | 公開時 |
| ダークモード | UX改善だが必須ではない | 将来 |
| PWA対応 | スマホ利用を強化するが、まずブラウザで使えること | 将来 |
| sync_service.py分離 | ロードマップA-5で対応。今回はコピーで対処 | Phase A-5 |
| テスト | Web UIのテスト（Playwright等）は後回し | Phase B |

---

## 6. 足軽への実装タスク分割案

### subtask_017c: 足軽7号（Opus）— 基盤構築 + ダッシュボード

**担当理由**: アーキテクチャの骨格を作る最重要タスク。htmx統合と同期ボタンの実装にはSSR+部分更新の理解が必要。Opusモデルが適任。

**実装内容**:

1. `app/api/main.py` の変更（StaticFiles, Jinja2Templates, web_routerマウント）
2. `app/web/__init__.py` + `app/web/routes.py` の新規作成
3. `app/templates/base.html` — 共通レイアウト（ナビゲーション、htmx読み込み、共通CSS）
4. `app/templates/dashboard.html` — ダッシュボード画面
5. `app/templates/partials/sync_status.html` — 同期結果フラグメント
6. `app/static/js/htmx.min.js` — htmxライブラリ配置（またはCDN設定）
7. `app/static/css/style.css` — 基本スタイル（変数定義、レイアウト基盤）
8. Web UIルーティング: `GET /`, `POST /web/sync`
9. 同期ボタンのhtmx統合（ローディング表示、結果表示）
10. `settings.json` の読み書きユーティリティ（アラートしきい値）
11. ダッシュボードのアラート超過表示

**成果物**: ブラウザで `http://localhost:8000/` にアクセスして、ダッシュボードが表示され、同期ボタンが動作する状態。

**注意事項**:
- htmxはCDN (`https://unpkg.com/htmx.org@2.0.4`) を `base.html` のscriptタグで読み込み。ローカルファイルは不要。
- CSSフレームワークは使わない（Pure CSS）。シンプルで軽量に。
- SMBCがカード別内訳の最上位に来るようソート（殿の要望）

### subtask_017d: 足軽1号（Sonnet）— 取引一覧 + 月次集計

**担当理由**: データ表示系のCRUD画面。明確な仕様に基づく実装で、Sonnetモデルで十分対応可能。

**実装内容**:

1. `app/templates/transactions.html` — 取引一覧画面
2. `app/templates/partials/transaction_table.html` — 取引テーブルフラグメント（htmx部分更新用）
3. `app/templates/summary.html` — 月次集計画面
4. Web UIルーティング追加: `GET /transactions`, `GET /web/transactions/filter`, `GET /summary`
5. 月フィルタ（select要素、htmx連携）
6. カード会社フィルタ（select要素、htmx連携）
7. 金額の通貨フォーマット表示（¥記号、カンマ区切り）
8. 日時の日本語フォーマット表示

**成果物**: `/transactions` と `/summary` がブラウザで表示され、フィルタが動作する状態。

**依存関係**: subtask_017c の完了が必須（base.html、ルーティング基盤、CSS基盤に依存）

**注意事項**:
- `app/web/routes.py` は017cが作成済み。そこにルート関数を追記する形。
- aggregation_service.py を直接importして使う（API経由にしない）
- 取引テーブルは `transaction_date DESC` でソート

### subtask_017e: 足軽2号（Sonnet）— 設定画面 + CSS仕上げ

**担当理由**: 設定画面の実装とCSS全体の仕上げ。他の画面完成後に整えるフェーズ。

**実装内容**:

1. `app/templates/settings.html` — 設定画面
2. `app/templates/partials/alert_form.html` — 設定保存結果フラグメント
3. Web UIルーティング追加: `GET /settings`, `POST /web/settings/alert`
4. `settings.json` の読み書き（アラートしきい値の永続化）
5. CSS仕上げ:
   - テーブルスタイリング（zebra stripe、hover効果）
   - ナビゲーションバーのアクティブ表示
   - フォーム要素のスタイリング
   - アラート超過時の視覚的強調（赤背景等）
   - レスポンシブ基本対応（`max-width`, `@media` クエリ）
6. システム情報表示（バージョン、DB接続状態、取引総数）

**成果物**: `/settings` がブラウザで表示され、しきい値の保存と読み込みが動作する。全画面のCSSが整った状態。

**依存関係**: subtask_017c + subtask_017d の完了が必須（全テンプレートとルーティングに依存）

---

## 付録A: 技術仕様メモ

### htmx使用パターン

```html
<!-- 同期ボタン（ダッシュボード） -->
<button hx-post="/web/sync"
        hx-target="#sync-result"
        hx-indicator="#sync-spinner"
        hx-swap="innerHTML">
    🔄 Gmail同期
</button>
<span id="sync-spinner" class="htmx-indicator">同期中...</span>
<div id="sync-result"></div>

<!-- フィルタ（取引一覧） -->
<select name="month"
        hx-get="/web/transactions/filter"
        hx-target="#tx-table"
        hx-include="[name='card_company']">
    <option value="2026-02">2026年2月</option>
    ...
</select>
```

### settings.json フォーマット

```json
{
    "alert_threshold": 100000,
    "display": {
        "transactions_per_page": 50,
        "default_card_order": ["三井住友", "JCB", "楽天", "AMEX", "dカード"]
    }
}
```

### CSS設計方針

- CSSフレームワーク不使用（Pure CSS）
- CSS変数で色・サイズを管理
- レスポンシブ: モバイルファースト（`min-width` メディアクエリ）
- 基本配色: 白背景 + ダークグレーテキスト + ブルーアクセント
- アラート超過: 赤系（`#dc3545`）で視覚的に強調

```css
:root {
    --primary: #2563eb;
    --danger: #dc3545;
    --success: #198754;
    --text: #1f2937;
    --bg: #f8f9fa;
    --card-bg: #ffffff;
    --border: #dee2e6;
}
```

---

## 付録B: 実装順序（推奨）

```
subtask_017c (足軽7号/Opus)     ← 最初に着手
    ├── main.py変更
    ├── base.html
    ├── dashboard.html + sync
    ├── CSS基盤
    └── settings.jsonユーティリティ
         │
         ├── subtask_017d (足軽1号/Sonnet)     ← 017c完了後
         │   ├── transactions.html
         │   ├── transaction_table.html (partial)
         │   └── summary.html
         │
         └── subtask_017e (足軽2号/Sonnet)     ← 017c+017d完了後
             ├── settings.html
             ├── alert_form.html (partial)
             └── CSS仕上げ
```

**推定合計実装時間**: 017c(3-4h) + 017d(2-3h) + 017e(2-3h) = 7-10h

ただし017d は 017c完了後に着手可能、017eは017c+017d完了後のため、**クリティカルパスは017c→017d→017eの直列**。017cの品質が全体を左右する。
