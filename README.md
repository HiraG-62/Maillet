# クレジットカード月間使用額管理アプリ

Gmail APIを利用してクレジットカード会社からの利用通知メールを自動収集・集計するアプリケーション。

## 概要

複数のクレジットカード会社からの利用通知メールを自動的に収集し、月次・カード別の利用額を一元管理します。

### 主要機能

- Gmail API経由でのカード利用通知メール自動取得
- 複数カード会社のメールフォーマット自動解析
- SQLiteによる利用履歴の永続化
- CLI経由での月次集計表示
- ドメイン検証によるフィッシングメール除外

## 技術スタック

| レイヤー | 技術 |
|---------|------|
| 言語 | Python 3.11+ |
| フレームワーク | FastAPI |
| データベース | SQLite |
| パッケージ管理 | Poetry |
| CLI | Click |
| Linter/Formatter | Ruff |
| テスト | pytest |
| デプロイ | Docker (optional) |

## セットアップ

### 前提条件

- Python 3.11以上
- Poetry ([インストール方法](https://python-poetry.org/docs/#installation))
- Google Cloud Console プロジェクト（Gmail API有効化済み）

### 1. 依存パッケージのインストール

```bash
poetry install
```

### 2. 環境変数の設定

```bash
cp .env.example .env
# .env ファイルを編集して必要な値を設定
```

### 3. Gmail API認証

```bash
# credentials.jsonをGoogle Cloud Consoleからダウンロードし、credentials/に配置
poetry run python scripts/setup_oauth.py
```

### 4. データベース初期化

```bash
poetry run python -m app.database.init_db
```

## 使い方

### Gmail同期（最新のカード通知を取得）

```bash
poetry run card-tracker sync
```

### 月次集計表示

```bash
poetry run card-tracker summary --month 2026-02
```

### 全コマンド一覧

```bash
poetry run card-tracker --help
```

## Docker実行（オプション）

```bash
# イメージビルド
docker-compose build

# コンテナ起動
docker-compose up -d

# ログ確認
docker-compose logs -f
```

## プロジェクト構成

```
card-spending-tracker/
├── app/
│   ├── gmail/          # Gmail API関連
│   ├── models/         # データモデル
│   ├── database/       # DB接続管理
│   ├── services/       # ビジネスロジック
│   └── cli/            # CLIコマンド
├── data/               # SQLiteデータベース (gitignore)
├── credentials/        # OAuth認証情報 (gitignore)
├── tests/              # テストコード
└── scripts/            # ユーティリティスクリプト
```

## 開発

### テスト実行

```bash
poetry run pytest
```

### Linter実行

```bash
poetry run ruff check .
poetry run ruff format .
```

## ライセンス

MIT
