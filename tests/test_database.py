"""
Unit tests for database connection management and CRUD operations.

Tests verify:
- Database connection initialization
- Session management
- Basic CRUD operations (Create, Read, Update, Delete)
- Transaction rollback behavior
- Index creation
"""

import pytest
from datetime import datetime
from pathlib import Path
from sqlalchemy import create_engine, inspect
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError

from app.models.transaction import CardTransaction, Base
from app.database.connection import (
    DatabaseConnection,
    get_engine,
    get_session,
    init_database,
)


@pytest.fixture
def db_path(tmp_path):
    """Provide temporary database path for testing."""
    return tmp_path / "test_transactions.db"


@pytest.fixture
def db_connection(db_path):
    """Create DatabaseConnection instance with temporary database."""
    connection = DatabaseConnection(str(db_path))
    yield connection
    connection.close()


@pytest.fixture
def session(db_connection):
    """Create database session for testing."""
    with db_connection.get_session() as session:
        yield session


class TestDatabaseConnection:
    """Test suite for DatabaseConnection class."""

    def test_init_creates_engine(self, db_path):
        """Test DatabaseConnection initialization creates engine."""
        connection = DatabaseConnection(str(db_path))
        assert connection.engine is not None
        connection.close()

    def test_init_creates_tables(self, db_path):
        """Test DatabaseConnection initialization creates all tables."""
        connection = DatabaseConnection(str(db_path))
        inspector = inspect(connection.engine)
        tables = inspector.get_table_names()
        assert "card_transactions" in tables
        connection.close()

    def test_get_session_returns_session(self, db_connection):
        """Test get_session() returns valid Session instance."""
        with db_connection.get_session() as session:
            assert isinstance(session, Session)

    def test_close_disposes_engine(self, db_connection):
        """Test close() disposes engine resources."""
        db_connection.close()
        # Verify engine is disposed (no connections in pool or checked out)
        status = db_connection.engine.pool.status()
        assert "Connections in pool: 0" in status
        assert "Current Checked out connections: 0" in status


class TestCRUDOperations:
    """Test suite for CRUD operations on CardTransaction."""

    def test_create_transaction(self, session):
        """Test INSERT operation creates new transaction record."""
        transaction = CardTransaction(
            card_company="三井住友",
            amount=5000,
            transaction_date=datetime(2026, 2, 15, 14, 30, 0),
            merchant="Amazon.co.jp",
            email_subject="【三井住友カード】ご利用のお知らせ",
            email_from="vpass@contact.vpass.ne.jp",
            gmail_message_id="msg_create_test_001",
        )

        session.add(transaction)
        session.commit()

        # Verify record was created with ID assigned
        assert transaction.id is not None
        assert transaction.id > 0

    def test_read_transaction_by_id(self, session):
        """Test SELECT operation retrieves transaction by ID."""
        # Create test data
        transaction = CardTransaction(
            card_company="JCB",
            amount=3000,
            transaction_date=datetime(2026, 2, 16, 10, 0, 0),
            email_subject="JCBカードご利用のお知らせ",
            email_from="info@qa.jcb.co.jp",
            gmail_message_id="msg_read_test_001",
        )
        session.add(transaction)
        session.commit()
        transaction_id = transaction.id

        # Read back from database
        retrieved = session.get(CardTransaction, transaction_id)
        assert retrieved is not None
        assert retrieved.id == transaction_id
        assert retrieved.card_company == "JCB"
        assert retrieved.amount == 3000

    def test_read_transaction_by_gmail_message_id(self, session):
        """Test SELECT operation with WHERE clause (gmail_message_id)."""
        # Create test data
        transaction = CardTransaction(
            card_company="楽天",
            amount=2000,
            transaction_date=datetime(2026, 2, 16, 12, 0, 0),
            email_subject="楽天カードご利用のお知らせ",
            email_from="info@mail.rakuten-card.co.jp",
            gmail_message_id="msg_query_test_001",
        )
        session.add(transaction)
        session.commit()

        # Query by gmail_message_id
        result = session.query(CardTransaction).filter_by(
            gmail_message_id="msg_query_test_001"
        ).first()

        assert result is not None
        assert result.card_company == "楽天"
        assert result.amount == 2000

    def test_update_transaction(self, session):
        """Test UPDATE operation modifies existing record."""
        # Create test data
        transaction = CardTransaction(
            card_company="AMEX",
            amount=10000,
            transaction_date=datetime(2026, 2, 14, 18, 0, 0),
            email_subject="American Express ご利用のお知らせ",
            email_from="service@aexp.com",
            gmail_message_id="msg_update_test_001",
            is_verified=False,
        )
        session.add(transaction)
        session.commit()
        transaction_id = transaction.id

        # Update is_verified flag
        transaction.is_verified = True
        transaction.merchant = "Apple Store"
        session.commit()

        # Read back and verify update
        updated = session.get(CardTransaction, transaction_id)
        assert updated.is_verified is True
        assert updated.merchant == "Apple Store"

    def test_delete_transaction(self, session):
        """Test DELETE operation removes record from database."""
        # Create test data
        transaction = CardTransaction(
            card_company="dカード",
            amount=7500,
            transaction_date=datetime(2026, 2, 16, 9, 30, 0),
            email_subject="dカードご利用のお知らせ",
            email_from="info@dcard.docomo.ne.jp",
            gmail_message_id="msg_delete_test_001",
        )
        session.add(transaction)
        session.commit()
        transaction_id = transaction.id

        # Delete record
        session.delete(transaction)
        session.commit()

        # Verify record is deleted
        deleted = session.get(CardTransaction, transaction_id)
        assert deleted is None

    def test_query_all_transactions(self, session):
        """Test SELECT operation retrieves all records."""
        # Create multiple test records
        transactions = [
            CardTransaction(
                card_company="カード1",
                amount=1000,
                transaction_date=datetime(2026, 2, 15, 10, 0, 0),
                email_subject="テスト1",
                email_from="test1@example.com",
                gmail_message_id=f"msg_all_test_{i}",
            )
            for i in range(5)
        ]

        session.add_all(transactions)
        session.commit()

        # Query all records
        all_records = session.query(CardTransaction).all()
        assert len(all_records) >= 5


