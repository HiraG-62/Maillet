FROM python:3.11-slim

# 作業ディレクトリ設定
WORKDIR /app

# システムパッケージ更新（セキュリティ対策）
RUN apt-get update && apt-get upgrade -y && \
    apt-get install -y --no-install-recommends \
        build-essential \
        curl && \
    rm -rf /var/lib/apt/lists/*

# Poetry インストール
ENV POETRY_VERSION=1.7.1
ENV POETRY_HOME=/opt/poetry
ENV POETRY_NO_INTERACTION=1
ENV POETRY_VIRTUALENVS_CREATE=false
RUN curl -sSL https://install.python-poetry.org | python3 -

# PATH に Poetry を追加
ENV PATH="$POETRY_HOME/bin:$PATH"

# 依存関係ファイルをコピー
COPY pyproject.toml ./

# 依存パッケージインストール（開発依存は除外）
RUN poetry install --no-dev --no-root

# アプリケーションコードをコピー
COPY app/ ./app/
COPY scripts/ ./scripts/

# データ・認証情報用ディレクトリ作成
RUN mkdir -p data credentials

# 非特権ユーザーで実行（セキュリティ対策）
RUN useradd -m -u 1000 appuser && \
    chown -R appuser:appuser /app
USER appuser

# FastAPI サーバー起動
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
