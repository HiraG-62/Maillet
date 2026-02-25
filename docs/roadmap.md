# card-spending-tracker 実運用ロードマップ

**作成日**: 2026-02-18
**作成者**: 軍師（Gunshi）
**親コマンド**: cmd_016
**入力**: 足軽1号コードインベントリ（subtask_016a）、設計書、QUICKSTART.md

---

## エグゼクティブサマリー

card-spending-trackerは **機能的にはほぼ完成** している（216テスト全PASS、カバレッジ93%、5社対応、OAuth認証完了）。
しかし **日常運用に必要な自動化・通知・設定管理が未整備** であり、現状は「手動で毎回コマンドを叩く」必要がある。

本ロードマップは「殿が日常的に使える」状態を最短で実現するために、3フェーズ13タスクを提案する。

| フェーズ | 目的 | タスク数 | 推定規模 |
|---------|------|---------|---------|
| **A: 即時対応（必須）** | 日常利用の前提条件を満たす | 5 | S〜M |
| **B: 安定運用（推奨）** | 使い勝手と信頼性を向上 | 5 | S〜L |
| **C: 機能拡張（将来）** | より良い体験・対応範囲拡大 | 3 | M〜L |

**最重要の3タスク**（これだけで日常利用が可能になる）:
1. A-1: .env.example / docker-compose.yml の設定漏れ修正（30分）
2. A-2: cron定期実行スクリプト作成（1〜2時間）
3. A-4: ntfy通知連携（1〜2時間）

---

## 現状分析

### 完了済み（強み）

| 項目 | 状態 | 備考 |
|------|------|------|
| OAuth2.0認証 | ✅ 完了 | Fernet暗号化、自動リフレッシュ実装済み |
| Gmail API連携 | ✅ 完了 | メール取得・ページネーション対応 |
| メール解析（5社） | ✅ 完了 | 三井住友・JCB・楽天・AMEX・dカード |
| SQLite DB | ✅ 完了 | CRUD・重複検出・月次集計 |
| CLI | ✅ 完了 | sync / summary / setup の3コマンド |
| FastAPI | ✅ 完了 | transactions / summary / sync / health |
| テスト | ✅ 完了 | 216件全PASS、93%カバレッジ |
| Docker | ✅ 完了 | Dockerfile + docker-compose.yml |
| セキュリティ | ✅ 完了 | rate_limiter / sanitizer / validators |

### 未完了（日常運用の障壁）

| 項目 | 影響度 | 現状 |
|------|--------|------|
| TOKEN_ENCRYPTION_KEY設定漏れ | **致命的** | .env.example・docker-compose.ymlに未記載。新環境構築時に詰まる |
| 定期実行 | **致命的** | cron/systemd未設定。毎回手動で`card-tracker sync`が必要 |
| 差分同期（History API） | **高** | 毎回フルスキャン（最大100件）。API Quota浪費 |
| 通知機能 | **高** | 同期結果を能動的に確認する必要がある |
| 設定一元管理 | **中** | app/config.py未作成。設定値がコード各所に散在 |
| 日時・店舗名抽出精度 | **中** | JCB・楽天・AMEXは汎用フォールバック依存 |
| バックアップ | **中** | SQLiteバックアップなし。ファイル破損時にデータ喪失 |
| エポス・オリコ対応 | **低** | 設計書に「今後対応」記載。殿が使用中なら対応要 |

---

## Phase A: 即時対応（必須）

> 日常利用の前提条件。これなしでは「毎日使うツール」にならない。

### A-1: 設定テンプレート修正

| 項目 | 内容 |
|------|------|
| **タスク名** | .env.example / docker-compose.yml に TOKEN_ENCRYPTION_KEY を追加 |
| **優先度** | 必須 |
| **規模** | S（30分以内） |
| **依存関係** | なし |
| **根拠** | TOKEN_ENCRYPTION_KEYはauth.pyで必須環境変数。.env.exampleに記載がないため、新環境構築者が100%詰まる。docker-compose.ymlのenvironment欄にも未記載で、Docker運用時にサーバー起動失敗する |

**対象ファイルと修正内容**:

