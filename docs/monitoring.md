# 監視設定ガイド（UptimeRobot）

**対象読者**: 殿（アプリオーナー）
**参照設計書**: `docs/architecture.md` § 4.7（ログ・監視）
**作成日**: 2026-02-20

---

## UptimeRobot 設定手順

### 1. アカウント作成

- https://uptimerobot.com にアクセス
- 無料アカウント登録（クレジットカード不要）
- 無料枠: 50モニター、5分間隔チェック

---

### 2. モニター追加

1. Dashboard → "Add New Monitor"
2. Monitor Type: HTTP(s)
3. Friendly Name: Card Spending Tracker
4. URL: https://card-spending-tracker.fly.dev/health
   （Fly.io デプロイ後の実際のURLに変更）
5. Monitoring Interval: 5 minutes
6. Monitor Timeout: 30 seconds

---

### 3. アラート連絡先設定

1. "Alert Contacts" → "Add Alert Contact"
2. Alert Contact Type: E-mail または Telegram/Slack
3. ダウン時の通知条件:
   - Down: Wait 0 minutes before alerting
   - Up: Notify when back up = YES

---

### 4. ntfy.sh との連携（オプション）

UptimeRobot の「Webhook」アラートで ntfy に通知:

```
Webhook URL: https://ntfy.sh/YOUR_NTFY_TOPIC
Post Value: Card Tracker DOWN: {monitorURL}
```

---

### 5. ステータスページ（オプション）

UptimeRobot の Public Status Page 機能で外部公開用ステータスページを作成可能。

---

## /health エンドポイント仕様

| 項目 | 詳細 |
|------|------|
| URL | GET /health |
| 正常時レスポンス | HTTP 200 + `{"status": "ok", "version": "0.1.0", "db_connected": true}` |
| チェック間隔 | 5分 |
| タイムアウト | 30秒 |
| DB接続確認 | SQLiteへの接続状態を含める |

---

## モニタリング体制

| レイヤー | ツール | 役割 |
|---------|--------|------|
| 死活監視 | UptimeRobot | HTTP監視 + ダウン通知 |
| アプリログ | structlog + Fly logs | 構造化ログ |
| エラー通知 | ntfy.sh | ERRORレベルをプッシュ通知 |
| インフラ | Fly.io built-in | マシン状態監視 |

---

## セットアップチェックリスト

- [ ] UptimeRobotアカウントを作成
- [ ] モニターを追加（URL: `/health`）
- [ ] アラート連絡先を設定（メールまたはSlack）
- [ ] ntfy.sh Webhook を設定（オプション）
- [ ] 最初の監視イベント（ダウン→アップ）を確認
- [ ] UptimeRobot Dashboard で正常なステータスを確認

---

## 参考リンク

- [UptimeRobot公式ドキュメント](https://uptimerobot.com/help/)
- [ntfy.sh ドキュメント](https://docs.ntfy.sh/)
- [Fly.io ヘルスチェック](https://fly.io/docs/monitoring/health-checks/)

---

*作成: 足軽5号 | subtask_036e | cmd_036 | 2026-02-20*
