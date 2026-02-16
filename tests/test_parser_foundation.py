"""
メール解析エンジン基礎テスト（送信元検証＋カード判別）

担当: Ashigaru 3
タスクID: subtask_004c
対応テストケース: T-PARSE-001〜011, T-PARSE-020〜025
"""

import pytest
from app.gmail.parser import is_trusted_domain, detect_card_company


class TestIsTrustedDomain:
    """送信元ドメイン検証テスト（T-PARSE-001〜011）"""

    # 三井住友ドメイン検証
    def test_t_parse_001_smbc_domain(self):
        """T-PARSE-001: 三井住友正規ドメイン検証"""
        assert is_trusted_domain("notify@contact.vpass.ne.jp", "三井住友") is True

    # JCBドメイン検証
    def test_t_parse_002_jcb_domain(self):
        """T-PARSE-002: JCB正規ドメイン検証"""
        assert is_trusted_domain("info@qa.jcb.co.jp", "JCB") is True

    # 楽天ドメイン検証
    def test_t_parse_003_rakuten_main_domain(self):
        """T-PARSE-003: 楽天メインドメイン検証"""
        assert is_trusted_domain("notify@mail.rakuten-card.co.jp", "楽天") is True

    def test_t_parse_004_rakuten_sub1_domain(self):
        """T-PARSE-004: 楽天サブドメイン1検証"""
        assert is_trusted_domain("info@mkrm.rakuten.co.jp", "楽天") is True

    def test_t_parse_005_rakuten_sub2_domain(self):
        """T-PARSE-005: 楽天サブドメイン2検証"""
        assert is_trusted_domain("bounce@bounce.rakuten-card.co.jp", "楽天") is True

    # AMEXドメイン検証
    def test_t_parse_006_amex_main_domain(self):
        """T-PARSE-006: AMEXメインドメイン検証"""
        assert is_trusted_domain("notify@aexp.com", "AMEX") is True

    def test_t_parse_007_amex_sub1_domain(self):
        """T-PARSE-007: AMEXサブドメイン1検証"""
        assert is_trusted_domain("info@americanexpress.com", "AMEX") is True

    def test_t_parse_008_amex_sub2_domain(self):
        """T-PARSE-008: AMEXサブドメイン2検証"""
        assert is_trusted_domain("notify@email.americanexpress.com", "AMEX") is True

    # フィッシング検出
    def test_t_parse_009_phishing_domain(self):
        """T-PARSE-009: フィッシングドメイン検出"""
        assert is_trusted_domain("fake@fake-vpass.com", "三井住友") is False

    def test_t_parse_010_unknown_domain(self):
        """T-PARSE-010: 不明なドメイン検出"""
        assert is_trusted_domain("info@unknown-bank.com", "楽天") is False

    def test_t_parse_011_saison_warning(self):
        """T-PARSE-011: セゾン名義メール＝フィッシング確定"""
        # セゾンはメール配信なし。セゾン名義のメールは全てフィッシング扱い
        assert is_trusted_domain("info@saison-card.co.jp", "セゾン") is False


class TestDetectCardCompany:
    """カード会社判別テスト（T-PARSE-020〜025）"""

    def test_t_parse_020_smbc_subject(self):
        """T-PARSE-020: 三井住友判別（件名）"""
        result = detect_card_company(
            "【三井住友カード】ご利用のお知らせ",
            "notify@contact.vpass.ne.jp"
        )
        assert result == "三井住友"

    def test_t_parse_021_jcb_subject(self):
        """T-PARSE-021: JCB判別（件名）"""
        result = detect_card_company(
            "【JCB】カードご利用のお知らせ",
            "info@qa.jcb.co.jp"
        )
        assert result == "JCB"

    def test_t_parse_022_rakuten_subject(self):
        """T-PARSE-022: 楽天判別（件名）"""
        result = detect_card_company(
            "【楽天カード】カード利用のお知らせ",
            "notify@mail.rakuten-card.co.jp"
        )
        assert result == "楽天"

    def test_t_parse_023_amex_subject(self):
        """T-PARSE-023: AMEX判別（件名）"""
        result = detect_card_company(
            "【American Express】カードご利用のお知らせ",
            "notify@aexp.com"
        )
        assert result == "AMEX"

    def test_t_parse_024_dcard_subject(self):
        """T-PARSE-024: dカード判別（件名）"""
        result = detect_card_company(
            "【dカード】カードご利用速報",
            "info@docomo.ne.jp"
        )
        assert result == "dカード"

    def test_t_parse_025_unknown_subject(self):
        """T-PARSE-025: 判別不能ケース（会社名なし）"""
        result = detect_card_company(
            "カード利用通知",
            "info@unknown.com"
        )
        assert result is None