1. `.env.example` に追加:
   ```
   # トークン暗号化キー（Fernet形式、初回生成コマンド: python3 -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"）
   TOKEN_ENCRYPTION_KEY=your-fernet-key-here
   ```

2. `docker-compose.yml` のenvironment欄に追加:
   ```
   - TOKEN_ENCRYPTION_KEY=${TOKEN_ENCRYPTION_KEY}
   ```

---

### A-2: 定期実行スクリプト + cron設定

| 項目 | 内容 |
|------|------|
| **タスク名** | scripts/daily_sync.sh 作成 + cron設定手順書 |
| **優先度** | 必須 |
| **規模** | S（1〜2時間） |
| **依存関係** | A-1（環境変数が正しく設定されていること） |
| **根拠** | 設計書Phase 2タスクだが未実装。これがないと毎日手動で`card-tracker sync`を叩く必要がある。殿が忘れる日 = その日の支出を追跡できない |

**実装方針**:

```bash
#!/bin/bash
# scripts/daily_sync.sh
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
LOG_FILE="${PROJECT_DIR}/data/sync.log"

cd "$PROJECT_DIR"

# .env 読み込み
if [ -f .env ]; then
    set -a; source .env; set +a
fi

# 同期実行 + ログ記録
echo "[$(date '+%Y-%m-%d %H:%M:%S')] Starting sync..." >> "$LOG_FILE"
poetry run card-tracker sync >> "$LOG_FILE" 2>&1
EXIT_CODE=$?
echo "[$(date '+%Y-%m-%d %H:%M:%S')] Sync finished (exit=$EXIT_CODE)" >> "$LOG_FILE"

exit $EXIT_CODE
```

**cron設定例**（毎朝9時 + 毎晩21時の2回）:
```
0 9,21 * * * /mnt/e/dev/card-spending-tracker/scripts/daily_sync.sh
```

**WSL2特有の注意**: WSL2のcronはデフォルトで無効。`sudo service cron start`が必要。永続化には`/etc/wsl.conf`に`[boot] command=service cron start`を追記する。

---

### A-3: 設定一元管理（app/config.py）

| 項目 | 内容 |
|------|------|
| **タスク名** | app/config.py 作成（環境変数の集約管理） |
| **優先度** | 必須 |
| **規模** | S（1時間） |
| **依存関係** | A-1 |
| **根拠** | 設計書2.3節・付録Bに記載あるが未作成。現状、各モジュールが個別に`os.getenv()`を呼んでおり、環境変数名の変更や追加時に複数箇所の修正が必要。Pydantic BaseSettingsを使えば型安全かつバリデーション付きで一元管理できる |

**推奨実装**:

```python
# app/config.py
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    database_path: str = "data/transactions.db"
    google_credentials_path: str = "credentials/credentials.json"
    google_token_path: str = "credentials/token.pickle"
    token_encryption_key: str  # 必須（未設定時にエラー）
    gmail_search_query: str = "from:(vpass.jp OR jcb.co.jp OR ...) subject:(ご利用)"
    log_level: str = "INFO"
    api_host: str = "0.0.0.0"
    api_port: int = 8000

    class Config:
        env_file = ".env"

settings = Settings()
```

---

### A-4: 同期結果通知（ntfy連携）

| 項目 | 内容 |
|------|------|
| **タスク名** | 同期完了時のntfy通知 |
| **優先度** | 必須 |
| **規模** | S（1〜2時間） |
| **依存関係** | A-2（daily_sync.sh） |
| **根拠** | 自動同期しても結果を確認できなければ意味がない。殿のshogunシステムは既にntfyを使用しており、追加インフラ不要。curl 1行で通知可能 |

**比較検討**:

| 方法 | 導入コスト | 利便性 | 依存 |
|------|-----------|--------|------|
| **ntfy（推奨）** | 極小 | スマホ通知即時 | ntfyサーバー（既存） |
| LINE Notify | 小 | LINE通知 | LINE APIトークン取得が必要 |
| メール通知 | 中 | 既存Gmail利用 | SMTP設定 or Gmail API送信スコープ追加 |
| Telegram Bot | 中 | Telegram通知 | Bot作成・チャットID取得 |

