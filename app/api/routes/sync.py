"""
Gmail sync endpoint with real Gmail integration.

Provides trigger endpoint for Gmail synchronization.
Fetches emails from Gmail, parses transaction data, and saves to database.
"""

import os
import logging
from fastapi import APIRouter, HTTPException
from googleapiclient.discovery import build

from app.api.schemas.response import SyncResponse
from app.gmail.auth import authenticate
from app.gmail.client import GmailClient
from app.gmail.parser import detect_card_company, extract_amount, extract_transaction_date, extract_merchant
from app.services.transaction_service import save_transaction
from app.database.connection import get_session

logger = logging.getLogger(__name__)
router = APIRouter()

# Gmail query for card notification emails
GMAIL_QUERY = "from:(@contact.vpass.ne.jp OR @qa.jcb.co.jp OR @mail.rakuten-card.co.jp OR @aexp.com OR @dcard.docomo.ne.jp)"


@router.post("/sync", response_model=SyncResponse)
def sync_gmail() -> SyncResponse:
    """
    Trigger Gmail synchronization with real Gmail API integration.

    Fetches card notification emails from Gmail, parses transaction data,
    and saves to database with automatic duplicate detection.

    Returns:
        SyncResponse with status, synced count, and message.

    Raises:
        HTTPException: If authentication fails or Gmail API error occurs.

    Example:
        POST /api/sync
        Response: {
            "status": "success",
            "new_transactions": 5,
            "message": "Synced 5 new transactions, skipped 2 duplicates"
        }
    """
    try:
        # Authenticate and build Gmail service
        credentials_path = os.getenv("CREDENTIALS_PATH", "credentials/credentials.json")
        token_path = os.getenv("TOKEN_PATH", "credentials/token.pickle")
        creds = authenticate(credentials_path, token_path)
        service = build("gmail", "v1", credentials=creds)

        # Create Gmail client and fetch messages
        client = GmailClient(service)
        messages = client.list_messages(query=GMAIL_QUERY, max_results=100)

        if not messages:
            return SyncResponse(
                status="success",
                new_transactions=0,
                message="No new emails found"
            )

        # Process each message
        new_count = 0
        skipped_count = 0
        db_path = os.getenv("DATABASE_PATH", "data/transactions.db")

        with get_session(db_path) as session:
            for msg in messages:
                try:
                    # Fetch full message
                    full_msg = client.get_message(msg["id"])

                    # Extract email metadata
                    headers = full_msg.get("payload", {}).get("headers", [])
                    subject = next((h["value"] for h in headers if h["name"] == "Subject"), "")
                    from_addr = next((h["value"] for h in headers if h["name"] == "From"), "")

                    # Get email body (simplified - gets snippet for now)
                    email_body = full_msg.get("snippet", "")

                    # Parse transaction data
                    card_company = detect_card_company(subject, from_addr)
                    if not card_company:
                        logger.warning(f"Could not detect card company for message {msg['id']}")
                        skipped_count += 1
                        continue

                    amount = extract_amount(email_body, card_company)
                    transaction_date = extract_transaction_date(email_body, card_company)
                    merchant = extract_merchant(email_body, card_company)

                    if not amount or not transaction_date:
                        logger.warning(f"Missing required fields for message {msg['id']}")
                        skipped_count += 1
                        continue

                    # Save transaction
                    transaction_data = {
                        "card_company": card_company,
                        "amount": amount,
                        "transaction_date": transaction_date,
                        "merchant": merchant or "Unknown",
                        "email_subject": subject,
                        "email_from": from_addr,
                        "gmail_message_id": msg["id"],
                    }

                    result = save_transaction(session, transaction_data)
                    if result:
                        new_count += 1
                    else:
                        skipped_count += 1

                except Exception as e:
                    logger.error(f"Error processing message {msg['id']}: {e}")
                    skipped_count += 1

            # Commit all changes
            session.commit()

        message = f"Synced {new_count} new transactions"
        if skipped_count > 0:
            message += f", skipped {skipped_count} duplicates/errors"

        return SyncResponse(
            status="success",
            new_transactions=new_count,
            message=message
        )

    except FileNotFoundError as e:
        logger.error(f"Credentials not found: {e}")
        raise HTTPException(
            status_code=500,
            detail="Credentials not configured. Please run setup first."
        )
    except Exception as e:
        logger.error(f"Sync error: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Sync failed: {str(e)}"
        )
