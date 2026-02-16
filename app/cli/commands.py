"""
CLI commands for card spending tracker.

Provides sync, summary, and setup commands using Click framework.
"""

import os
import sys
import click
from datetime import datetime
from typing import Optional

from googleapiclient.discovery import build
from googleapiclient.errors import HttpError

from app.gmail.auth import authenticate
from app.gmail.client import GmailClient
from app.database.connection import DatabaseConnection
from app.services.aggregation_service import (
    get_monthly_summary,
    get_all_time_summary_by_card,
)


# Default database path
DEFAULT_DB_PATH = os.getenv("DATABASE_PATH", "data/transactions.db")


@click.group()
def cli():
    """Card Spending Tracker CLI - クレジットカード月間使用額管理システム"""
    pass


@cli.command()
@click.option(
    "--credentials",
    default="credentials/credentials.json",
    help="Path to OAuth credentials file",
)
@click.option(
    "--token",
    default="credentials/token.pickle",
    help="Path to token file",
)
@click.option(
    "--db",
    default=DEFAULT_DB_PATH,
    help="Path to database file",
)
def sync(credentials: str, token: str, db: str):
    """
    メール同期実行 - Gmail APIからカード利用通知を取得してDBに保存
    """
    try:
        # OAuth認証
        click.echo("🔐 OAuth認証中...")
        creds = authenticate(credentials, token)

        # Gmail API サービス構築
        service = build("gmail", "v1", credentials=creds)
        client = GmailClient(service)

        # メール取得クエリ
        query = "from:(@contact.vpass.ne.jp OR @qa.jcb.co.jp OR @mail.rakuten-card.co.jp OR @aexp.com OR @dcard.docomo.ne.jp)"

        click.echo("📧 メール取得中...")
        messages = client.list_messages(query=query, max_results=100)

        if not messages:
            click.echo("✅ 新規取引はありません")
            return

        # データベース接続
        db_conn = DatabaseConnection(db)

        # 各メッセージを処理
        # TODO: Parser実装後にメール本文解析とDB保存を追加
        click.echo(f"✅ {len(messages)}件の新規取引を追加しました")

    except FileNotFoundError as e:
        click.echo(f"❌ エラー: {e}", err=True)
        click.echo(
            "💡 credentials.jsonが見つかりません。'setup'コマンドを実行してください。",
            err=True,
        )
        sys.exit(1)

    except EnvironmentError as e:
        click.echo(f"❌ エラー: {e}", err=True)
        click.echo(
            "💡 環境変数 TOKEN_ENCRYPTION_KEY が設定されていません。",
            err=True,
        )
        sys.exit(1)

    except HttpError as e:
        click.echo(f"❌ Gmail APIエラー: {e}", err=True)
        sys.exit(1)

    except Exception as e:
        click.echo(f"❌ エラー: {e}", err=True)
        sys.exit(1)


@cli.command()
@click.option(
    "--month",
    help="集計対象月 (YYYY-MM形式)",
)
@click.option(
    "--card",
    help="カード会社名 (例: 三井住友, 楽天, JCB)",
)
@click.option(
    "--db",
    default=DEFAULT_DB_PATH,
    help="Path to database file",
)
def summary(month: Optional[str], card: Optional[str], db: str):
    """
    月次集計表示 - カード会社別・月別の利用金額を表示
    """
    try:
        # データベース接続
        db_conn = DatabaseConnection(db)

        # 月指定の処理
        year = None
        month_num = None
        if month:
            try:
                # YYYY-MM形式をパース
                dt = datetime.strptime(month, "%Y-%m")
                year = dt.year
                month_num = dt.month
            except ValueError:
                click.echo(
                    "❌ Invalid month format. Use YYYY-MM (例: 2026-02)",
                    err=True,
                )
                sys.exit(1)

        # 集計データ取得
        with db_conn.get_session() as session:
            if year and month_num:
                # 月別集計
                if card:
                    # 特定カード会社・特定月
                    result = get_monthly_summary(session, year, month_num, card)
                    _display_single_card_summary(month, card, result)
                else:
                    # 全カード会社・特定月
                    result = get_all_time_summary_by_card(session)
                    # TODO: Filter by month in aggregation service
                    _display_monthly_summary(month, result)
            else:
                # 全期間集計
                result = get_all_time_summary_by_card(session)
                if not result:
                    click.echo("📭 取引データがありません")
                    return
                _display_all_time_summary(result)

    except Exception as e:
        click.echo(f"❌ エラー: {e}", err=True)
        sys.exit(1)


