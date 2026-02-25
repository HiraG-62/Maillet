# card-spending-tracker SPA移行設計書

**作成日**: 2026-02-22
**作成者**: 軍師（Gunshi）— subtask_052_gunshi
**親コマンド**: cmd_052
**ステータス**: 設計文書（実装待ち）

---

## 変更の背景

殿の確定方針により、card-spending-trackerを以下の形態に全面移行する:

| 項目 | 現行（FastAPI+Jinja2） | 移行先（React SPA+PWA） |
|------|----------------------|----------------------|
| フロントエンド | Jinja2テンプレート + htmx | React + Vite |
| UI | DaisyUI + Tailwind CSS (CDN) | Radix UI + Tailwind CSS + shadcn/ui方式 |
| ビルド | なし（CDN） | Vite |
| サーバー | FastAPI（Python） | **なし**（静的PWA） |
| ホスティング | Fly.io | GitHub Pages等（無料） |
| データ | サーバーSQLite + クライアントwa-sqlite | クライアントwa-sqlite/OPFSのみ |
| メールパース | サーバー（Python `parse_email`） | クライアント（JS/TS移植） |
| Gmail認証 | サーバーOAuth + クライアントPKCE並存 | PKCE（ブラウザ完結）のみ |
| LLM | サーバー経由 or BYOK | BYOK（ブラウザ直接）のみ |

**核心的変化**: サーバーが完全に消える。全ロジックをブラウザ側JS/TSに移植する。

---

## 1. 技術スタック定義

### 1.1 確定技術スタック

| カテゴリ | 技術 | バージョン方針 | 選定理由 |
|---------|------|-------------|---------|
| **言語** | TypeScript | ^5.x (latest stable) | 型安全性。大規模JS移植で型がないとバグの温床になる |
| **フレームワーク** | React | ^19.x | 殿の指定。コンポーネントベースUIで再利用性が高い |
| **ビルドツール** | Vite | ^6.x | React公式推奨。HMR高速、ESM native、設定が最小限 |
| **UIプリミティブ** | Radix UI | latest | ヘッドレスUI。アクセシビリティ標準搭載、デザイン自由度最大 |
| **CSS** | Tailwind CSS | ^4.x | ユーティリティファースト。Radix UIとの親和性が高い |
| **コンポーネント方式** | shadcn/ui方式 | — | コピー＆カスタマイズ。npmの依存ではなく自プロジェクト内に配置 |
| **クライアントDB** | wa-sqlite + OPFS | ^0.9.x | 既存Phase C実装を継承。SQLクエリがそのまま使える |
| **ルーティング** | React Router | ^7.x | SPA内ページ遷移。GitHub Pagesのfallbackと相性良い |
| **状態管理** | Zustand | ^5.x | 軽量。Context APIより簡潔、Reduxより低コスト |
| **テスト** | Vitest + Testing Library | latest | Viteネイティブ。Jest互換APIでゼロ設定 |
| **リンター** | ESLint + Prettier | latest | TypeScript向けlint + フォーマット統一 |
| **PWA** | vite-plugin-pwa | latest | Service Worker自動生成。Workbox内蔵 |

### 1.2 TypeScript選択の根拠

| 比較項目 | JavaScript | TypeScript（採用） |
|---------|-----------|-------------------|
| パーサー移植の安全性 | △ 型なしで金額パースミスが実行時まで分からない | ◎ 型定義でコンパイル時に型不整合を検出 |
| DB操作の信頼性 | △ SQLクエリ結果の型が不明 | ◎ レコード型を定義して安全にマッピング |
| リファクタリング | △ 変数名変更でサイレント破壊 | ◎ 型チェックで安全に変更可能 |
| 開発体験 | ○ 補完弱い | ◎ IntelliSense完全動作 |
| ビルド時間 | ◎ 変換不要 | ○ Viteのesbuild変換で高速（体感差なし） |

殿の「テストを厳重に」という厳命に応えるため、型安全性が最も重要。パーサー（金額抽出）や集計ロジック（SUM/COUNT）は数値型ミスが致命的であり、TypeScriptの型チェックが事前防御として機能する。

### 1.3 Vite設定方針

```typescript
// vite.config.ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import tailwindcss from '@tailwindcss/vite';
import path from 'path';

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'Card Spending Tracker',
        short_name: '支出管理',
        theme_color: '#0f172a',
        background_color: '#0f172a',
        display: 'standalone',
        start_url: '/',
        icons: [
          { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,wasm}'],
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024, // wa-sqlite WASM用
      },
    }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  base: '/', // GitHub Pages用。サブディレクトリ運用時は変更
  build: {
    target: 'es2022', // OPFS + Top-level await対応ブラウザ
    outDir: 'dist',
  },
  worker: {
    format: 'es', // wa-sqlite Worker用
  },
});
```

### 1.4 依存関係一覧

```json
{
  "dependencies": {
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "react-router": "^7.0.0",
    "@radix-ui/react-dialog": "latest",
    "@radix-ui/react-dropdown-menu": "latest",
    "@radix-ui/react-select": "latest",
    "@radix-ui/react-tabs": "latest",
    "@radix-ui/react-toast": "latest",
    "@radix-ui/react-progress": "latest",
    "@radix-ui/react-switch": "latest",
    "tailwindcss": "^4.0.0",
    "wa-sqlite": "^0.9.9",
    "zustand": "^5.0.0",
    "class-variance-authority": "latest",
    "clsx": "latest",
    "tailwind-merge": "latest",
    "recharts": "^2.0.0",
    "lucide-react": "latest",
    "date-fns": "^4.0.0"
  },
  "devDependencies": {
    "typescript": "^5.7.0",
    "@types/react": "latest",
    "@types/react-dom": "latest",
    "vite": "^6.0.0",
    "@vitejs/plugin-react": "latest",
    "@tailwindcss/vite": "latest",
    "vite-plugin-pwa": "latest",
    "vitest": "latest",
    "@testing-library/react": "latest",
    "@testing-library/jest-dom": "latest",
    "jsdom": "latest",
    "eslint": "latest",
    "prettier": "latest",
    "@typescript-eslint/eslint-plugin": "latest",
    "@typescript-eslint/parser": "latest"
  }
}
```

---

## 2. 現行FastAPIアプリの機能棚卸し

### 2.1 全APIルート一覧

| Method | Path | 機能概要 | 移行先 |
|--------|------|---------|--------|
| GET | `/` | Root → API情報JSON | **廃止**（SPAにroot不要） |
| GET | `/api/transactions` | 取引一覧（月フィルタ対応） | **JS移植**: wa-sqlite直接クエリ |
| GET | `/api/transactions/summary` | 月次サマリー（カード別集計） | **JS移植**: wa-sqlite集計クエリ |
| PATCH | `/api/transactions/{id}/category` | カテゴリ個別更新 | **JS移植**: wa-sqlite UPDATE |
| POST | `/api/transactions/apply-categories` | ルールベース一括分類 | **JS移植**: category_service移植 |
| POST | `/api/sync` | Gmail同期（サーバー経由） | **廃止**: クライアント側gmail_sync.jsに統合済 |
| GET | `/api/health` | ヘルスチェック | **廃止**（サーバーなし） |
| POST | `/api/parse/email` | メール本文パース（ステートレス） | **JS/TS移植**: パーサーをTS化 |

### 2.2 全Webルートとテンプレート一覧

