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

    # T-API-003: 有効なトークンの再利用
    @patch("app.gmail.auth.Fernet")
    @patch("app.gmail.auth.pickle.loads")
    @patch("app.gmail.auth.InstalledAppFlow")
    @patch("builtins.open", new_callable=mock_open, read_data=b"encrypted_token_data")
    @patch("os.path.exists")
    def test_reuse_valid_token(
        self, mock_exists, mock_file, mock_flow_class, mock_pickle_loads, mock_fernet_class, temp_credentials_json, temp_token_path, mock_credentials, encryption_key, monkeypatch
    ):
        """token.pickleが存在し、有効期限内の場合、再認証せずAPI呼び出しが成功"""
        # Arrange
        monkeypatch.setenv("TOKEN_ENCRYPTION_KEY", encryption_key)

        # token.pickleが存在する
        mock_exists.return_value = True

        # 有効なトークンをモック
        mock_credentials.valid = True
        mock_credentials.expired = False
        mock_pickle_loads.return_value = mock_credentials

        # Fernet復号化をモック
        mock_fernet = MagicMock()
        mock_fernet.decrypt.return_value = b"decrypted_pickle_data"
        mock_fernet_class.return_value = mock_fernet

        # Act
        from app.gmail.auth import authenticate

        creds = authenticate(
            credentials_path=temp_credentials_json,
            token_path=temp_token_path,
        )

        # Assert
        # 1. OAuthフローが呼ばれないこと（既存トークンを再利用）
        mock_flow_class.from_client_secrets_file.assert_not_called()

        # 2. トークンファイルから読み込まれたこと
        mock_file.assert_called()

        # 3. Fernet復号化が呼ばれたこと
        mock_fernet.decrypt.assert_called_once()

        # 4. pickle.loadsが呼ばれたこと
        mock_pickle_loads.assert_called_once()

        # 5. 有効な認証情報が返されたこと
        assert creds is not None
        assert creds.valid
        assert creds == mock_credentials

    # T-API-004: トークンの自動リフレッシュ
    @patch("app.gmail.auth.pickle.dumps")
    @patch("app.gmail.auth.Fernet")
    @patch("app.gmail.auth.pickle.loads")
    @patch("app.gmail.auth.Request")
    @patch("app.gmail.auth.InstalledAppFlow")
    @patch("builtins.open", new_callable=mock_open, read_data=b"encrypted_token_data")
    @patch("os.path.exists")
    def test_automatic_token_refresh(
        self, mock_exists, mock_file, mock_flow_class, mock_request_class, mock_pickle_loads, mock_fernet_class, mock_pickle_dumps, temp_credentials_json, temp_token_path, encryption_key, monkeypatch
    ):
        """アクセストークンが期限切れの場合、リフレッシュトークンで自動更新される"""
        # Arrange
        monkeypatch.setenv("TOKEN_ENCRYPTION_KEY", encryption_key)

        # token.pickleが存在する
        mock_exists.return_value = True

        # 期限切れのトークンをモック
        mock_creds = Mock()
        mock_creds.valid = False
        mock_creds.expired = True
        mock_creds.refresh_token = "mock_refresh_token"

        # refresh()呼び出し後はvalid=Trueにする
        def refresh_side_effect(request):
            mock_creds.valid = True

        mock_creds.refresh.side_effect = refresh_side_effect

        mock_pickle_loads.return_value = mock_creds

        # Fernet復号化をモック
        mock_fernet = MagicMock()
        mock_fernet.decrypt.return_value = b"decrypted_pickle_data"
        mock_fernet_class.return_value = mock_fernet

        # pickle.dumpsをモック
        mock_pickle_dumps.return_value = b"mock_serialized_data"

        # Request()をモック
        mock_request = Mock()
        mock_request_class.return_value = mock_request

        # Act
        from app.gmail.auth import authenticate

        creds = authenticate(
            credentials_path=temp_credentials_json,
            token_path=temp_token_path,
        )

        # Assert
        # 1. OAuthフローが呼ばれないこと（リフレッシュで対応）
        mock_flow_class.from_client_secrets_file.assert_not_called()

        # 2. refresh()が呼ばれたこと
        mock_creds.refresh.assert_called_once_with(mock_request)

        # 3. トークンが再保存されたこと
        mock_pickle_dumps.assert_called_once()

        # 4. リフレッシュ後の認証情報が返されたこと
        assert creds is not None
        assert creds.valid

    # T-API-005: リフレッシュトークン失効時の処理
    @patch("app.gmail.auth.pickle.dumps")
    @patch("app.gmail.auth.Fernet")
    @patch("app.gmail.auth.pickle.loads")
    @patch("app.gmail.auth.Request")
    @patch("app.gmail.auth.InstalledAppFlow")
    @patch("builtins.open", new_callable=mock_open, read_data=b"encrypted_token_data")
    @patch("os.path.exists")
    def test_refresh_error_fallback_to_oauth(
        self, mock_exists, mock_file, mock_flow_class, mock_request_class, mock_pickle_loads, mock_fernet_class, mock_pickle_dumps, temp_credentials_json, temp_token_path, encryption_key, monkeypatch
    ):
        """リフレッシュトークンが無効な場合、RefreshErrorが発生し、再認証フローにフォールバック"""
        # Arrange
        monkeypatch.setenv("TOKEN_ENCRYPTION_KEY", encryption_key)

        # token.pickleが存在する
        def exists_side_effect(path):
            if "token.pickle" in path:
                return True
            if "credentials.json" in path:
                return True
            return False

        mock_exists.side_effect = exists_side_effect

        # 期限切れのトークンをモック
        mock_expired_creds = Mock()
        mock_expired_creds.valid = False
        mock_expired_creds.expired = True
        mock_expired_creds.refresh_token = "invalid_refresh_token"

        # refresh()でRefreshError発生
        mock_expired_creds.refresh.side_effect = RefreshError("Invalid refresh token")

        mock_pickle_loads.return_value = mock_expired_creds

        # Fernet復号化をモック
        mock_fernet = MagicMock()
        mock_fernet.decrypt.return_value = b"decrypted_pickle_data"
        mock_fernet_class.return_value = mock_fernet

        # pickle.dumpsをモック
        mock_pickle_dumps.return_value = b"mock_serialized_data"

        # Request()をモック
        mock_request = Mock()
        mock_request_class.return_value = mock_request

        # 新しいOAuthフローのモック
        mock_flow = MagicMock()
        mock_new_creds = Mock()
        mock_new_creds.valid = True
        mock_flow.run_local_server.return_value = mock_new_creds
        mock_flow_class.from_client_secrets_file.return_value = mock_flow

        # Act
        from app.gmail.auth import authenticate

        creds = authenticate(
            credentials_path=temp_credentials_json,
            token_path=temp_token_path,
        )

        # Assert
        # 1. refresh()が試行されたこと
        mock_expired_creds.refresh.assert_called_once()

        # 2. RefreshErrorが捕捉され、OAuthフローにフォールバック
        mock_flow_class.from_client_secrets_file.assert_called_once()
        mock_flow.run_local_server.assert_called_once()

        # 3. 新しい認証情報が返されたこと
        assert creds is not None
        assert creds.valid
        assert creds == mock_new_creds

    # T-API-006: スコープ検証
    def test_correct_scope_used(self):
        """正しいスコープ（gmail.readonly）で認証されることを確認"""
        # Act
        from app.gmail.auth import SCOPES

        # Assert
        # 1. SCOPESが正しく定義されていること
        assert SCOPES is not None
        assert isinstance(SCOPES, list)
        assert len(SCOPES) == 1

        # 2. gmail.readonlyスコープが含まれていること
        assert "https://www.googleapis.com/auth/gmail.readonly" in SCOPES

        # 3. 余計なスコープが含まれていないこと（読み取り専用を保証）
        assert "https://www.googleapis.com/auth/gmail.modify" not in SCOPES
        assert "https://www.googleapis.com/auth/gmail.compose" not in SCOPES

    # T-API-007: 暗号化キー不正時のエラー
    @patch("app.gmail.auth.pickle.dumps")
    @patch("app.gmail.auth.InstalledAppFlow")
    @patch("builtins.open", new_callable=mock_open)
    @patch("os.path.exists")
    def test_missing_encryption_key_error(
        self, mock_exists, mock_file, mock_flow_class, mock_pickle_dumps, temp_credentials_json, temp_token_path, mock_credentials, monkeypatch
    ):
        """TOKEN_ENCRYPTION_KEYが未設定の場合、暗号化保存時にエラーが発生"""
        # Arrange
        # TOKEN_ENCRYPTION_KEYを削除（未設定状態）
        monkeypatch.delenv("TOKEN_ENCRYPTION_KEY", raising=False)

        # token.pickleは存在しない
        mock_exists.return_value = False

        # モックのOAuthフローを設定
        mock_flow = MagicMock()
        mock_flow.run_local_server.return_value = mock_credentials
        mock_flow_class.from_client_secrets_file.return_value = mock_flow

        # pickle.dumpsをモック
        mock_pickle_dumps.return_value = b"mock_serialized_data"

        # Act & Assert
        from app.gmail.auth import authenticate

        # TOKEN_ENCRYPTION_KEY未設定でEnvironmentErrorが発生すること
        with pytest.raises(EnvironmentError) as exc_info:
            authenticate(
                credentials_path=temp_credentials_json,
                token_path=temp_token_path,
            )

        # エラーメッセージが明示的であること
        assert "TOKEN_ENCRYPTION_KEY" in str(exc_info.value)

    # T-API-008: トークンファイル破損時の処理
    @patch("app.gmail.auth.pickle.dumps")
    @patch("app.gmail.auth.Fernet")
    @patch("app.gmail.auth.pickle.loads")
    @patch("app.gmail.auth.InstalledAppFlow")
    @patch("builtins.open", new_callable=mock_open, read_data=b"corrupted_invalid_data")
    @patch("os.path.exists")
    def test_corrupted_token_file_fallback(
        self, mock_exists, mock_file, mock_flow_class, mock_pickle_loads, mock_fernet_class, mock_pickle_dumps, temp_credentials_json, temp_token_path, mock_credentials, encryption_key, monkeypatch
    ):
        """token.pickleが破損している場合、エラーを捕捉してOAuthフローにフォールバック"""
        # Arrange
        monkeypatch.setenv("TOKEN_ENCRYPTION_KEY", encryption_key)

        # token.pickleが存在するが破損している
        def exists_side_effect(path):
            if "token.pickle" in path:
                return True
            if "credentials.json" in path:
                return True
            return False

        mock_exists.side_effect = exists_side_effect

        # Fernet復号化でエラー発生（破損データ）
        mock_fernet = MagicMock()
        mock_fernet.decrypt.side_effect = Exception("Invalid token")
        mock_fernet_class.return_value = mock_fernet

        # pickle.loadsもエラー発生させる（破損データ）
        mock_pickle_loads.side_effect = pickle.UnpicklingError("Corrupted pickle data")

        # 新しいOAuthフローのモック
        mock_flow = MagicMock()
        mock_new_creds = Mock()
        mock_new_creds.valid = True
        mock_flow.run_local_server.return_value = mock_new_creds
        mock_flow_class.from_client_secrets_file.return_value = mock_flow

        # pickle.dumpsをモック（新しいトークン保存用）
        mock_pickle_dumps.return_value = b"mock_serialized_data"

        # Act
        from app.gmail.auth import authenticate

        creds = authenticate(
            credentials_path=temp_credentials_json,
            token_path=temp_token_path,
        )

        # Assert
        # 1. OAuthフローにフォールバックしたこと
        mock_flow_class.from_client_secrets_file.assert_called_once()
        mock_flow.run_local_server.assert_called_once()

        # 2. 新しい認証情報が返されたこと
        assert creds is not None
        assert creds.valid
        assert creds == mock_new_creds

        # 3. 新しいトークンが保存されたこと
        mock_pickle_dumps.assert_called_once()
