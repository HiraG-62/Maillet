"""
Gmail API OAuth認証層のテスト（TDD Phase 1）
テストケース: T-API-001 ~ T-API-008
"""

import os
import pickle
from pathlib import Path
from unittest.mock import Mock, MagicMock, patch, mock_open

import pytest
from cryptography.fernet import Fernet
from google.auth.transport.requests import Request
from google.auth.exceptions import RefreshError
from google_auth_oauthlib.flow import InstalledAppFlow


class TestOAuthAuthentication:
    """OAuth 2.0認証フローのテストスイート"""

    @pytest.fixture
    def mock_credentials(self):
        """モックCredentialsオブジェクト"""
        mock_creds = Mock()
        mock_creds.valid = True
        mock_creds.expired = False
        mock_creds.refresh_token = "mock_refresh_token"
        mock_creds.token = "mock_access_token"
        mock_creds.scopes = ["https://www.googleapis.com/auth/gmail.readonly"]
        return mock_creds

    @pytest.fixture
    def temp_credentials_json(self, tmp_path):
        """一時的なcredentials.jsonファイル"""
        creds_file = tmp_path / "credentials.json"
        creds_file.write_text('{"installed": {"client_id": "test", "client_secret": "test"}}')
        return str(creds_file)

    @pytest.fixture
    def temp_token_path(self, tmp_path):
        """一時的なtoken.pickleパス"""
        return str(tmp_path / "token.pickle")

    @pytest.fixture
    def encryption_key(self):
        """テスト用暗号化キー"""
        return Fernet.generate_key().decode()

    # T-API-001: 初回OAuth認証フロー
    @patch("app.gmail.auth.pickle.dumps")
    @patch("app.gmail.auth.InstalledAppFlow")
    @patch("builtins.open", new_callable=mock_open)
    @patch("os.path.exists")
    def test_initial_oauth_flow(
        self, mock_exists, mock_file, mock_flow_class, mock_pickle_dumps, temp_credentials_json, temp_token_path, mock_credentials, encryption_key, monkeypatch
    ):
        """credentials.jsonのみ存在、token.pickleが存在しない状態で認証実行"""
        # Arrange
        monkeypatch.setenv("TOKEN_ENCRYPTION_KEY", encryption_key)

        # token.pickleは存在しない、credentials.jsonは存在する
        def exists_side_effect(path):
            if "token.pickle" in path:
                return False
            if "credentials.json" in path:
                return True
            return False

        mock_exists.side_effect = exists_side_effect

        # モックのOAuthフローを設定
        mock_flow = MagicMock()
        mock_flow.run_local_server.return_value = mock_credentials
        mock_flow_class.from_client_secrets_file.return_value = mock_flow

        # pickle.dumpsをモック（シリアライズ問題を回避）
        mock_pickle_dumps.return_value = b"mock_serialized_data"

        # Act
        from app.gmail.auth import authenticate

        creds = authenticate(
            credentials_path=temp_credentials_json,
            token_path=temp_token_path,
        )

        # Assert
        # 1. OAuthフローが呼ばれたこと
        mock_flow_class.from_client_secrets_file.assert_called_once_with(
            temp_credentials_json,
            ["https://www.googleapis.com/auth/gmail.readonly"],
        )
        mock_flow.run_local_server.assert_called_once_with(port=0)

        # 2. トークンファイルが保存されたこと（暗号化されて）
        mock_file.assert_called()
        mock_pickle_dumps.assert_called_once_with(mock_credentials)

        # 3. 認証情報が返されたこと
        assert creds is not None
        assert creds.valid

    # T-API-002: トークンの暗号化保存
    @patch("app.gmail.auth.pickle.dumps")
    def test_token_encryption_on_save(self, mock_pickle_dumps, temp_credentials_json, temp_token_path, encryption_key, monkeypatch, mock_credentials):
        """認証成功時にtoken.pickleが暗号化されて保存される"""
        # Arrange
        monkeypatch.setenv("TOKEN_ENCRYPTION_KEY", encryption_key)

        # pickle.dumpsの戻り値をモック
        mock_serialized_data = b"mock_credential_data"
        mock_pickle_dumps.return_value = mock_serialized_data

        # Act: _save_encrypted_tokenを直接テスト
        from app.gmail.auth import _save_encrypted_token

        _save_encrypted_token(mock_credentials, temp_token_path)

        # Assert
        # 1. pickle.dumpsが呼ばれたこと
        mock_pickle_dumps.assert_called_once_with(mock_credentials)

        # 2. トークンファイルが作成されたこと
        assert os.path.exists(temp_token_path)

        # 3. ファイルが暗号化されていること
        with open(temp_token_path, "rb") as f:
            encrypted_data = f.read()

        # Fernetで復号化できること
        fernet = Fernet(encryption_key.encode())
        decrypted_data = fernet.decrypt(encrypted_data)

        # 復号化されたデータが元のシリアライズデータと一致すること
        assert decrypted_data == mock_serialized_data

        # 4. 生データとして直接読めないこと（暗号化されている）
        assert encrypted_data != mock_serialized_data
