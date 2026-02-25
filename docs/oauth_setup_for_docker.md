# Docker環境でのGmail OAuth認証セットアップ手順

## 前提条件

- Google Cloud Consoleでプロジェクト作成済み
- Gmail API有効化済み
- OAuth 2.0クライアントID（デスクトップアプリ）作成済み
- `credentials/credentials.json` 配置済み

## 手順1: Google Cloud ConsoleでリダイレクトURIを追加

1. [Google Cloud Console](https://console.cloud.google.com/) にアクセス
2. 左メニュー「APIとサービス」>「認証情報」を開く
3. 使用中のOAuth 2.0クライアントIDをクリック
4. 「承認済みのリダイレクトURI」セクションで「URIを追加」をクリック
5. 以下のURIを追加:
   ```
   http://localhost:8000/auth/callback
   ```
6. 「保存」をクリック

> **注意**: localhostの場合、HTTPでも許可されます（Google側の特例）。

## 手順2: Docker環境を起動

```bash
docker-compose up -d
```

## 手順3: ブラウザでGmail認証を実行

1. ブラウザで以下のURLにアクセス:
   ```
   http://localhost:8000/auth/start
   ```
2. Googleアカウント選択画面が表示される
3. 使用するGmailアカウントを選択
4. 「許可」をクリック（Gmail読み取り権限）
5. 自動的にダッシュボード（`http://localhost:8000/?auth=success`）へリダイレクト

## 手順4: 認証確認

- ダッシュボードの「Gmail同期」セクションに「Gmail: 認証済み」と表示されれば成功
- 「Gmail同期」ボタンをクリックしてメール同期をテスト

## トラブルシューティング

### 「認証エラー: 不正なリクエスト」と表示される
- ブラウザのCookieが無効になっている可能性があります
- ブラウザのCookieを有効にして再度 `/auth/start` にアクセスしてください

### 「redirect_uri_mismatch」エラー
- 手順1のリダイレクトURIが正しく設定されているか確認してください
- URIは完全一致が必要です: `http://localhost:8000/auth/callback`

### トークン期限切れ
- access_tokenは通常1時間で期限切れになります
- refresh_tokenが有効な場合、自動更新されます
- refresh_tokenも無効な場合、再度 `/auth/start` で認証してください
