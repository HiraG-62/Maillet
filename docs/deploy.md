# Fly.io デプロイ手順書

**対象読者**: 殿（アプリオーナー）
**参照設計書**: `docs/privacy_architecture.md`（プライバシーファーストSaaS設計）
**作成日**: 2026-02-21
**更新**: ステートレスデプロイ版（Phase B）

---

## アーキテクチャ方針（2026-02-21 v2確定）

このアプリは **プライバシーファーストSaaS** 型アーキテクチャを採用します：

- **サーバー（Fly.io）**: ステートレス。UIテンプレート・静的アセット・APIロジックを配信
- **データ**: ユーザーのブラウザ側に保存（IndexedDB/OPFS — Phase C実装予定）
- **サーバーにデータなし**: SQLiteファイル・OAuthトークン・APIキーはサーバーに置かない
- **Litestream不要**: サーバーにデータベースを持たないため、バックアップインフラは不要

---

## 前提条件

- flyctl（Fly.io CLI）がインストール済みであること
- Fly.io アカウントを持っていること

---

## flyctl のインストール（未インストールの場合）

```bash
# Linux / macOS
curl -L https://fly.io/install.sh | sh

# インストール確認
fly version
```

---

## 初回デプロイ手順

### Step 1: ログイン

```bash
fly auth login
```

ブラウザが開きます。Fly.io アカウントでログインしてください。

---

### Step 2: アプリ作成

```bash
# fly.toml が存在するディレクトリで実行
cd /path/to/card-spending-tracker

fly launch --no-deploy
```

> **注意**: アプリ名の変更を求められた場合は、`card-spending-tracker` を希望の名前に変更できます。
> 変更後は `fly.toml` の `app = "..."` も同じ名前に更新してください。

---

### Step 3: シークレット設定

必要なシークレットを設定します。Phase C（クライアントサイドDB実装）までの暫定設定です：

```bash
# アプリ認証（UI PIN、オプション）
fly secrets set APP_PIN="0000"   # 4〜8桁のPINに変更
fly secrets set SESSION_SECRET="$(openssl rand -hex 32)"

# Gmail OAuth（Google Cloud Console から取得）
# ※ GOOGLE_CLIENT_SECRET は不要（PKCE フロー採用）
fly secrets set GOOGLE_CLIENT_ID="YOUR_CLIENT_ID.apps.googleusercontent.com"

# トークン暗号化キー（Phase Cで廃止予定。現在はサーバー側で使用）
python3 -c 'from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())'
fly secrets set TOKEN_ENCRYPTION_KEY="（上記で生成した値）"
```

設定確認:

```bash
fly secrets list
```

**注意**: Phase C実装後はTOKEN_ENCRYPTION_KEYは廃止予定です（クライアントサイドBYOKに移行）。

---

### Step 4: 初回デプロイ

```bash
fly deploy
```

初回は Docker イメージのビルドに数分かかります。ステートレス設計のため、追加の初期化ステップは不要です。

---

### Step 5: 動作確認

```bash
# アプリを開く
fly open

# ログ確認
fly logs

# ステータス確認
fly status

# ヘルスチェック
curl https://card-spending-tracker.fly.dev/health
```

---

## 以降のデプロイ（自動）

`main` ブランチへの push で自動デプロイされます（`.github/workflows/deploy.yml` 参照）。

GitHub Secrets に以下を設定してください:

| Secret 名 | 取得方法 |
|-----------|---------|
| `FLY_API_TOKEN` | `fly tokens create deploy -x 999999h` |
| `NTFY_TOPIC` | 任意の文字列（ntfy トピック名） |

---

## ロールバック

```bash
# リリース一覧確認
fly releases

# 特定バージョンに戻す
fly deploy --image registry.fly.io/card-spending-tracker:v<N>
```

---

## コスト目安

| 項目 | 月額 |
|------|------|
| Fly.io Machines（auto_stop=true） | $0〜$5 |
| **合計** | **ほぼ $0〜$5** |

ステートレス設計により、Fly.io Volume やバックアップインフラは不要です。`auto_stop_machines = true` の設定により、アクセスがない時間帯はマシンが自動停止します。個人利用であれば実質無料枠内で運用可能です。

---

## トラブルシューティング

### デプロイが失敗する場合

```bash
fly logs       # エラーログ確認
fly doctor     # 環境診断
```

### アプリが起動しない場合

```bash
fly ssh console   # コンテナにSSH接続
fly logs --tail   # リアルタイムログ
```

---

## 将来計画（Phase C）

Phase C 実装時の予定：
- ブラウザ側 IndexedDB/SQLite WASM でのクライアントサイドDB移行
- フロントエンドOAuth（PKCE）の完全実装
- サーバー側テーブル廃止（サーバー完全ステートレス化）

詳細は `docs/privacy_architecture.md` を参照してください。

---

*作成: 足軽1号 | subtask_035b | cmd_035 | 2026-02-20*
*更新: 足軽5号 | subtask_046e | cmd_046 | 2026-02-21*
