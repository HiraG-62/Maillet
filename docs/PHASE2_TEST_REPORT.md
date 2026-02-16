# Phase 2 リグレッションテスト実行レポート

**作成日**: 2026-02-16
**テスト実行者**: 足軽2号
**タスクID**: subtask_009d
**対象プロジェクト**: card-spending-tracker (Phase 2)

---

## 📊 テスト実行サマリー

| カテゴリ | テスト数 | PASS | FAILED | SKIP | 結果 |
|---------|---------|------|--------|------|------|
| **Phase 1リグレッション** | 59 | 56 | **3** | 0 | ❌ **リグレッション発生** |
| **Phase 2新機能** | 22 | 22 | 0 | 0 | ✅ 全PASS |
| **統合テスト** | 81 | 78 | **3** | 0 | ❌ **リグレッション発生** |

**総カバレッジ**: **95%** (222 statements, 11 missed)

---

## ❌ リグレッション詳細

Phase 1の既存テスト59件中、**3件がFAILED** → Phase 2実装により既存機能が破壊されている可能性。

### 失敗テスト一覧

#### 1. `test_list_messages_basic_query` (tests/test_gmail_client.py:48)

**期待動作**: Gmail API `list()` メソッドが1回だけ呼ばれる
**実測動作**: `list()` が **2回** 呼ばれている

```python
AssertionError: Expected 'list' to have been called once. Called 2 times.
Calls: [call(),
 call(userId='me', q='from:@contact.vpass.ne.jp', maxResults=100),
 call().execute()].
```

**発生場所**: tests/test_gmail_client.py:48
`gmail_client.service.users().messages().list.assert_called_once()`

---

#### 2. `test_list_messages_pagination` (tests/test_gmail_client.py:113)

**期待動作**: ページネーション処理で `list()` が2回呼ばれる（2ページ分）
**実測動作**: `list()` が **3回** 呼ばれている

```python
AssertionError: assert 3 == 2
 +  where 3 = <Mock name='mock.users().messages().list' id='126755842264848'>.call_count
```

**発生場所**: tests/test_gmail_client.py:113
`assert mock_list.call_count == 2`

---

#### 3. `test_get_message_full_format` (tests/test_gmail_client.py:202)

**期待動作**: Gmail API `get()` メソッドが1回だけ呼ばれる
**実測動作**: `get()` が **2回** 呼ばれている

```python
AssertionError: Expected 'get' to have been called once. Called 2 times.
Calls: [call(), call(userId='me', id='msg12345', format='full'), call().execute()].
```

**発生場所**: tests/test_gmail_client.py:202
`gmail_client.service.users().messages().get.assert_called_once()`

---

## 🔍 根本原因分析

### 問題パターン: Mockチェーン呼び出しの副作用

#### テストコード側の挙動（例: test_list_messages_basic_query）

```python
# L40: モック設定時に list() が1回目の呼び出し
gmail_client.service.users().messages().list().execute.return_value = mock_response

# L43-48: 実コード実行
result = gmail_client.list_messages(query=query, max_results=100)
# ↓ 内部で client.py:129 が実行される
# service.users().messages().list(**request_params).execute()
# ↑ list() が2回目の呼び出し

# L48: アサーション失敗
gmail_client.service.users().messages().list.assert_called_once()
# → "Expected 'list' to have been called once. Called 2 times."
```

#### 実装コード（app/gmail/client.py:129）

```python
results = service.users().messages().list(**request_params).execute()
```

実装コード自体は正しく、**1回だけ** `.list(**request_params)` を呼んでいる。
しかし、Mockオブジェクトのチェーン構造により、以下の2つが**同じカウンター**を共有している:

1. テスト内のモック設定時の呼び出し: `.list()`（引数なし）
2. 実コード内の呼び出し: `.list(**request_params)`（引数あり）

**結論**: テストコード側のモック設定方法に問題がある可能性が高い。

---

## ✅ Phase 2新機能テスト結果（全PASS）

Phase 2で実装された以下の新機能は正常動作:

### テストファイル別実行結果

#### `tests/test_parser_amount_extraction.py` (11テスト)
- ✅ T-PARSE-030〜032: SMBC金額抽出（基本、全角コロン、カンマなし）
- ✅ T-PARSE-040〜042: JCB金額抽出（基本、全角コロン、速報）
- ✅ T-PARSE-050〜052: 楽天金額抽出（基本、速報、確定）
- ✅ T-PARSE-090〜091: SMBC日時抽出（基本、全角コロン）

**実装担当**: 足軽7号 (subtask_009a)

---

#### `tests/test_aggregation.py` (5テスト)
- ✅ T-DATA-042: 月次サマリー基本集計
- ✅ T-DATA-043: 複数カード月次集計
- ✅ T-DATA-044: 月次カウント集計
- ✅ T-DATA-045: 月次平均値集計
- ✅ T-DATA-046: 未確定トランザクション除外

**実装担当**: 足軽8号 (subtask_009b)

---

#### `tests/test_duplicate_detection.py` (6テスト)
- ✅ T-DATA-003: Gmail message_id重複検出
- ✅ T-DATA-058: IntegrityError自動ロールバック
- ✅ T-EDGE-017: 2重重複エラー処理
- ✅ T-EDGE-018: 楽天速報→確定（金額変更）
- ✅ T-EDGE-019: 楽天速報→確定（金額同一）
- ✅ T-PARSE-173: 重複スキップログ確認

