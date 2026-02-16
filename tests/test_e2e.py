"""
E2E Integration Tests for Card Spending Tracker

Task: subtask_011c (Ashigaru 8)
Test Cases: T-E2E-050~055, T-E2E-013~014, T-E2E-022~023

This module tests end-to-end flows from email parsing to database storage,
using mock Gmail API calls and inline email samples (since sample_emails/*.eml
are not yet available from subtask_011a).
"""

import pytest
from datetime import datetime
from pathlib import Path
from typing import Optional
from unittest.mock import Mock, patch, MagicMock
from sqlalchemy import create_engine
from sqlalchemy.orm import Session

from app.models.transaction import CardTransaction, Base
from app.database.connection import DatabaseConnection
from app.gmail.parser import (
    detect_card_company,
    extract_amount,
    extract_transaction_date,
    extract_merchant,
    is_trusted_domain,
)
from app.services.transaction_service import save_transaction
from app.services.aggregation_service import (
    get_monthly_by_card,
    get_monthly_summary,
    get_total_by_month,
)


# ==============================================================================
# Sample Email Templates (inline)
# ==============================================================================

SAMPLE_EMAIL_SMBC = """From: notify@contact.vpass.ne.jp
Subject: 【三井住友カード】ご利用のお知らせ
Date: 2026-02-15 14:30:00

【三井住友カード】ご利用のお知らせ

ご利用日時: 2026-02-15 14:30
ご利用金額: 3,500円
ご利用先: セブンイレブン渋谷店

ご利用ありがとうございます。
"""

SAMPLE_EMAIL_JCB = """From: info@qa.jcb.co.jp
Subject: 【JCBカード】ご利用のお知らせ
Date: 2026-02-14 18:45:00

【JCBカード】カードご利用のお知らせ

ご利用日時: 2026-02-14 18:45
ご利用金額: 12,800円
ご利用先: Amazon.co.jp

今後ともJCBカードをご愛顧ください。
"""

SAMPLE_EMAIL_RAKUTEN = """From: info@mail.rakuten-card.co.jp
Subject: 【楽天カード】カード利用のお知らせ
Date: 2026-02-13 12:00:00

【楽天カード】カード利用のお知らせ（速報版）

ご利用日時: 2026-02-13 12:00
ご利用金額: 5,400円
ご利用先: 楽天市場

楽天ポイントが貯まります！
"""

SAMPLE_EMAIL_AMEX = """From: notify@aexp.com
Subject: 【American Express】カードご利用のお知らせ
Date: 2026-02-12 10:30:00

【American Express】カードご利用のお知らせ

ご利用日時: 2026-02-12 10:30
ご利用金額: 25,000円
ご利用先: ヨドバシカメラ

American Expressをご利用いただきありがとうございます。
"""

SAMPLE_EMAIL_DCARD = """From: info@dcard.docomo.ne.jp
Subject: 【dカード】ご利用のお知らせ
Date: 2026-02-11 09:15:00

【dカード】カードご利用のお知らせ

ご利用日時: 2026-02-11 09:15
ご利用金額: 8,900円
ご利用先: ローソン

dポイントが貯まります。
"""

# Fallback test emails
SAMPLE_EMAIL_FALLBACK_GENERIC = """From: notify@contact.vpass.ne.jp
Subject: 【三井住友カード】ご利用のお知らせ
Date: 2026-02-10 00:00:00

カードご利用のお知らせ

ご利用日時: 2026-02-10 15:20
金額: 1,200円
ご利用先: スターバックス
"""

SAMPLE_EMAIL_UNPARSEABLE = """From: unknown@example.com
Subject: スパムメール
Date: 2026-02-09 00:00:00

これは解析不能なメールです。
金額や日時の情報はありません。
"""


# ==============================================================================
# Helper Functions
# ==============================================================================

def parse_card_email(subject: str, from_address: str, email_body: str) -> Optional[dict]:
    """
    E2E helper function: Parse a complete card email into transaction data.

    This integrates multiple parser functions:
    - detect_card_company()
    - is_trusted_domain()
    - extract_amount()
    - extract_transaction_date()
    - extract_merchant()

    Returns:
        Optional[dict]: Transaction data dict, or None if parsing fails
    """
    # Step 1: Detect card company
    card_company = detect_card_company(subject, from_address)
    if not card_company:
        return None

    # Step 2: Verify domain
    is_verified = 1 if is_trusted_domain(from_address, card_company) else 0

    # Step 3: Extract amount
    amount = extract_amount(email_body, card_company)
    if not amount:
        return None

    # Step 4: Extract transaction date
    transaction_date = extract_transaction_date(email_body, card_company)
    if not transaction_date:
        return None

    # Step 5: Extract merchant
    merchant = extract_merchant(email_body, card_company)

    return {
        "card_company": card_company,
        "amount": amount,
        "transaction_date": transaction_date,
        "merchant": merchant,
        "is_verified": is_verified,
    }


