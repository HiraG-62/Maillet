"""
Gmail sync endpoint (stub implementation).

Provides trigger endpoint for Gmail synchronization.
Currently returns stub response as Gmail integration is not yet implemented.
"""

from fastapi import APIRouter

from app.api.schemas.response import SyncResponse

router = APIRouter()


@router.post("/sync", response_model=SyncResponse)
def sync_gmail() -> SyncResponse:
    """
    Trigger Gmail synchronization (stub implementation).

    This endpoint is a stub that returns a success response without
    actually performing Gmail synchronization. Real implementation
    will be added in a future phase when Gmail credentials are configured.

    Returns:
        SyncResponse with status and message indicating stub implementation.

    Example:
        POST /api/sync
        Response: {
            "status": "success",
            "new_transactions": 0,
            "message": "Sync not implemented"
        }
    """
    return SyncResponse(
        status="success", new_transactions=0, message="Sync not implemented"
    )
