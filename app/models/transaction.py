"""
CardTransaction SQLAlchemy model for storing credit card transaction records.

This module defines the database schema for card transactions extracted from
Gmail notification emails.
"""

from datetime import datetime
from sqlalchemy import Column, Integer, String, Boolean, DateTime, UniqueConstraint
from sqlalchemy.orm import declarative_base

Base = declarative_base()


class CardTransaction(Base):
    """
    SQLAlchemy model for credit card transaction records.

    Attributes:
        id: Auto-incrementing primary key
        card_company: Card issuer name (e.g., "三井住友", "JCB")
        amount: Transaction amount in yen (integer)
        transaction_date: Date and time of the transaction
        merchant: Store/merchant name (nullable)
        email_subject: Original email subject line
        email_from: Sender email address
        gmail_message_id: Unique Gmail message identifier
        is_verified: Manual verification flag (default: False)
        created_at: Record creation timestamp
    """

    __tablename__ = "card_transactions"

    id = Column(Integer, primary_key=True, autoincrement=True)
    card_company = Column(String, nullable=False)
    amount = Column(Integer, nullable=False)
    transaction_date = Column(DateTime, nullable=False)
    merchant = Column(String, nullable=True)
    email_subject = Column(String, nullable=False)
    email_from = Column(String, nullable=False)
    gmail_message_id = Column(String, nullable=False, unique=True)
    is_verified = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    __table_args__ = (
        UniqueConstraint("gmail_message_id", name="uq_gmail_message_id"),
    )

    def __repr__(self) -> str:
        """String representation of CardTransaction."""
        return (
            f"<CardTransaction(id={self.id}, "
            f"card_company='{self.card_company}', "
            f"amount={self.amount}, "
            f"transaction_date={self.transaction_date})>"
        )
