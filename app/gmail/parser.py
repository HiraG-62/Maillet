"""
メール解析エンジン基礎実装（送信元検証＋カード判別）

担当: Ashigaru 3
タスクID: subtask_004c, subtask_010c
"""

import re
import logging
from typing import Optional
from datetime import datetime

# ロガー設定
logger = logging.getLogger(__name__)


# 信頼ドメイン定義（設計書4.3参照）
TRUSTED_DOMAINS = {
    "三井住友": ["contact.vpass.ne.jp"],
    "JCB": ["qa.jcb.co.jp"],
    "楽天": ["mail.rakuten-card.co.jp", "mkrm.rakuten.co.jp", "bounce.rakuten-card.co.jp"],
    "AMEX": ["aexp.com", "americanexpress.com", "americanexpress.jp", "email.americanexpress.com"],
    "dカード": ["dcard.docomo.ne.jp"],
}

# カード会社判別キーワード（件名用）
CARD_KEYWORDS = {
    "三井住友": ["三井住友カード", "三井住友"],
    "JCB": ["JCB"],
    "楽天": ["楽天カード", "楽天"],
    "AMEX": ["American Express", "AMEX", "アメックス"],
    "dカード": ["dカード"],
}

# 汎用パターン（フォールバック用）— 会社別パターンが全て失敗した場合に使用
FALLBACK_AMOUNT_PATTERN = r'(?:ご?利用金額|金額|お支払い金額)[:：]\s*¥?\s*([0-9,]+)円?'
FALLBACK_DATETIME_PATTERNS = [
    r'(?:ご?利用日時?|利用日)[:：]\s*(\d{4})-(\d{2})-(\d{2})\s+(\d{2}):(\d{2})',  # ISO形式
    r'(?:ご?利用日時?|利用日)[:：]\s*(\d{4})/(\d{2})/(\d{2})\s+(\d{2}):(\d{2})',  # スラッシュ形式
]
FALLBACK_MERCHANT_PATTERN = r'(?:ご?利用先|店舗名|加盟店)[:：]\s*(.+?)(?:\n|$)'


def is_trusted_domain(from_address: str, company: str) -> bool:
    """
    送信元ドメイン検証

    Args:
        from_address: 送信元メールアドレス (例: "notify@contact.vpass.ne.jp")
        company: カード会社名 (例: "三井住友")

    Returns:
        bool: 信頼できるドメインならTrue、それ以外はFalse

    対応テストケース: T-PARSE-001〜011
    """
    # セゾンカードは特殊ケース（メール配信なし＝全てフィッシング）
    if company == "セゾン":
        return False

    # 会社名がTRUSTED_DOMAINSに登録されているか確認
    if company not in TRUSTED_DOMAINS:
        return False

    # メールアドレスからドメイン部分を抽出
    if "@" not in from_address:
        return False

    domain = from_address.split("@")[1]

    # 信頼ドメインリストと照合
    trusted_list = TRUSTED_DOMAINS[company]
    return domain in trusted_list


def detect_card_company(subject: str, from_address: str) -> Optional[str]:
    """
    カード会社判別（件名ベース）

    Args:
        subject: メール件名 (例: "【三井住友カード】ご利用のお知らせ")
        from_address: 送信元メールアドレス (例: "notify@contact.vpass.ne.jp")

    Returns:
        Optional[str]: カード会社名（判別不能ならNone）

    対応テストケース: T-PARSE-020〜025
    """
    # 件名からカード会社名を推測
    for company, keywords in CARD_KEYWORDS.items():
        for keyword in keywords:
            if keyword in subject:
                return company

    # 判別不能
    return None


def extract_amount(email_body: str, card_company: str) -> Optional[int]:
    """
    金額抽出（カード会社別パターンマッチング）

    Args:
        email_body: メール本文
        card_company: カード会社名 (例: "三井住友")

    Returns:
        Optional[int]: 抽出された金額（円）、抽出失敗時はNone

    対応テストケース: T-PARSE-030〜082
    """
    # 三井住友カード: "利用金額: 1,234円"
    if card_company == "三井住友":
        match = re.search(r'利用金額[:：]\s*([0-9,]+)円', email_body)
        if match:
            amount_str = match.group(1).replace(',', '')
            return int(amount_str)

    # JCBカード: "ご利用金額: 2,500円" or "ご利用金額(速報): 1,500円"
    elif card_company == "JCB":
        match = re.search(r'ご利用金額(?:\(速報\))?[:：]\s*([0-9,]+)円', email_body)
        if match:
            amount_str = match.group(1).replace(',', '')
            return int(amount_str)

    # 楽天カード: "利用金額: 4,500円" or "利用金額(速報): 1,200円" or "利用金額(確定): 1,200円"
    elif card_company == "楽天":
        match = re.search(r'利用金額(?:\((?:速報|確定)\))?[:：]\s*([0-9,]+)円', email_body)
        if match:
            amount_str = match.group(1).replace(',', '')
            return int(amount_str)

    # dカード: "利用金額: 1,800円" or "金額: 2,400円"
    elif card_company == "dカード":
        match = re.search(r'(?:利用金額|金額)[:：]\s*([0-9,]+)円', email_body)
        if match:
            amount_str = match.group(1).replace(',', '')
            return int(amount_str)

    # AMEX: "ご利用金額: 8,900円" or "金額: ¥ 5,000円" or "金額: 3,000円"
    elif card_company == "AMEX":
        match = re.search(r'(?:ご利用金額|金額)[:：]\s*¥?\s*([0-9,]+)円?', email_body)
        if match:
            amount_str = match.group(1).replace(',', '')
            return int(amount_str)

    # 汎用パターン（フォールバック）— 会社別パターンが全て失敗した場合
    match = re.search(FALLBACK_AMOUNT_PATTERN, email_body)
    if match:
        amount_str = match.group(1).replace(',', '')
        logger.warning(f"Fallback pattern used for amount extraction (company: {card_company})")
        return int(amount_str)

    return None


def extract_transaction_date(email_body: str, card_company: str) -> Optional[datetime]:
    """
    利用日時抽出（カード会社別パターンマッチング）

    Args:
        email_body: メール本文
        card_company: カード会社名 (例: "三井住友")

    Returns:
        Optional[datetime]: 抽出された日時、抽出失敗時はNone

    対応テストケース: T-PARSE-090〜122
    """
    # 三井住友カード: "利用日: 2026/02/15 14:30"
    if card_company == "三井住友":
        match = re.search(r'利用日[:：]\s*(\d{4})/(\d{2})/(\d{2})\s+(\d{2}):(\d{2})', email_body)
        if match:
            year, month, day, hour, minute = map(int, match.groups())
            return datetime(year, month, day, hour, minute)

    # 汎用パターン（フォールバック）— 会社別パターンが全て失敗した場合
    for pattern in FALLBACK_DATETIME_PATTERNS:
        match = re.search(pattern, email_body)
        if match:
            year, month, day, hour, minute = map(int, match.groups())
            logger.warning(f"Fallback pattern used for datetime extraction (company: {card_company})")
            return datetime(year, month, day, hour, minute)

    return None
