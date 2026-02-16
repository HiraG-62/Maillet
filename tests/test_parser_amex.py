"""
AMEX（アメリカン・エキスプレス）メール解析テスト

担当: Ashigaru 1
タスクID: subtask_010a
対応テストケース: T-PARSE-006〜008, T-PARSE-023, T-PARSE-060〜062
"""

import pytest
from app.gmail.parser import is_trusted_domain, detect_card_company, extract_amount


class TestAMEXDomainValidation:
    """AMEXドメイン検証テスト（T-PARSE-006〜008）"""

    def test_t_parse_006_amex_domain_main(self):
        """T-PARSE-006: AMEXドメイン検証(メイン) @aexp.com"""
        assert is_trusted_domain("notify@aexp.com", "AMEX") is True

    def test_t_parse_007_amex_domain_sub1(self):
        """T-PARSE-007: AMEXドメイン検証(サブ1) @americanexpress.com"""
        assert is_trusted_domain("info@americanexpress.com", "AMEX") is True

    def test_t_parse_008_amex_domain_sub2(self):
        """T-PARSE-008: AMEXドメイン検証(サブ2) @email.americanexpress.com"""
        assert is_trusted_domain("notify@email.americanexpress.com", "AMEX") is True


class TestAMEXCardCompanyDetection:
    """AMEXカード会社判別テスト（T-PARSE-023）"""

    def test_t_parse_023_amex_subject_detection(self):
        """T-PARSE-023: AMEX判別(件名) 【American Express】カードご利用のお知らせ"""
        result = detect_card_company(
            "【American Express】カードご利用のお知らせ",
            "notify@aexp.com"
        )
        assert result == "AMEX"


class TestAMEXAmountExtraction:
    """AMEX金額抽出テスト（T-PARSE-060〜062）"""

    def test_t_parse_060_amex_amount_basic(self):
        """T-PARSE-060: AMEX金額抽出(基本) ご利用金額: 8,900円"""
        email_body = "ご利用金額: 8,900円"
        result = extract_amount(email_body, "AMEX")
        assert result == 8900

    def test_t_parse_061_amex_amount_yen_mark(self):
        """T-PARSE-061: AMEX金額抽出(円マーク付) 金額: ¥ 5,000円"""
        email_body = "金額: ¥ 5,000円"
        result = extract_amount(email_body, "AMEX")
        assert result == 5000

    def test_t_parse_062_amex_amount_short(self):
        """T-PARSE-062: AMEX金額抽出(短縮形) 金額: 3,000円"""
        email_body = "金額: 3,000円"
        result = extract_amount(email_body, "AMEX")
        assert result == 3000
