"""
Monthly aggregation service for card transactions.

Provides functions to aggregate transaction data by month and card company.
All aggregations exclude unverified transactions (is_verified=0).
"""

from typing import Dict, List, Optional, Any
from sqlalchemy import select, func, extract, Select
from sqlalchemy.orm import Session

from app.models.transaction import CardTransaction


def _build_monthly_query(year: int, month: int) -> Select:
    """
    Build base query with common filters for monthly aggregation.

    Filters applied:
    - is_verified = True (exclude unverified transactions)
    - transaction_date year matches
    - transaction_date month matches

    Args:
        year: Year to filter (e.g., 2026)
        month: Month to filter (1-12)

    Returns:
        SQLAlchemy select query with common WHERE clauses
    """
    return select().where(
        CardTransaction.is_verified == True,
        extract("year", CardTransaction.transaction_date) == year,
        extract("month", CardTransaction.transaction_date) == month,
    )


def _format_aggregation_result(row: Any) -> Dict:
    """
    Format aggregation result row into a dictionary.

    Handles NULL values by converting to 0 for total and average.

    Args:
        row: SQLAlchemy result row with total, count, average labels

    Returns:
        Dictionary with int values for total, count, average
    """
    return {
        "total": int(row.total) if row.total is not None else 0,
        "count": int(row.count),
        "average": int(row.average) if row.average is not None else 0,
    }


def get_monthly_summary(
    session: Session,
    year: int,
    month: int,
    card_company: Optional[str] = None,
) -> Dict:
    """
    Get monthly summary for a specific card company.

    Args:
        session: SQLAlchemy database session
        year: Year to filter (e.g., 2026)
        month: Month to filter (1-12)
        card_company: Card company name (e.g., "三井住友"). If None, aggregate all cards.

    Returns:
        Dictionary with keys:
        - total: SUM(amount)
        - count: COUNT(*)
        - average: AVG(amount)

    Example:
        >>> result = get_monthly_summary(session, 2026, 2, "三井住友")
        >>> # {"total": 6000, "count": 3, "average": 2000}
    """
    query = _build_monthly_query(year, month).add_columns(
        func.sum(CardTransaction.amount).label("total"),
        func.count(CardTransaction.id).label("count"),
        func.avg(CardTransaction.amount).label("average"),
    )

    if card_company is not None:
        query = query.where(CardTransaction.card_company == card_company)

    result = session.execute(query).one()
    return _format_aggregation_result(result)


def get_monthly_by_card(session: Session, year: int, month: int) -> List[Dict]:
    """
    Get monthly summary grouped by card company.

    Args:
        session: SQLAlchemy database session
        year: Year to filter (e.g., 2026)
        month: Month to filter (1-12)

    Returns:
        List of dictionaries, one per card company, each with keys:
        - card_company: Card company name
        - total: SUM(amount)
        - count: COUNT(*)
        - average: AVG(amount)

    Example:
        >>> results = get_monthly_by_card(session, 2026, 2)
        >>> # [
        >>> #   {"card_company": "三井住友", "total": 6000, "count": 3, "average": 2000},
        >>> #   {"card_company": "JCB", "total": 12000, "count": 2, "average": 6000}
        >>> # ]
    """
    query = (
        _build_monthly_query(year, month)
        .add_columns(
            CardTransaction.card_company,
            func.sum(CardTransaction.amount).label("total"),
            func.count(CardTransaction.id).label("count"),
            func.avg(CardTransaction.amount).label("average"),
        )
        .group_by(CardTransaction.card_company)
    )

    results = session.execute(query).all()

    return [
        {
            "card_company": row.card_company,
            **_format_aggregation_result(row),
        }
        for row in results
    ]


def get_total_by_month(session: Session, year: int, month: int) -> Dict:
    """
    Get total monthly summary for all card companies combined.

    Args:
        session: SQLAlchemy database session
        year: Year to filter (e.g., 2026)
        month: Month to filter (1-12)

    Returns:
        Dictionary with keys:
        - total: SUM(amount) across all cards
        - count: COUNT(*) across all cards
        - average: AVG(amount) across all cards

    Example:
        >>> result = get_total_by_month(session, 2026, 2)
        >>> # {"total": 18000, "count": 5, "average": 3600}
    """
    query = _build_monthly_query(year, month).add_columns(
        func.sum(CardTransaction.amount).label("total"),
        func.count(CardTransaction.id).label("count"),
        func.avg(CardTransaction.amount).label("average"),
    )

    result = session.execute(query).one()
    return _format_aggregation_result(result)


def get_all_time_summary_by_card(session: Session) -> Dict[str, Dict]:
    """
    Get all-time summary grouped by card company.

    Args:
        session: SQLAlchemy database session

    Returns:
        Dictionary with card company names as keys, each containing:
        - total: SUM(amount)
        - count: COUNT(*)
        - average: AVG(amount)

    Example:
        >>> results = get_all_time_summary_by_card(session)
        >>> # {
        >>> #   "三井住友": {"total": 10000, "count": 5, "average": 2000},
        >>> #   "楽天": {"total": 5000, "count": 2, "average": 2500}
        >>> # }
    """
    query = (
        select(
            CardTransaction.card_company,
            func.sum(CardTransaction.amount).label("total"),
            func.count(CardTransaction.id).label("count"),
            func.avg(CardTransaction.amount).label("average"),
        )
        .where(CardTransaction.is_verified == True)
        .group_by(CardTransaction.card_company)
    )

    results = session.execute(query).all()

    return {
        row.card_company: _format_aggregation_result(row)
        for row in results
    }
