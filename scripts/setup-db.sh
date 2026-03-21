#!/bin/bash
# Setup script for database migrations
# This script loads .env and runs database migrations

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
API_SERVER_DIR="$PROJECT_ROOT/artifacts/api-server"

echo "🔍 Checking for .env file..."
if [ ! -f "$API_SERVER_DIR/.env" ]; then
  echo "❌ .env file not found at $API_SERVER_DIR/.env"
  echo "📝 Creating from .env.example..."
  cp "$API_SERVER_DIR/.env.example" "$API_SERVER_DIR/.env"
  echo "⚠️  Please edit $API_SERVER_DIR/.env and set your DATABASE_URL"
  exit 1
fi

echo "✅ .env file found"
echo "📦 Loading environment variables..."

# Load .env file
export $(grep -v '^#' "$API_SERVER_DIR/.env" | xargs)

if [ -z "$DATABASE_URL" ] || [ "$DATABASE_URL" = "postgresql://user:password@host:5432/dbname?sslmode=require" ]; then
  echo "❌ DATABASE_URL is not set or is still the placeholder value"
  echo "📝 Please edit $API_SERVER_DIR/.env and set your actual DATABASE_URL"
  exit 1
fi

echo "✅ DATABASE_URL is set"
echo "🚀 Running database migrations..."

cd "$PROJECT_ROOT"
pnpm --filter @workspace/db run push

echo "✅ Database migrations completed!"