**推奨: ntfy** — 既にshogunシステムで運用中、追加設定ほぼなし。

**daily_sync.sh への追記**:
```bash
# 通知（ntfy）
NTFY_TOPIC="${NTFY_TOPIC:-card-tracker}"
if [ $EXIT_CODE -eq 0 ]; then
    curl -s -d "Card sync completed successfully" "ntfy.sh/${NTFY_TOPIC}" > /dev/null 2>&1 || true
else
    curl -s -H "Priority: high" -d "Card sync FAILED (exit=$EXIT_CODE)" "ntfy.sh/${NTFY_TOPIC}" > /dev/null 2>&1 || true
fi
```

---

### A-5: sync_service.py 分離

| 項目 | 内容 |
|------|------|
| **タスク名** | 同期ロジックをCLIからservices/sync_service.pyに分離 |
| **優先度** | 必須 |
| **規模** | M（2〜3時間） |
| **依存関係** | なし |
| **根拠** | 現状、sync処理がCLIコマンドに直書きされている（足軽1号報告）。daily_sync.sh・FastAPIの`POST /api/sync`・将来のWeb UIすべてが同じロジックを必要とするため、サービス層への分離は必須。DRY原則違反の解消 |

**構成**:
```
app/services/sync_service.py
├── SyncService(gmail_client, parser, transaction_service)
├── sync_all(days=7) → SyncResult
├── sync_incremental(last_history_id) → SyncResult  # Phase B で実装
└── SyncResult(synced_count, skipped_count, errors)
```

---

## Phase B: 安定運用（推奨）

> 日常利用の快適性と信頼性を向上させる。Phase A完了後に順次実施。

### B-1: 差分同期（History API）

| 項目 | 内容 |
|------|------|
| **タスク名** | Gmail History API による差分同期実装 |
| **優先度** | 推奨 |
| **規模** | M（3〜4時間） |
| **依存関係** | A-5（sync_service.py） |
| **根拠** | 設計書3.2節に詳細設計あり。現状は毎回フルスキャン（messages.list）で最大100件取得。1日2回実行で月60回×100件 = 6,000 API呼び出し。History APIなら差分のみで済み、クォータ消費を90%以上削減。また、処理速度も大幅に向上する |

**実装方針**:
- `last_history_id` を SQLiteテーブル（metadata）またはファイルに永続化
- 初回: messages.list（フルスキャン）→ historyId保存
- 2回目以降: history.list（差分取得）→ historyId更新
- historyId失効時（7日超）: フルスキャンにフォールバック

---

### B-2: SQLiteバックアップ自動化

| 項目 | 内容 |
|------|------|
| **タスク名** | SQLiteデータベースの日次バックアップ |
| **優先度** | 推奨 |
| **規模** | S（1時間） |
| **依存関係** | A-2（cron基盤） |
| **根拠** | SQLiteはファイルベースDB。ファイル破損・誤削除でデータ全喪失のリスクがある。個人利用でも数ヶ月分の支出データは貴重。バックアップは`sqlite3 .backup`コマンド1行で実現可能 |

**実装方針**:

```bash
# scripts/backup_db.sh
BACKUP_DIR="${PROJECT_DIR}/data/backups"
mkdir -p "$BACKUP_DIR"
sqlite3 "${PROJECT_DIR}/data/transactions.db" ".backup '${BACKUP_DIR}/transactions_$(date +%Y%m%d).db'"
# 30日以上前のバックアップを自動削除
find "$BACKUP_DIR" -name "transactions_*.db" -mtime +30 -delete
```

cron追加: 毎日深夜3時
```
0 3 * * * /mnt/e/dev/card-spending-tracker/scripts/backup_db.sh
```

---

### B-3: カード会社別パーサー精度向上

| 項目 | 内容 |
|------|------|
| **タスク名** | JCB・楽天・AMEX・dカードの日時・店舗名抽出パターン強化 |
| **優先度** | 推奨 |
| **規模** | M（3〜4時間） |
| **依存関係** | なし |
| **根拠** | 足軽1号報告: extract_transaction_dateのJCB/楽天/AMEXは汎用フォールバック依存、extract_merchantは全社で汎用パターンのみ。設計書4.3節にはカード会社別パターンが定義されているが未実装。抽出精度が低いと集計の信頼性に影響する |