| Method | Path | テンプレート | 機能概要 | 移行先 |
|--------|------|-----------|---------|--------|
| GET | `/web/dashboard` | `dashboard.html` | メインダッシュボード | React: `<DashboardPage>` |
| GET | `/web/transactions` | `transactions.html` | 取引一覧ページ | React: `<TransactionsPage>` |
| GET | `/web/transactions/filter` | (partial) | htmxフィルタ応答 | React: useState+useEffect |
| GET | `/web/transactions/export` | — | CSV出力 | JS: Blob + download |
| GET | `/web/summary` | `summary.html` | 月次サマリー | React: `<SummaryPage>` |
| GET | `/web/chart/monthly` | `partials/monthly_chart.html` | 月次チャートJSON | React: Recharts直接描画 |
| GET | `/web/settings` | `settings.html` | 設定画面 | React: `<SettingsPage>` |
| POST | `/web/settings` | — | 設定保存 | JS: localStorage直接 |
| POST | `/web/sync` | `partials/sync_status.html` | Gmail同期実行 | React: 既存gmail_sync.js呼出 |
| GET | `/auth/start` | — | OAuth開始リダイレクト | **廃止**: PKCE（gmail_auth.js） |
| GET | `/auth/callback` | — | OAuthコールバック | **廃止**: PKCE |
| GET | `/auth/status` | (partial) | 認証状態HTML | React: useAuth hook |
| POST | `/pin-login` | — | PIN認証 | **廃止**（ローカルアプリのためPIN不要） |
| POST | `/pin-logout` | — | PINログアウト | **廃止** |

### 2.3 サービス層の棚卸し

| モジュール | 行数 | 役割 | 移植判定 |
|-----------|------|------|---------|
| `services/transaction_service.py` | 73行 | 取引保存＋重複検出 | **JS移植**: wa-sqlite INSERT + UNIQUE制約 |
| `services/aggregation_service.py` | 300行 | 月次集計・カード別集計・トレンド | **JS移植**: SQLクエリをwa-sqliteで実行 |
| `services/category_service.py` | 82行 | ルールベースカテゴリ分類 | **JS移植**: キーワード辞書をTS化 |
| `services/sync_service.py` | 210行 | Gmail→DB同期ロジック | **部分移植**: コア同期ロジックは既存gmail_sync.jsに統合済。パーサー呼び出しをJS化 |
| `gmail/parsers/` (全体) | ~600行 | 5社パーサー（Strategy Pattern） | **JS/TS移植**: 全パーサーをTS化。正規表現はそのまま流用可能 |
| `gmail/auth.py` | ~200行 | サーバーサイドOAuth | **廃止**: PKCE（gmail_auth.js）に完全移行済 |
| `gmail/client.py` | ~100行 | Gmail APIクライアント | **廃止**: ブラウザからfetch直接呼出（gmail_sync.js） |
| `config.py` | 116行 | 環境変数設定管理 | **廃止**: settings_store.js（localStorage）に移行済 |
| `database/connection.py` | ~50行 | SQLAlchemyセッション管理 | **廃止**: wa-sqlite直接操作 |
| `models/transaction.py` | 61行 | CardTransactionモデル | **TS型定義に変換**: `interface CardTransaction` |
| `web/routes.py` | 520行 | 12ルート + 11ヘルパー | **React化**: ページコンポーネント + hooks |
| `web/auth_routes.py` | ~150行 | サーバーサイドOAuthルート | **廃止**: PKCE |
| `web/pin_auth.py` | ~100行 | PIN認証 | **廃止** |

### 2.4 データモデル

**現行SQLAlchemyモデル（CardTransaction）:**

```python
# app/models/transaction.py
class CardTransaction(Base):
    __tablename__ = "card_transactions"
    id = Column(Integer, primary_key=True, autoincrement=True)
    card_company = Column(String, nullable=False)
    amount = Column(Integer, nullable=False)
    transaction_date = Column(DateTime, nullable=False)
    merchant = Column(String, nullable=True)
    email_subject = Column(String, nullable=False)
    email_from = Column(String, nullable=False)
    gmail_message_id = Column(String, nullable=False, unique=True)
    is_verified = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    category = Column(String(100), nullable=True, default=None)
```

**移行先TypeScript型定義:**

```typescript
// src/types/transaction.ts
export interface CardTransaction {
  id: number;
  card_company: string;
  amount: number;
  transaction_date: string; // ISO 8601
  merchant: string | null;
  email_subject: string;
  email_from: string;
  gmail_message_id: string;
  is_verified: boolean;
  created_at: string; // ISO 8601
  category: string | null;
}
```

**移行先wa-sqliteスキーマ（既存db.jsと統合）:**

```sql
CREATE TABLE IF NOT EXISTS card_transactions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  card_company TEXT NOT NULL,
  amount INTEGER NOT NULL,
  transaction_date TEXT NOT NULL,
  merchant TEXT,
  email_subject TEXT NOT NULL,
  email_from TEXT NOT NULL,
  gmail_message_id TEXT UNIQUE NOT NULL,
  is_verified INTEGER DEFAULT 0 NOT NULL,
  created_at TEXT DEFAULT (datetime('now')) NOT NULL,
  category TEXT
);

CREATE INDEX IF NOT EXISTS idx_tx_date ON card_transactions(transaction_date);
CREATE INDEX IF NOT EXISTS idx_tx_card ON card_transactions(card_company);
CREATE INDEX IF NOT EXISTS idx_tx_date_card ON card_transactions(transaction_date, card_company);
CREATE INDEX IF NOT EXISTS idx_tx_category ON card_transactions(category);
```

注: 現行db.jsのスキーマは`msg_id`カラムを使用しているが、上記の正式スキーマに統一する。`email_subject`と`email_from`カラムを追加し、既存Pythonモデルと完全一致させる。

---

## 3. Python→JS/TS移植計画

### 3.1 パーサー（メール解析ロジック）の移植

**現行構造（Python）:**

```
app/gmail/parsers/
├── __init__.py     # レジストリ + parse_email()
├── base.py         # BaseCardParser ABC
├── smbc.py         # 三井住友
├── jcb.py          # JCB
├── rakuten.py      # 楽天
├── amex.py         # AMEX
└── dcard.py        # dカード
```

**移植先構造（TypeScript）:**

```
src/services/parsers/
├── index.ts        # レジストリ + parseEmail()
├── types.ts        # ParsedTransaction型定義
├── base.ts         # BaseCardParser abstract class
├── smbc.ts         # 三井住友
├── jcb.ts          # JCB
├── rakuten.ts      # 楽天
├── amex.ts         # AMEX
└── dcard.ts        # dカード
```

**移植方針:**

1. **正規表現はそのまま流用**: Python正規表現とJS正規表現はほぼ互換。名前付きグループ `(?P<name>...)` を `(?<name>...)` に変換するだけ
2. **Strategy Patternを維持**: 各パーサーがBaseCardParserを継承する設計はそのまま
3. **サーバーAPIを廃止**: 現行の`POST /api/parse/email`はサーバー側パーサー呼び出し。SPA移行後はブラウザ内で直接実行

**移植例 — SMBCパーサー:**

```typescript
// src/services/parsers/smbc.ts
import { BaseCardParser, ParsedTransaction } from './base';

export class SMBCParser extends BaseCardParser {
  readonly companyName = '三井住友';
  readonly trustedDomains = ['contact.vpass.ne.jp'];
  readonly subjectKeywords = ['三井住友カード', '三井住友'];

  extractAmount(body: string): number | null {
    // Python: r'利用金額[:：]\s*([0-9,]+)\s*円'
    const match = body.match(/利用金額[:：]\s*([0-9,]+)\s*円/);
    if (!match) return null;
    const amount = parseInt(match[1].replace(/,/g, ''), 10);
    return isNaN(amount) || amount <= 0 || amount > 2147483647 ? null : amount;
  }

  extractTransactionDate(body: string): string | null {
    // Python: r'利用日[:：]\s*(\d{4})/(\d{2})/(\d{2})\s+(\d{2}):(\d{2})'
    const match = body.match(
      /利用日[:：]\s*(\d{4})\/(\d{2})\/(\d{2})\s+(\d{2}):(\d{2})/
    );
    if (!match) return super.extractTransactionDate(body);
    return `${match[1]}-${match[2]}-${match[3]}T${match[4]}:${match[5]}:00`;
  }
}
```

