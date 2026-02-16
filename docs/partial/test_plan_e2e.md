# E2E・統合テスト計画書

**プロジェクト**: card-spending-tracker
**テスト階層**: E2E (End-to-End) / Integration
**作成日**: 2026-02-15
**担当**: 足軽5号 (E2E・統合テスト専門家)

---

## 目次

1. [E2E・統合テスト概要](#1-e2e統合テスト概要)
2. [テスト対象システムフロー](#2-テスト対象システムフロー)
3. [シナリオベーステストケース一覧](#3-シナリオベーステストケース一覧)
4. [テストデータ準備方針](#4-テストデータ準備方針)
5. [前提条件・制約事項](#5-前提条件制約事項)

---

## 1. E2E・統合テスト概要

### 1.1 テストの目的

本テスト計画は、クレジットカード月間使用額管理システムの**エンドツーエンドのユーザーシナリオ**と**コンポーネント間統合動作**を検証する。

**検証対象:**
- ユーザーが実際に行う操作フロー（初回セットアップ → 同期 → 集計表示）
- 複数コンポーネント間のデータ連携（Gmail API ↔ Parser ↔ DB ↔ Summary ↔ CLI）
- エラーハンドリング・例外ケースの動作保証
- セキュリティ機能（OAuth認証、フィッシング対策、トークン管理）

### 1.2 テスト階層の定義

| テスト階層 | 定義 | 対象範囲 |
|----------|------|---------|
| **E2E (End-to-End)** | ユーザー視点での実利用フロー全体を検証 | CLI操作 → システム全体 → 最終出力 |
| **Integration** | 複数コンポーネント間の連携動作を検証 | サービス間API呼び出し、外部API連携 |

### 1.3 テスト優先度

| 優先度 | 定義 | 対象 |
|-------|------|------|
| **Critical** | システムのコア機能。失敗時はリリース不可 | OAuth認証、メール同期、金額抽出、DB保存 |
| **High** | 重要なユーザーシナリオ。失敗時は修正必須 | 月次集計表示、差分同期、重複処理 |
| **Medium** | 補助機能・エラーハンドリング。失敗時は要検討 | レート制限対策、フィッシング警告 |
| **Low** | エッジケース・最適化。将来的な改善対象 | 大量データ処理、パフォーマンス検証 |

---

## 2. テスト対象システムフロー

### 2.1 全体アーキテクチャ（再掲）

```
[User] → [CLI] → [FastAPI] → [Gmail Sync Service] → [Gmail API]
                      ↓              ↓
                 [Parser Service] → [SQLite DB]
                      ↓
                 [Summary Service] → [CLI Output]
```

### 2.2 主要ユースケース

1. **初回セットアップ** (UC-001)
   - OAuth 2.0認証フロー完了
   - トークン暗号化保存
   - 初回メール全件取得

2. **日次メール同期** (UC-002)
   - 差分同期（History API使用）
   - 新規メール解析・DB保存
   - 重複メール除外

3. **月次レポート表示** (UC-003)
   - CLI経由で月次集計取得
   - カード会社別・月別グループ化
   - 正しいフォーマット出力

4. **複数カード会社対応** (UC-004)
   - 三井住友、JCB、楽天カードのメール解析
   - AMEX、dカードのメール解析
   - カード会社別パーサー振り分け

5. **エラーハンドリング** (UC-005)
   - Gmail API エラー対応（401, 429, 500）
   - パース失敗時のフォールバック
   - トークン失効時の再認証フロー

6. **セキュリティ検証** (UC-006)
   - 送信元ドメイン検証
   - フィッシングメール除外
   - 不正メールの警告ログ記録

---

## 3. シナリオベーステストケース一覧

### 3.1 初回セットアップシナリオ

| Test ID | テスト対象 | シナリオ | 前提条件 | テスト内容 | 期待結果 | 優先度 | テスト階層 |
|---------|----------|---------|---------|----------|---------|-------|-----------|
| **T-E2E-001** | OAuth認証フロー | 初回起動時のOAuth 2.0認証完了 | ・credentials.jsonが存在<br>・token.pickleが存在しない | 1. CLI `sync`コマンド実行<br>2. ブラウザで認証URL自動表示<br>3. Googleログイン & 権限承認<br>4. 認可コード取得<br>5. token.pickle作成確認 | ・認証成功メッセージ表示<br>・token.pickleファイル生成<br>・暗号化されたトークン保存 | Critical | E2E |
| **T-E2E-002** | 初回メール全件取得 | OAuth認証後、過去のクレカ通知メール全件取得 | ・OAuth認証済み<br>・SQLite DB初期化済み | 1. CLI `sync`コマンド実行<br>2. Gmail API経由でメール取得（最大500件）<br>3. 各メールを解析・DB保存<br>4. 同期完了メッセージ表示 | ・"X件の新規取引を追加しました"表示<br>・SQLiteに全取引データ保存<br>・gmail_message_idがユニーク | Critical | E2E |
| **T-E2E-003** | トークン自動リフレッシュ | アクセストークン期限切れ時の自動更新 | ・token.pickleが存在（期限切れ）<br>・リフレッシュトークンが有効 | 1. 期限切れトークンで同期実行<br>2. リフレッシュトークンで自動更新<br>3. 新アクセストークンでAPI呼び出し成功 | ・エラーなく同期完了<br>・token.pickle更新<br>・ユーザー操作不要 | Critical | Integration |
| **T-E2E-004** | OAuth再認証フロー | リフレッシュトークン失効時の再認証 | ・token.pickleが存在（リフレッシュトークン失効）| 1. 同期実行<br>2. RefreshError検出<br>3. 再認証フロー開始<br>4. ユーザーに再ログイン促す | ・"トークンが失効しました。再認証してください"表示<br>・ブラウザで認証URL開く | High | E2E |

### 3.2 日次メール同期シナリオ

| Test ID | テスト対象 | シナリオ | 前提条件 | テスト内容 | 期待結果 | 優先度 | テスト階層 |
|---------|----------|---------|---------|----------|---------|-------|-----------|
| **T-E2E-010** | 差分同期（History API） | 2回目以降の同期で差分のみ取得 | ・初回同期完了済み<br>・historyId保存済み<br>・新規メール1件受信 | 1. CLI `sync`実行<br>2. History API呼び出し（前回のhistoryId使用）<br>3. 新規メール1件のみ取得<br>4. DB保存 | ・"1件の新規取引を追加"表示<br>・全件取得せず差分のみ処理<br>・高速化（API呼び出し削減） | High | Integration |
| **T-E2E-011** | 重複メール除外（楽天速報版・確定版） | 同一取引の速報版・確定版メールを1件のみ保存 | ・楽天カード速報版メール受信済み<br>・確定版メールも受信 | 1. 速報版メール同期（DB保存成功）<br>2. 確定版メール同期実行<br>3. gmail_message_idで重複検知<br>4. IntegrityErrorで挿入スキップ | ・"Duplicate email skipped"ログ出力<br>・DBには1件のみ保存<br>・同期処理は継続 | High | Integration |
| **T-E2E-012** | 複数カード会社メール混在同期 | 三井住友・JCB・楽天カードのメールを一度に同期 | ・各カード会社のメールが3件ずつ受信済み | 1. CLI `sync`実行<br>2. 9件のメール取得<br>3. カード会社別パーサー振り分け<br>4. 全メール解析・DB保存 | ・"9件の新規取引を追加"表示<br>・各カード会社フィールドに正しい値<br>・全メール正常処理 | Critical | E2E |
| **T-E2E-013** | パース失敗時のフォールバック | 金額抽出失敗時の汎用パターン適用 | ・カード会社別パターンで抽出失敗するメール受信 | 1. カード会社別パターンマッチ失敗<br>2. 汎用パターン（FALLBACK_AMOUNT_PATTERN）適用<br>3. 抽出成功 → DB保存 | ・警告ログ"Fallback pattern used"出力<br>・金額は正しく抽出<br>・同期処理継続 | Medium | Integration |
| **T-E2E-014** | パース完全失敗時の処理 | 金額・日時が一切抽出できないメールのスキップ | ・解析不可能なメール（広告メール等） | 1. 全パターンで抽出失敗<br>2. エラーログ記録<br>3. 当該メールスキップ<br>4. 次のメール処理継続 | ・"Failed to parse email {message_id}"ログ出力<br>・DBに保存されない<br>・処理中断しない | Medium | Integration |

### 3.3 月次レポート表示シナリオ

| Test ID | テスト対象 | シナリオ | 前提条件 | テスト内容 | 期待結果 | 優先度 | テスト階層 |
|---------|----------|---------|---------|----------|---------|-------|-----------|
| **T-E2E-020** | 月次集計表示（CLI） | 指定月のカード別利用額集計表示 | ・2026-02の取引データ10件保存済み<br>（三井住友5件、JCB3件、楽天2件） | 1. CLI `summary --month 2026-02`実行<br>2. SQLビュー`monthly_summary`クエリ<br>3. カード会社別集計<br>4. フォーマット出力 | ・月: 2026-02<br>・三井住友: 合計X円（5件）<br>・JCB: 合計Y円（3件）<br>・楽天: 合計Z円（2件）<br>・総合計: X+Y+Z円 | Critical | E2E |
| **T-E2E-021** | 全期間集計表示 | 全月の集計データを時系列表示 | ・複数月のデータ保存済み<br>（2026-01、2026-02、2026-03） | 1. CLI `summary`（月指定なし）実行<br>2. 全期間データ取得<br>3. 月降順ソート表示 | ・2026-03 → 2026-02 → 2026-01の順で表示<br>・各月のカード別集計<br>・月別総合計 | High | E2E |
| **T-E2E-022** | 未検証メール除外集計 | is_verified=0のメールを集計から除外 | ・is_verified=1のデータ8件<br>・is_verified=0のデータ2件（不明ドメイン） | 1. CLI `summary --month 2026-02`実行<br>2. SQLビュークエリ（WHERE is_verified=1） | ・集計結果: 8件のみ<br>・不明ドメインメールは合計額に含まれない | High | Integration |
| **T-E2E-023** | 空データ月の表示 | データが存在しない月の集計 | ・2026-05のデータなし | 1. CLI `summary --month 2026-05`実行 | ・"2026-05の取引データはありません"表示<br>・エラーなく正常終了 | Medium | E2E |

### 3.4 セキュリティ検証シナリオ

| Test ID | テスト対象 | シナリオ | 前提条件 | テスト内容 | 期待結果 | 優先度 | テスト階層 |
|---------|----------|---------|---------|----------|---------|-------|-----------|
| **T-E2E-030** | 送信元ドメイン検証（信頼できるドメイン） | 三井住友カード公式ドメインからのメール処理 | ・送信元: `xxx@contact.vpass.ne.jp` | 1. メール同期実行<br>2. ドメインホワイトリスト検証<br>3. is_verified=1でDB保存 | ・"Verified email from 三井住友"ログ出力<br>・is_verified=1<br>・DB保存成功 | Critical | Integration |
| **T-E2E-031** | フィッシングメール検出 | 不明ドメインからのメールを警告 | ・送信元: `xxx@fake-vpass-scam.com`（偽装ドメイン） | 1. メール同期実行<br>2. ドメイン検証失敗<br>3. 警告ログ記録<br>4. is_verified=0でDB保存 | ・"WARNING: Unverified domain detected"ログ出力<br>・is_verified=0<br>・集計には含まれない | Critical | Integration |
| **T-E2E-032** | トークン暗号化保存 | token.pickleが暗号化されている | ・OAuth認証完了 | 1. token.pickle読み込み<br>2. 平文でないことを確認<br>3. 環境変数`TOKEN_ENCRYPTION_KEY`で復号化成功 | ・ファイル内容が暗号化バイナリ<br>・正しいキーで復号化可能<br>・誤ったキーで復号化失敗 | High | Integration |
| **T-E2E-033** | OAuth スコープ検証 | 必要最小限のスコープのみ使用 | ・認証フロー実行中 | 1. 認証URLのスコープ確認<br>2. `gmail.readonly`のみ使用 | ・スコープ: `https://www.googleapis.com/auth/gmail.readonly`<br>・書き込み権限なし | High | Integration |

### 3.5 エラーハンドリングシナリオ

| Test ID | テスト対象 | シナリオ | 前提条件 | テスト内容 | 期待結果 | 優先度 | テスト階層 |
|---------|----------|---------|---------|----------|---------|-------|-----------|
| **T-E2E-040** | Gmail APIレート制限（429エラー） | レート制限超過時のExponential Backoff | ・Gmail API: 429レスポンス返却するようモック設定 | 1. 同期実行 → 429エラー<br>2. 2秒待機後リトライ<br>3. 再度429 → 4秒待機<br>4. 3回目成功 | ・"Rate limit exceeded, retrying in 2s..."ログ出力<br>・最大3回リトライ<br>・最終的に成功 | High | Integration |
| **T-E2E-041** | Gmail APIサーバーエラー（500/503） | Googleサーバーエラー時の固定待機リトライ | ・Gmail API: 500エラー返却 | 1. 同期実行 → 500エラー<br>2. 3秒待機後リトライ<br>3. 成功 | ・"Server error, retrying in 3s..."ログ出力<br>・3秒待機<br>・リトライ成功 | Medium | Integration |
| **T-E2E-042** | Gmail API認証エラー（401） | トークン無効時の自動リフレッシュ | ・無効なアクセストークン使用 | 1. API呼び出し → 401エラー<br>2. リフレッシュトークンで自動更新<br>3. 新トークンで再試行成功 | ・"Token expired, refreshing..."ログ出力<br>・token.pickle更新<br>・ユーザー操作不要で成功 | Critical | Integration |
| **T-E2E-043** | ネットワーク切断時の処理 | インターネット接続なし時のエラーハンドリング | ・ネットワーク切断状態 | 1. CLI `sync`実行<br>2. ConnectionErrorキャッチ<br>3. エラーメッセージ表示<br>4. プログラム異常終了なし | ・"ネットワークエラー: 接続を確認してください"表示<br>・スタックトレースなし<br>・終了コード: 1 | Medium | E2E |
| **T-E2E-044** | SQLiteデータベースロック | 同時書き込み時のロック処理 | ・DB書き込み中に2つ目の同期実行 | 1. 1つ目の同期実行（長時間トランザクション）<br>2. 2つ目の同期実行<br>3. DatabaseLockedErrorキャッチ<br>4. リトライまたはエラーメッセージ | ・"Database is locked, retrying..."ログ出力<br>・最大5秒待機後リトライ<br>・またはエラーメッセージ表示 | Medium | Integration |

### 3.6 カード会社別パーサーテスト（統合）

| Test ID | テスト対象 | シナリオ | 前提条件 | テスト内容 | 期待結果 | 優先度 | テスト階層 |
|---------|----------|---------|---------|----------|---------|-------|-----------|
| **T-E2E-050** | 三井住友カードメール解析 | 三井住友カードの利用通知メール解析 | ・実際のメールサンプル（fixtures/sample_emails/smbc.eml） | 1. メール読み込み<br>2. 金額・日時・店舗名抽出<br>3. Transactionオブジェクト生成 | ・card_company: "三井住友"<br>・amount: 3500（円）<br>・transaction_date: "2026-02-15 14:30:00"<br>・merchant: "セブンイレブン渋谷店"<br>・is_verified: 1 | Critical | Integration |
| **T-E2E-051** | JCBカードメール解析 | JCBカードの利用通知メール解析 | ・実際のメールサンプル（fixtures/sample_emails/jcb.eml） | 1. メール読み込み<br>2. 金額・日時・店舗名抽出 | ・card_company: "JCB"<br>・amount: 12800<br>・transaction_date: "2026-02-14 18:45:00"<br>・merchant: "Amazon.co.jp"<br>・is_verified: 1 | Critical | Integration |
| **T-E2E-052** | 楽天カードメール解析（速報版） | 楽天カード速報版メール解析 | ・実際のメールサンプル（fixtures/sample_emails/rakuten_preliminary.eml） | 1. メール読み込み<br>2. 金額・日時・店舗名抽出 | ・card_company: "楽天"<br>・amount: 5400<br>・transaction_date: "2026-02-13 12:00:00"<br>・merchant: "楽天市場"<br>・is_verified: 1 | Critical | Integration |
| **T-E2E-053** | AMEXメール解析 | American Expressメール解析 | ・実際のメールサンプル（fixtures/sample_emails/amex.eml） | 1. メール読み込み<br>2. 金額・日時・店舗名抽出 | ・card_company: "AMEX"<br>・amount: 25000<br>・transaction_date: "2026-02-12"<br>・merchant: "ヨドバシカメラ"<br>・is_verified: 1 | High | Integration |
| **T-E2E-054** | dカードメール解析 | dカードメール解析（パターン推測） | ・実際のメールサンプル（fixtures/sample_emails/dcard.eml） | 1. メール読み込み<br>2. 金額・日時・店舗名抽出 | ・card_company: "dカード"<br>・amount: 8900<br>・transaction_date: "2026-02-11"<br>・merchant: "ローソン"<br>・is_verified: 1 | High | Integration |
| **T-E2E-055** | 複数カード会社混在処理 | 全カード会社のメールを一括解析 | ・6社のメールサンプル各1件ずつ | 1. 6件のメール一括処理<br>2. カード会社判別<br>3. カード会社別パーサー適用<br>4. 全件DB保存 | ・6件全て正常解析<br>・各カード会社フィールド正確<br>・DB保存成功 | Critical | Integration |

### 3.7 FastAPI統合テスト

| Test ID | テスト対象 | シナリオ | 前提条件 | テスト内容 | 期待結果 | 優先度 | テスト階層 |
|---------|----------|---------|---------|----------|---------|-------|-----------|
| **T-E2E-060** | FastAPI月次集計エンドポイント | `GET /api/summary/{month}`の動作検証 | ・2026-02のデータ10件保存済み | 1. `GET /api/summary/2026-02`リクエスト<br>2. JSONレスポンス取得 | ・ステータスコード: 200<br>・JSON形式レスポンス<br>・カード会社別集計データ含む | High | Integration |
| **T-E2E-061** | FastAPI手動同期エンドポイント | `POST /api/sync`で同期トリガー | ・OAuth認証済み<br>・新規メール3件受信済み | 1. `POST /api/sync`リクエスト<br>2. 同期処理実行<br>3. レスポンス取得 | ・ステータスコード: 200<br>・`{"status": "success", "new_transactions": 3}`<br>・DB保存成功 | High | Integration |
| **T-E2E-062** | FastAPI Swagger UI | `/docs`でAPI仕様確認 | ・FastAPI起動中 | 1. ブラウザで`http://localhost:8000/docs`アクセス<br>2. Swagger UI表示確認 | ・Swagger UI正常表示<br>・全エンドポイント一覧表示<br>・Try it out機能動作 | Medium | E2E |
| **T-E2E-063** | FastAPIエラーレスポンス（認証エラー） | 未認証状態でAPI呼び出し時のエラー | ・token.pickleが存在しない | 1. `POST /api/sync`リクエスト<br>2. 認証エラー検出 | ・ステータスコード: 401<br>・`{"error": "Not authenticated"}`<br>・エラーメッセージ表示 | High | Integration |

### 3.8 パフォーマンス・スケーラビリティ

| Test ID | テスト対象 | シナリオ | 前提条件 | テスト内容 | 期待結果 | 優先度 | テスト階層 |
|---------|----------|---------|---------|----------|---------|-------|-----------|
| **T-E2E-070** | 大量メール同期 | 500件のメールを一度に同期 | ・Gmail受信箱に500件のメール存在 | 1. 初回同期実行<br>2. 500件全メール取得<br>3. パース・DB保存<br>4. 処理時間計測 | ・全件正常処理<br>・処理時間: 5分以内（目安）<br>・メモリエラーなし | Low | E2E |
| **T-E2E-071** | ページネーション処理 | 100件を超えるメールのページネーション取得 | ・Gmail受信箱に200件のメール存在 | 1. API呼び出し（maxResults=100）<br>2. nextPageToken取得<br>3. 2ページ目取得<br>4. 全200件取得完了 | ・ページネーション正常動作<br>・全200件取得<br>・重複なし | Medium | Integration |
| **T-E2E-072** | 長期間データの集計パフォーマンス | 1年分（12ヶ月）のデータ集計 | ・2025-01〜2025-12の取引データ各100件（計1200件） | 1. CLI `summary`（全期間）実行<br>2. 集計処理時間計測 | ・処理時間: 3秒以内<br>・全12ヶ月分表示<br>・メモリエラーなし | Low | E2E |

---

## 4. テストデータ準備方針

### 4.1 シナリオ用メールデータセット

#### 4.1.1 実メールサンプル収集戦略

| カード会社 | サンプル数 | 収集方法 | 保存場所 |
|----------|----------|---------|---------|
| 三井住友 | 3件（通常利用、高額決済、海外利用） | Gmail API経由でエクスポート → `.eml`形式保存 | `tests/fixtures/sample_emails/smbc_*.eml` |
| JCB | 3件（通常利用、速報版、確定版） | 同上 | `tests/fixtures/sample_emails/jcb_*.eml` |
| 楽天 | 3件（速報版、確定版、重複テスト用） | 同上 | `tests/fixtures/sample_emails/rakuten_*.eml` |
| AMEX | 2件（通常利用、パターン検証用） | 同上 | `tests/fixtures/sample_emails/amex_*.eml` |
| dカード | 2件（パターン推測検証用） | 同上 | `tests/fixtures/sample_emails/dcard_*.eml` |
| **フィッシングメール** | 2件（偽装ドメイン） | 手動作成（送信元アドレス偽装） | `tests/fixtures/sample_emails/phishing_*.eml` |

**合計**: 15件のメールサンプル

#### 4.1.2 メールサンプルフォーマット

```
tests/fixtures/sample_emails/
├── smbc_normal.eml          # 三井住友: 通常利用（セブンイレブン 3,500円）
├── smbc_high_amount.eml     # 三井住友: 高額決済（家電量販店 50,000円）
├── smbc_overseas.eml        # 三井住友: 海外利用（USD 100）
├── jcb_normal.eml           # JCB: 通常利用（Amazon 12,800円）
├── jcb_preliminary.eml      # JCB: 速報版
├── jcb_final.eml            # JCB: 確定版
├── rakuten_preliminary.eml  # 楽天: 速報版（楽天市場 5,400円）
├── rakuten_final.eml        # 楽天: 確定版（同一取引）
├── rakuten_duplicate_test.eml # 楽天: 重複テスト用（同じgmail_message_id）
├── amex_normal.eml          # AMEX: 通常利用（ヨドバシ 25,000円）
├── amex_pattern_test.eml    # AMEX: パターン検証用
├── dcard_normal.eml         # dカード: 通常利用（ローソン 8,900円）
├── dcard_pattern_test.eml   # dカード: パターン検証用
├── phishing_fake_smbc.eml   # フィッシング: 偽装三井住友（@fake-vpass-scam.com）
└── phishing_fake_rakuten.eml # フィッシング: 偽装楽天（@rakuten-card-scam.com）
```

**注意**: 実メールには個人情報（カード番号下4桁、利用店舗等）が含まれる可能性があるため、サンプル作成時に**匿名化**する。

#### 4.1.3 メールサンプル匿名化ルール

| 項目 | 匿名化方法 |
|------|----------|
| カード番号下4桁 | ダミー番号（例: `**** **** **** 1234`） |
| 利用店舗名 | 一般的な店舗名に置き換え（例: "セブンイレブン渋谷店"） |
| 金額 | テストシナリオに応じた固定値 |
| メール受信者アドレス | `test@example.com`等のダミーアドレス |

### 4.2 Gmail APIモック戦略

#### 4.2.1 モック方針

| テストケース | モック使用 | 理由 |
|------------|----------|------|
| **パーサー単体テスト** | ファイルベース（`.eml`読み込み） | 外部API不要、高速、再現性高 |
| **Gmail API統合テスト** | `responses`ライブラリでHTTPモック | Gmail API呼び出し動作検証、エラーケース再現 |
| **E2Eテスト（初回同期）** | Gmail API Testアカウント使用 | 実際のOAuthフロー・ネットワーク動作検証 |

#### 4.2.2 Gmail APIモック実装例

```python
# tests/test_gmail_integration.py
import responses
from app.gmail.client import GmailClient

@responses.activate
def test_gmail_api_rate_limit_429():
    # Gmail API: 429エラーをモック
    responses.add(
        responses.GET,
        "https://gmail.googleapis.com/gmail/v1/users/me/messages",
        json={"error": {"code": 429, "message": "Rate limit exceeded"}},
        status=429
    )

    client = GmailClient()
    result = client.fetch_messages()  # Exponential Backoffでリトライ

    assert result is not None  # リトライ成功
```

### 4.3 SQLiteテストデータベース戦略

#### 4.3.1 テストDB管理方針

| 方針 | 実装 |
|------|------|
| **テストDB独立化** | `tests/fixtures/test_transactions.db`を使用（本番DBと分離） |
| **テスト前後の初期化** | pytest `fixture`で各テスト前にDB作成、テスト後に削除 |
| **シード データ投入** | `tests/fixtures/seed_data.sql`で初期データ投入 |

#### 4.3.2 シードデータ例

```sql
-- tests/fixtures/seed_data.sql
INSERT INTO card_transactions (card_company, amount, transaction_date, merchant, email_subject, email_from, gmail_message_id, is_verified)
VALUES
  ('三井住友', 3500, '2026-02-15 14:30:00', 'セブンイレブン渋谷店', '三井住友カードご利用通知', 'no-reply@contact.vpass.ne.jp', 'msg_001', 1),
  ('JCB', 12800, '2026-02-14 18:45:00', 'Amazon.co.jp', 'JCBカードご利用のお知らせ', 'jcb@qa.jcb.co.jp', 'msg_002', 1),
  ('楽天', 5400, '2026-02-13 12:00:00', '楽天市場', '楽天カード利用通知', 'info@mail.rakuten-card.co.jp', 'msg_003', 1),
  ('三井住友', 50000, '2026-02-12 16:20:00', 'ヨドバシカメラ', '三井住友カードご利用通知', 'no-reply@contact.vpass.ne.jp', 'msg_004', 1),
  ('AMEX', 25000, '2026-02-11 10:15:00', 'ビックカメラ', 'American Express ご利用通知', 'notifications@aexp.com', 'msg_005', 1),
  ('三井住友', 8900, '2026-01-30 09:00:00', 'ローソン', '三井住友カードご利用通知', 'no-reply@contact.vpass.ne.jp', 'msg_006', 1),
  ('JCB', 15000, '2026-01-28 20:30:00', 'ユニクロ', 'JCBカードご利用のお知らせ', 'jcb@qa.jcb.co.jp', 'msg_007', 1),
  ('楽天', 7200, '2026-01-25 13:45:00', 'マクドナルド', '楽天カード利用通知', 'info@mail.rakuten-card.co.jp', 'msg_008', 1),
  ('UNKNOWN', 10000, '2026-02-10 11:00:00', '不明', 'カード利用通知', 'scam@fake-vpass-scam.com', 'msg_009', 0),  -- フィッシングメール
  ('三井住友', 2000, '2026-03-01 08:00:00', 'スターバックス', '三井住友カードご利用通知', 'no-reply@contact.vpass.ne.jp', 'msg_010', 1);
```

**データ内訳**:
- 2026-02: 5件（三井住友2件、JCB1件、楽天1件、AMEX1件）
- 2026-01: 3件
- 2026-03: 1件
- フィッシングメール: 1件（is_verified=0）

### 4.4 外部サービスモック

#### 4.4.1 Gmail API テストアカウント

| 目的 | 実装方法 |
|------|---------|
| **OAuth認証フローE2Eテスト** | Google Cloud Consoleでテストプロジェクト作成<br>→ テスト用Gmailアカウント準備<br>→ OAuth 2.0クレデンシャル発行 |
| **API呼び出しクォータ消費削減** | テストプロジェクトのクォータは本番と分離<br>→ 本番環境への影響なし |

#### 4.4.2 外部APIモック（将来的なWeb UI連携対応）

| API | モック方法 |
|-----|----------|
| **FastAPI `/api/summary`** | `httpx.AsyncClient`でテストクライアント作成 |
| **Gmail API** | `responses`ライブラリでHTTPモック |

---

## 5. 前提条件・制約事項

### 5.1 テスト実行前提条件

| カテゴリ | 前提条件 | 確認方法 |
|---------|---------|---------|
| **環境** | Python 3.11+インストール済み | `python --version` |
| **依存関係** | Poetry経由で全ライブラリインストール済み | `poetry install` |
| **Google Cloud** | Gmail API有効化済み | Google Cloud Console確認 |
| **認証情報** | `credentials/credentials.json`存在（テスト用） | `ls credentials/credentials.json` |
| **テストデータ** | メールサンプル（`.eml`）15件準備済み | `ls tests/fixtures/sample_emails/` |
| **データベース** | テスト用SQLite初期化済み | `pytest --fixtures`実行 |

### 5.2 テスト実行制約事項

| 項目 | 制約内容 | 対策 |
|------|---------|------|
| **Gmail APIクォータ** | 1日10億ユニット（実質無制限だが念のため注意） | テストではモック優先使用 |
| **OAuthトークン有効期限** | アクセストークン: 1時間<br>リフレッシュトークン: 無期限（失効リスクあり） | テスト開始前にトークン更新 |
| **SQLiteロック** | 同時書き込み不可 | テストは順次実行（並列テスト時は注意） |
| **実メールサンプル** | 個人情報含む可能性 | 必ず匿名化してからgit commit |
| **E2Eテスト実行時間** | 初回同期テスト等は数分かかる | CIでは軽量テストのみ実行、重いテストは手動実行 |

### 5.3 テスト実行環境

| 環境 | 用途 | 実行方法 |
|------|------|---------|
| **ローカル開発環境** | 全テスト実行（ユニット・統合・E2E） | `poetry run pytest tests/` |
| **CI/CD（GitHub Actions等）** | 軽量テストのみ（モック中心） | `pytest tests/ -m "not slow"` |
| **手動テスト環境** | 実Gmail API使用テスト | テスト用Gmailアカウントで手動実行 |

### 5.4 テストカバレッジ目標

| テスト階層 | 目標カバレッジ | 測定方法 |
|----------|--------------|---------|
| **ユニットテスト** | 80%以上 | `pytest --cov=app --cov-report=html` |
| **統合テスト** | 主要シナリオ網羅（Critical/High優先度100%） | 手動チェックリスト |
| **E2Eテスト** | コアフロー100%（OAuth→同期→集計） | 手動実行・レポート記録 |

---

## 付録: テスト実行コマンド一覧

### A.1 全テスト実行

```bash
# 全テスト実行（ユニット・統合・E2E）
poetry run pytest tests/ -v

# カバレッジ付き実行
poetry run pytest tests/ --cov=app --cov-report=html

# 特定テストファイルのみ実行
poetry run pytest tests/test_parser.py -v
```

### A.2 テストマーカー別実行

```bash
# E2Eテストのみ実行
poetry run pytest tests/ -m "e2e" -v

# 統合テストのみ実行
poetry run pytest tests/ -m "integration" -v

# 軽量テストのみ（CI用）
poetry run pytest tests/ -m "not slow" -v

# Critical優先度テストのみ
poetry run pytest tests/ -m "critical" -v
```

### A.3 テストデータ準備

```bash
# テスト用DBシード投入
sqlite3 tests/fixtures/test_transactions.db < tests/fixtures/seed_data.sql

# メールサンプル確認
ls -lh tests/fixtures/sample_emails/

# Gmail API モック確認
poetry run pytest tests/test_gmail_integration.py::test_gmail_api_rate_limit_429 -v
```

---

**テスト計画書作成完了**
**次のアクション**: テストデータ（メールサンプル15件）の収集と匿名化作業
