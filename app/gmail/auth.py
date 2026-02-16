"""
Gmail API OAuth 2.0 認証モジュール
"""

import os
import pickle
from pathlib import Path

from cryptography.fernet import Fernet
from google.auth.transport.requests import Request
from google_auth_oauthlib.flow import InstalledAppFlow

# Gmail APIのスコープ（読み取り専用）
SCOPES = ["https://www.googleapis.com/auth/gmail.readonly"]


def authenticate(
    credentials_path: str = "credentials/credentials.json",
    token_path: str = "credentials/token.pickle",
):
    """
    Gmail API OAuth 2.0認証を実行

    Args:
        credentials_path: OAuth クライアントシークレットファイルのパス
        token_path: 保存済みトークンファイルのパス

    Returns:
        google.oauth2.credentials.Credentials: 認証済みの資格情報

    Raises:
        EnvironmentError: TOKEN_ENCRYPTION_KEY環境変数が未設定の場合
    """
    creds = None

    # 保存済みトークンが存在する場合は読み込む
    if os.path.exists(token_path):
        creds = _load_encrypted_token(token_path)

    # 有効な資格情報がない場合は認証フローを実行
    if not creds or not creds.valid:
        if creds and creds.expired and creds.refresh_token:
            # トークンの自動リフレッシュ
            creds.refresh(Request())
        else:
            # 初回OAuth認証フロー
            flow = InstalledAppFlow.from_client_secrets_file(credentials_path, SCOPES)
            creds = flow.run_local_server(port=0)

        # トークンを暗号化して保存
        _save_encrypted_token(creds, token_path)

    return creds


def _load_encrypted_token(token_path: str):
    """
    暗号化されたトークンファイルを読み込む

    Args:
        token_path: トークンファイルのパス

    Returns:
        google.oauth2.credentials.Credentials: 復号化された資格情報
    """
    encryption_key = os.getenv("TOKEN_ENCRYPTION_KEY")
    if not encryption_key:
        raise EnvironmentError("TOKEN_ENCRYPTION_KEY environment variable is not set")

    fernet = Fernet(encryption_key.encode())

    with open(token_path, "rb") as token_file:
        encrypted_data = token_file.read()
        decrypted_data = fernet.decrypt(encrypted_data)
        creds = pickle.loads(decrypted_data)

    return creds


def _save_encrypted_token(creds, token_path: str):
    """
    トークンを暗号化して保存

    Args:
        creds: 保存する資格情報
        token_path: 保存先パス

    Raises:
        EnvironmentError: TOKEN_ENCRYPTION_KEY環境変数が未設定の場合
    """
    encryption_key = os.getenv("TOKEN_ENCRYPTION_KEY")
    if not encryption_key:
        raise EnvironmentError("TOKEN_ENCRYPTION_KEY environment variable is not set")

    fernet = Fernet(encryption_key.encode())

    # 資格情報をシリアライズして暗号化
    serialized_creds = pickle.dumps(creds)
    encrypted_data = fernet.encrypt(serialized_creds)

    # 暗号化データをファイルに保存
    Path(token_path).parent.mkdir(parents=True, exist_ok=True)
    with open(token_path, "wb") as token_file:
        token_file.write(encrypted_data)
