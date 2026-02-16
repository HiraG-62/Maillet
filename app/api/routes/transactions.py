"""
Transaction endpoints for listing and aggregating card transactions.
"""

from fastapi import APIRouter, HTTPException, Query
from typing import Optional
import os
import re

from app.api.schemas.transaction import (
    TransactionResponse,
    MonthlySummaryResponse,
    MonthlySummaryCard,
)
from app.database.connection import get_session
from app.models.transaction import CardTransaction
from app.services.aggregation_service import get_monthly_by_card, get_total_by_month

router = APIRouter()


def validate_month_format(month: str) -> tuple[int, int]:
    """
    Validate and parse month string in YYYY-MM format.

    Args:
        month: Month string in YYYY-MM format.

    Returns:
        Tuple of (year, month) as integers.

    Raises:
        HTTPException: If format is invalid or values are out of range.
    """
    pattern = r"^(\d{4})-(\d{2})$"
    match = re.match(pattern, month)

    if not match:
        raise HTTPException(
            status_code=422,
            detail="Invalid month format. Expected YYYY-MM (e.g., 2026-02)",
        )

    year = int(match.group(1))
    month_num = int(match.group(2))

    if month_num < 1 or month_num > 12:
        raise HTTPException(
            status_code=422, detail="Month must be between 01 and 12"
        )

    return year, month_num


@router.get("/transactions", response_model=list[TransactionResponse])
def get_transactions(
    month: Optional[str] = Query(None, description="Filter by month (YYYY-MM format)")
) -> list[TransactionResponse]:
    """
    Get list of transactions, optionally filtered by month.

    Args:
        month: Optional month filter in YYYY-MM format (e.g., "2026-02").

    Returns:
        List of transactions matching the filter criteria.

    Example:
        GET /api/transactions
        GET /api/transactions?month=2026-02
    """
    db_path = os.getenv("DATABASE_PATH", "data/transactions.db")

    with get_session(db_path) as session:
        query = session.query(CardTransaction)

        # Apply month filter if provided
        if month:
            year, month_num = validate_month_format(month)
            from sqlalchemy import extract

            query = query.filter(
                extract("year", CardTransaction.transaction_date) == year,
                extract("month", CardTransaction.transaction_date) == month_num,
            )

        transactions = query.order_by(CardTransaction.transaction_date.desc()).all()

        return [
            TransactionResponse(
                id=t.id,
                card_company=t.card_company,
                amount=t.amount,
                transaction_date=t.transaction_date,
                merchant=t.merchant,
                is_verified=t.is_verified,
            )
            for t in transactions
        ]


@router.get("/transactions/summary", response_model=MonthlySummaryResponse)
def get_transactions_summary(
    month: str = Query(..., description="Month in YYYY-MM format (required)")
) -> MonthlySummaryResponse:
    """
    Get monthly summary aggregated by card company.

    Args:
        month: Month in YYYY-MM format (e.g., "2026-02"). Required.

    Returns:
        Monthly summary with per-card breakdown and grand total.

    Example:
        GET /api/transactions/summary?month=2026-02
        Response: {
            "month": "2026-02",
            "by_card": [
                {"card": "三井住友", "total": 10000, "count": 5},
                {"card": "JCB", "total": 5000, "count": 2}
            ],
            "grand_total": 15000
        }
    """
    year, month_num = validate_month_format(month)
    db_path = os.getenv("DATABASE_PATH", "data/transactions.db")

    with get_session(db_path) as session:
        # Get per-card summary
        by_card_data = get_monthly_by_card(session, year, month_num)

        # Get grand total
        total_data = get_total_by_month(session, year, month_num)

        # Transform to response schema
        by_card = [
            MonthlySummaryCard(
                card=row["card_company"], total=row["total"], count=row["count"]
            )
            for row in by_card_data
        ]

        return MonthlySummaryResponse(
            month=month, by_card=by_card, grand_total=total_data["total"]
        )
