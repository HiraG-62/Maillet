# Maillet

Maillet（Mail + Wallet）— メールからカード利用明細を自動取得・管理する静的PWA。

## 概要

Gmail からクレジットカード利用通知メールを自動取得し、月次・カード別の支出を一元管理します。
データはブラウザ内（wa-sqlite / IndexedDB）に保存され、サーバー不要のプライバシーファーストな設計です。

## 主な機能

- Gmail OAuth（PKCE）によるメール自動取得
- 複数カード会社のメールフォーマット自動解析
- ブラウザ内 SQLite（wa-sqlite）による利用履歴管理
- 月次・カード別集計ダッシュボード
- Progressive Web App（オフライン対応）

## 技術スタック

| レイヤー | 技術 |
|---------|------|
| UI | React 19 + TypeScript |
| ビルド | Vite 6 |
| スタイリング | Tailwind CSS v4 + Radix UI |
| データベース | wa-sqlite（IndexedDB / OPFS）|
| 状態管理 | Zustand |
| テスト | Vitest + Testing Library |
| デプロイ | GitHub Pages |

## セットアップ

```bash
npm install
npm run dev
```

## テスト

```bash
npx vitest run
```

## デプロイ

`main` ブランチへのプッシュで GitHub Actions が自動デプロイします。

```bash
git push origin main
```

デプロイ先: `https://<user>.github.io/maillet/`

## ライセンス

MIT