class TestTransactionRollback:
    """Test suite for transaction rollback behavior."""

    def test_rollback_prevents_insert(self, db_connection):
        """Test session rollback prevents INSERT from persisting."""
        with db_connection.get_session() as session:
            transaction = CardTransaction(
                card_company="テスト",
                amount=9999,
                transaction_date=datetime(2026, 2, 16, 15, 0, 0),
                email_subject="ロールバックテスト",
                email_from="rollback@test.com",
                gmail_message_id="msg_rollback_test_001",
            )
            session.add(transaction)
            session.rollback()  # Rollback before commit

        # Verify record was NOT created
        with db_connection.get_session() as session:
            result = session.query(CardTransaction).filter_by(
                gmail_message_id="msg_rollback_test_001"
            ).first()
            assert result is None

    def test_rollback_reverts_update(self, db_connection):
        """Test session rollback reverts UPDATE operation."""
        # Create initial record
        with db_connection.get_session() as session:
            transaction = CardTransaction(
                card_company="テスト",
                amount=5000,
                transaction_date=datetime(2026, 2, 16, 15, 0, 0),
                email_subject="更新ロールバックテスト",
                email_from="update_rollback@test.com",
                gmail_message_id="msg_update_rollback_001",
                is_verified=False,
            )
            session.add(transaction)
            session.commit()
            transaction_id = transaction.id

        # Attempt update then rollback
        with db_connection.get_session() as session:
            transaction = session.get(CardTransaction, transaction_id)
            transaction.is_verified = True
            session.rollback()  # Rollback before commit

        # Verify update was reverted
        with db_connection.get_session() as session:
            transaction = session.get(CardTransaction, transaction_id)
            assert transaction.is_verified is False


class TestDatabaseIndexes:
    """Test suite for database index creation."""

    def test_gmail_message_id_index_exists(self, db_connection):
        """Test index on gmail_message_id column exists."""
        inspector = inspect(db_connection.engine)
        indexes = inspector.get_indexes("card_transactions")

        # Check if gmail_message_id has an index (either explicit or via unique constraint)
        index_columns = []
        for index in indexes:
            index_columns.extend(index["column_names"])

        # Unique constraint creates implicit index
        unique_constraints = inspector.get_unique_constraints("card_transactions")
        for constraint in unique_constraints:
            index_columns.extend(constraint["column_names"])

        assert "gmail_message_id" in index_columns


class TestModuleFunctions:
    """Test suite for module-level convenience functions."""

    def test_get_engine_returns_engine(self, db_path):
        """Test get_engine() returns SQLAlchemy Engine."""
        engine = get_engine(str(db_path))
        assert engine is not None
        engine.dispose()

    def test_get_session_context_manager(self, db_path):
        """Test get_session() as context manager."""
        init_database(str(db_path))
        with get_session(str(db_path)) as session:
            assert isinstance(session, Session)

    def test_init_database_creates_tables(self, db_path):
        """Test init_database() creates all tables."""
        init_database(str(db_path))
        engine = get_engine(str(db_path))
        inspector = inspect(engine)
        assert "card_transactions" in inspector.get_table_names()
        engine.dispose()
