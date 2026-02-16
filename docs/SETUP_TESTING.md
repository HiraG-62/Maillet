# テスト実行セットアップ手順

## 前提条件

- Python 3.11以上
- Poetry（Pythonパッケージマネージャ）

## セットアップ手順

### 1. Poetryのインストール

```bash
curl -sSL https://install.python-poetry.org | python3 -
```

または

```bash
pip install poetry
```

### 2. 依存関係のインストール

プロジェクトルートで以下を実行：

```bash
cd /mnt/e/dev/card-spending-tracker
poetry install
```

これにより、`pyproject.toml`に定義された全ての依存関係がインストールされます：
- `google-api-python-client`: Gmail API クライアント
- `pytest`: テストフレームワーク
- `pytest-cov`: カバレッジ計測
- その他の開発依存関係

### 3. テスト実行

```bash
# 全テスト実行
poetry run pytest

# Gmail clientテストのみ実行
poetry run pytest tests/test_gmail_client.py -v

# カバレッジ付きで実行
poetry run pytest --cov=app --cov-report=term-missing

# 特定のテストケースを実行
poetry run pytest tests/test_gmail_client.py::TestGmailClientListMessages::test_list_messages_basic_query -v
```

### 4. 実装済みテストケース

| テストID | テスト内容 | テストメソッド |
|---------|-----------|--------------|
| T-API-009 | 基本クエリによるメール取得 | `test_list_messages_basic_query` |
| T-API-010 | 複合クエリによるメール取得 | `test_list_messages_complex_query` |
| T-API-011 | maxResults制限の動作確認 | `test_list_messages_max_results_limit` |
| T-API-012 | ページネーション処理 | `test_list_messages_pagination` |
| T-API-013 | 空の検索結果処理 | `test_list_messages_empty_result` |
| T-API-014 | 不正なクエリ構文処理 | `test_list_messages_invalid_query_syntax` |
| T-API-015 | メッセージID取得のみ | `test_list_messages_id_only` |
| T-API-016 | メッセージ本文取得 | `test_get_message_full_format` |

### 5. トラブルシューティング

#### `ModuleNotFoundError: No module named 'pytest'`

Poetry環境が有効化されていません。以下を実行：

```bash
poetry install
poetry run pytest
```

または、Poetry shellに入る：

```bash
poetry shell
pytest
```

#### `ModuleNotFoundError: No module named 'app'`

プロジェクトルートから実行してください：

```bash
cd /mnt/e/dev/card-spending-tracker
poetry run pytest
```

## 期待される結果

全テストがPASSする想定：

```
tests/test_gmail_client.py::TestGmailClientListMessages::test_list_messages_basic_query PASSED
tests/test_gmail_client.py::TestGmailClientListMessages::test_list_messages_complex_query PASSED
tests/test_gmail_client.py::TestGmailClientListMessages::test_list_messages_max_results_limit PASSED
tests/test_gmail_client.py::TestGmailClientListMessages::test_list_messages_pagination PASSED
tests/test_gmail_client.py::TestGmailClientListMessages::test_list_messages_empty_result PASSED
tests/test_gmail_client.py::TestGmailClientListMessages::test_list_messages_invalid_query_syntax PASSED
tests/test_gmail_client.py::TestGmailClientListMessages::test_list_messages_id_only PASSED
tests/test_gmail_client.py::TestGmailClientGetMessage::test_get_message_full_format PASSED

======================== 8 passed in 0.XX s ========================
```

**重要**: SKIP=0、FAILED=0 であることを確認してください。
