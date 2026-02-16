"""
Health check endpoint.

Provides service health status and database connectivity verification.
"""

from fastapi import APIRouter
from sqlalchemy import text
import os

from app.api.schemas.response import HealthResponse
from app.database.connection import get_engine

router = APIRouter()


@router.get("/health", response_model=HealthResponse)
def health_check() -> HealthResponse:
    """
    Health check endpoint.

    Returns:
        HealthResponse with status, version, and database connection status.

    Example:
        GET /api/health
        Response: {"status": "ok", "version": "0.1.0", "db_connected": true}
    """
    # Check database connectivity
    db_connected = False
    try:
        db_path = os.getenv("DATABASE_PATH", "data/transactions.db")
        engine = get_engine(db_path)
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        db_connected = True
        engine.dispose()
    except Exception:
        db_connected = False

    return HealthResponse(status="ok", version="0.1.0", db_connected=db_connected)
