"""
CLI command tests using Click CliRunner.

Tests cover sync, summary, and setup commands with both success and error cases.
Uses mocking to avoid actual Gmail API calls during testing.
"""

import pytest
from click.testing import CliRunner
from unittest.mock import patch, MagicMock, Mock
from datetime import datetime

from app.cli.commands import cli


@pytest.fixture
def runner():
    """Create a CliRunner for testing Click commands."""
    return CliRunner()


# ============================================================================
# sync command tests
# ============================================================================


def test_sync_command_success(runner):
    """Test sync command with successful Gmail API call."""
    with patch("app.cli.commands.authenticate") as mock_auth, \
         patch("app.cli.commands.GmailClient") as mock_client, \
         patch("app.cli.commands.DatabaseConnection") as mock_db:

        # Mock authenticate to return credentials
        mock_creds = MagicMock()
        mock_auth.return_value = mock_creds

        # Mock Gmail client to return messages
        mock_gmail = MagicMock()
        mock_gmail.list_messages.return_value = [
            {"id": "msg001", "threadId": "thread001"},
            {"id": "msg002", "threadId": "thread002"},
        ]
        mock_client.return_value = mock_gmail

        # Mock database connection
        mock_db_instance = MagicMock()
        mock_db.return_value = mock_db_instance

        result = runner.invoke(cli, ["sync"])

        assert result.exit_code == 0
        assert "2件の新規取引を追加しました" in result.output or \
               "同期完了" in result.output


def test_sync_command_oauth_not_configured(runner):
    """Test sync command when credentials.json is missing."""
    with patch("app.cli.commands.authenticate") as mock_auth:
        # Mock authenticate to raise FileNotFoundError
        mock_auth.side_effect = FileNotFoundError("credentials.json not found")

        result = runner.invoke(cli, ["sync"])

        assert result.exit_code != 0
        assert "credentials.json" in result.output or \
               "エラー" in result.output


def test_sync_command_token_encryption_key_missing(runner):
    """Test sync command when TOKEN_ENCRYPTION_KEY is not set."""
    with patch("app.cli.commands.authenticate") as mock_auth:
        # Mock authenticate to raise EnvironmentError
        mock_auth.side_effect = EnvironmentError("TOKEN_ENCRYPTION_KEY not set")

        result = runner.invoke(cli, ["sync"])

        assert result.exit_code != 0
        assert "TOKEN_ENCRYPTION_KEY" in result.output or \
               "環境変数" in result.output


def test_sync_command_no_new_messages(runner):
    """Test sync command when no new messages are found."""
    with patch("app.cli.commands.authenticate") as mock_auth, \
         patch("app.cli.commands.GmailClient") as mock_client, \
         patch("app.cli.commands.DatabaseConnection") as mock_db:

        # Mock authenticate
        mock_auth.return_value = MagicMock()

        # Mock Gmail client to return empty list
        mock_gmail = MagicMock()
        mock_gmail.list_messages.return_value = []
        mock_client.return_value = mock_gmail

        # Mock database
        mock_db.return_value = MagicMock()

        result = runner.invoke(cli, ["sync"])

        assert result.exit_code == 0
        assert "0件" in result.output or "新規取引はありません" in result.output


def test_sync_command_gmail_api_error(runner):
    """Test sync command when Gmail API returns an error."""
    with patch("app.cli.commands.authenticate") as mock_auth, \
         patch("app.cli.commands.GmailClient") as mock_client:

        # Mock authenticate
        mock_auth.return_value = MagicMock()

        # Mock Gmail client to raise HttpError
        mock_gmail = MagicMock()
        mock_gmail.list_messages.side_effect = Exception("Gmail API Error")
        mock_client.return_value = mock_gmail

        result = runner.invoke(cli, ["sync"])

        assert result.exit_code != 0
        assert "エラー" in result.output or "Gmail API" in result.output


# ============================================================================
# summary command tests
# ============================================================================


def test_summary_command_default(runner):
    """Test summary command with default options (all time, all cards)."""
    with patch("app.cli.commands.DatabaseConnection") as mock_db:
        # Mock database and aggregation results
        mock_db_instance = MagicMock()
        mock_session = MagicMock()
        mock_db_instance.get_session.return_value.__enter__.return_value = mock_session
        mock_db.return_value = mock_db_instance

        # Mock aggregation service
        with patch("app.cli.commands.get_all_time_summary_by_card") as mock_summary:
            mock_summary.return_value = {
                "三井住友": {"total": 10000, "count": 5, "average": 2000},
                "楽天": {"total": 5000, "count": 2, "average": 2500},
            }

            result = runner.invoke(cli, ["summary"])

            assert result.exit_code == 0
            assert "三井住友" in result.output
            assert "10000" in result.output or "10,000" in result.output
            assert "楽天" in result.output


