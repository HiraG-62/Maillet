"""
dカード メール解析テスト（TDD実装）

担当: Ashigaru 2
タスクID: subtask_010b
対応テストケース: T-PARSE-024, T-PARSE-070, T-PARSE-071
"""

import pytest
from app.gmail.parser import detect_card_company, extract_amount, is_trusted_domain


class TestDcardDetection:
    """T-PARSE-024: dカード判別（件名ベース）"""

    def test_parse_024_dcard_detection(self):
        """件名「【dカード】カードご利用速報」からdカード判別"""
        subject = "【dカード】カードご利用速報"
        from_address = "notify@dcard.docomo.ne.jp"

        result = detect_card_company(subject, from_address)

        assert result == "dカード", "件名からdカードを正しく判別できること"


class TestDcardAmountExtraction:
    """T-PARSE-070, T-PARSE-071: dカード金額抽出"""

    def test_parse_070_dcard_amount_basic(self):
        """T-PARSE-070: 利用金額: 1,800円 → amount=1800"""
        email_body = """
        【dカード】カードご利用速報

        利用金額: 1,800円
        利用店舗: ローソン
        """

        result = extract_amount(email_body, "dカード")

        assert result == 1800, "基本パターン「利用金額: 1,800円」から1800を抽出"

    def test_parse_071_dcard_amount_short_form(self):
        """T-PARSE-071: 金額: 2,400円 → amount=2400"""
        email_body = """
        【dカード】カードご利用速報

        金額: 2,400円
        利用店舗: セブンイレブン
        """

        result = extract_amount(email_body, "dカード")

        assert result == 2400, "短縮形「金額: 2,400円」から2400を抽出"


class TestDcardDomainVerification:
    """ドメイン検証テスト（セキュリティ要件）"""

    def test_dcard_trusted_domain_valid(self):
        """dcard.docomo.ne.jp ドメインは信頼できること"""
        from_address = "notify@dcard.docomo.ne.jp"

        result = is_trusted_domain(from_address, "dカード")

        assert result is True, "dcard.docomo.ne.jp は信頼ドメインとして認識される"

    def test_dcard_trusted_domain_invalid(self):
        """偽装ドメイン（dcard-fake.com）はフィッシング扱い"""
        from_address = "phishing@dcard-fake.com"

        result = is_trusted_domain(from_address, "dカード")

        assert result is False, "偽装ドメインは信頼されない"
