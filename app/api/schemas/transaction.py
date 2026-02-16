"""
Pydantic schemas for transaction data validation.
"""

from datetime import datetime
from pydantic import BaseModel, ConfigDict, Field
from typing import Optional


class TransactionResponse(BaseModel):
    """Schema for transaction response."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    card_company: str
    amount: int
    transaction_date: datetime
    merchant: Optional[str] = None
    is_verified: bool = False


class MonthlySummaryCard(BaseModel):
    """Schema for per-card summary data."""

    card: str = Field(..., description="Card company name")
    total: int = Field(..., description="Total spending amount")
    count: int = Field(..., description="Number of transactions")


class MonthlySummaryResponse(BaseModel):
    """Schema for monthly summary response."""

    month: str = Field(..., description="Month in YYYY-MM format")
    by_card: list[MonthlySummaryCard] = Field(..., description="Summary by card company")
    grand_total: int = Field(..., description="Total spending across all cards")
