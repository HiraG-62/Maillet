"""
Database connection management for card spending tracker.

This module provides database connection, session management, and initialization
utilities for SQLAlchemy-based operations.
"""

from contextlib import contextmanager
from pathlib import Path
from typing import Generator

from sqlalchemy import create_engine, Engine
from sqlalchemy.orm import Session, sessionmaker

from app.models.transaction import Base


class DatabaseConnection:
    """
    Manages database connection lifecycle and session creation.

    Provides a high-level interface for database operations with proper
    resource management and session lifecycle handling.

    Attributes:
        engine: SQLAlchemy Engine instance
        _session_factory: Configured sessionmaker for creating sessions
    """

    def __init__(self, db_path: str):
        """
        Initialize database connection and create tables.

        Args:
            db_path: File path to SQLite database (will be created if not exists)
        """
        # Ensure parent directory exists
        db_file = Path(db_path)
        db_file.parent.mkdir(parents=True, exist_ok=True)

        # Create engine with SQLite connection
        self.engine: Engine = create_engine(
            f"sqlite:///{db_path}",
            echo=False,  # Set to True for SQL debugging
            future=True,  # Use SQLAlchemy 2.0 API
        )

        # Create all tables defined in Base metadata
        Base.metadata.create_all(self.engine)

        # Create session factory
        self._session_factory = sessionmaker(
            bind=self.engine,
            expire_on_commit=False,
        )

    @contextmanager
    def get_session(self) -> Generator[Session, None, None]:
        """
        Context manager for database session lifecycle.

        Provides automatic session cleanup and transaction management.
        Commits on success, rolls back on exception.

        Yields:
            Session: SQLAlchemy Session instance

        Example:
            with db_connection.get_session() as session:
                transaction = session.query(CardTransaction).first()
        """
        session = self._session_factory()
        try:
            yield session
            session.commit()
        except Exception:
            session.rollback()
            raise
        finally:
            session.close()

    def close(self):
        """
        Dispose database engine and release all connections.

        Should be called when shutting down the application or
        when the connection is no longer needed.
        """
        self.engine.dispose()


# Module-level convenience functions


def get_engine(db_path: str) -> Engine:
    """
    Create and return SQLAlchemy Engine for the specified database.

    Args:
        db_path: File path to SQLite database

    Returns:
        Engine: SQLAlchemy Engine instance
    """
    # Ensure parent directory exists
    db_file = Path(db_path)
    db_file.parent.mkdir(parents=True, exist_ok=True)

    engine = create_engine(
        f"sqlite:///{db_path}",
        echo=False,
        future=True,
    )
    return engine


@contextmanager
def get_session(db_path: str) -> Generator[Session, None, None]:
    """
    Context manager for creating database session.

    Convenience function for one-off database operations without
    maintaining a persistent DatabaseConnection instance.

    Args:
        db_path: File path to SQLite database

    Yields:
        Session: SQLAlchemy Session instance

    Example:
        with get_session("data/transactions.db") as session:
            transactions = session.query(CardTransaction).all()
    """
    engine = get_engine(db_path)
    session_factory = sessionmaker(bind=engine, expire_on_commit=False)
    session = session_factory()

    try:
        yield session
        session.commit()
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()
        engine.dispose()


def init_database(db_path: str) -> None:
    """
    Initialize database and create all tables.

    Creates the database file and all tables defined in the Base metadata.
    Safe to call multiple times - existing tables are not modified.

    Args:
        db_path: File path to SQLite database

    Example:
        init_database("data/transactions.db")
    """
    engine = get_engine(db_path)
    Base.metadata.create_all(engine)
    engine.dispose()