def test_summary_command_with_month_option(runner):
    """Test summary command with --month option."""
    with patch("app.cli.commands.DatabaseConnection") as mock_db:
        # Mock database
        mock_db_instance = MagicMock()
        mock_session = MagicMock()
        mock_db_instance.get_session.return_value.__enter__.return_value = mock_session
        mock_db.return_value = mock_db_instance

        # Mock aggregation service - get_monthly_by_card returns list
        with patch("app.services.aggregation_service.get_monthly_by_card") as mock_summary:
            mock_summary.return_value = [
                {"card_company": "三井住友", "total": 10000, "count": 5, "average": 2000},
                {"card_company": "楽天", "total": 5000, "count": 2, "average": 2500},
            ]

            result = runner.invoke(cli, ["summary", "--month", "2026-02"])

            assert result.exit_code == 0
            assert "2026-02" in result.output
            assert "三井住友" in result.output


def test_summary_command_with_card_option(runner):
    """Test summary command with --card option."""
    with patch("app.cli.commands.DatabaseConnection") as mock_db:
        # Mock database
        mock_db_instance = MagicMock()
        mock_session = MagicMock()
        mock_db_instance.get_session.return_value.__enter__.return_value = mock_session
        mock_db.return_value = mock_db_instance

        # Mock aggregation service - all time summary by card
        with patch("app.cli.commands.get_all_time_summary_by_card") as mock_summary:
            mock_summary.return_value = {
                "三井住友": {"total": 10000, "count": 5, "average": 2000},
                "楽天": {"total": 5000, "count": 2, "average": 2500},
            }

            result = runner.invoke(cli, ["summary", "--card", "三井住友"])

            assert result.exit_code == 0
            assert "三井住友" in result.output
            assert "10000" in result.output or "10,000" in result.output


def test_summary_command_invalid_month_format(runner):
    """Test summary command with invalid --month format."""
    result = runner.invoke(cli, ["summary", "--month", "2026/02"])

    assert result.exit_code != 0
    assert "Invalid" in result.output or "不正" in result.output or "形式" in result.output


def test_summary_command_no_data(runner):
    """Test summary command when no transaction data exists."""
    with patch("app.cli.commands.DatabaseConnection") as mock_db:
        # Mock database
        mock_db_instance = MagicMock()
        mock_session = MagicMock()
        mock_db_instance.get_session.return_value.__enter__.return_value = mock_session
        mock_db.return_value = mock_db_instance

        # Mock aggregation service to return empty dict
        with patch("app.cli.commands.get_all_time_summary_by_card") as mock_summary:
            mock_summary.return_value = {}

            result = runner.invoke(cli, ["summary"])

            assert result.exit_code == 0
            assert "データが見つかりません" in result.output or \
                   "取引データがありません" in result.output


# ============================================================================
# setup command tests
# ============================================================================


def test_setup_command_success(runner):
    """Test setup command with successful OAuth flow."""
    with patch("app.cli.commands.authenticate") as mock_auth, \
         patch("app.cli.commands.os.getenv") as mock_getenv:
        # Mock environment variable
        mock_getenv.return_value = "test_encryption_key"
        # Mock authenticate to complete successfully
        mock_auth.return_value = MagicMock()

        result = runner.invoke(cli, ["setup"])

        assert result.exit_code == 0
        assert "認証完了" in result.output or "setup complete" in result.output.lower()


def test_setup_command_credentials_missing(runner):
    """Test setup command when credentials.json is missing."""
    with patch("app.cli.commands.authenticate") as mock_auth:
        # Mock authenticate to raise FileNotFoundError
        mock_auth.side_effect = FileNotFoundError("credentials.json not found")

        result = runner.invoke(cli, ["setup"])

        assert result.exit_code != 0
        assert "credentials.json" in result.output


def test_setup_command_token_encryption_key_missing(runner):
    """Test setup command when TOKEN_ENCRYPTION_KEY is not set."""
    with patch("app.cli.commands.authenticate") as mock_auth:
        # Mock authenticate to raise EnvironmentError
        mock_auth.side_effect = EnvironmentError("TOKEN_ENCRYPTION_KEY not set")

        result = runner.invoke(cli, ["setup"])

        assert result.exit_code != 0
        assert "TOKEN_ENCRYPTION_KEY" in result.output


def test_setup_command_user_cancellation(runner):
    """Test setup command when user cancels OAuth flow."""
    with patch("app.cli.commands.authenticate") as mock_auth, \
         patch("app.cli.commands.os.getenv") as mock_getenv:
        # Mock environment variable
        mock_getenv.return_value = "test_encryption_key"
        # Mock authenticate to raise user cancellation error
        mock_auth.side_effect = Exception("User denied access")

        result = runner.invoke(cli, ["setup"])

        assert result.exit_code != 0
        assert "キャンセル" in result.output or "denied" in result.output.lower()