**既存gmail_sync.jsとの統合:**

現行の`gmail_sync.js`は`POST /api/parse/email`サーバーAPIを呼んでいる。移植後はサーバーを経由せず、インポートしたパーサーモジュールを直接呼び出す:

```typescript
// 現行 (gmail_sync.js)
const result = await parseEmail(fromAddr, subject, body); // → POST /api/parse/email

// 移行後
import { parseEmail } from '@/services/parsers';
const result = parseEmail(fromAddr, subject, body); // ブラウザ内で直接実行
```

### 3.2 集計ロジック（aggregation_service）の移植

**現行Python関数 → TS移植マッピング:**

| Python関数 | 行数 | 移植先 | 方針 |
|-----------|------|--------|------|
| `get_monthly_summary()` | 30行 | `src/services/aggregation.ts` | SQLクエリをwa-sqliteで実行。SQLはほぼそのまま |
| `get_monthly_by_card()` | 30行 | 同上 | GROUP BY card_company（SQL互換） |
| `get_total_by_month()` | 20行 | 同上 | SUM + COUNT（SQL互換） |
| `get_top_merchants()` | 20行 | 同上 | ORDER BY + LIMIT（SQL互換） |
| `get_all_time_summary_by_card()` | 25行 | 同上 | 全期間集計（SQL互換） |
| `get_monthly_trend()` | 40行 | 同上 | 過去12ヶ月のループ → 1クエリに最適化可能 |

**移植の核心**: 既存SQLAlchemyクエリをraw SQLに変換してwa-sqliteで実行する。SQLAlchemyが生成するSQLとSQLiteのネイティブSQLは互換性が高い。

**移植例:**

```typescript
// src/services/aggregation.ts
import { db } from '@/lib/database';

export interface MonthlySummary {
  card_company: string;
  total: number;
  count: number;
  average: number;
}

export async function getMonthlyByCard(
  year: number,
  month: number
): Promise<MonthlySummary[]> {
  const monthStr = `${year}-${String(month).padStart(2, '0')}`;
  return db.query<MonthlySummary>(
    `SELECT card_company,
            SUM(amount) as total,
            COUNT(*) as count,
            CAST(AVG(amount) AS INTEGER) as average
     FROM card_transactions
     WHERE is_verified = 1
       AND strftime('%Y-%m', transaction_date) = ?
     GROUP BY card_company`,
    [monthStr]
  );
}

export async function getMonthlyTrend(months: number = 12) {
  // Python版は12回ループでクエリ発行 → 1クエリに最適化
  return db.query(
    `SELECT strftime('%Y-%m', transaction_date) as month,
            SUM(amount) as total,
            COUNT(*) as count
     FROM card_transactions
     WHERE is_verified = 1
       AND transaction_date >= date('now', ? || ' months')
     GROUP BY strftime('%Y-%m', transaction_date)
     ORDER BY month`,
    [`-${months}`]
  );
}
```

### 3.3 カテゴリ分類（category_service）の移植

**移植方針**: キーワード辞書をそのままTS化。ロジックは単純な文字列マッチング。

```typescript
// src/services/category.ts
const CATEGORIES: Record<string, string[]> = {
  '食費': ['マクドナルド', 'すき家', '吉野家', '松屋', 'スーパー', 'イオン', 'ライフ',
           'コンビニ', 'セブンイレブン', 'ローソン', 'ファミリーマート', '業務スーパー',
           'デリバリー', '出前館', 'UberEats', 'Uber Eats'],
  '交通費': ['JR', '東急', '小田急', '京王', '東武', '西武', 'メトロ', '都営',
             'バス', 'タクシー', 'Uber', '電車', '新幹線', 'ETC', '高速'],
  // ... 他カテゴリ（Python版category_service.pyのCATEGORIESをそのまま転記）
};

export function classifyTransaction(merchant: string): string | null {
  if (!merchant) return null;
  const lower = merchant.toLowerCase();
  for (const [category, keywords] of Object.entries(CATEGORIES)) {
    for (const kw of keywords) {
      if (lower.includes(kw.toLowerCase())) return category;
    }
  }
  return null;
}

export async function applyCategories(overwrite = false): Promise<{ updated: number; skipped: number }> {
  const condition = overwrite ? '' : "AND category IS NULL";
  const rows = await db.query<{ id: number; merchant: string }>(
    `SELECT id, merchant FROM card_transactions WHERE 1=1 ${condition}`
  );
  let updated = 0;
  for (const row of rows) {
    const cat = classifyTransaction(row.merchant ?? '');
    if (cat) {
      await db.execute('UPDATE card_transactions SET category = ? WHERE id = ?', [cat, row.id]);
      updated++;
    }
  }
  return { updated, skipped: rows.length - updated };
}
```

### 3.4 DB操作（transaction_service, sync_service）→ wa-sqlite APIへの置換

**現行の二重構造を統一:**

| 現行 | 用途 | 移行先 |
|------|------|--------|
| SQLAlchemy ORM (`transaction_service.py`) | サーバーDB操作 | **廃止**: wa-sqlite直接操作 |
| wa-sqlite JS (`db.js`) | クライアントDB操作 | **拡張**: TypeScript化 + 全操作を統合 |

**統合データベースモジュール:**

```typescript
// src/lib/database.ts
import SQLiteESMFactory from 'wa-sqlite/dist/wa-sqlite.mjs';
import { IDBBatchAtomicVFS } from 'wa-sqlite/src/IDBBatchAtomicVFS.js';

let sqlite3: any;
let dbHandle: number;
let initialized = false;

export async function initDB(): Promise<void> {
  if (initialized) return;
  const module = await SQLiteESMFactory();
  sqlite3 = SQLite.Factory(module);
  const vfs = await IDBBatchAtomicVFS.create('card-tracker', module);
  sqlite3.vfs_register(vfs, true);
  dbHandle = await sqlite3.open_v2('card-tracker.db');

  // スキーマ初期化（CardTransactionモデル完全互換）
  await execute(SCHEMA_SQL);
  initialized = true;
}

export async function execute(sql: string, params: any[] = []): Promise<void> {
  await sqlite3.exec(dbHandle, sql, params);
}

export async function query<T>(sql: string, params: any[] = []): Promise<T[]> {
  const results: T[] = [];
  await sqlite3.exec(dbHandle, sql, (row: any[], cols: string[]) => {
    results.push(Object.fromEntries(cols.map((c, i) => [c, row[i]])) as T);
  }, params);
  return results;
}

// 重複検出付き保存（transaction_service.py の save_transaction 移植）
export async function saveTransaction(data: Omit<CardTransaction, 'id' | 'created_at'>): Promise<boolean> {
  try {
    await execute(
      `INSERT INTO card_transactions
        (card_company, amount, transaction_date, merchant, email_subject, email_from, gmail_message_id, is_verified, category)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [data.card_company, data.amount, data.transaction_date, data.merchant,
       data.email_subject, data.email_from, data.gmail_message_id,
       data.is_verified ? 1 : 0, data.category]
    );
    return true; // 保存成功
  } catch (e: any) {
    if (e.message?.includes('UNIQUE constraint')) {
      return false; // 重複（gmail_message_id）
    }
    throw e;
  }
}
```

### 3.5 Gmail API連携の移植

**現行構造:**
- **サーバー側**: `gmail/auth.py`（OAuth）+ `gmail/client.py`（API呼出）+ `sync_service.py`（処理統合）
- **クライアント側**: `gmail_auth.js`（PKCE）+ `gmail_sync.js`（API呼出＋同期）

**移行方針**: クライアント側JS群をTypeScript化し、パーサーのサーバー呼び出しを排除。

```typescript
// src/services/gmail/sync.ts (gmail_sync.js のTS化)
import { parseEmail } from '@/services/parsers';
import { saveTransaction } from '@/lib/database';
import { getAccessToken } from './auth';

