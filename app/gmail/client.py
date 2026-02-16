"""
Gmail API クライアント実装
メール取得・ページネーション処理を提供
"""

from typing import List, Dict, Any, Optional
from googleapiclient.discovery import Resource


class GmailClient:
    """
    Gmail API クライアント

    メール一覧取得、メッセージ詳細取得、ページネーション処理を提供する。
    """

    def __init__(self, service: Resource):
        """
        Args:
            service: 認証済み Gmail API service オブジェクト
                    (googleapiclient.discovery.build('gmail', 'v1', credentials=creds))
        """
        self.service = service

    def list_messages(
        self,
        query: str,
        max_results: int = 100,
    ) -> List[Dict[str, Any]]:
        """
        Gmail検索クエリでメール一覧を取得

        自動的にページネーション処理を行い、全メッセージを取得する。
        結果にはメッセージIDとスレッドIDのみが含まれる（本文は含まない）。

        Args:
            query: Gmail検索クエリ
                  例: 'from:@contact.vpass.ne.jp'
                      'from:(@contact.vpass.ne.jp OR @qa.jcb.co.jp)'
            max_results: 取得する最大件数（デフォルト: 100）

        Returns:
            メッセージIDとスレッドIDのリスト
            例: [{"id": "msg001", "threadId": "thread001"}, ...]
            検索結果が空の場合は空リスト

        Raises:
            HttpError: Gmail API呼び出しエラー（不正なクエリ構文など）
        """
        return self._handle_pagination(
            service=self.service,
            query=query,
            max_results=max_results,
        )

    def get_message(
        self,
        message_id: str,
        format: str = "full",
    ) -> Dict[str, Any]:
        """
        メッセージIDを指定してメール詳細を取得

        Args:
            message_id: メッセージID（list_messages()で取得したID）
            format: 取得フォーマット
                   - 'full': 完全なメッセージ（ヘッダー、本文含む）
                   - 'metadata': ヘッダーのみ
                   - 'minimal': ID、スレッドIDのみ

        Returns:
            メッセージオブジェクト
            例: {
                "id": "msg12345",
                "threadId": "thread001",
                "payload": {
                    "headers": [
                        {"name": "From", "value": "sender@example.com"},
                        {"name": "Subject", "value": "件名"},
                    ],
                    "body": {"data": "...base64..."},
                },
                "snippet": "メールスニペット...",
            }

        Raises:
            HttpError: Gmail API呼び出しエラー
        """
        result = (
            self.service.users()
            .messages()
            .get(userId="me", id=message_id, format=format)
            .execute()
        )
        return result

    def _handle_pagination(
        self,
        service: Resource,
        query: str,
        max_results: int,
    ) -> List[Dict[str, Any]]:
        """
        Gmail API list()のページネーション処理

        nextPageTokenが存在する限り、全ページを取得して結合する。

        Args:
            service: Gmail API serviceオブジェクト
            query: Gmail検索クエリ
            max_results: 1回のリクエストでの最大取得件数

        Returns:
            全ページのメッセージを結合したリスト
        """
        all_messages = []
        page_token: Optional[str] = None

        while True:
            # API呼び出し
            request_params = {
                "userId": "me",
                "q": query,
                "maxResults": max_results,
            }
            if page_token:
                request_params["pageToken"] = page_token

            results = service.users().messages().list(**request_params).execute()

            # メッセージ取得
            messages = results.get("messages", [])
            all_messages.extend(messages)

            # 次ページトークン確認
            page_token = results.get("nextPageToken")
            if not page_token:
                break

        return all_messages