**アプローチ**:
1. 実際に受信したカード通知メールを確認（殿の協力要）
2. 各社メール本文の実パターンを特定
3. parser.pyのDATETIME_PATTERNS / MERCHANT_PATTERNSに各社別パターン追加
4. テストフィクスチャ（sample_emails）も実データベースで更新

---

### B-4: ロギング・監視改善

| 項目 | 内容 |
|------|------|
| **タスク名** | 構造化ログ + エラーアラート |
| **優先度** | 推奨 |
| **規模** | S（1〜2時間） |
| **依存関係** | A-3（config.py）、A-4（ntfy） |
| **根拠** | 現状、ログ出力の統一された仕組みがない。パース失敗・API エラー・認証失敗などが発生しても、ログファイルを能動的に確認しない限り気づけない。ntfy連携済みなら、ERROR以上のログをリアルタイム通知可能 |

**実装方針**:
- Python標準`logging`モジュール + `logging.config` で設定
- ファイルログ（data/app.log）+ コンソール出力
- ログローテーション（7日分保持）
- ERROR以上 → ntfy通知連携

---

### B-5: 月次支出レポート自動生成

| 項目 | 内容 |
|------|------|
| **タスク名** | 月次集計レポートの自動生成 + ntfy通知 |
| **優先度** | 推奨 |
| **規模** | S（1〜2時間） |
| **依存関係** | A-2、A-4 |
| **根拠** | 本システムの最大の価値は「月間の支出可視化」。自動同期だけでなく、月末に集計結果をプッシュ通知することで、殿が能動的に確認する必要がなくなる |

**実装方針**:
```bash
# scripts/monthly_report.sh（毎月1日に先月分を集計）
LAST_MONTH=$(date -d "last month" +%Y-%m)
SUMMARY=$(poetry run card-tracker summary --month "$LAST_MONTH")
curl -d "$SUMMARY" "ntfy.sh/${NTFY_TOPIC}"
```

cron: 毎月1日 9:00
```
0 9 1 * * /mnt/e/dev/card-spending-tracker/scripts/monthly_report.sh
```

---

## Phase C: 機能拡張（将来）

> 基本運用が安定してから検討。殿の利用パターンに応じて優先度を調整。

### C-1: 追加カード会社対応（エポス・オリコ）

| 項目 | 内容 |
|------|------|
| **タスク名** | エポスカード・オリコカードのパーサー追加 |
| **優先度** | 将来 |
| **規模** | M（各2時間、計4時間） |
| **依存関係** | B-3（パーサー基盤強化） |
| **根拠** | 設計書記載の「今後対応」カード。殿がこれらのカードを使用していなければ不要。使用している場合は優先度を「推奨」に格上げ |

**前提条件**: 実際のメールサンプルが必要。殿からの提供 or テスト用メール転送が必要。

---

### C-2: Webダッシュボード

| 項目 | 内容 |
|------|------|
| **タスク名** | 簡易Webダッシュボード実装 |
| **優先度** | 将来 |
| **規模** | L（8〜12時間） |
| **依存関係** | A-5（sync_service.py） |

**比較検討**:

| アプローチ | 実装コスト | 保守性 | 機能性 | 推奨度 |
|-----------|-----------|--------|--------|--------|
| **A: FastAPI + Jinja2テンプレート（推奨）** | 小（4〜6h） | 高（Python単一スタック） | 中（サーバーサイドレンダリング） | ★★★ |
| B: React + Chart.js SPA | 大（10〜15h） | 低（フロント+バック2スタック） | 高（リアクティブUI） | ★★ |
| C: Streamlit | 極小（2〜3h） | 中（Streamlit依存） | 中（プロトタイプ向き） | ★★ |
| D: CLIリッチ出力（Rich） | 極小（1〜2h） | 高（追加依存少） | 低（ターミナル限定） | ★ |

**推奨: A（FastAPI + Jinja2）**