# ==============================================================================
# Fixtures
# ==============================================================================

@pytest.fixture
def test_db(tmp_path):
    """Create test database (in-memory or temporary file)."""
    db_path = tmp_path / "test_e2e.db"
    connection = DatabaseConnection(str(db_path))
    yield connection
    connection.close()


@pytest.fixture
def test_session(test_db):
    """Create test database session."""
    with test_db.get_session() as session:
        yield session


@pytest.fixture
def mock_gmail_messages():
    """
    Mock Gmail API message list response.
    Returns a dictionary of email samples keyed by card company.
    """
    return {
        "smbc": {
            "id": "msg_smbc_001",
            "threadId": "thread_001",
            "payload": {
                "headers": [
                    {"name": "From", "value": "notify@contact.vpass.ne.jp"},
                    {"name": "Subject", "value": "【三井住友カード】ご利用のお知らせ"},
                    {"name": "Date", "value": "2026-02-15 14:30:00"},
                ]
            },
            "snippet": SAMPLE_EMAIL_SMBC,
        },
        "jcb": {
            "id": "msg_jcb_001",
            "threadId": "thread_002",
            "payload": {
                "headers": [
                    {"name": "From", "value": "info@qa.jcb.co.jp"},
                    {"name": "Subject", "value": "【JCBカード】ご利用のお知らせ"},
                    {"name": "Date", "value": "2026-02-14 18:45:00"},
                ]
            },
            "snippet": SAMPLE_EMAIL_JCB,
        },
        "rakuten": {
            "id": "msg_rakuten_001",
            "threadId": "thread_003",
            "payload": {
                "headers": [
                    {"name": "From", "value": "info@mail.rakuten-card.co.jp"},
                    {"name": "Subject", "value": "【楽天カード】カード利用のお知らせ"},
                    {"name": "Date", "value": "2026-02-13 12:00:00"},
                ]
            },
            "snippet": SAMPLE_EMAIL_RAKUTEN,
        },
        "amex": {
            "id": "msg_amex_001",
            "threadId": "thread_004",
            "payload": {
                "headers": [
                    {"name": "From", "value": "notify@aexp.com"},
                    {"name": "Subject", "value": "【American Express】カードご利用のお知らせ"},
                    {"name": "Date", "value": "2026-02-12 00:00:00"},
                ]
            },
            "snippet": SAMPLE_EMAIL_AMEX,
        },
        "dcard": {
            "id": "msg_dcard_001",
            "threadId": "thread_005",
            "payload": {
                "headers": [
                    {"name": "From", "value": "info@dcard.docomo.ne.jp"},
                    {"name": "Subject", "value": "【dカード】ご利用のお知らせ"},
                    {"name": "Date", "value": "2026-02-11 00:00:00"},
                ]
            },
            "snippet": SAMPLE_EMAIL_DCARD,
        },
    }


# ==============================================================================
# T-E2E-050~055: Card Company Parser Integration Tests
# ==============================================================================

