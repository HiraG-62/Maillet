"""
セキュリティバリデーター

機密情報マスキング、入力検証
"""

import re


def mask_sensitive_data(message: str) -> str:
    """
    ログ出力用の機密情報マスキング

    OAuth トークン、APIキー、パスワード等をマスク処理

    Args:
        message: ログメッセージ

    Returns:
        str: マスク処理済みメッセージ

    対応テストケース: T-SEC-012
    OWASP: A09:2021 セキュリティログの失敗
    """
    # OAuth 2.0 トークンパターン（ya29.a0で始まるGoogle OAuth token）
    message = re.sub(
        r'ya29\.[a-zA-Z0-9_-]+',
        '***REDACTED_OAUTH_TOKEN***',
        message
    )

    # Bearer トークンパターン
    message = re.sub(
        r'Bearer\s+[a-zA-Z0-9_\-\.]+',
        'Bearer ***REDACTED***',
        message,
        flags=re.IGNORECASE
    )

    # APIキーパターン（一般的なパターン）
    message = re.sub(
        r'(api[_-]?key|apikey|api[_-]?secret)[\s=:]+[a-zA-Z0-9_\-]{20,}',
        r'\1=***REDACTED***',
        message,
        flags=re.IGNORECASE
    )

    # パスワードパターン
    message = re.sub(
        r'(password|passwd|pwd)[\s=:]+\S+',
        r'\1=***REDACTED***',
        message,
        flags=re.IGNORECASE
    )

    return message
