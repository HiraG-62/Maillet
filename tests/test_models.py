"""
Unit tests for CardTransaction SQLAlchemy model.

Tests verify:
- Model field definitions
- Data type constraints
- Nullable/non-nullable fields
- Unique constraints
- Default values
"""

import pytest
from datetime import datetime
from sqlalchemy import create_engine, inspect
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError

from app.models.transaction import CardTransaction, Base


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


class TestCardTransactionModel:
    """Test suite for CardTransaction model definition."""

    def test_table_name(self, engine):
        """Test table name is 'card_transactions'."""
        inspector = inspect(engine)
        assert "card_transactions" in inspector.get_table_names()

    def test_model_fields_exist(self, engine):
        """Test all required fields exist in the model."""
        inspector = inspect(engine)
        columns = {col["name"] for col in inspector.get_columns("card_transactions")}

        required_fields = {
            "id",
            "card_company",
            "amount",
            "transaction_date",
            "merchant",
            "email_subject",
            "email_from",
            "gmail_message_id",
            "is_verified",
            "created_at",
        }
        assert required_fields == columns

    def test_primary_key(self, engine):
        """Test 'id' field is primary key."""
        inspector = inspect(engine)
        pk_constraint = inspector.get_pk_constraint("card_transactions")
        assert pk_constraint["constrained_columns"] == ["id"]

    def test_unique_constraint_gmail_message_id(self, engine):
        """Test gmail_message_id has UNIQUE constraint."""
        inspector = inspect(engine)
        unique_constraints = inspector.get_unique_constraints("card_transactions")

        # Extract all columns with unique constraints
        unique_columns = []
        for constraint in unique_constraints:
            unique_columns.extend(constraint["column_names"])

        assert "gmail_message_id" in unique_columns

    def test_nullable_fields(self, engine):
        """Test nullable fields: only merchant should be nullable."""
        inspector = inspect(engine)
        columns = {col["name"]: col["nullable"] for col in inspector.get_columns("card_transactions")}

        # Only merchant should be nullable
        assert columns["merchant"] is True

        # All others should be NOT NULL (except id which is autoincrement)
        assert columns["card_company"] is False
        assert columns["amount"] is False
        assert columns["transaction_date"] is False
        assert columns["email_subject"] is False
        assert columns["email_from"] is False
        assert columns["gmail_message_id"] is False

    def test_create_transaction(self, session):
        """Test creating a new transaction record."""
        transaction = CardTransaction(
            card_company="三井住友",
            amount=5000,
            transaction_date=datetime(2026, 2, 15, 14, 30, 0),
            merchant="Amazon.co.jp",
            email_subject="【三井住友カード】ご利用のお知らせ",
            email_from="vpass@contact.vpass.ne.jp",
            gmail_message_id="msg_12345abcde",
            is_verified=True,
        )

        session.add(transaction)
        session.commit()

        assert transaction.id is not None
        assert transaction.card_company == "三井住友"
        assert transaction.amount == 5000
        assert transaction.merchant == "Amazon.co.jp"

    def test_unique_constraint_violation(self, session):
        """Test gmail_message_id UNIQUE constraint raises IntegrityError on duplicate."""
        transaction1 = CardTransaction(
            card_company="JCB",
            amount=3000,
            transaction_date=datetime(2026, 2, 15, 10, 0, 0),
            email_subject="JCBカードご利用のお知らせ",
            email_from="info@qa.jcb.co.jp",
            gmail_message_id="msg_duplicate_test",
        )
        session.add(transaction1)
        session.commit()

        # Attempt to insert duplicate gmail_message_id
        transaction2 = CardTransaction(
            card_company="楽天",
            amount=2000,
            transaction_date=datetime(2026, 2, 16, 12, 0, 0),
            email_subject="楽天カードご利用のお知らせ",
            email_from="info@mail.rakuten-card.co.jp",
            gmail_message_id="msg_duplicate_test",  # Same ID
        )
        session.add(transaction2)

        with pytest.raises(IntegrityError):
            session.commit()

    def test_nullable_merchant(self, session):
        """Test merchant field can be NULL."""
        transaction = CardTransaction(
            card_company="AMEX",
            amount=10000,
            transaction_date=datetime(2026, 2, 14, 18, 0, 0),
            merchant=None,  # Explicitly NULL
            email_subject="American Express ご利用のお知らせ",
            email_from="service@aexp.com",
            gmail_message_id="msg_no_merchant",
        )

        session.add(transaction)
        session.commit()

        assert transaction.merchant is None

    def test_default_values(self, session):
        """Test default values for is_verified and created_at."""
        transaction = CardTransaction(
            card_company="dカード",
            amount=7500,
            transaction_date=datetime(2026, 2, 16, 9, 30, 0),
            email_subject="dカードご利用のお知らせ",
            email_from="info@dcard.docomo.ne.jp",
            gmail_message_id="msg_defaults_test",
        )

        session.add(transaction)
        session.commit()

        # is_verified should default to False
        assert transaction.is_verified is False

        # created_at should be auto-populated
        assert transaction.created_at is not None
        assert isinstance(transaction.created_at, datetime)

    def test_repr(self, session):
        """Test __repr__ method output."""
        transaction = CardTransaction(
            card_company="三井住友",
            amount=5000,
            transaction_date=datetime(2026, 2, 15, 14, 30, 0),
            email_subject="Test",
            email_from="test@example.com",
            gmail_message_id="msg_repr_test",
        )

        repr_str = repr(transaction)
        assert "CardTransaction" in repr_str
        assert "三井住友" in repr_str
        assert "5000" in repr_str
