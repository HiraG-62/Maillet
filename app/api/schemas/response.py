"""
Common response schemas for API endpoints.
"""

from pydantic import BaseModel, Field


class HealthResponse(BaseModel):
    """Schema for health check response."""

    status: str = Field(..., description="Service status")
    version: str = Field(..., description="API version")
    db_connected: bool = Field(..., description="Database connection status")


class SyncResponse(BaseModel):
    """Schema for sync endpoint response."""

    status: str = Field(..., description="Sync operation status")
    new_transactions: int = Field(..., description="Number of new transactions synced")
    message: str = Field(..., description="Human-readable message")


class ErrorResponse(BaseModel):
    """Schema for error responses."""

    error: str = Field(..., description="Error message")
