"""
APIレート制限管理（Exponential Backoff実装）

OWASP A04:2021 安全でない設計対策
"""

import time
from typing import Optional


def exponential_backoff(attempt: int, base_delay: float = 2.0, max_delay: float = 60.0) -> float:
    """
    Exponential Backoff計算

    Args:
        attempt: 試行回数（1から開始）
        base_delay: 基本待機時間（秒）
        max_delay: 最大待機時間（秒）

    Returns:
        float: 待機時間（秒）

    対応テストケース: T-SEC-014
    OWASP: A04:2021 安全でない設計
    """
    # 2^(attempt-1) * base_delay
    wait_time = (2 ** (attempt - 1)) * base_delay

    # 最大待機時間を超えないようにクリップ
    return min(wait_time, max_delay)


class RateLimiter:
    """
    レート制限マネージャー

    一定期間内のリクエスト数を制限し、過剰なAPI呼び出しを防ぐ。

    対応テストケース: T-SEC-015
    OWASP: A04:2021 安全でない設計
    """

    def __init__(self, max_requests_per_minute: int = 60):
        """
        Args:
            max_requests_per_minute: 1分間あたりの最大リクエスト数
        """
        self.max_requests = max_requests_per_minute
        self.window_seconds = 60.0
        self.request_times: list[float] = []

    def allow_request(self) -> bool:
        """
        リクエストを許可するかどうかを判定

        Returns:
            bool: リクエストが許可される場合はTrue、制限される場合はFalse
        """
        current_time = time.time()

        # ウィンドウ外の古いリクエストを削除
        cutoff_time = current_time - self.window_seconds
        self.request_times = [t for t in self.request_times if t > cutoff_time]

        # リクエスト数が上限を超えていないかチェック
        if len(self.request_times) < self.max_requests:
            self.request_times.append(current_time)
            return True
        else:
            # レート制限に到達
            return False

    def wait_if_needed(self) -> Optional[float]:
        """
        レート制限に到達している場合、待機時間を返す

        Returns:
            Optional[float]: 待機時間（秒）、制限がない場合はNone
        """
        if not self.allow_request():
            # 最も古いリクエストがウィンドウを出るまでの時間
            if self.request_times:
                oldest_request = self.request_times[0]
                wait_time = oldest_request + self.window_seconds - time.time()
                return max(0, wait_time)
        return None
