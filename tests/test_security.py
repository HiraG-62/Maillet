"""
Phase 3: セキュリティテスト（OWASP Top 10準拠）

担当: Ashigaru 8
タスクID: subtask_010e

OWASP Top 10 2021カバレッジ:
- A01:2021 アクセス制御の不備 (2件)
- A02:2021 暗号化の失敗 (3件)
- A03:2021 インジェクション (5件)
- A04:2021 安全でない設計 (4件)
- A05:2021 セキュリティ設定ミス (2件)
- A06:2021 脆弱な古いコンポーネント (1件)
- A07:2021 認証の失敗 (6件)
- A09:2021 セキュリティログの失敗 (2件)
"""

import os
import pytest
from pathlib import Path


# ========================================
# T-SEC-011: token.pickle暗号化検証
# ========================================
def test_sec_011_token_encryption():
    """
    T-SEC-011: token.pickleファイルが暗号化されている
    OWASP: A02:2021 暗号化の失敗
    優先度: Critical
    """
    from app.gmail.auth import _save_encrypted_token, _load_encrypted_token
    from cryptography.fernet import Fernet
    import tempfile
    from unittest.mock import Mock

    # 暗号化キーを生成
    encryption_key = Fernet.generate_key()
    os.environ["TOKEN_ENCRYPTION_KEY"] = encryption_key.decode()

    # モック資格情報を作成
    mock_creds = Mock()
    mock_creds.token = "test_access_token"
    mock_creds.refresh_token = "test_refresh_token"

    # 一時ファイルに暗号化保存
    with tempfile.NamedTemporaryFile(delete=False, suffix=".pickle") as tmp:
        token_path = tmp.name

    try:
        _save_encrypted_token(mock_creds, token_path)

        # ファイルが存在することを確認
        assert os.path.exists(token_path), "Token file should exist"

        # ファイル内容を読み込み、平文ではないことを確認
        with open(token_path, "rb") as f:
            encrypted_data = f.read()

        # 平文文字列（"test_access_token"）が含まれていないことを確認
        assert b"test_access_token" not in encrypted_data, "Token should be encrypted"
        assert b"test_refresh_token" not in encrypted_data, "Refresh token should be encrypted"

        # 復号化できることを確認
        loaded_creds = _load_encrypted_token(token_path)
        assert loaded_creds.token == "test_access_token", "Decrypted token should match"
        assert loaded_creds.refresh_token == "test_refresh_token", "Decrypted refresh token should match"

    finally:
        # クリーンアップ
        if os.path.exists(token_path):
            os.remove(token_path)
        del os.environ["TOKEN_ENCRYPTION_KEY"]


# ========================================
# T-SEC-013: credentials.jsonが.gitignore対象
# ========================================
def test_sec_013_gitignore_credentials():
    """
    T-SEC-013: credentials.jsonが.gitignore対象外
    OWASP: A05:2021 セキュリティ設定ミス
    優先度: Critical
    """
    gitignore_path = Path("/mnt/e/dev/card-spending-tracker/.gitignore")
    assert gitignore_path.exists(), ".gitignore file should exist"

    gitignore_content = gitignore_path.read_text()

    # credentials/*.json が含まれているか確認
    assert "credentials/*.json" in gitignore_content or "credentials/" in gitignore_content, \
        "credentials.json should be in .gitignore"

    # token.pickle も含まれているか確認
    assert "credentials/*.pickle" in gitignore_content or "token.pickle" in gitignore_content, \
        "token.pickle should be in .gitignore"
