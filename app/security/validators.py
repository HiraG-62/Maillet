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


def validate_email_size(email_content: str, max_size_mb: int = 10) -> bool:
    """
    メールサイズ検証（DoS対策）

    Args:
        email_content: メール本文
        max_size_mb: 最大サイズ（MB）

    Returns:
        bool: サイズが上限以内ならTrue、超過ならFalse

    対応テストケース: T-SEC-019
    OWASP: A04:2021 安全でない設計
    """
    # バイト数を計算（UTF-8エンコーディング）
    size_bytes = len(email_content.encode('utf-8'))
    max_size_bytes = max_size_mb * 1024 * 1024

    return size_bytes <= max_size_bytes


def sanitize_error_message(error_message: str) -> str:
    """
    エラーメッセージのサニタイズ（機密情報漏洩対策）

    内部パス、認証情報等をエラーメッセージから除去

    Args:
        error_message: 元のエラーメッセージ

    Returns:
        str: サニタイズ済みエラーメッセージ

    対応テストケース: T-SEC-022
    OWASP: A09:2021 セキュリティログの失敗
    """
    # 絶対パスパターンを除去
    # /home/, /mnt/, /usr/, C:\ など
    sanitized = re.sub(
        r'(/home/[^\s]+|/mnt/[^\s]+|/usr/[^\s]+|C:\\[^\s]+|/var/[^\s]+)',
        '[REDACTED_PATH]',
        error_message
    )

    # 機密ディレクトリ名を除去
    sensitive_dirs = ['credentials', 'token', 'secrets', '.env', 'config']
    for dir_name in sensitive_dirs:
        sanitized = sanitized.replace(dir_name, '[REDACTED]')

    return sanitized
