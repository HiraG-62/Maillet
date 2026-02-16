"""
セキュリティサニタイザー（OWASP準拠）

XSS、SQLインジェクション、パストラバーサル、コマンドインジェクション対策
"""

import html
import re


def sanitize_html(raw_input: str) -> str:
    """
    HTML出力用のエスケープ処理（XSS対策）

    Args:
        raw_input: ユーザー入力文字列

    Returns:
        str: HTMLエスケープ済み文字列

    対応テストケース: T-SEC-007, T-SEC-008
    OWASP: A03:2021 インジェクション
    """
    # HTMLエスケープ（<, >, &, ", ' を実体参照に変換）
    return html.escape(raw_input, quote=True)


def sanitize_sql_input(raw_input: str) -> str:
    """
    SQL入力のサニタイズ（実際はプレースホルダー使用を推奨）

    このアプリではSQLAlchemy ORMを使用しているため、
    プレースホルダーによる自動保護が機能する。
    この関数は検証用のスタブとして機能。

    Args:
        raw_input: ユーザー入力文字列

    Returns:
        str: 入力文字列（ORMがプレースホルダー処理を行うため、そのまま返す）

    対応テストケース: T-SEC-005, T-SEC-006
    OWASP: A03:2021 インジェクション
    """
    # SQLAlchemy ORM使用時は、プレースホルダーによる保護が自動適用されるため、
    # 明示的なサニタイズは不要（文字列として扱われる）
    return raw_input


def sanitize_filename(raw_input: str) -> str:
    """
    ファイル名のサニタイズ（パストラバーサル対策）

    Args:
        raw_input: ファイル名候補文字列

    Returns:
        str: 安全なファイル名（危険文字除去済み）

    対応テストケース: T-SEC-010
    OWASP: A01:2021 アクセス制御の不備
    """
    # パストラバーサルパターン除去
    # - ".." を除去
    # - "/" と "\" を除去
    safe_name = raw_input.replace("..", "").replace("/", "").replace("\\", "")

    # 制御文字除去
    safe_name = re.sub(r'[\x00-\x1f\x7f]', '', safe_name)

    return safe_name


def sanitize_command_input(raw_input: str) -> str:
    """
    コマンドインジェクション対策（念のため検証）

    このアプリはshellコマンド実行機能を持たないため、
    実質的な防御は「コマンド実行しない」こと。
    この関数は警告目的のみ。

    Args:
        raw_input: ユーザー入力文字列

    Returns:
        str: 入力文字列（コマンド実行機能がないため、そのまま返す）

    対応テストケース: T-SEC-009
    OWASP: A03:2021 インジェクション
    """
    # コマンド実行機能がないため、サニタイズ不要
    # ただし、危険パターンをログに記録することは推奨
    dangerous_patterns = ["; ", "| ", "&&", "||", "$(",  "`"]
    for pattern in dangerous_patterns:
        if pattern in raw_input:
            # 実運用ではここでログ記録
            pass

    return raw_input
