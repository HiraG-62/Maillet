"""
FastAPI application for Card Spending Tracker.

Provides RESTful API for transaction management, aggregation, and Gmail sync.
"""

from fastapi import FastAPI

from app.api.routes import transactions, sync, health

# Create FastAPI application
app = FastAPI(
    title="Card Spending Tracker API",
    version="0.1.0",
    description="API for managing credit card spending across multiple cards",
)

# Include routers
app.include_router(transactions.router, prefix="/api", tags=["transactions"])
app.include_router(sync.router, prefix="/api", tags=["sync"])
app.include_router(health.router, prefix="/api", tags=["health"])


@app.get("/")
def root():
    """Root endpoint - redirects to API documentation."""
    return {
        "message": "Card Spending Tracker API",
        "docs": "/docs",
        "version": "0.1.0",
    }
