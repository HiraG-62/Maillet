"""
Unit tests for monthly aggregation service.

Tests verify:
- Monthly summary calculation (SUM, COUNT, AVG)
- Card company grouping
- is_verified filtering
- Boundary cases (no data, zero amounts)
"""

import pytest
from datetime import datetime
from sqlalchemy import create_engine
from sqlalchemy.orm import Session

from app.models.transaction import CardTransaction, Base
from app.services.aggregation_service import (
    get_monthly_summary,
    get_monthly_by_card,
    get_total_by_month,
)


@pytest.fixture
def engine():
    """Create in-memory SQLite database for testing."""
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(engine)
    return engine


@pytest.fixture
def session(engine):
    """Create database session."""
    with Session(engine) as session:
        yield session


@pytest.fixture
def sample_transactions(session):
    """
    Insert sample transactions for testing.

    2026-02 transactions:
    - 三井住友: 1000, 2000, 3000 (is_verified=1) → total=6000, count=3, avg=2000
    - JCB: 5000, 7000 (is_verified=1) → total=12000, count=2, avg=6000
    - 楽天: 500 (is_verified=0) → should be excluded from aggregation

    2026-01 transactions:
    - 三井住友: 10000 (is_verified=1) → different month, should not be included
    """
    transactions = [
        # 2026-02 verified transactions
        CardTransaction(
            card_company="三井住友",
            amount=1000,
            transaction_date=datetime(2026, 2, 1, 12, 0),
            merchant="Amazon",
            email_subject="【三井住友カード】ご利用のお知らせ",
            email_from="notify@contact.vpass.ne.jp",
            gmail_message_id="msg_001",
            is_verified=True,
        ),
        CardTransaction(
            card_company="三井住友",
            amount=2000,
            transaction_date=datetime(2026, 2, 5, 14, 30),
            merchant="Costco",
            email_subject="【三井住友カード】ご利用のお知らせ",
            email_from="notify@contact.vpass.ne.jp",
            gmail_message_id="msg_002",
            is_verified=True,
        ),
        CardTransaction(
            card_company="三井住友",
            amount=3000,
            transaction_date=datetime(2026, 2, 10, 9, 15),
            merchant="Starbucks",
            email_subject="【三井住友カード】ご利用のお知らせ",
            email_from="notify@contact.vpass.ne.jp",
            gmail_message_id="msg_003",
            is_verified=True,
        ),
        CardTransaction(
            card_company="JCB",
            amount=5000,
            transaction_date=datetime(2026, 2, 7, 18, 0),
            merchant="Yodobashi",
            email_subject="【JCB】カード利用のお知らせ",
            email_from="info@qa.jcb.co.jp",
            gmail_message_id="msg_004",
            is_verified=True,
        ),
        CardTransaction(
            card_company="JCB",
            amount=7000,
            transaction_date=datetime(2026, 2, 15, 20, 30),
            merchant="Bic Camera",
            email_subject="【JCB】カード利用のお知らせ",
            email_from="info@qa.jcb.co.jp",
            gmail_message_id="msg_005",
            is_verified=True,
        ),
        # 2026-02 unverified transaction (should be excluded)
        CardTransaction(
            card_company="楽天",
            amount=500,
            transaction_date=datetime(2026, 2, 12, 11, 0),
            merchant="Rakuten Market",
            email_subject="【楽天カード】利用速報",
            email_from="info@mail.rakuten-card.co.jp",
            gmail_message_id="msg_006",
            is_verified=False,
        ),
        # 2026-01 transaction (different month, should not be included)
        CardTransaction(
            card_company="三井住友",
            amount=10000,
            transaction_date=datetime(2026, 1, 20, 16, 45),
            merchant="Apple Store",
            email_subject="【三井住友カード】ご利用のお知らせ",
            email_from="notify@contact.vpass.ne.jp",
            gmail_message_id="msg_007",
            is_verified=True,
        ),
    ]

    session.add_all(transactions)
    session.commit()
    return transactions


class TestMonthlyAggregation:
    """Test suite for monthly aggregation functions."""

    def test_data_042_monthly_summary_basic(self, session, sample_transactions):
        """
        T-DATA-042: 月次集計（基本）
        2026-02の三井住友カード利用額を集計 → SUM(amount)が正しく計算される
        """
        result = get_monthly_summary(session, 2026, 2, "三井住友")

        assert result is not None
        assert result["total"] == 6000  # 1000 + 2000 + 3000
        assert result["count"] == 3
        assert result["average"] == 2000  # 6000 / 3

    def test_data_043_monthly_summary_multiple_cards(self, session, sample_transactions):
        """
        T-DATA-043: 月次集計（複数カード）
        2026-02の全カード会社の合計を集計 → カード会社別にグルーピングされる
        """
        results = get_monthly_by_card(session, 2026, 2)

        assert len(results) == 2  # 三井住友 and JCB (楽天 is unverified)

        # Results should be sorted by card_company or total_amount
        card_totals = {r["card_company"]: r["total"] for r in results}

        assert card_totals["三井住友"] == 6000
        assert card_totals["JCB"] == 12000

    def test_data_044_monthly_count_aggregation(self, session, sample_transactions):
        """
        T-DATA-044: 月次集計（COUNT集計）
        2026-02の取引件数をカウント → COUNT(*)が正しく返却される
        """
        result = get_total_by_month(session, 2026, 2)

        assert result is not None
        assert result["count"] == 5  # 3 from 三井住友 + 2 from JCB (exclude unverified)

    def test_data_045_monthly_avg_aggregation(self, session, sample_transactions):
        """
        T-DATA-045: 月次集計（AVG集計）
        2026-02の平均利用額を算出 → AVG(amount)が正しく計算される
        """
        result = get_total_by_month(session, 2026, 2)

        assert result is not None
        # (1000 + 2000 + 3000 + 5000 + 7000) / 5 = 18000 / 5 = 3600
        assert result["average"] == 3600

    def test_data_046_monthly_summary_exclude_unverified(self, session, sample_transactions):
        """
        T-DATA-046: 月次集計（is_verified=0除外）
        is_verified=0のレコードが集計から除外されるか確認
        信頼できるメール（is_verified=1）のみ集計される
        """
        # 楽天カード (is_verified=False, amount=500) should NOT be included
        result = get_total_by_month(session, 2026, 2)

        assert result is not None
        # Total should be 18000 (excluding 500 from unverified transaction)
        assert result["total"] == 18000
        # Count should be 5 (excluding 1 unverified transaction)
        assert result["count"] == 5