根拠:
- FastAPI基盤は既に実装済み → エンドポイント追加のみ
- Pythonスタック統一 → ビルドツールチェーン追加なし
- 設計書Phase 3のReact案は個人利用にはオーバースペック
- Jinja2は軽量で学習コスト低、保守しやすい

**ただし**: 殿がCLI + ntfy通知で満足なら、Webダッシュボードは不要。実運用1ヶ月後に要否を判断することを推奨。

---

### C-3: しきい値アラート（異常検知）

| 項目 | 内容 |
|------|------|
| **タスク名** | 高額利用・異常パターンのリアルタイムアラート |
| **優先度** | 将来 |
| **規模** | M（3〜4時間） |
| **依存関係** | A-4（ntfy）、A-5（sync_service.py） |
| **根拠** | 設計書1.1の「不正利用の早期検知」目的に対応。同期時に利用額をチェックし、しきい値超過時に即座にntfy通知 |

**実装方針**:
- 設定ファイル（config.py）にしきい値定義（例: 1回10万円超、月合計50万円超）
- sync処理の中でチェック → 条件合致時にntfy高優先度通知
- 将来的には過去の利用パターンとの統計的比較（異常検知）

---

## 推奨実行順序

```
Phase A（必須・直列実行推奨）:

  A-1: 設定テンプレート修正 [S] ─┐
                                   ├→ A-3: config.py [S] ─┐
  A-5: sync_service.py分離 [M] ─┘                         │
                                                            ├→ A-2: cron設定 [S]
                                                            │
                                                            └→ A-4: ntfy通知 [S]

Phase B（推奨・並列実行可能）:

  B-1: History API [M] ← A-5
  B-2: DBバックアップ [S] ← A-2
  B-3: パーサー精度向上 [M] ← (独立)
  B-4: ログ改善 [S] ← A-3, A-4
  B-5: 月次レポート [S] ← A-2, A-4

Phase C（将来・殿の判断待ち）:

  C-1: 追加カード会社 [M] ← B-3
  C-2: Webダッシュボード [L] ← A-5
  C-3: しきい値アラート [M] ← A-4, A-5
```

**最短で日常利用可能にする最小実行パス**:
A-1 → A-5 → A-2 → A-4（計4タスク、推定5〜7時間）

---

## 殿への確認事項

以下は殿の判断が必要な事項です。ロードマップの優先度調整に影響します。

1. **使用カード**: エポスカード・オリコカードは使用中か？ → C-1の優先度決定
2. **通知方法**: ntfyで良いか、LINE/Telegram等の希望はあるか？ → A-4の実装方針
3. **Web UI要否**: CLI + ntfy通知で十分か、ブラウザで見たいか？ → C-2の優先度決定
4. **同期頻度**: 1日何回同期したいか？（推奨: 朝・夕の2回） → A-2のcron設定
5. **支出アラートしきい値**: 1回あたり何円以上で通知が欲しいか？ → C-3の設定値

---

## 付録: タスク一覧（全13タスク）

| ID | タスク名 | 優先度 | 規模 | 依存 | フェーズ |
|----|---------|--------|------|------|---------|
| A-1 | 設定テンプレート修正 | 必須 | S | なし | A |
| A-2 | cron定期実行 | 必須 | S | A-1, A-3 | A |
| A-3 | app/config.py作成 | 必須 | S | A-1 | A |
| A-4 | ntfy通知連携 | 必須 | S | A-2 | A |
| A-5 | sync_service.py分離 | 必須 | M | なし | A |
| B-1 | 差分同期（History API） | 推奨 | M | A-5 | B |
| B-2 | SQLiteバックアップ | 推奨 | S | A-2 | B |
| B-3 | パーサー精度向上 | 推奨 | M | なし | B |
| B-4 | ログ・監視改善 | 推奨 | S | A-3, A-4 | B |
| B-5 | 月次レポート自動生成 | 推奨 | S | A-2, A-4 | B |
| C-1 | 追加カード会社対応 | 将来 | M | B-3 | C |
| C-2 | Webダッシュボード | 将来 | L | A-5 | C |
| C-3 | しきい値アラート | 将来 | M | A-4, A-5 | C |

**規模目安**: S = 1〜2時間、M = 3〜4時間、L = 8時間以上
