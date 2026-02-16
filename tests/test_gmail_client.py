"""
Gmail API クライアントのテスト（TDD Phase 1）
テストケース: T-API-009 ~ T-API-016
"""

import pytest
from unittest.mock import Mock, MagicMock, patch
from googleapiclient.errors import HttpError

from app.gmail.client import GmailClient


class TestGmailClientListMessages:
    """list_messages() メソッドのテストスイート"""

    @pytest.fixture
    def gmail_client(self):
        """GmailClientインスタンスを生成（モックサービス注入）"""
        mock_service = Mock()
        client = GmailClient(service=mock_service)
        return client

    @pytest.fixture
    def mock_service(self):
        """Gmail API serviceオブジェクトのモック"""
        return Mock()

    # T-API-009: 基本クエリによるメール取得
    def test_list_messages_basic_query(self, gmail_client):
        """from:@contact.vpass.ne.jp クエリで三井住友カードのメールのみ取得"""
        # Arrange
        query = "from:@contact.vpass.ne.jp"
        mock_response = {
            "messages": [
                {"id": "msg001", "threadId": "thread001"},
                {"id": "msg002", "threadId": "thread002"},
            ],
            "resultSizeEstimate": 2,
        }
        mock_list_call = Mock()
        mock_list_call.execute.return_value = mock_response
        gmail_client.service.users().messages().list.return_value = mock_list_call

        # Act
        result = gmail_client.list_messages(query=query, max_results=100)

        # Assert
        assert len(result) == 2
        assert result[0]["id"] == "msg001"
        gmail_client.service.users().messages().list.assert_called_once()
        call_kwargs = gmail_client.service.users().messages().list.call_args.kwargs
        assert call_kwargs["userId"] == "me"
        assert call_kwargs["q"] == query
        assert call_kwargs["maxResults"] == 100

    # T-API-010: 複合クエリによるメール取得
    def test_list_messages_complex_query(self, gmail_client):
        """複数カード会社のメール取得（OR条件）"""
        query = "from:(@contact.vpass.ne.jp OR @qa.jcb.co.jp)"
        mock_response = {
            "messages": [
                {"id": "msg001", "threadId": "thread001"},  # 三井住友
                {"id": "msg002", "threadId": "thread002"},  # JCB
            ]
        }
        gmail_client.service.users().messages().list().execute.return_value = mock_response

        result = gmail_client.list_messages(query=query, max_results=100)

        assert len(result) == 2
        call_kwargs = gmail_client.service.users().messages().list.call_args.kwargs
        assert call_kwargs["q"] == query

    # T-API-011: maxResults制限の動作確認
    def test_list_messages_max_results_limit(self, gmail_client):
        """maxResults=10を指定し、10件のみ取得されることを確認"""
        query = "from:@contact.vpass.ne.jp"
        mock_messages = [{"id": f"msg{i:03d}", "threadId": f"thread{i:03d}"} for i in range(10)]
        mock_response = {"messages": mock_messages}
        gmail_client.service.users().messages().list().execute.return_value = mock_response

        result = gmail_client.list_messages(query=query, max_results=10)

        assert len(result) == 10
        call_kwargs = gmail_client.service.users().messages().list.call_args.kwargs
        assert call_kwargs["maxResults"] == 10

    # T-API-012: ページネーション処理
    def test_list_messages_pagination(self, gmail_client):
        """nextPageTokenを使用して全メールを取得"""
        query = "from:@contact.vpass.ne.jp"

        # モックレスポンス: 1ページ目
        page1_response = {
            "messages": [{"id": f"msg{i:03d}", "threadId": f"thread{i:03d}"} for i in range(100)],
            "nextPageToken": "token_page2",
        }
        # モックレスポンス: 2ページ目
        page2_response = {
            "messages": [{"id": f"msg{i:03d}", "threadId": f"thread{i:03d}"} for i in range(100, 150)],
            # nextPageTokenなし = 最終ページ
        }

        # executeメソッドが呼ばれるたびに異なるレスポンスを返す
        mock_list_call = Mock()
        mock_list_call.execute.side_effect = [page1_response, page2_response]
        mock_list = gmail_client.service.users().messages().list
        mock_list.return_value = mock_list_call

        result = gmail_client.list_messages(query=query, max_results=200)

        # 全ページのメッセージが結合されていることを確認
        assert len(result) == 150
        assert result[0]["id"] == "msg000"
        assert result[-1]["id"] == "msg149"
        # listメソッドが2回呼ばれたことを確認
        assert mock_list.call_count == 2

    # T-API-013: 空の検索結果処理
    def test_list_messages_empty_result(self, gmail_client):
        """存在しないクエリで空リストが返される"""
        query = "from:nonexistent@example.com"
        mock_response = {"resultSizeEstimate": 0}  # messagesキー自体が存在しない
        gmail_client.service.users().messages().list().execute.return_value = mock_response

        result = gmail_client.list_messages(query=query, max_results=100)

        assert result == []
        assert isinstance(result, list)

    # T-API-014: 不正なクエリ構文処理
    def test_list_messages_invalid_query_syntax(self, gmail_client):
        """Gmail検索構文エラーでHTTP 400エラーが発生"""
        query = "from:"  # 不正な構文

        # HttpErrorをモック
        mock_http_error = HttpError(
            resp=Mock(status=400),
            content=b'{"error": {"code": 400, "message": "Invalid query"}}'
        )
        gmail_client.service.users().messages().list().execute.side_effect = mock_http_error

        with pytest.raises(HttpError) as exc_info:
            gmail_client.list_messages(query=query, max_results=100)

        assert exc_info.value.resp.status == 400

    # T-API-015: メッセージID取得のみ
    def test_list_messages_id_only(self, gmail_client):
        """list()でメッセージIDリストを取得し、本文は取得しない"""
        query = "from:@contact.vpass.ne.jp"
        mock_response = {
            "messages": [
                {"id": "msg001", "threadId": "thread001"},
                {"id": "msg002", "threadId": "thread002"},
            ]
        }
        gmail_client.service.users().messages().list().execute.return_value = mock_response

        result = gmail_client.list_messages(query=query, max_results=100)

        # IDとthreadIdのみが含まれることを確認
        assert "id" in result[0]
        assert "threadId" in result[0]
        # 本文などは含まれない
        assert "payload" not in result[0]
        assert "snippet" not in result[0]