**実装担当**: 足軽1号 (subtask_009c)

---

## 📈 カバレッジレポート（統合テスト実行時）

```
Name                                  Stmts   Miss  Cover   Missing
-------------------------------------------------------------------
app/__init__.py                           0      0   100%
app/cli/__init__.py                       0      0   100%
app/database/__init__.py                  0      0   100%
app/database/connection.py               47      6    87%   76-78, 142-144
app/gmail/__init__.py                     0      0   100%
app/gmail/auth.py                        46      1    98%   79
app/gmail/client.py                      24      0   100%  ← リグレッション発生モジュール
app/gmail/parser.py                      45      4    91%   50, 54, 120, 143
app/models/__init__.py                    0      0   100%
app/models/transaction.py                19      0   100%
app/services/__init__.py                  0      0   100%
app/services/aggregation_service.py      22      0   100%  ← Phase 2新実装
app/services/transaction_service.py      19      0   100%  ← Phase 2新実装
-------------------------------------------------------------------
TOTAL                                   222     11    95%
```

**カバレッジ達成状況**:
- Phase 2新実装モジュール: **100%** (aggregation_service.py, transaction_service.py)
- 総カバレッジ: **95%** (目標90%以上を達成)

---

## 🚨 リグレッション判定

**判定結果**: ❌ **Phase 1リグレッション発生**

**根拠**:
1. Phase 1テスト59件中、**3件がFAILED**（期待: 全PASS）
2. 失敗テストは全て `test_gmail_client.py`（Gmail APIクライアント基盤）
3. Phase 1デモレポート（PHASE1_DEMO_REPORT.md）では59テスト全PASS記録あり

**影響範囲**:
- Gmail API `list()`, `get()` メソッドの呼び出し回数検証が失敗
- **実機能への影響は不明**（Mockアサーションのみの失敗）
- Phase 2新機能は全て正常動作

---

## 💡 推奨対応

### 優先度1: テストコード修正（緊急）

**対象ファイル**: `tests/test_gmail_client.py`

#### 修正方針: Mockチェーン呼び出しの分離

**現在の問題あるモック設定**:
```python
# ❌ list() がモック設定時に1回カウントされる
gmail_client.service.users().messages().list().execute.return_value = mock_response
```

**推奨修正案**:
```python
# ✅ list() の戻り値を別の変数で管理
mock_list_call = Mock()
mock_list_call.execute.return_value = mock_response
gmail_client.service.users().messages().list.return_value = mock_list_call
```

**修正対象テスト**:
1. `test_list_messages_basic_query` (L40-48)
2. `test_list_messages_pagination` (L87-113)
3. `test_get_message_full_format` (L177-206)

---

### 優先度2: 実装コード検証（念のため）

`app/gmail/client.py` の実装コードを再レビューし、以下を確認:
- ページネーション処理の呼び出し回数が正しいか（L119-140）
- `get_message()` の呼び出しが冪等性を保っているか（L89-95）

**現状**: コードレビューでは問題なし（実装は正しく1回のみ呼び出し）

---

### 優先度3: Phase 1デモレポートとの差分調査

**Phase 1デモレポート**: `/mnt/e/dev/card-spending-tracker/docs/PHASE1_DEMO_REPORT.md`

Phase 1完了時に59テスト全PASSだったのに、現在3テストFAILしている原因を特定:
1. Phase 1 → Phase 2 の間にテストコードが変更されたか？
2. Pythonパッケージ（pytest, mockなど）のバージョン変更があったか？
3. Docker環境の差異があるか？

---

## 📋 完了条件チェックリスト

| 条件 | 期待 | 実測 | 判定 |
|------|------|------|------|
| Phase 1テスト59件全PASS | 59/59 | 56/59 | ❌ |
| Phase 2テスト22件全PASS | 22/22 | 22/22 | ✅ |
| 統合テスト SKIP=0 | 0 | 0 | ✅ |
| 統合テスト FAILED=0 | 0 | 3 | ❌ |
| PHASE2_TEST_REPORT.md 作成 | 完了 | 完了 | ✅ |

**タスク完了条件未達**: Phase 1リグレッションのため、**subtask_009d は未完了**

---

## 📎 参考ドキュメント

- テスト計画: `/mnt/e/dev/card-spending-tracker/docs/test_plan.md`
- Phase 1デモレポート: `/mnt/e/dev/card-spending-tracker/docs/PHASE1_DEMO_REPORT.md`
- テスト実行ログ: 本レポート内に記載

---

## 🔄 次のアクション

1. **家老へ報告**: inbox_write で subtask_009d 結果を報告（リグレッション発生）
2. **テスト修正タスク作成**: test_gmail_client.py のMock設定修正
3. **再テスト実施**: 修正後に subtask_009d を再実行

---

**報告者**: 足軽2号
**報告日時**: 2026-02-16T22:45:00
**レポート作成場所**: `/mnt/e/dev/card-spending-tracker/docs/PHASE2_TEST_REPORT.md`