class TestCardCompanyParserIntegration:
    """
    カード会社別パーサー統合テスト
    Test Cases: T-E2E-050, T-E2E-051, T-E2E-052, T-E2E-053, T-E2E-054, T-E2E-055
    """

    def test_t_e2e_050_smbc_email_parsing(self):
        """T-E2E-050: 三井住友カードメール解析 (Critical)"""
        subject = "【三井住友カード】ご利用のお知らせ"
        from_address = "notify@contact.vpass.ne.jp"
        email_body = SAMPLE_EMAIL_SMBC

        # Parse email
        result = parse_card_email(subject, from_address, email_body)

        # Assertions
        assert result is not None
        assert result["card_company"] == "三井住友"
        assert result["amount"] == 3500
        assert result["transaction_date"] == datetime(2026, 2, 15, 14, 30, 0)
        assert result["merchant"] == "セブンイレブン渋谷店"
        assert result["is_verified"] == 1

    def test_t_e2e_051_jcb_email_parsing(self):
        """T-E2E-051: JCBカードメール解析 (Critical)"""
        subject = "【JCBカード】ご利用のお知らせ"
        from_address = "info@qa.jcb.co.jp"
        email_body = SAMPLE_EMAIL_JCB

        result = parse_card_email(subject, from_address, email_body)

        assert result is not None
        assert result["card_company"] == "JCB"
        assert result["amount"] == 12800
        assert result["transaction_date"] == datetime(2026, 2, 14, 18, 45, 0)
        assert result["merchant"] == "Amazon.co.jp"
        assert result["is_verified"] == 1

    def test_t_e2e_052_rakuten_email_parsing(self):
        """T-E2E-052: 楽天カードメール解析（速報版） (Critical)"""
        subject = "【楽天カード】カード利用のお知らせ"
        from_address = "info@mail.rakuten-card.co.jp"
        email_body = SAMPLE_EMAIL_RAKUTEN

        result = parse_card_email(subject, from_address, email_body)

        assert result is not None
        assert result["card_company"] == "楽天"
        assert result["amount"] == 5400
        assert result["transaction_date"] == datetime(2026, 2, 13, 12, 0, 0)
        assert result["merchant"] == "楽天市場"
        assert result["is_verified"] == 1

    def test_t_e2e_053_amex_email_parsing(self):
        """T-E2E-053: AMEXメール解析 (High)"""
        subject = "【American Express】カードご利用のお知らせ"
        from_address = "notify@aexp.com"
        email_body = SAMPLE_EMAIL_AMEX

        result = parse_card_email(subject, from_address, email_body)

        assert result is not None
        assert result["card_company"] == "AMEX"
        assert result["amount"] == 25000
        assert result["transaction_date"] == datetime(2026, 2, 12, 10, 30, 0)
        assert result["merchant"] == "ヨドバシカメラ"
        assert result["is_verified"] == 1

    def test_t_e2e_054_dcard_email_parsing(self):
        """T-E2E-054: dカードメール解析 (High)"""
        subject = "【dカード】ご利用のお知らせ"
        from_address = "info@dcard.docomo.ne.jp"
        email_body = SAMPLE_EMAIL_DCARD

        result = parse_card_email(subject, from_address, email_body)

        assert result is not None
        assert result["card_company"] == "dカード"
        assert result["amount"] == 8900
        assert result["transaction_date"] == datetime(2026, 2, 11, 9, 15, 0)
        assert result["merchant"] == "ローソン"
        assert result["is_verified"] == 1

    def test_t_e2e_055_mixed_card_companies_batch_processing(self, test_session):
        """T-E2E-055: 複数カード会社混在処理 (Critical)"""
        # Prepare email data for all 5 card companies
        emails = [
            ("【三井住友カード】ご利用のお知らせ", "notify@contact.vpass.ne.jp", SAMPLE_EMAIL_SMBC, "msg_001"),
            ("【JCBカード】ご利用のお知らせ", "info@qa.jcb.co.jp", SAMPLE_EMAIL_JCB, "msg_002"),
            ("【楽天カード】カード利用のお知らせ", "info@mail.rakuten-card.co.jp", SAMPLE_EMAIL_RAKUTEN, "msg_003"),
            ("【American Express】カードご利用のお知らせ", "notify@aexp.com", SAMPLE_EMAIL_AMEX, "msg_004"),
            ("【dカード】ご利用のお知らせ", "info@dcard.docomo.ne.jp", SAMPLE_EMAIL_DCARD, "msg_005"),
        ]

        saved_count = 0

        # Parse and save all emails
        for subject, from_addr, body, msg_id in emails:
            parsed = parse_card_email(subject, from_addr, body)
            if parsed:
                parsed["email_subject"] = subject
                parsed["email_from"] = from_addr
                parsed["gmail_message_id"] = msg_id
                result = save_transaction(test_session, parsed)
                if result:
                    saved_count += 1

        # Commit all transactions
        test_session.commit()

        # Verify all 5 transactions saved
        assert saved_count == 5

        # Verify each card company is correctly identified
        transactions = test_session.query(CardTransaction).all()
        assert len(transactions) == 5

        card_companies = {t.card_company for t in transactions}
        assert card_companies == {"三井住友", "JCB", "楽天", "AMEX", "dカード"}


# ==============================================================================
# T-E2E-013, T-E2E-014: Fallback Pattern Tests
# ==============================================================================

