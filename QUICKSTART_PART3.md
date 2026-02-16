# QUICKSTART Part 3: Gmail API接続（オプション）

**このセクションはオプションです。** Gmail APIを使用してメール受信機能を有効化する場合のみ必要です。

---

## 1. credentials.json 取得方法

Gmail APIを使用するには、Google Cloud Console でOAuth 2.0認証情報を作成する必要があります。

### 1.1. Google Cloud Consoleでプロジェクト作成

1. [Google Cloud Console](https://console.cloud.google.com/) にアクセス
2. 画面上部の「プロジェクトを選択」→「新しいプロジェクト」をクリック
3. プロジェクト名を入力（例: `card-spending-tracker`）
4. 「作成」をクリック

### 1.2. Gmail API有効化

1. 左側メニューから「APIとサービス」→「ライブラリ」を選択
2. 検索バーで「Gmail API」を検索
3. 「Gmail API」を選択
4. 「有効にする」ボタンをクリック

### 1.3. OAuth 2.0 クライアントID作成

1. 左側メニューから「APIとサービス」→「認証情報」を選択
2. 「認証情報を作成」→「OAuthクライアントID」をクリック
3. 初回の場合、「OAuth同意画面を構成」をクリック
   - ユーザータイプ: **外部** を選択
   - アプリ名、ユーザーサポートメール、デベロッパーの連絡先を入力
   - スコープは設定不要（後でコードで指定）
   - テストユーザーに自分のGmailアドレスを追加
4. OAuth同意画面の設定完了後、再度「認証情報を作成」→「OAuthクライアントID」を選択
5. アプリケーションの種類: **デスクトップアプリ**
6. 名前を入力（例: `card-tracker-desktop`）
7. 「作成」をクリック

### 1.4. credentials.json ダウンロード

1. 作成したクライアントIDの右側にある「ダウンロード」アイコン（↓）をクリック
2. JSONファイルがダウンロードされる
3. ファイル名を `credentials.json` にリネーム

---

## 2. 配置場所と設定

### 2.1. credentials.json の配置

ダウンロードした `credentials.json` を以下の場所に配置します:

```bash
# プロジェクトルートからの配置先
/mnt/e/dev/card-spending-tracker/credentials/credentials.json
```

**セキュリティ注意:**
- `credentials.json` は機密情報です
- Git管理対象外です（`.gitignore`で除外済み）
- 公開リポジトリにpushしないよう注意してください

### 2.2. 暗号化キーの生成と設定

トークンファイルの暗号化に使用する32バイトのキーを生成します:

```bash
# Fernetキー生成（Pythonを使用）
python3 -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
```

出力例:
```
dGhpcyBpcyBhIDMyLWJ5dGUga2V5IGZvciBGZXJuZXQ=
```

生成されたキーを環境変数に設定:

```bash
# .bashrc または .zshrc に追加（永続化）
export TOKEN_ENCRYPTION_KEY="dGhpcyBpcyBhIDMyLWJ5dGUga2V5IGZvciBGZXJuZXQ="

# または一時的に設定（現在のシェルセッションのみ）
export TOKEN_ENCRYPTION_KEY="dGhpcyBpcyBhIDMyLWJ5dGUga2V5IGZvciBGZXJuZXQ="
```

**注意:**
- キーは32バイト以上のBase64エンコード文字列である必要があります
- 本番環境では安全な場所に保管してください（例: AWS Secrets Manager, HashiCorp Vault）

---

## 3. 初回認証フロー

### 3.1. Docker環境での認証実行

```bash
# Dockerコンテナ起動（インタラクティブモード）
docker run --rm -it \
  -v /mnt/e/dev/card-spending-tracker:/app \
  -e TOKEN_ENCRYPTION_KEY="your-generated-key-here" \
  -p 8080:8080 \
  -w /app \
  python:3.11-slim bash

# コンテナ内で依存関係をインストール
pip install google-auth-oauthlib google-auth-httplib2 google-api-python-client cryptography

# 認証スクリプト実行
python3 -c "
from app.gmail.auth import authenticate
creds = authenticate()
print('✓ 認証成功！トークンが credentials/token.pickle に保存されました。')
"
```

### 3.2. 認証フローの動作

1. ブラウザが自動的に開きます（またはURLが表示されます）
2. Googleアカウントにログイン
3. アプリケーションの権限リクエストを承認
   - スコープ: `https://www.googleapis.com/auth/gmail.readonly`（読み取り専用）
4. 「このアプリは確認されていません」という警告が表示される場合:
   - 「詳細」→「card-spending-tracker（安全ではないページ）に移動」をクリック
   - これはテストユーザー認証の正常な動作です
5. 承認後、自動的にトークンが暗号化保存されます

### 3.3. ローカル環境での認証（WSL2の場合）

WSL2環境では、ブラウザの自動起動が動作しないことがあります。その場合:

```bash
# WSL2ターミナルで実行
cd /mnt/e/dev/card-spending-tracker
export TOKEN_ENCRYPTION_KEY="your-generated-key-here"
python3 -c "from app.gmail.auth import authenticate; authenticate()"
```

エラーが発生した場合、表示されたURLを手動でブラウザにコピー&ペーストしてください。

---

## 4. トラブルシューティング

### 4.1. エラー: "credentials.json not found"

**原因:** `credentials.json` が指定された場所に存在しない

**対処法:**
```bash
# ファイルの存在確認
ls -la /mnt/e/dev/card-spending-tracker/credentials/credentials.json

# ない場合は再度ダウンロードして配置
# credentials/ ディレクトリがない場合は作成
mkdir -p /mnt/e/dev/card-spending-tracker/credentials
```

### 4.2. エラー: "TOKEN_ENCRYPTION_KEY environment variable is not set"

**原因:** 環境変数 `TOKEN_ENCRYPTION_KEY` が未設定

**対処法:**
```bash
# 環境変数が設定されているか確認
echo $TOKEN_ENCRYPTION_KEY

# 未設定の場合、再度キーを生成して設定
export TOKEN_ENCRYPTION_KEY="$(python3 -c 'from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())')"
```

### 4.3. エラー: "Invalid grant" または "Token has been expired or revoked"

**原因:**
- OAuthトークンが失効している
- Google Cloud Console側でクライアントIDが削除/無効化された
- 90日以上未使用でトークンが無効化された（テストユーザーの場合）

**対処法:**
```bash
# 古いトークンファイルを削除
rm /mnt/e/dev/card-spending-tracker/credentials/token.pickle

# 再度認証フローを実行
python3 -c "from app.gmail.auth import authenticate; authenticate()"
```

### 4.4. エラー: トークンファイル破損 "Unable to decrypt token"

**原因:**
- `TOKEN_ENCRYPTION_KEY` が変更された
- トークンファイルが手動編集された
- ファイルシステムエラーでデータが破損

**対処法:**
```bash
# 破損したトークンを削除
rm /mnt/e/dev/card-spending-tracker/credentials/token.pickle

# 正しい TOKEN_ENCRYPTION_KEY を設定して再認証
export TOKEN_ENCRYPTION_KEY="correct-key-here"
python3 -c "from app.gmail.auth import authenticate; authenticate()"
```

### 4.5. 警告: "このアプリは確認されていません"

**原因:** Google Cloud ConsoleでOAuth同意画面が「公開」ステータスになっていない

**対処法（本番移行前）:**
- これは正常な動作です（テスト段階）
- 「詳細」→「安全ではないページに移動」で続行可能

**対処法（本番公開時）:**
1. Google Cloud Consoleで「OAuth同意画面」を選択
2. 「アプリを公開」ボタンをクリック
3. Googleの審査プロセスを経て承認される必要があります

---

## 5. 認証後の動作確認

認証が成功したら、以下のスクリプトでGmailからメール取得をテストできます:

```python
from app.gmail.auth import authenticate
from googleapiclient.discovery import build

# 認証
creds = authenticate()

# Gmail APIサービス構築
service = build('gmail', 'v1', credentials=creds)

# 最新5件のメッセージIDを取得
results = service.users().messages().list(userId='me', maxResults=5).execute()
messages = results.get('messages', [])

if not messages:
    print('メッセージが見つかりません。')
else:
    print(f'{len(messages)} 件のメッセージを取得しました:')
    for msg in messages:
        print(f'  - Message ID: {msg["id"]}')
```

---

## 6. セキュリティのベストプラクティス

1. **機密情報の管理:**
   - `credentials.json` と `token.pickle` をバージョン管理に含めない
   - `.gitignore` に以下を追加済み:
     ```
     credentials/credentials.json
     credentials/token.pickle
     ```

2. **環境変数の保護:**
   - `TOKEN_ENCRYPTION_KEY` をコードにハードコードしない
   - 本番環境ではシークレット管理サービスを使用

3. **スコープの最小化:**
   - 現在のスコープ: `gmail.readonly`（読み取り専用）
   - メール送信や削除は不可能な設計

4. **定期的なトークンリフレッシュ:**
   - トークンは自動的にリフレッシュされます
   - リフレッシュトークンが失効した場合のみ再認証が必要

---

## 次のステップ

Gmail API接続が完了したら、以下の機能を実装できます:

- メール受信の自動監視
- 特定の送信者（カード会社）からのメールフィルタリング
- メール本文のパース処理
- データベースへの支出記録保存

詳細は `docs/design_document.md` の「Phase 2: Gmail API統合」セクションを参照してください。
