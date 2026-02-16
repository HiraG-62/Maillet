"""
Tests for FastAPI endpoints.

Testing strategy follows TDD principles:
1. Write tests first (RED phase)
2. Implement minimal code to pass (GREEN phase)
3. Refactor for error handling and edge cases (REFACTOR phase)
"""

import pytest
from fastapi.testclient import TestClient
from datetime import datetime
from unittest.mock import patch, MagicMock

# Tests will fail initially - API endpoints not yet implemented


class TestHealthEndpoint:
    """Tests for GET /api/health endpoint."""

    def test_health_check_success(self):
        """Health check returns 200 with status ok."""
        from app.api.main import app

        client = TestClient(app)
        response = client.get("/api/health")

        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "ok"
        assert data["version"] == "0.1.0"
        assert "db_connected" in data

    def test_health_check_db_connection(self):
        """Health check verifies database connectivity."""
        from app.api.main import app

        client = TestClient(app)
        response = client.get("/api/health")

        data = response.json()
        assert isinstance(data["db_connected"], bool)


class TestTransactionsEndpoint:
    """Tests for GET /api/transactions endpoint."""

    def test_get_transactions_success(self):
        """GET /api/transactions returns transaction list."""
        from app.api.main import app

        client = TestClient(app)
        response = client.get("/api/transactions")

        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)

    def test_get_transactions_with_month_filter(self):
        """GET /api/transactions?month=2026-02 filters by month."""
        from app.api.main import app

        client = TestClient(app)
        response = client.get("/api/transactions?month=2026-02")

        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)

    def test_get_transactions_invalid_month_format(self):
        """GET /api/transactions with invalid month format returns 422."""
        from app.api.main import app

        client = TestClient(app)
        response = client.get("/api/transactions?month=invalid")

        assert response.status_code == 422

    def test_get_transactions_response_schema(self):
        """Transaction response includes required fields."""
        from app.api.main import app

        client = TestClient(app)
        response = client.get("/api/transactions")

        data = response.json()
        if len(data) > 0:
            transaction = data[0]
            required_fields = [
                "id",
                "card_company",
                "amount",
                "transaction_date",
                "is_verified",
            ]
            for field in required_fields:
                assert field in transaction


class TestTransactionsSummaryEndpoint:
    """Tests for GET /api/transactions/summary endpoint."""

    def test_get_summary_success(self):
        """GET /api/transactions/summary returns monthly summary."""
        from app.api.main import app

        client = TestClient(app)
        response = client.get("/api/transactions/summary?month=2026-02")

        assert response.status_code == 200
        data = response.json()
        assert "month" in data
        assert "by_card" in data
        assert "grand_total" in data
        assert isinstance(data["by_card"], list)

    def test_get_summary_missing_month_parameter(self):
        """GET /api/transactions/summary without month returns 422."""
        from app.api.main import app

        client = TestClient(app)
        response = client.get("/api/transactions/summary")

        assert response.status_code == 422

    def test_get_summary_invalid_month_format(self):
        """GET /api/transactions/summary with invalid month returns 422."""
        from app.api.main import app

        client = TestClient(app)
        response = client.get("/api/transactions/summary?month=2026-13")

        assert response.status_code == 422

    def test_get_summary_response_schema(self):
        """Summary response has correct schema structure."""
        from app.api.main import app

        client = TestClient(app)
        response = client.get("/api/transactions/summary?month=2026-02")

        data = response.json()
        assert data["month"] == "2026-02"
        assert isinstance(data["grand_total"], int)

        if len(data["by_card"]) > 0:
            card_data = data["by_card"][0]
            assert "card" in card_data
            assert "total" in card_data
            assert "count" in card_data


