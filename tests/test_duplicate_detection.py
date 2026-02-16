"""
Unit and integration tests for duplicate transaction detection.

Tests verify:
- Duplicate gmail_message_id detection via UNIQUE constraint
- IntegrityError handling and automatic rollback
- Duplicate skip logging
- Rakuten card preliminary/final version handling
"""

import pytest
from datetime import datetime
from sqlalchemy import create_engine
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError

from app.models.transaction import CardTransaction, Base
from app.services.transaction_service import save_transaction


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


class TestDuplicateDetection:
    """Test suite for duplicate transaction detection logic."""

    def test_data_003_duplicate_gmail_message_id(self, session, caplog):
        """
        T-DATA-003: INSERT with duplicate gmail_message_id.

        When inserting a transaction with an already-existing gmail_message_id,
        save_transaction() should catch IntegrityError, rollback, and return None.
        """
        # First transaction - should succeed
        transaction_data1 = {
            "card_company": "楽天カード",
            "amount": 5000,
            "transaction_date": datetime(2024, 1, 15, 10, 30),
            "merchant": "Amazon",
            "email_subject": "【楽天カード】カードご利用のお知らせ",
            "email_from": "info@mail.rakuten-card.co.jp",
            "gmail_message_id": "msg_001",
        }
        result1 = save_transaction(session, transaction_data1)
        assert result1 is not None
        assert result1.gmail_message_id == "msg_001"

        # Second transaction with duplicate gmail_message_id - should return None
        transaction_data2 = {
            "card_company": "JCBカード",
            "amount": 3000,
            "transaction_date": datetime(2024, 1, 16, 14, 20),
            "merchant": "セブンイレブン",
            "email_subject": "【JCB】カード利用のお知らせ",
            "email_from": "noreply@jcb.co.jp",
            "gmail_message_id": "msg_001",  # Duplicate!
        }
        result2 = save_transaction(session, transaction_data2)
        assert result2 is None

        # Verify only the first transaction exists in database
        all_transactions = session.query(CardTransaction).all()
        assert len(all_transactions) == 1
        assert all_transactions[0].card_company == "楽天カード"