class TestParsingFallback:
    """
    パース失敗時のフォールバック処理テスト
    Test Cases: T-E2E-013, T-E2E-014
    """

    def test_t_e2e_013_fallback_to_generic_pattern(self):
        """T-E2E-013: カード会社別パターン失敗 → 汎用パターン適用 (Integration)"""
        # Email with generic format (no company-specific keywords)
        subject = "【三井住友カード】ご利用のお知らせ"
        from_address = "notify@contact.vpass.ne.jp"
        email_body = SAMPLE_EMAIL_FALLBACK_GENERIC

        result = parse_card_email(subject, from_address, email_body)

        # Should successfully parse with fallback pattern
        assert result is not None
        assert result["card_company"] == "三井住友"
        assert result["amount"] == 1200
        assert result["merchant"] == "スターバックス"

    def test_t_e2e_014_all_patterns_fail_skip_processing(self):
        """T-E2E-014: 全パターン失敗 → スキップ処理 (Integration)"""
        subject = "スパムメール"
        from_address = "unknown@example.com"
        email_body = SAMPLE_EMAIL_UNPARSEABLE

        result = parse_card_email(subject, from_address, email_body)

        # Should return None (cannot parse)
        assert result is None


# ==============================================================================
# T-E2E-022, T-E2E-023: Monthly Report Display Scenarios
# ==============================================================================

class TestDuplicateDetectionE2E:
    """
    重複検知E2Eテスト
    Additional integration test for duplicate detection in full flow
    """

    def test_e2e_duplicate_email_skipped_in_batch(self, test_session):
        """E2E: 同一メールID重複時のスキップ処理"""
        # Parse email
        subject = "【三井住友カード】ご利用のお知らせ"
        from_address = "notify@contact.vpass.ne.jp"
        email_body = SAMPLE_EMAIL_SMBC

        parsed = parse_card_email(subject, from_address, email_body)
        parsed["email_subject"] = subject
        parsed["email_from"] = from_address
        parsed["gmail_message_id"] = "msg_duplicate_test"

        # Save first time
        result1 = save_transaction(test_session, parsed)
        assert result1 is not None

        # Save second time (duplicate)
        result2 = save_transaction(test_session, parsed)
        assert result2 is None  # Should be skipped

        test_session.commit()

        # Verify only one transaction saved
        transactions = test_session.query(CardTransaction).filter_by(
            gmail_message_id="msg_duplicate_test"
        ).all()
        assert len(transactions) == 1


class TestMixedValidInvalidEmails:
    """
    正常・異常メール混在処理テスト
    Additional integration test for robust batch processing
    """

    def test_e2e_batch_with_valid_and_invalid_emails(self, test_session):
        """E2E: 正常メールと異常メール混在バッチ処理"""
        emails = [
            # Valid: SMBC
            ("【三井住友カード】ご利用のお知らせ", "notify@contact.vpass.ne.jp", SAMPLE_EMAIL_SMBC, "msg_batch_001"),
            # Invalid: Unparseable (no card company detected)
            ("スパム", "spam@example.com", SAMPLE_EMAIL_UNPARSEABLE, "msg_batch_002"),
            # Valid: JCB
            ("【JCBカード】ご利用のお知らせ", "info@qa.jcb.co.jp", SAMPLE_EMAIL_JCB, "msg_batch_003"),
            # Phishing: Wrong domain (parsed but is_verified=0)
            ("【楽天カード】カード利用のお知らせ", "fake@phishing.com", SAMPLE_EMAIL_RAKUTEN, "msg_batch_004"),
            # Valid: Rakuten
            ("【楽天カード】カード利用のお知らせ", "info@mail.rakuten-card.co.jp", SAMPLE_EMAIL_RAKUTEN, "msg_batch_005"),
        ]

        saved_count = 0
        verified_count = 0
        for subject, from_addr, body, msg_id in emails:
            parsed = parse_card_email(subject, from_addr, body)
            if parsed:
                parsed["email_subject"] = subject
                parsed["email_from"] = from_addr
                parsed["gmail_message_id"] = msg_id
                result = save_transaction(test_session, parsed)
                if result:
                    saved_count += 1
                    if result.is_verified:
                        verified_count += 1

        test_session.commit()

        # 4 parseable emails saved (SMBC, JCB, phishing Rakuten, real Rakuten)
        # 1 unparseable email skipped (spam)
        assert saved_count == 4

        # Only 3 verified emails (SMBC, JCB, real Rakuten)
        assert verified_count == 3

        # Verify transactions
        transactions = test_session.query(CardTransaction).all()
        assert len(transactions) == 4

        # Verify only 3 verified transactions
        verified_txs = test_session.query(CardTransaction).filter_by(is_verified=1).all()
        assert len(verified_txs) == 3

        verified_card_companies = {t.card_company for t in verified_txs}
        assert verified_card_companies == {"三井住友", "JCB", "楽天"}