class TestGmailClientGetMessage:
    """get_message() メソッドのテストスイート"""

    @pytest.fixture
    def gmail_client(self):
        """GmailClientインスタンスを生成"""
        mock_service = Mock()
        client = GmailClient(service=mock_service)
        return client

    # T-API-016: メッセージ本文取得
    def test_get_message_full_format(self, gmail_client):
        """messages().get(id=message_id, format='full')でメール本文を取得"""
        message_id = "msg12345"
        mock_message = {
            "id": message_id,
            "threadId": "thread001",
            "payload": {
                "headers": [
                    {"name": "From", "value": "sender@example.com"},
                    {"name": "Subject", "value": "テストメール件名"},
                ],
                "body": {"data": "bWVzc2FnZSBib2R5"},  # Base64エンコード
            },
            "snippet": "メールスニペット...",
        }
        mock_get_call = Mock()
        mock_get_call.execute.return_value = mock_message
        gmail_client.service.users().messages().get.return_value = mock_get_call

        result = gmail_client.get_message(message_id=message_id, format="full")

        # メッセージオブジェクトが完全に返される
        assert result["id"] == message_id
        assert "payload" in result
        assert "headers" in result["payload"]

        # API呼び出しの検証
        gmail_client.service.users().messages().get.assert_called_once()
        call_kwargs = gmail_client.service.users().messages().get.call_args.kwargs
        assert call_kwargs["userId"] == "me"
        assert call_kwargs["id"] == message_id
        assert call_kwargs["format"] == "full"