export interface SyncResult {
  total: number;
  saved: number;
  skipped: number;
  errors: string[];
}

export async function syncGmail(
  onProgress?: (current: number, total: number, msg: string) => void
): Promise<SyncResult> {
  const token = getAccessToken();
  if (!token) throw new Error('Gmail未認証');

  const queries = ['ご利用のお知らせ', 'カードご利用確認', 'ご利用代金明細'];
  const result: SyncResult = { total: 0, saved: 0, skipped: 0, errors: [] };

  for (const query of queries) {
    const messages = await listMessages(token, query, 50);
    result.total += messages.length;

    for (let i = 0; i < messages.length; i++) {
      onProgress?.(i + 1, messages.length, `処理中: ${i + 1}/${messages.length}`);

      try {
        const msg = await getMessage(token, messages[i].id);
        // ★ サーバーAPI呼び出しの代わりにブラウザ内パーサー直接実行
        const parsed = parseEmail(msg.from, msg.subject, msg.body);
        if (!parsed) { result.skipped++; continue; }

        const saved = await saveTransaction({
          card_company: parsed.card_company,
          amount: parsed.amount,
          transaction_date: parsed.transaction_date,
          merchant: parsed.merchant ?? 'Unknown',
          email_subject: msg.subject,
          email_from: msg.from,
          gmail_message_id: messages[i].id,
          is_verified: true,
          category: null,
        });
        saved ? result.saved++ : result.skipped++;
      } catch (e) {
        result.errors.push(String(e));
      }

      // レートリミット対策
      await new Promise(r => setTimeout(r, 200));
    }
  }
  return result;
}
```

---

## 4. テスト戦略

### 4.1 テストフレームワーク: Vitest

| 比較項目 | Vitest（採用） | Jest | Mocha |
|---------|-------------|------|-------|
| Vite統合 | ◎ ネイティブ（設定不要） | × babel変換必要 | × 設定必要 |
| ESM対応 | ◎ ネイティブ | △ `--experimental-vm-modules` | ○ |
| TypeScript | ◎ esbuildで変換（設定不要） | △ ts-jest / babel設定 | △ ts-node設定 |
| 実行速度 | ◎ Viteのモジュールグラフ再利用 | ○ | ○ |
| API互換性 | Jest互換（`describe`, `it`, `expect`） | — | 独自 |
| UIテスト | ◎ @testing-library統合 | ○ | △ |
| カバレッジ | ◎ c8/istanbul内蔵 | ○ | △ 別途必要 |

### 4.2 テスト分類と戦略

| テスト種別 | 対象 | ツール | カバレッジ目標 |
|-----------|------|--------|-------------|
| **パーサーUnit** | 5社パーサー + FallbackParser | Vitest | **100%** |
| **集計Unit** | aggregation関数群 | Vitest + wa-sqlite mock | 90%+ |
| **カテゴリUnit** | classifyTransaction | Vitest | 100% |
| **DB操作Unit** | saveTransaction, query | Vitest + in-memory SQLite | 90%+ |
| **コンポーネントUnit** | React UIコンポーネント | Vitest + Testing Library | 80%+ |
| **フックUnit** | useAuth, useSync等 | Vitest + renderHook | 90%+ |
| **統合** | Gmail同期フロー | Vitest + MSW (mock API) | 80%+ |
| **E2E** | 全画面操作フロー | Playwright (将来) | — |

### 4.3 Python既存テストとの対比・回帰テスト方針

**最重要: パーサーテストの完全移植**

現行Pythonパーサーテストは33ファイル中最も多い。移植時は「Python版テストケースを全てTS版に1:1変換」する。

| Pythonテストファイル | TSテストファイル | 戦略 |
|--------------------|--------------|----|
| `test_parser_foundation.py` | `parsers/base.test.ts` | テストケースを全て移植。正規表現の挙動差異を確認 |
| `test_parser_amount_extraction.py` | `parsers/amount.test.ts` | 金額抽出の境界値テストを完全移植 |
| `test_parser_amex.py` | `parsers/amex.test.ts` | AMEXメールサンプルで検証 |
| `test_parser_dcard.py` | `parsers/dcard.test.ts` | dカードサンプルで検証 |
| `test_parser_fallback.py` | `parsers/fallback.test.ts` | 未知カード会社の処理 |
| `test_aggregation.py` | `services/aggregation.test.ts` | SQL集計結果の一致確認 |
| `tests/unit/test_category_service.py` | `services/category.test.ts` | 分類ルールの一致確認 |
| `test_sync_service.py` | `services/sync.test.ts` | 同期ロジック（Gmail mock） |
| `test_duplicate_detection.py` | `lib/database.test.ts` | UNIQUE制約の動作確認 |

**回帰テスト手法:**

1. **テストデータの共有**: `tests/fixtures/sample_emails/` の `.eml` ファイル（smbc.eml, jcb.eml, rakuten.eml, amex.eml, dcard.eml, generic.eml, invalid.eml, phishing.eml）をTS側テストでも読み込んで使用
2. **Golden test**: Python版パーサーで各サンプルメールを処理した結果をJSONに保存 → TS版パーサーの出力と自動比較
3. **数値精度**: 金額（整数）と日付（ISO 8601文字列）の完全一致を検証。浮動小数点はない

**Golden testの実装:**

```typescript
// src/services/parsers/__tests__/golden.test.ts
import { readFileSync } from 'fs';
import { parseEmail } from '../index';

// Python版で生成した期待値
const goldenResults = JSON.parse(
  readFileSync('tests/fixtures/golden_results.json', 'utf-8')
);

describe('Parser golden tests (Python parity)', () => {
  for (const [filename, expected] of Object.entries(goldenResults)) {
    it(`should match Python output for ${filename}`, () => {
      const eml = readFileSync(`tests/fixtures/sample_emails/${filename}`, 'utf-8');
      // emlからfrom, subject, bodyを抽出
      const { from, subject, body } = parseEml(eml);
      const result = parseEmail(from, subject, body);

      if (expected === null) {
        expect(result).toBeNull();
      } else {
        expect(result?.amount).toBe(expected.amount);
        expect(result?.card_company).toBe(expected.card_company);
        expect(result?.merchant).toBe(expected.merchant);
        expect(result?.transaction_date).toBe(expected.transaction_date);
      }
    });
  }
});
```

### 4.4 Vitest設定

```typescript
// vitest.config.ts
import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      include: ['src/**/*.ts', 'src/**/*.tsx'],
      exclude: ['src/**/*.test.ts', 'src/**/*.test.tsx', 'src/test/**'],
      thresholds: {
        branches: 80,
        functions: 80,
        lines: 80,
        statements: 80,
      },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
