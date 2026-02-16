#!/bin/bash
# Test execution helper script for Docker environment
# Usage: bash scripts/test-docker.sh [pytest args]
#
# This script runs pytest inside a Docker container with all dependencies installed.
# It mounts the project directory and executes tests with Python 3.11.

set -e

PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$PROJECT_ROOT"

echo "🐳 Running tests in Docker (Python 3.11)..."
echo "📦 Installing dependencies..."

docker run --rm \
  -v "$PROJECT_ROOT:/app" \
  -w /app \
  -e PYTHONPATH=/app \
  python:3.11-slim \
  bash -c "
    pip install -q --no-cache-dir \
      pytest pytest-cov httpx \
      google-api-python-client google-auth-httplib2 google-auth-oauthlib \
      sqlalchemy fastapi pydantic click python-dotenv cryptography ruff && \
    echo '✅ Dependencies installed' && \
    echo '🧪 Running pytest...' && \
    pytest $* -v --tb=short
  "
