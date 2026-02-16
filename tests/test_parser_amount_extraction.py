"""
メール解析エンジン Phase 2: 金額・日時抽出テスト

担当: Ashigaru 7
タスクID: subtask_009a
対応テストケース: T-PARSE-030〜052, T-PARSE-090〜091
"""

import pytest
from datetime import datetime
from app.gmail.parser import extract_amount, extract_transaction_date


class TestAmountExtraction:
    """金額抽出テスト（T-PARSE-030〜082）"""

    # 三井住友カード金額抽出
    def test_t_parse_030_smbc_basic(self):
        """T-PARSE-030: 三井住友金額抽出（基本形式）"""
        email_body = "利用金額: 1,234円"
        result = extract_amount(email_body, "三井住友")
        assert result == 1234
