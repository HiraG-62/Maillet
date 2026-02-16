"""
Transaction service for saving card transactions with duplicate detection.

This module provides business logic for handling card transaction data,
including automatic duplicate detection via gmail_message_id UNIQUE constraint.
"""

import logging
from typing import Dict, Optional

from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError

from app.models.transaction import CardTransaction


logger = logging.getLogger(__name__)


def save_transaction(
    session: Session, transaction_data: Dict
) -> Optional[CardTransaction]:
    """
    Save a card transaction to the database with duplicate detection.

    If a transaction with the same gmail_message_id already exists,
    the IntegrityError is caught, the transaction is rolled back to a savepoint,
    and None is returned.

    Uses nested transactions (savepoints) to isolate rollback to the current
    operation only, preventing interference with other transactions in the session.

    Args:
        session: SQLAlchemy Session instance
        transaction_data: Dictionary containing transaction fields:
            - card_company: str
            - amount: int
            - transaction_date: datetime
            - merchant: str (optional)
            - email_subject: str
            - email_from: str
            - gmail_message_id: str (must be unique)

    Returns:
        CardTransaction object if saved successfully, None if duplicate

    Example:
        >>> data = {
        ...     "card_company": "楽天カード",
        ...     "amount": 5000,
        ...     "transaction_date": datetime(2024, 1, 15, 10, 30),
        ...     "merchant": "Amazon",
        ...     "email_subject": "カード利用のお知らせ",
        ...     "email_from": "info@example.com",
        ...     "gmail_message_id": "msg_001",
        ... }
        >>> result = save_transaction(session, data)
    """
    # Use nested transaction (savepoint) to isolate rollback
    savepoint = session.begin_nested()

    try:
        transaction = CardTransaction(**transaction_data)
        session.add(transaction)
        session.flush()  # Trigger IntegrityError if duplicate exists
        savepoint.commit()
        return transaction
    except IntegrityError:
        savepoint.rollback()
        gmail_message_id = transaction_data.get("gmail_message_id", "unknown")
        logger.info(f"Duplicate email skipped: {gmail_message_id}")
        return None