```

---

## 5. PWA設計

### 5.1 Service Worker戦略

| リソース種別 | 戦略 | 理由 |
|------------|------|------|
| **HTML/JS/CSS** (静的アセット) | Cache-first | ビルド時にハッシュ付きファイル名。キャッシュ済みなら即座に表示 |
| **wa-sqlite WASMファイル** | Cache-first | 大きなファイル（~600KB）。一度キャッシュすれば再ダウンロード不要 |
| **アイコン/画像** | Cache-first | 静的アセット |
| **Google OAuth** | Network-only | 認証フローはオフライン不可 |
| **Gmail API** | Network-only | リアルタイムデータ取得 |
| **LLM API** | Network-only | リアルタイムAPI呼び出し |

vite-plugin-pwaがWorkboxベースのService Workerを自動生成する。追加のカスタムSWは不要。

### 5.2 manifest.json設計

```json
{
  "name": "Card Spending Tracker",
  "short_name": "支出管理",
  "description": "クレジットカード利用額をGmailから自動収集・分析するプライバシーファーストPWA",
  "start_url": "/",
  "display": "standalone",
  "orientation": "portrait-primary",
  "theme_color": "#0f172a",
  "background_color": "#0f172a",
  "categories": ["finance", "utilities"],
  "lang": "ja",
  "icons": [
    {
      "src": "/icon-192.png",
      "sizes": "192x192",
      "type": "image/png",
      "purpose": "any maskable"
    },
    {
      "src": "/icon-512.png",
      "sizes": "512x512",
      "type": "image/png",
      "purpose": "any maskable"
    }
  ]
}
```

**デザイン選択の根拠:**
- `display: "standalone"` — アドレスバーを隠し、ネイティブアプリ風の全画面体験
- `orientation: "portrait-primary"` — 殿の「スマホが主戦場」方針に対応。モバイルファースト
- `theme_color: "#0f172a"` (slate-900) — ダークテーマベースの独自デザインに合致
- `categories: ["finance"]` — OSのアプリ分類に使用

### 5.3 オフライン対応の範囲と動作

| 機能 | オフライン動作 | 理由 |
|------|-------------|------|
| ダッシュボード表示 | ✅ 完全動作 | データはローカルDB（wa-sqlite）から取得 |
| 取引一覧・フィルタ | ✅ 完全動作 | SQLクエリはローカル実行 |
| 月次サマリー・グラフ | ✅ 完全動作 | 集計もローカル実行 |
| カテゴリ分類（ルールベース） | ✅ 完全動作 | キーワード辞書はJSに内蔵 |
| 設定変更 | ✅ 完全動作 | localStorage操作 |
| CSVエクスポート | ✅ 完全動作 | Blob生成はブラウザ内 |
| Gmail同期 | ❌ 不可 | ネットワーク必須（Gmail API） |
| LLMカテゴリ分類 | ❌ 不可 | ネットワーク必須（Anthropic/OpenAI API） |
| Gmail認証 | ❌ 不可 | ネットワーク必須（Google OAuth） |

**オフライン検出UI:**

```typescript
// src/hooks/useOnlineStatus.ts
export function useOnlineStatus() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  useEffect(() => {
    const on = () => setIsOnline(true);
    const off = () => setIsOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
  }, []);
  return isOnline;
}
```

オフライン時はGmail同期ボタンを非活性化し、「オフラインです。閲覧は可能です」のバナーを表示。

### 5.4 キャッシュ戦略

| レイヤー | 技術 | サイズ目安 | 寿命 |
|---------|------|----------|------|
| **SW precache** | Workbox (vite-plugin-pwa) | ~2MB (JS+CSS+WASM+HTML) | ビルドハッシュで自動更新 |
| **アプリデータ** | wa-sqlite (IndexedDB backend) | ~1-50MB (取引量次第) | 永続（ブラウザクリアまで） |
| **認証トークン** | sessionStorage | ~1KB | セッション限定 |
| **設定** | localStorage | ~1KB | 永続 |
| **LLMキー** | wa-sqlite (暗号化) | ~1KB | 永続 |

### 5.5 インストール体験

vite-plugin-pwaの`registerType: 'autoUpdate'`により:
1. 初回アクセス時にService Workerが自動登録
2. ブラウザが「ホーム画面に追加」バナーを自動表示（Chrome/Edge）
3. 更新がある場合は自動的にキャッシュを更新し、次回アクセス時に反映

追加のカスタムインストールプロンプトは不要（ブラウザネイティブのプロンプトに任せる）。

---

## 6. デザインシステム基盤設計

### 6.1 Radix UI + Tailwind によるコンポーネント体系

shadcn/ui方式 = Radix UIのヘッドレスコンポーネントに独自Tailwindスタイルを適用し、`src/components/ui/`にコピー配置する。npmの依存ではなくプロジェクト内ソースとして管理。

**コンポーネント一覧:**

```
src/components/ui/
├── button.tsx          # Radix不使用（HTML button + CVA variants）
├── card.tsx            # div + Tailwind
├── dialog.tsx          # @radix-ui/react-dialog
├── dropdown-menu.tsx   # @radix-ui/react-dropdown-menu
├── input.tsx           # HTML input + Tailwind
├── progress.tsx        # @radix-ui/react-progress
├── select.tsx          # @radix-ui/react-select
├── switch.tsx          # @radix-ui/react-switch
├── tabs.tsx            # @radix-ui/react-tabs
├── toast.tsx           # @radix-ui/react-toast
├── badge.tsx           # span + CVA variants
├── table.tsx           # HTML table + Tailwind
└── stat-card.tsx       # 独自コンポーネント（ダッシュボード用）
```

### 6.2 テーマトークン定義方針

**Tailwind CSS v4のCSS変数アプローチ:**

```css
/* src/styles/theme.css */
@theme {
  /* === カラーシステム === */
  /* ダーク基調のモダンファイナンスカラー */
  --color-background: #0a0a0f;
  --color-surface: #12121a;
  --color-surface-raised: #1a1a26;
  --color-border: #2a2a3a;

  /* アクセントカラー: ティール〜シアン系（金融アプリで差別化） */
  --color-primary: #06b6d4;        /* cyan-500 */
  --color-primary-hover: #22d3ee;  /* cyan-400 */
  --color-primary-muted: #0e4f5c;

  /* セマンティックカラー */
  --color-success: #10b981;   /* 予算内 */
  --color-warning: #f59e0b;   /* 予算80%以上 */
  --color-danger: #ef4444;    /* 予算超過 */
  --color-info: #3b82f6;

  /* テキスト */
  --color-text-primary: #f1f5f9;    /* slate-100 */
  --color-text-secondary: #94a3b8;  /* slate-400 */
  --color-text-muted: #64748b;      /* slate-500 */

  /* === タイポグラフィ === */
  --font-sans: 'Inter', 'Noto Sans JP', system-ui, sans-serif;
  --font-mono: 'JetBrains Mono', 'Fira Code', ui-monospace, monospace;

  /* === スペーシング（4px基準） === */
  --spacing-xs: 0.25rem;  /* 4px */
  --spacing-sm: 0.5rem;   /* 8px */
  --spacing-md: 1rem;     /* 16px */
  --spacing-lg: 1.5rem;   /* 24px */
  --spacing-xl: 2rem;     /* 32px */

  /* === 角丸 === */
  --radius-sm: 0.375rem;
  --radius-md: 0.5rem;
  --radius-lg: 0.75rem;
  --radius-full: 9999px;

  /* === 影 === */
  --shadow-sm: 0 1px 2px 0 rgb(0 0 0 / 0.3);
  --shadow-md: 0 4px 6px -1px rgb(0 0 0 / 0.4);
  --shadow-lg: 0 10px 15px -3px rgb(0 0 0 / 0.5);
}