class TestCardCompanyGrouping:
    """
    カード会社別集計E2Eテスト
    Additional test for grouping by card company
    """

    def test_e2e_monthly_grouping_by_card_company(self, test_session):
        """E2E: 月次カード会社別集計"""
        # Add transactions for multiple card companies
        transactions = [
            CardTransaction(
                card_company="三井住友",
                amount=1000,
                transaction_date=datetime(2026, 2, 10, 10, 0, 0),
                merchant="店舗A",
                email_subject="【三井住友カード】ご利用のお知らせ",
                email_from="notify@contact.vpass.ne.jp",
                gmail_message_id="msg_group_001",
                is_verified=1,
            ),
            CardTransaction(
                card_company="三井住友",
                amount=2000,
                transaction_date=datetime(2026, 2, 11, 11, 0, 0),
                merchant="店舗B",
                email_subject="【三井住友カード】ご利用のお知らせ",
                email_from="notify@contact.vpass.ne.jp",
                gmail_message_id="msg_group_002",
                is_verified=1,
            ),
            CardTransaction(
                card_company="JCB",
                amount=5000,
                transaction_date=datetime(2026, 2, 12, 12, 0, 0),
                merchant="店舗C",
                email_subject="【JCBカード】ご利用のお知らせ",
                email_from="info@qa.jcb.co.jp",
                gmail_message_id="msg_group_003",
                is_verified=1,
            ),
        ]
        for tx in transactions:
            test_session.add(tx)
        test_session.commit()

        # Get monthly summary by card company
        results = get_monthly_by_card(test_session, 2026, 2)

        # Verify results
        assert len(results) == 2  # 2 card companies

        # Find SMBC and JCB results
        smbc = next((r for r in results if r["card_company"] == "三井住友"), None)
        jcb = next((r for r in results if r["card_company"] == "JCB"), None)

        assert smbc is not None
        assert smbc["total"] == 3000
        assert smbc["count"] == 2
        assert smbc["average"] == 1500

        assert jcb is not None
        assert jcb["total"] == 5000
        assert jcb["count"] == 1
        assert jcb["average"] == 5000


class TestMonthlyReportDisplay:
    """
    月次レポート表示シナリオテスト
    Test Cases: T-E2E-022, T-E2E-023
    """

    def test_t_e2e_022_exclude_unverified_emails_from_aggregation(self, test_session):
        """T-E2E-022: 未検証メール除外集計 (Integration)"""
        # Add verified transaction
        verified_tx = CardTransaction(
            card_company="三井住友",
            amount=5000,
            transaction_date=datetime(2026, 2, 15, 14, 0, 0),
            merchant="テスト店舗",
            email_subject="【三井住友カード】ご利用のお知らせ",
            email_from="notify@contact.vpass.ne.jp",
            gmail_message_id="msg_verified_001",
            is_verified=1,
        )
        test_session.add(verified_tx)

        # Add unverified transaction
        unverified_tx = CardTransaction(
            card_company="三井住友",
            amount=3000,
            transaction_date=datetime(2026, 2, 16, 10, 0, 0),
            merchant="フィッシング店舗",
            email_subject="【三井住友カード】ご利用のお知らせ",
            email_from="fake@example.com",  # Invalid domain
            gmail_message_id="msg_unverified_001",
            is_verified=0,
        )
        test_session.add(unverified_tx)
        test_session.commit()

        # Aggregate (should exclude unverified automatically)
        result = get_monthly_summary(test_session, 2026, 2, "三井住友")

        # Verify only verified transaction is counted
        assert result["total"] == 5000
        assert result["count"] == 1

    def test_t_e2e_023_empty_month_display(self, test_session):
        """T-E2E-023: 空データ月の表示 (E2E)"""
        # No transactions in database

        # Aggregate for non-existent month
        result = get_total_by_month(test_session, 2026, 1)

        # Should return empty result (not None or error)
        assert result is not None
        assert result["total"] == 0
        assert result["count"] == 0
        assert result["average"] == 0
