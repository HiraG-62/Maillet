# QUICKSTART Part 2: 個別モジュール動作確認

## 概要

このガイドでは、Card Spending Trackerの各モジュールをPython REPLで個別に確認できます。
環境構築不要で、Dockerコンテナ内でサクッと動作確認できます。

---

## 1. パーサー基礎機能（app/gmail/parser.py）

メール解析の中核となる2つの関数を確認します。

### Docker環境でPython起動

```bash
cd /mnt/e/dev/card-spending-tracker
docker run --rm -v /mnt/e/dev/card-spending-tracker:/app -w /app python:3.11-slim python3
```

### パーサーデモ

```python
# モジュールのインポート
>>> import sys
>>> sys.path.insert(0, '/app')
>>> from app.gmail.parser import is_trusted_domain, detect_card_company

# Test 1: 信頼ドメイン検証（正当なメール）
>>> is_trusted_domain('noreply@contact.vpass.ne.jp', '三井住友')
True

# Test 2: 信頼ドメイン検証（フィッシングメール）
>>> is_trusted_domain('fake@phishing.com', '三井住友')
False

# Test 3: カード会社判別（JCBカード）
>>> detect_card_company('JCBカードご利用のお知らせ', '')
'JCB'

# Test 4: カード会社判別（楽天カード）
>>> detect_card_company('楽天カードご利用のお知らせ', '')
'楽天'

# Test 5: カード会社判別（判別不能）
>>> detect_card_company('重要なお知らせ', '')
None
```

### 期待される出力

- **is_trusted_domain**: 正当なメールは `True`、フィッシングメールは `False`
- **detect_card_company**: 件名にキーワードが含まれていればカード会社名、判別不能なら `None`

### 信頼ドメイン一覧（現在の対応状況）

| カード会社 | 信頼ドメイン |
|-----------|-------------|
| 三井住友 | contact.vpass.ne.jp |
| JCB | qa.jcb.co.jp |
| 楽天 | mail.rakuten-card.co.jp, mkrm.rakuten.co.jp, bounce.rakuten-card.co.jp |
| AMEX | aexp.com, americanexpress.com, americanexpress.jp, email.americanexpress.com |

**注意**: セゾンカードは公式メール通知なし（全てフィッシング扱い）。

---

## 2. データベースCRUD（app/models/transaction.py）

### SQLAlchemyモデル構造

CardTransactionモデルは以下のカラムで構成されています：

```python
class CardTransaction(Base):
    __tablename__ = "card_transactions"

    id = Column(Integer, primary_key=True, autoincrement=True)
    card_company = Column(String, nullable=False)          # カード会社名
    amount = Column(Integer, nullable=False)                # 利用金額（円）
    transaction_date = Column(DateTime, nullable=False)     # 取引日時
    merchant = Column(String, nullable=True)                # 店舗名
    email_subject = Column(String, nullable=False)          # メール件名
    email_from = Column(String, nullable=False)             # 送信元アドレス
    gmail_message_id = Column(String, nullable=False, unique=True)  # Gmail ID
    is_verified = Column(Boolean, default=False)            # 手動検証フラグ
    created_at = Column(DateTime, default=datetime.utcnow)  # 登録日時
```

### トランザクション登録の基本的な流れ

```python
from app.models.transaction import CardTransaction
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from datetime import datetime

# 1. データベース接続
engine = create_engine('sqlite:///data/transactions.db')
Session = sessionmaker(bind=engine)
session = Session()

# 2. トランザクション作成
transaction = CardTransaction(
    card_company="三井住友",
    amount=1500,
    transaction_date=datetime.now(),
    merchant="セブンイレブン",
    email_subject="【三井住友カード】ご利用のお知らせ",
    email_from="noreply@contact.vpass.ne.jp",
    gmail_message_id="msg_unique_id_12345"
)

# 3. データベースに保存
session.add(transaction)
session.commit()
```

### UNIQUE制約の動作

**gmail_message_id にUNIQUE制約が設定されています。**

```python
__table_args__ = (
    UniqueConstraint("gmail_message_id", name="uq_gmail_message_id"),
)
```

これにより、同じGmailメッセージIDを持つトランザクションは重複登録されません。
2回目の登録時には `IntegrityError` が発生し、重複チェックが機能します。

**テストでの確認結果:**
- テストケース `T-DB-003` で重複登録が正しくエラーとなることを確認済み
- 詳細は `tests/test_models.py` の `test_duplicate_gmail_message_id` を参照

---

## 3. OAuth認証層（app/gmail/auth.py）

### トークン暗号化保存の仕組み

Gmail API認証では、OAuth 2.0トークンを暗号化して保存します：

```python
# トークン保存時
def _save_encrypted_token(creds, token_path: str):
    encryption_key = os.getenv("TOKEN_ENCRYPTION_KEY")  # 環境変数から暗号化キーを取得
    fernet = Fernet(encryption_key.encode())            # Fernetオブジェクト作成

    serialized_creds = pickle.dumps(creds)              # 資格情報をシリアライズ
    encrypted_data = fernet.encrypt(serialized_creds)   # 暗号化

    with open(token_path, "wb") as token_file:
        token_file.write(encrypted_data)                # 暗号化データを保存
```

**セキュリティポイント:**
- トークンは平文で保存されない（`cryptography.fernet` による暗号化）
- 暗号化キーは環境変数 `TOKEN_ENCRYPTION_KEY` で管理
- `.gitignore` でトークンファイルは除外済み

### 自動リフレッシュの動作

トークンの有効期限が切れた場合、自動的にリフレッシュされます：

```python
if creds and creds.expired and creds.refresh_token:
    try:
        creds.refresh(Request())  # 自動リフレッシュ
    except RefreshError:
        # リフレッシュ失敗時は再認証フローへフォールバック
        flow = InstalledAppFlow.from_client_secrets_file(credentials_path, SCOPES)
        creds = flow.run_local_server(port=0)
```

**動作フロー:**
1. 保存済みトークンを読み込む
2. トークンが期限切れか確認
3. リフレッシュトークンがあれば自動更新
4. リフレッシュ失敗時は再認証（ブラウザ起動）

### 実際の認証にはcredentials.json必要

**注意**: このモジュールを実際に動かすには、以下が必要です：

1. **Google Cloud Platformでの設定**
   - Gmail APIの有効化
   - OAuth 2.0クライアントIDの作成
   - `credentials.json` のダウンロード

2. **環境変数の設定**
   ```bash
   export TOKEN_ENCRYPTION_KEY=$(python3 -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())")
   ```

3. **credentials.jsonの配置**
   ```bash
   cp credentials.json credentials/credentials.json
   ```

詳細な認証設定手順は、**QUICKSTART Part 3**（次のフェーズ）で説明予定です。

---

## まとめ

- ✅ **パーサー**: Dockerで即座に動作確認可能
- ✅ **データベース**: SQLAlchemyモデル構造とUNIQUE制約を理解
- ✅ **OAuth**: トークン暗号化・自動リフレッシュの仕組みを把握

次のステップ（Part 3）では、実際のGmail API認証フローとエンドツーエンドの動作確認を行います。
