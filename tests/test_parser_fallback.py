"""
汎用パターン（フォールバック）テスト

担当: Ashigaru 3
タスクID: subtask_010c
Phase: 3 (汎用パターン対応)

対象テストケース:
- T-PARSE-080〜082: 汎用金額抽出
- T-PARSE-120〜122: 汎用日時抽出
- T-PARSE-160〜161: 汎用店舗名抽出
"""

import pytest
from datetime import datetime
from app.gmail.parser import (
    extract_amount,
    extract_transaction_date,
    # extract_merchant will be created
)


# ===== 汎用金額抽出テスト =====

def test_parse_080_generic_amount_pattern1():
    """
    T-PARSE-080: 汎用金額抽出(パターン1)
    不明カード会社のメールから「ご利用金額: 6,700円」形式で抽出
    """
    email_body = """
    ご利用ありがとうございます。
    ご利用金額: 6,700円
    ご確認ください。
    """

    # 不明カード会社（"unknown"として扱う）
    result = extract_amount(email_body, "unknown")

    assert result == 6700, f"Expected 6700, got {result}"


def test_parse_081_generic_amount_pattern2():
    """
    T-PARSE-081: 汎用金額抽出(パターン2)
    「XXX円形式: 4,200円」のような汎用パターン
    """
    email_body = """
    カード利用のお知らせ
    お支払い金額: 4,200円
    ありがとうございました。
    """

    result = extract_amount(email_body, "unknown")

    assert result == 4200, f"Expected 4200, got {result}"


def test_parse_082_amount_extraction_failure():
    """
    T-PARSE-082: 金額抽出失敗ケース
    金額情報が全く含まれていないメール
    """
    email_body = """
    カードご利用のお知らせ

    詳細はWebサイトでご確認ください。
    """

    result = extract_amount(email_body, "unknown")

    assert result is None, f"Expected None, got {result}"


# ===== 汎用日時抽出テスト =====

def test_parse_120_generic_datetime_iso():
    """
    T-PARSE-120: 汎用日時抽出(ISO形式)
    「2026-02-15 14:30」形式（ハイフン区切り）
    """
    email_body = """
    ご利用日時: 2026-02-15 14:30
    """

    result = extract_transaction_date(email_body, "unknown")

    expected = datetime(2026, 2, 15, 14, 30)
    assert result == expected, f"Expected {expected}, got {result}"


def test_parse_121_generic_datetime_slash():
    """
    T-PARSE-121: 汎用日時抽出(スラッシュ形式)
    「2026/02/15 14:30」形式（スラッシュ区切り）
    """
    email_body = """
    利用日: 2026/02/15 14:30
    """

    result = extract_transaction_date(email_body, "unknown")

    expected = datetime(2026, 2, 15, 14, 30)
    assert result == expected, f"Expected {expected}, got {result}"


def test_parse_122_datetime_extraction_failure():
    """
    T-PARSE-122: 日時抽出失敗ケース
    日時情報が全く含まれていないメール
    """
    email_body = """
    カードをご利用いただきました。
    詳細はアプリでご確認ください。
    """

    result = extract_transaction_date(email_body, "unknown")

    assert result is None, f"Expected None, got {result}"


# ===== 汎用店舗名抽出テスト =====

def test_parse_160_generic_merchant():
    """
    T-PARSE-160: 汎用店舗名抽出
    「ご利用先: イオンモール」形式
    """
    email_body = """
    ご利用ありがとうございます。
    ご利用先: イオンモール
    金額: 5,000円
    """

    # This function will be created
    from app.gmail.parser import extract_merchant

    result = extract_merchant(email_body, "unknown")

    assert result == "イオンモール", f"Expected 'イオンモール', got {result}"


def test_parse_161_merchant_extraction_failure():
    """
    T-PARSE-161: 店舗名抽出失敗ケース
    店舗名情報が全く含まれていないメール
    """
    email_body = """
    カードをご利用いただきました。
    金額: 3,000円
    """

    from app.gmail.parser import extract_merchant

    result = extract_merchant(email_body, "unknown")

    assert result is None, f"Expected None, got {result}"
