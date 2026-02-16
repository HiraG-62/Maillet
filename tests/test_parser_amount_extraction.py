"""
メール解析エンジン Phase 2: 金額・日時抽出テスト

担当: Ashigaru 7
タスクID: subtask_009a
対応テストケース: T-PARSE-030〜052, T-PARSE-090〜091
"""

import pytest
from datetime import datetime
from app.gmail.parser import extract_amount, extract_transaction_date


class TestAmountExtraction:
    """金額抽出テスト（T-PARSE-030〜082）"""

    # 三井住友カード金額抽出
    def test_t_parse_030_smbc_basic(self):
        """T-PARSE-030: 三井住友金額抽出（基本形式）"""
        email_body = "利用金額: 1,234円"
        result = extract_amount(email_body, "三井住友")
        assert result == 1234

    def test_t_parse_031_smbc_fullwidth_colon(self):
        """T-PARSE-031: 三井住友金額抽出（全角コロン）"""
        email_body = "利用金額:5,678円"
        result = extract_amount(email_body, "三井住友")
        assert result == 5678

    def test_t_parse_032_smbc_no_comma(self):
        """T-PARSE-032: 三井住友金額抽出（カンマなし）"""
        email_body = "利用金額: 100円"
        result = extract_amount(email_body, "三井住友")
        assert result == 100

    # JCBカード金額抽出
    def test_t_parse_040_jcb_basic(self):
        """T-PARSE-040: JCB金額抽出（基本形式）"""
        email_body = "ご利用金額: 2,500円"
        result = extract_amount(email_body, "JCB")
        assert result == 2500

    def test_t_parse_041_jcb_fullwidth_colon(self):
        """T-PARSE-041: JCB金額抽出（全角コロン）"""
        email_body = "ご利用金額:3,000円"
        result = extract_amount(email_body, "JCB")
        assert result == 3000

    def test_t_parse_042_jcb_preliminary(self):
        """T-PARSE-042: JCB金額抽出（速報版）"""
        email_body = "ご利用金額(速報): 1,500円"
        result = extract_amount(email_body, "JCB")
        assert result == 1500

    # 楽天カード金額抽出
    def test_t_parse_050_rakuten_basic(self):
        """T-PARSE-050: 楽天金額抽出（基本形式）"""
        email_body = "利用金額: 4,500円"
        result = extract_amount(email_body, "楽天")
        assert result == 4500

    def test_t_parse_051_rakuten_preliminary(self):
        """T-PARSE-051: 楽天金額抽出（速報版）"""
        email_body = "利用金額(速報): 1,200円"
        result = extract_amount(email_body, "楽天")
        assert result == 1200

    def test_t_parse_052_rakuten_confirmed(self):
        """T-PARSE-052: 楽天金額抽出（確定版）"""
        email_body = "利用金額(確定): 1,200円"
        result = extract_amount(email_body, "楽天")
        assert result == 1200


class TestDatetimeExtraction:
    """日時抽出テスト（T-PARSE-090〜122）"""

    # 三井住友カード日時抽出
    def test_t_parse_090_smbc_datetime_basic(self):
        """T-PARSE-090: 三井住友日時抽出（基本形式）"""
        email_body = "利用日: 2026/02/15 14:30"
        result = extract_transaction_date(email_body, "三井住友")
        assert result == datetime(2026, 2, 15, 14, 30)

    def test_t_parse_091_smbc_datetime_fullwidth_colon(self):
        """T-PARSE-091: 三井住友日時抽出（全角コロン）"""
        email_body = "利用日:2026/02/15 14:30"
        result = extract_transaction_date(email_body, "三井住友")
        assert result == datetime(2026, 2, 15, 14, 30)