/* ライトモードオーバーライド */
@media (prefers-color-scheme: light) {
  @theme {
    --color-background: #fafafa;
    --color-surface: #ffffff;
    --color-surface-raised: #f8fafc;
    --color-border: #e2e8f0;
    --color-primary: #0891b2;
    --color-text-primary: #0f172a;
    --color-text-secondary: #475569;
    --color-text-muted: #94a3b8;
  }
}
```

### 6.3 「ありきたり禁止」を実現するデザイン方向性

殿の「ありきたりデザイン禁止」方針を具体化する。

**差別化ポイント:**

| 要素 | ありきたり（BootstrapやDaisyUI標準） | 独自デザイン（本アプリ） |
|------|-----------------------------------|--------------------|
| **配色** | 白背景 + 青アクセント | ダーク基調 + シアンアクセント（FinTech風） |
| **カード** | 白背景 + border-radius + shadow | グラスモーフィズム（半透明背景 + blur） |
| **金額表示** | 普通のテキスト | モノスペース + グラデーション + サイズ強調 |
| **チャート** | 素のChart.js / Recharts | カスタムカラーパレット + アニメーション |
| **ナビゲーション** | 上部バー or サイドバー | 下部タブナビ（モバイル） + サイドバー（PC） |
| **トランジション** | なし or 即座 | framer-motion的なスムーズアニメーション |
| **データ密度** | 1画面1情報 | 情報密度の高いダッシュボード |

**グラスモーフィズムカードの例:**

```tsx
// src/components/ui/card.tsx
export function Card({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn(
      "rounded-lg border border-white/10",
      "bg-surface/80 backdrop-blur-xl",
      "shadow-lg shadow-black/20",
      "p-4",
      className
    )}>
      {children}
    </div>
  );
}
```

**金額表示コンポーネント:**

```tsx
// src/components/ui/currency-display.tsx
export function CurrencyDisplay({ amount, size = 'md' }: { amount: number; size?: 'sm' | 'md' | 'lg' }) {
  const formatted = amount.toLocaleString('ja-JP');
  const sizes = {
    sm: 'text-sm font-mono',
    md: 'text-xl font-bold font-mono tracking-tight',
    lg: 'text-4xl font-black font-mono tracking-tighter',
  };
  return (
    <span className={cn(sizes[size], 'text-text-primary')}>
      <span className="text-text-muted text-[0.6em]">¥</span>
      {formatted}
    </span>
  );
}
```

### 6.4 主要画面のコンポーネント設計

**Dashboard:**

```
┌─────────────────────────────────────┐
│ ナビバー: ロゴ + 月選択 + テーマ切替    │
├─────────────────────────────────────┤
│ ┌─────┐ ┌─────┐ ┌─────┐ ┌──────┐  │
│ │合計  │ │件数  │ │平均  │ │予算率 │  │  ← StatCardコンポーネント x4
│ │¥128k │ │32件  │ │¥4k  │ │ 64%  │  │
│ └─────┘ └─────┘ └─────┘ └──────┘  │
├─────────────────────────────────────┤
│ ┌──────────────┐ ┌──────────────┐  │
│ │ 月次推移グラフ │ │ カテゴリ円グラフ│  │  ← Rechartsコンポーネント
│ │ (Recharts Bar)│ │ (Recharts Pie)│  │
│ └──────────────┘ └──────────────┘  │
├─────────────────────────────────────┤
│ 直近の取引リスト (最新10件)            │  ← TransactionListコンポーネント
│ ┌─────────────────────────────────┐ │
│ │ 02/22 Amazon     ¥3,200  食費   │ │
│ │ 02/21 JR東日本   ¥1,040  交通費  │ │
│ └─────────────────────────────────┘ │
├─────────────────────────────────────┤
│ [Gmail同期] [データエクスポート]        │  ← ActionButtonsコンポーネント
└─────────────────────────────────────┘
```

**Transaction一覧:**

```
モバイル (< 768px):                   PC (>= 768px):
┌─────────────────────┐              ┌──────────────────────────────────┐
│ 🔍 検索バー          │              │ 🔍 | 月: [2026-02] | カード: [全] │
│ 月: [2026-02▼]      │              ├──────────────────────────────────┤
│ カード: [全て▼]      │              │ 日付   | カード | 店舗 | 分類 | 金額│
├─────────────────────┤              │ 02/22 | 三井住友| Amazon| 食費|¥3.2k│
│ ┌────────────────┐  │              │ 02/21 | JCB   | JR   | 交通|¥1.0k│
│ │ Amazon          │  │              │ ...                              │
│ │ ¥3,200  02/22   │  │              ├──────────────────────────────────┤
│ │ 三井住友  食費   │  │              │ 合計: 32件  ¥128,000             │
│ └────────────────┘  │              └──────────────────────────────────┘
│ ┌────────────────┐  │
│ │ JR東日本        │  │
│ │ ¥1,040  02/21   │  │
│ └────────────────┘  │
└─────────────────────┘
```

**Settings:**

```
┌──────────────────────────────┐
│ 設定                          │
├──────────────────────────────┤
│ 📊 月間予算しきい値            │
│    [¥100,000        ]        │
├──────────────────────────────┤
│ 🔑 LLM APIキー (BYOK)        │
│    プロバイダ: [Anthropic ▼]  │
│    APIキー: [sk-ant-...]      │
│    PIN: [****]                │
│    [保存] [削除]               │
├──────────────────────────────┤
│ 🎨 テーマ                     │
│    [ダーク ◉] [ライト ○]      │
├──────────────────────────────┤
│ 💾 データ管理                  │
│    [JSONエクスポート]          │
│    [JSONインポート]            │
│    [全データ削除]              │
└──────────────────────────────┘
```

---

## 7. 移行フェーズ分割と依存関係

### 7.1 フェーズ定義

| フェーズ | 内容 | 成果物 | 前提条件 |
|---------|------|--------|---------|
| **Phase 0** | プロジェクト初期化 | Vite+React+TS骨格、Tailwind設定、ルーティング、デザイントークン | なし |
| **Phase 1** | コアロジック移植 | パーサー(TS)、DB操作(TS)、集計(TS)、カテゴリ(TS) + 全テスト | Phase 0 |
| **Phase 2** | UI構築 | 全ページコンポーネント、デザインシステム、レスポンシブ | Phase 0 + Phase 1（一部並行可） |
| **Phase 3** | Gmail統合 | PKCE認証(TS)、同期フロー(TS)、BYOK LLM(TS) | Phase 1 |
| **Phase 4** | PWA化 + デプロイ | Service Worker、manifest、GitHub Pages設定、CI/CD | Phase 2 + Phase 3 |

### 7.2 依存関係グラフ

```
Phase 0: プロジェクト初期化
    │
    ├──────────────────────────┐
    ▼                          ▼
Phase 1: コアロジック移植     Phase 2: UI構築（静的部分）
    │                          │
    ├──────────┐               │
    ▼          │               │
Phase 3: Gmail統合  │               │
    │          │               │
    └──────────┴───────────────┘
                    │
                    ▼
           Phase 4: PWA + デプロイ