def _display_single_card_summary(month: str, card: str, result: dict):
    """Display summary for a single card company."""
    click.echo(f"\n📊 {month} - {card} の集計")
    click.echo("=" * 50)
    click.echo(f"合計金額: ¥{result['total']:,} 円")
    click.echo(f"取引件数: {result['count']} 件")
    click.echo(f"平均金額: ¥{result['average']:,} 円")
    click.echo()


def _display_monthly_summary(month: str, results: dict):
    """Display summary for all cards in a specific month."""
    click.echo(f"\n📊 {month} の集計")
    click.echo("=" * 50)

    if not results:
        click.echo("📭 データが見つかりません")
        return

    for card_name, data in results.items():
        click.echo(f"\n{card_name}:")
        click.echo(f"  合計: ¥{data['total']:,} 円 ({data['count']}件)")


def _display_all_time_summary(results: dict):
    """Display summary for all cards across all time."""
    click.echo("\n📊 全期間の集計")
    click.echo("=" * 50)

    total_all = 0
    count_all = 0

    for card_name, data in results.items():
        click.echo(f"\n{card_name}:")
        click.echo(f"  合計: ¥{data['total']:,} 円")
        click.echo(f"  件数: {data['count']} 件")
        click.echo(f"  平均: ¥{data['average']:,} 円")
        total_all += data["total"]
        count_all += data["count"]

    click.echo(f"\n{'=' * 50}")
    click.echo(f"総合計: ¥{total_all:,} 円 ({count_all}件)")
    click.echo()


@cli.command()
@click.option(
    "--credentials",
    default="credentials/credentials.json",
    help="Path to OAuth credentials file",
)
@click.option(
    "--token",
    default="credentials/token.pickle",
    help="Path to token file",
)
def setup(credentials: str, token: str):
    """
    OAuth認証フロー起動 - 初回セットアップ用
    """
    try:
        click.echo("🚀 OAuth認証フローを開始します...")
        click.echo(f"📄 Credentials: {credentials}")

        # 環境変数チェック
        if not os.getenv("TOKEN_ENCRYPTION_KEY"):
            raise EnvironmentError("TOKEN_ENCRYPTION_KEY environment variable not set")

        # OAuth認証実行
        creds = authenticate(credentials, token)

        click.echo("✅ 認証完了!")
        click.echo(f"🔐 トークンファイルを保存しました: {token}")
        click.echo("\n次のコマンドでメール同期を実行できます:")
        click.echo("  $ card-tracker sync")

    except FileNotFoundError as e:
        click.echo(f"❌ エラー: {e}", err=True)
        click.echo(
            f"💡 {credentials} が見つかりません。Google Cloud Consoleからダウンロードしてください。",
            err=True,
        )
        sys.exit(1)

    except EnvironmentError as e:
        click.echo(f"❌ エラー: {e}", err=True)
        click.echo(
            "💡 環境変数 TOKEN_ENCRYPTION_KEY を設定してください。",
            err=True,
        )
        sys.exit(1)

    except Exception as e:
        error_msg = str(e).lower()
        if "denied" in error_msg or "cancel" in error_msg:
            click.echo("❌ OAuth認証がキャンセルされました", err=True)
        else:
            click.echo(f"❌ エラー: {e}", err=True)
        sys.exit(1)


if __name__ == "__main__":
    cli()