class TestSyncEndpoint:
    """Tests for POST /api/sync endpoint with Gmail integration."""

    @patch("app.api.routes.sync.authenticate")
    @patch("app.api.routes.sync.build")
    @patch("app.api.routes.sync.get_session")
    def test_sync_gmail_success_with_messages(
        self, mock_get_session, mock_build, mock_authenticate
    ):
        """POST /api/sync successfully syncs messages from Gmail."""
        from app.api.main import app

        # Mock Gmail API responses
        mock_service = MagicMock()
        mock_build.return_value = mock_service

        # Mock GmailClient.list_messages to return 2 messages
        mock_messages = [{"id": "msg1"}, {"id": "msg2"}]

        # Mock GmailClient.get_message responses
        def mock_get_message_side_effect(msg_id):
            return {
                "id": msg_id,
                "payload": {
                    "headers": [
                        {"name": "Subject", "value": "三井住友カード利用通知"},
                        {"name": "From", "value": "notify@contact.vpass.ne.jp"},
                    ]
                },
                "snippet": "ご利用金額: ¥5,000円 利用日時: 2026-02-15 14:30 ご利用先: Amazon",
            }

        # Mock session for database operations
        mock_session = MagicMock()
        mock_get_session.return_value.__enter__.return_value = mock_session

        # Patch list_messages and get_message methods
        with patch("app.api.routes.sync.GmailClient") as MockGmailClient:
            mock_client = MockGmailClient.return_value
            mock_client.list_messages.return_value = mock_messages
            mock_client.get_message.side_effect = mock_get_message_side_effect

            # Patch save_transaction to return success
            with patch("app.api.routes.sync.save_transaction") as mock_save:
                mock_save.return_value = MagicMock()  # Return non-None for success

                client = TestClient(app)
                response = client.post("/api/sync")

                assert response.status_code == 200
                data = response.json()
                assert data["status"] == "success"
                assert data["new_transactions"] == 2
                assert "2 new transactions" in data["message"]

    @patch("app.api.routes.sync.authenticate")
    @patch("app.api.routes.sync.build")
    @patch("app.api.routes.sync.get_session")
    def test_sync_gmail_no_messages(
        self, mock_get_session, mock_build, mock_authenticate
    ):
        """POST /api/sync returns success when no messages found."""
        from app.api.main import app

        mock_service = MagicMock()
        mock_build.return_value = mock_service

        with patch("app.api.routes.sync.GmailClient") as MockGmailClient:
            mock_client = MockGmailClient.return_value
            mock_client.list_messages.return_value = []  # No messages

            client = TestClient(app)
            response = client.post("/api/sync")

            assert response.status_code == 200
            data = response.json()
            assert data["status"] == "success"
            assert data["new_transactions"] == 0
            assert "No new emails" in data["message"]

    def test_sync_method_not_allowed(self):
        """GET /api/sync returns 405 method not allowed."""
        from app.api.main import app

        client = TestClient(app)
        response = client.get("/api/sync")

        assert response.status_code == 405


class TestRootEndpoint:
    """Tests for root endpoint."""

    def test_root_endpoint(self):
        """GET / returns API information."""
        from app.api.main import app

        client = TestClient(app)
        response = client.get("/")

        assert response.status_code == 200
        data = response.json()
        assert "message" in data
        assert data["version"] == "0.1.0"
        assert data["docs"] == "/docs"


class TestEdgeCases:
    """Edge case tests for API endpoints."""

    def test_transactions_empty_database(self):
        """GET /api/transactions returns empty list when no data exists."""
        from app.api.main import app

        client = TestClient(app)
        # Using a non-existent month to ensure empty results
        response = client.get("/api/transactions?month=1999-01")

        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        assert len(data) == 0

    def test_summary_empty_month(self):
        """GET /api/transactions/summary returns zero totals for empty month."""
        from app.api.main import app

        client = TestClient(app)
        response = client.get("/api/transactions/summary?month=1999-01")

        assert response.status_code == 200
        data = response.json()
        assert data["month"] == "1999-01"
        assert data["grand_total"] == 0
        assert isinstance(data["by_card"], list)
        assert len(data["by_card"]) == 0

    def test_transactions_year_boundary(self):
        """GET /api/transactions handles year boundaries correctly."""
        from app.api.main import app

        client = TestClient(app)
        # Test December
        response = client.get("/api/transactions?month=2025-12")
        assert response.status_code == 200

        # Test January
        response = client.get("/api/transactions?month=2026-01")
        assert response.status_code == 200