```

Phase 1とPhase 2の静的UI部分は並行可能。Phase 2のデータ連携部分はPhase 1完了後。

### 7.3 各フェーズの詳細

#### Phase 0: プロジェクト初期化

| # | タスク | 内容 |
|---|--------|------|
| P0-1 | Viteプロジェクト作成 | `npm create vite@latest` + React + TypeScript |
| P0-2 | Tailwind CSS v4設定 | `@tailwindcss/vite` プラグイン + theme.css |
| P0-3 | React Router設定 | /, /transactions, /summary, /settings の4ルート |
| P0-4 | shadcn/ui方式のUI基盤 | `src/components/ui/` にButton, Card, Input等の基本コンポーネント配置 |
| P0-5 | Zustandストア骨格 | useTransactionStore, useSettingsStore |
| P0-6 | Vitest設定 | vitest.config.ts + テスト実行確認 |
| P0-7 | ESLint + Prettier設定 | TypeScript向けlint設定 |
| P0-8 | wa-sqlite統合 | Worker経由のDB初期化 + スキーマ作成 |

#### Phase 1: コアロジック移植

| # | タスク | 移植元(Python) | 移植先(TS) |
|---|--------|-------------|----------|
| P1-1 | 型定義 | `models/transaction.py` | `src/types/transaction.ts` |
| P1-2 | パーサー基底クラス | `parsers/base.py` | `src/services/parsers/base.ts` |
| P1-3 | SMBCパーサー | `parsers/smbc.py` | `src/services/parsers/smbc.ts` |
| P1-4 | JCBパーサー | `parsers/jcb.py` | `src/services/parsers/jcb.ts` |
| P1-5 | 楽天パーサー | `parsers/rakuten.py` | `src/services/parsers/rakuten.ts` |
| P1-6 | AMEXパーサー | `parsers/amex.py` | `src/services/parsers/amex.ts` |
| P1-7 | dカードパーサー | `parsers/dcard.py` | `src/services/parsers/dcard.ts` |
| P1-8 | パーサーレジストリ | `parsers/__init__.py` | `src/services/parsers/index.ts` |
| P1-9 | 集計サービス | `aggregation_service.py` | `src/services/aggregation.ts` |
| P1-10 | カテゴリサービス | `category_service.py` | `src/services/category.ts` |
| P1-11 | DB操作モジュール | `transaction_service.py` + `db.js` | `src/lib/database.ts` |
| P1-12 | Golden test生成 | Python版テスト実行結果 | `tests/fixtures/golden_results.json` |
| P1-13 | パーサーテスト | `test_parser_*.py` 全ファイル | `src/services/parsers/__tests__/*.test.ts` |
| P1-14 | 集計テスト | `test_aggregation.py` | `src/services/__tests__/aggregation.test.ts` |
| P1-15 | カテゴリテスト | `test_category_service.py` | `src/services/__tests__/category.test.ts` |
| P1-16 | DB操作テスト | `test_duplicate_detection.py` | `src/lib/__tests__/database.test.ts` |

#### Phase 2: UI構築

| # | タスク | 内容 |
|---|--------|------|
| P2-1 | レイアウトシェル | ナビバー + 下部タブ(モバイル) + サイドバー(PC) |
| P2-2 | StatCardコンポーネント | 月間合計・件数・平均・予算率の4カード |
| P2-3 | DashboardPage | グラフ + 統計 + 直近取引 |
| P2-4 | TransactionsPage | フィルタバー + モバイルカード/PCテーブル |
| P2-5 | SummaryPage | 月次推移チャート + カテゴリ円グラフ |
| P2-6 | SettingsPage | 予算設定 + BYOK + テーマ + データ管理 |
| P2-7 | Rechartsグラフ統合 | BarChart(月次推移) + PieChart(カテゴリ) |
| P2-8 | CSVエクスポート | Blob生成 + ダウンロード |
| P2-9 | レスポンシブテスト | モバイル/タブレット/PC全ブレークポイント確認 |

#### Phase 3: Gmail統合

| # | タスク | 内容 |
|---|--------|------|
| P3-1 | Gmail認証(TS化) | `gmail_auth.js` → `src/services/gmail/auth.ts` (PKCE) |
| P3-2 | Gmail同期(TS化) | `gmail_sync.js` → `src/services/gmail/sync.ts` (サーバーAPI廃止) |
| P3-3 | BYOK LLM(TS化) | `llm_key.js` → `src/services/llm/key-store.ts` (暗号化保存) |
| P3-4 | useAuth hook | 認証状態管理React hook |
| P3-5 | useSync hook | 同期実行 + 進捗管理React hook |
| P3-6 | 同期UIコンポーネント | 進捗バー + 結果表示 |

#### Phase 4: PWA化 + デプロイ

| # | タスク | 内容 |
|---|--------|------|
| P4-1 | vite-plugin-pwa設定 | Service Worker + manifest生成 |
| P4-2 | アプリアイコン作成 | 192x192, 512x512 PNG |
| P4-3 | オフラインフォールバック | オフライン時のUI表示 |
| P4-4 | GitHub Actions CI | lint + test + build |
| P4-5 | GitHub Pages CD | build → gh-pages branch自動デプロイ |
| P4-6 | 最終統合テスト | 全機能の動作確認 |

### 7.4 並行稼働戦略（Python版とReact版の共存期間）

**共存しない。クリーンカットで移行する。**

理由:
1. **サーバーが消える**: React SPA版にサーバーは存在しない。Python版とReact版の共存は「サーバーあり＋なし」の二重管理になり意味がない
2. **データ移行は手動**: 既存サーバーDBのデータはJSONエクスポート→インポートで移行。Phase 1のDB操作モジュールにインポート機能を含める
3. **Phase 1完了時点で並行テスト**: Python版パーサーとTS版パーサーのGolden testで出力一致を確認すれば、並行稼働は不要

**データ移行方法:**
1. Python版で `GET /web/transactions/export?month=all` → CSV取得（既存機能）
2. または `python -c "from app.database.connection import get_session; ..."` でJSON出力スクリプト作成
3. React版SettingsページのインポートUIでJSON読み込み → wa-sqliteバルクインサート

---

## 8. ディレクトリ構成案

### 8.1 src/ 配下の構成

```
card-spending-tracker/
├── public/
│   ├── icon-192.png
│   ├── icon-512.png
│   └── favicon.ico
├── src/
│   ├── app/
│   │   ├── App.tsx                  # ルートコンポーネント（Router設定）
│   │   ├── Layout.tsx               # 共通レイアウト（ナビバー + サイドバー）
│   │   └── routes.tsx               # ルート定義
│   ├── components/
│   │   ├── ui/                      # shadcn/ui方式の汎用UIコンポーネント
│   │   │   ├── button.tsx
│   │   │   ├── card.tsx
│   │   │   ├── dialog.tsx
│   │   │   ├── dropdown-menu.tsx
│   │   │   ├── input.tsx
│   │   │   ├── progress.tsx
│   │   │   ├── select.tsx
│   │   │   ├── switch.tsx
│   │   │   ├── tabs.tsx
│   │   │   ├── toast.tsx
│   │   │   ├── badge.tsx
│   │   │   └── table.tsx
│   │   ├── dashboard/               # ダッシュボード専用コンポーネント
│   │   │   ├── StatCard.tsx
│   │   │   ├── MonthlyChart.tsx
│   │   │   ├── CategoryPie.tsx
│   │   │   ├── RecentTransactions.tsx
│   │   │   └── SyncButton.tsx
│   │   ├── transactions/            # 取引一覧専用コンポーネント
│   │   │   ├── TransactionCard.tsx   # モバイル用カード
│   │   │   ├── TransactionTable.tsx  # PC用テーブル
│   │   │   ├── FilterBar.tsx
│   │   │   └── CsvExport.tsx
│   │   ├── settings/                # 設定画面専用コンポーネント
│   │   │   ├── BudgetSetting.tsx
│   │   │   ├── LlmKeySetting.tsx
│   │   │   ├── ThemeSetting.tsx
│   │   │   └── DataManagement.tsx
│   │   └── common/                  # 横断的UIコンポーネント
│   │       ├── CurrencyDisplay.tsx
│   │       ├── OfflineBanner.tsx
│   │       └── MonthSelector.tsx
│   ├── pages/                       # ページコンポーネント（ルーティング先）
│   │   ├── DashboardPage.tsx
│   │   ├── TransactionsPage.tsx
│   │   ├── SummaryPage.tsx
│   │   └── SettingsPage.tsx
│   ├── services/                    # ビジネスロジック（Pythonからの移植先）
│   │   ├── parsers/                 # メールパーサー（5社 + base）
│   │   │   ├── index.ts             # レジストリ + parseEmail()
│   │   │   ├── types.ts             # ParsedTransaction型
│   │   │   ├── base.ts              # BaseCardParser abstract
│   │   │   ├── smbc.ts
│   │   │   ├── jcb.ts
│   │   │   ├── rakuten.ts
│   │   │   ├── amex.ts
│   │   │   └── dcard.ts
│   │   ├── gmail/                   # Gmail API連携
│   │   │   ├── auth.ts              # PKCE OAuth
│   │   │   └── sync.ts              # メール取得 + パース + DB保存
│   │   ├── llm/                     # LLM API連携
│   │   │   ├── key-store.ts         # BYOK暗号化保存
│   │   │   └── classify.ts          # LLMカテゴリ分類
│   │   ├── aggregation.ts           # 月次集計関数群
│   │   └── category.ts              # ルールベースカテゴリ分類
│   ├── hooks/                       # React カスタムフック
│   │   ├── useAuth.ts               # Gmail認証状態
│   │   ├── useSync.ts               # 同期実行 + 進捗
│   │   ├── useTransactions.ts       # 取引データ取得
│   │   ├── useAggregation.ts        # 集計データ取得
│   │   ├── useOnlineStatus.ts       # オフライン検出
│   │   └── useTheme.ts              # テーマ切替
│   ├── stores/                      # Zustandストア
│   │   ├── transaction-store.ts     # 取引データキャッシュ
│   │   └── settings-store.ts        # アプリ設定
│   ├── lib/                         # インフラ層
│   │   ├── database.ts              # wa-sqlite初期化 + クエリ実行
│   │   ├── database.worker.ts       # Web Worker（OPFS用）
│   │   └── utils.ts                 # cn(), formatCurrency()等
│   ├── types/                       # TypeScript型定義
│   │   ├── transaction.ts           # CardTransaction
│   │   └── settings.ts              # AppSettings
│   ├── styles/
│   │   ├── globals.css              # Tailwindインポート + テーマ変数
│   │   └── theme.css                # カスタムテーマトークン
│   ├── test/                        # テスト共通設定
│   │   └── setup.ts                 # Vitest setup（jest-dom等）
│   ├── main.tsx                     # エントリポイント
│   └── vite-env.d.ts                # Vite型定義
├── tests/
│   └── fixtures/
│       ├── sample_emails/           # Python版から流用
│       │   ├── smbc.eml
│       │   ├── jcb.eml
│       │   ├── rakuten.eml
│       │   ├── amex.eml
│       │   ├── dcard.eml
│       │   ├── generic.eml
│       │   ├── invalid.eml
│       │   └── phishing.eml
│       └── golden_results.json      # Python版パーサー出力（回帰テスト用）
├── index.html                       # Viteエントリ
├── package.json
├── tsconfig.json
├── vite.config.ts
├── vitest.config.ts
├── tailwind.config.ts               # (v4ではCSS内設定が主だが、必要に応じて)
├── .eslintrc.cjs
├── .prettierrc
└── .github/
    └── workflows/
        ├── ci.yml                   # lint + test + build
        └── deploy.yml               # GitHub Pages自動デプロイ
```

### 8.2 テストファイルの配置

テストファイルはコロケーション（対象ファイルの隣に配置）方式:

```
src/services/parsers/
├── smbc.ts
├── smbc.test.ts            # ← コロケーション
├── jcb.ts
├── jcb.test.ts
├── base.ts
├── base.test.ts
├── index.ts
└── index.test.ts

src/services/
├── aggregation.ts
├── aggregation.test.ts     # ← コロケーション
├── category.ts
└── category.test.ts

src/lib/
├── database.ts
└── database.test.ts

src/components/dashboard/
├── StatCard.tsx
└── StatCard.test.tsx       # UIコンポーネントテスト
```

**理由**: コロケーションはファイル移動時にテストも一緒に移動される。`__tests__/` ディレクトリだとファイル構造の二重管理が発生する。Vitestはデフォルトで `*.test.ts` を検出するため追加設定不要。

### 8.3 設定ファイルの配置

```
ルートディレクトリ:
├── vite.config.ts           # Viteビルド設定（React, Tailwind, PWA）
├── vitest.config.ts         # テスト設定（vitest.workspace.tsは不要）
├── tsconfig.json            # TypeScript設定
├── tsconfig.node.json       # Node用TS設定（vite.config.ts用）
├── package.json             # 依存関係 + scripts
├── .eslintrc.cjs            # ESLint設定
├── .prettierrc              # Prettier設定
└── postcss.config.js        # (Tailwind v4ではViteプラグインで代替可能。不要な場合あり)
```

**tsconfig.json:**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "moduleResolution": "bundler",
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "paths": {
      "@/*": ["./src/*"]
    }
  },
  "include": ["src"],
  "references": [{ "path": "./tsconfig.node.json" }]
}
```

---

## 付録A: 廃止されるサーバーサイドコンポーネント一覧

SPA移行完了後、以下のPythonコードは不要になる:

| ファイル/ディレクトリ | 理由 |
|---------------------|------|
| `app/api/` | 全APIルート廃止（ロジックはJS/TS側に移植） |
| `app/web/` | 全Webルート廃止（React SPAに置換） |
| `app/cli/` | CLI廃止（ブラウザアプリのみ） |
| `app/database/` | SQLAlchemy廃止（wa-sqliteに置換） |
| `app/models/` | ORMモデル廃止（TypeScript型定義に置換） |
| `app/gmail/auth.py` | サーバーOAuth廃止（PKCEに完全移行） |
| `app/gmail/client.py` | サーバー経由Gmail API廃止（ブラウザ直接呼出） |
| `app/config.py` | サーバー設定廃止（localStorage） |
| `app/security/` | サーバーセキュリティ廃止（CSP等はGitHub Pagesのheaders設定） |
| `app/templates/` | Jinja2テンプレート廃止（React JSXに置換） |
| `app/static/` | 静的ファイル廃止（Viteでビルド） |
| `alembic/` | DBマイグレーション廃止（クライアントDBはスキーマ内蔵） |
| `Dockerfile` | コンテナ廃止（静的ホスティング） |
| `docker-compose.yml` | 同上 |
| `fly.toml` | Fly.io廃止（GitHub Pages） |
| `pyproject.toml` | Python依存管理廃止 |

**保持するもの:**
- `app/gmail/parsers/` — TS移植の参照元として保持（移植完了・テスト合格後に削除可）
- `tests/fixtures/sample_emails/` — TS側テストで共用
- `docs/` — 設計文書は保持

## 付録B: GitHub Pages デプロイ設定

```yaml
# .github/workflows/deploy.yml
name: Deploy to GitHub Pages

on:
  push:
    branches: [main]

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: pages
  cancel-in-progress: true

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '22'
          cache: 'npm'
      - run: npm ci
      - run: npm run lint
      - run: npm run test -- --run
      - run: npm run build
      - uses: actions/upload-pages-artifact@v3
        with:
          path: dist

  deploy:
    needs: build
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - uses: actions/deploy-pages@v4
        id: deployment
```

**SPA用404ハンドリング:**

GitHub Pagesは`/transactions`等のパスを404にするため、`public/404.html`にリダイレクトスクリプトを配置:

```html
<!-- public/404.html -->
<!DOCTYPE html>
<html>
<head>
  <script>
    // GitHub Pages SPA fallback
    sessionStorage.setItem('redirect', window.location.pathname);
    window.location.replace('/');
  </script>
</head>
</html>
```

`index.html`のスクリプトで復元:

```html
<script>
  const redirect = sessionStorage.getItem('redirect');
  if (redirect) {
    sessionStorage.removeItem('redirect');
    window.history.replaceState(null, '', redirect);
  }
</script>
```

---

*作成: 軍師（Gunshi）| subtask_052_gunshi | cmd_052 | 2026-02-22*
*入力: 現行FastAPI+Jinja2コード全読（API routes, services, models, templates, static JS, parsers, tests, config）*
*参照: architecture.md, privacy_architecture.md, MEMORY.md（確定方針）*
