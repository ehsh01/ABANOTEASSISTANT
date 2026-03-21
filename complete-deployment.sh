#!/bin/bash
# Complete the ABA Note Assistant deployment
# Run on the droplet from repo root: bash complete-deployment.sh
#
# Prerequisites:
# - artifacts/api-server/.env with DATABASE_URL, JWT_SECRET (and optional staging vars)
# - Tables live in Postgres schema `abanote` (see lib/db/src/schema) so this app can share a
#   cluster with other products that use `public.*`.
# - drizzle.config.ts parses DATABASE_URL and sets ssl.rejectUnauthorized=false (managed PG).

set -e

REPO_ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$REPO_ROOT"

echo "📦 Installing dependencies..."
command -v pnpm >/dev/null || (corepack enable && corepack prepare pnpm@9 --activate)
pnpm install --frozen-lockfile 2>/dev/null || pnpm install

echo "🔧 Ensuring bcrypt native binding (first deploy / new Node)..."
BCRYPT_DIR="$REPO_ROOT/node_modules/.pnpm/bcrypt@5.1.1/node_modules/bcrypt"
if [ -d "$BCRYPT_DIR" ] && [ ! -f "$BCRYPT_DIR/lib/binding/napi-v3/bcrypt_lib.node" ]; then
  (cd "$BCRYPT_DIR" && npm run install)
fi

echo "🗄️  Database schema (drizzle push)..."
# Load only DATABASE_URL by scanning lines — avoids `source .env` failing when another
# line has a bash syntax issue (e.g. unclosed quote, stray newline).
ENV_FILE="artifacts/api-server/.env"
if [ ! -f "$ENV_FILE" ]; then
  echo "❌ Missing $ENV_FILE"
  exit 1
fi
DATABASE_URL=""
while IFS= read -r line || [ -n "$line" ]; do
  [[ "$line" =~ ^[[:space:]]*# ]] && continue
  [[ -z "${line// }" ]] && continue
  if [[ "$line" =~ ^[[:space:]]*DATABASE_URL[[:space:]]*= ]]; then
    DATABASE_URL="${line#*=}"
    DATABASE_URL="${DATABASE_URL#"${DATABASE_URL%%[![:space:]]*}"}"
    DATABASE_URL="${DATABASE_URL%"${DATABASE_URL##*[![:space:]]}"}"
    DATABASE_URL="${DATABASE_URL#\"}"
    DATABASE_URL="${DATABASE_URL%\"}"
    DATABASE_URL="${DATABASE_URL#\'}"
    DATABASE_URL="${DATABASE_URL%\'}"
    break
  fi
done < "$ENV_FILE"
if [ -z "$DATABASE_URL" ]; then
  echo "❌ DATABASE_URL not found in $ENV_FILE"
  exit 1
fi
export DATABASE_URL
pnpm --filter @workspace/db run push

echo "🔨 Building API server..."
pnpm --filter @workspace/api-server run build

echo "🌐 Building frontend (adjust PORT/BASE_PATH if needed)..."
export PORT="${FRONTEND_BUILD_PORT:-5000}"
export BASE_PATH="${FRONTEND_BASE_PATH:-/}"
pnpm --filter @workspace/abanoteassistant run build

echo "📁 Creating logs directory..."
mkdir -p logs

echo "🛑 Replacing PM2 processes..."
pm2 delete abanoteassistant-api 2>/dev/null || true
pm2 delete abanoteassistant-api-staging 2>/dev/null || true

echo "🚀 Starting PM2 — production + staging (reads artifacts/api-server/.env via ecosystem.config.cjs)..."
pm2 start artifacts/api-server/ecosystem.config.cjs --only abanoteassistant-api
pm2 start artifacts/api-server/ecosystem.config.cjs --only abanoteassistant-api-staging

pm2 save

echo "✅ Deployment complete!"
echo ""
echo "Status:"
pm2 list | grep abanoteassistant || true
echo ""
echo "Testing health endpoints..."
sleep 2
echo -n "  Production (${API_PORT_PROD:-5002}): "
curl -sS "http://127.0.0.1:${API_PORT_PROD:-5002}/api/healthz" && echo "" || echo "(failed)"
echo -n "  Staging (${API_PORT_STAGING:-5007}): "
curl -sS "http://127.0.0.1:${API_PORT_STAGING:-5007}/api/healthz" && echo "" || echo "(failed)"
