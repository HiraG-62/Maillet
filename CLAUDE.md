# Maillet Development Rules

## No Hardcoding Rule (MANDATORY)

以下の値をコンポーネント・ロジック・スタイルに直接ハードコードしない：

| カテゴリ | 禁止例 | 代替手段 |
|----------|--------|----------|
| カラー値 | `#0d9488`, `rgb(13, 148, 136)` | CSS変数 `var(--color-primary)` 等 |
| マジックナンバー | `5000`, `0.15` | 名前付き定数 (`const BATCH_SIZE = 5`) |
| URL・APIエンドポイント | `'https://api.example.com'` | 設定ファイル or 環境変数 |
| 文字列リテラル | UIラベル・メッセージ | 必要に応じて定数化 |
| スペーシング・サイズ | `padding: 24px` | CSS変数 or デザイントークン |

### CSS変数を受け付けないライブラリ（Recharts等）

`getComputedStyle(document.documentElement).getPropertyValue('--color-primary')` で
CSS変数からJS値を取得し、コンポーネントに渡すこと。
