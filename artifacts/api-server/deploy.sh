#!/bin/bash
# ABA Note Assistant - Deployment Script for DigitalOcean Droplet

set -e

echo "🚀 ABA Note Assistant Deployment Script"
echo "========================================"

# Configuration (update these if needed)
DEPLOY_PATH="${DEPLOY_PATH:-/var/www/ABANOTEASSISTANT}"
PROD_PORT="${PROD_PORT:-5002}"
STAGING_PORT="${STAGING_PORT:-5007}"

echo ""
echo "Configuration:"
echo "  Deploy Path: $DEPLOY_PATH"
echo "  Production Port: $PROD_PORT"
echo "  Staging Port: $STAGING_PORT"
echo ""

# Check if we're on the droplet (optional check)
if [ ! -f "/etc/nginx/nginx.conf" ] && [ ! -d "/root/.pm2" ]; then
  echo "⚠️  Warning: This doesn't look like the droplet environment."
  echo "   Make sure you're running this on the droplet or update paths."
  read -p "Continue anyway? (y/N) " -n 1 -r
  echo
  if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    exit 1
  fi
fi

# Step 1: Navigate to project
if [ ! -d "$DEPLOY_PATH" ]; then
  echo "❌ Error: Directory $DEPLOY_PATH does not exist"
  echo "   Please clone the repository first or update DEPLOY_PATH"
  exit 1
fi

cd "$DEPLOY_PATH"
echo "✅ Changed to $DEPLOY_PATH"

# Step 2: Pull latest code
echo ""
echo "📥 Pulling latest code..."
git pull --ff-only origin main

# Step 3: Install dependencies
echo ""
echo "📦 Installing dependencies..."
corepack pnpm install

# Step 4: Release gates (must pass before any build or restart)
echo ""
echo "🧪 Running API regression tests..."
corepack pnpm run test:api
echo ""
echo "📏 Running offline note-quality evaluation..."
corepack pnpm run eval:notes

# Step 5: Build API + SPA (when nginx serves dist/public from this repo)
echo ""
echo "🔨 Building API server..."
corepack pnpm run build:api-server
echo ""
echo "🔨 Building frontend (ABA Note Assistant SPA)..."
PORT="${FRONTEND_BUILD_PORT:-5000}" BASE_PATH="${FRONTEND_BASE_PATH:-/}" corepack pnpm run build:frontend

# Step 6: Check environment variables
echo ""
echo "🔍 Checking environment configuration..."
if [ ! -f "artifacts/api-server/.env" ]; then
  echo "⚠️  Warning: artifacts/api-server/.env not found"
  echo "   Creating from .env.example..."
  if [ -f "artifacts/api-server/.env.example" ]; then
    cp artifacts/api-server/.env.example artifacts/api-server/.env
    echo "   ⚠️  Please edit artifacts/api-server/.env and set:"
    echo "      - DATABASE_URL"
    echo "      - JWT_SECRET"
    read -p "   Press Enter after updating .env file..."
  else
    echo "   ❌ .env.example not found. Please create .env manually."
    exit 1
  fi
fi

# Step 7: Verify the checked-in PM2 configuration
echo ""
echo "⚙️  Checking artifacts/api-server/ecosystem.config.cjs..."
if [ ! -f "artifacts/api-server/ecosystem.config.cjs" ]; then
  echo "   ❌ artifacts/api-server/ecosystem.config.cjs not found."
  exit 1
fi

# Additive/idempotent audit DDL is required before the new API bundle starts writing telemetry.
echo ""
echo "🗄️  Ensuring note-generation audit tables/columns..."
corepack pnpm --filter @workspace/db run ensure:note-generation-audit-table
corepack pnpm --filter @workspace/db run ensure:note-generation-jobs-table

# Step 8: Run database migrations (optional)
echo ""
read -p "🗄️  Run database migrations? (y/N) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
  echo "   Running migrations..."
  corepack pnpm --filter @workspace/db run push
fi

# Step 9: Restart staging, health-check, then optionally promote the same checkout
echo ""
echo "🔄 Restarting PM2 processes..."
read -p "   Restart staging API first? (Y/n) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Nn]$ ]]; then
  pm2 restart abanoteassistant-api-staging || pm2 start artifacts/api-server/ecosystem.config.cjs --only abanoteassistant-api-staging
  echo "   Waiting for staging health on port $STAGING_PORT..."
  curl --fail --silent --show-error --retry 10 --retry-delay 2 "http://127.0.0.1:$STAGING_PORT/api/healthz" >/dev/null
  echo "   ✅ Staging API restarted and healthy"
fi

read -p "   Promote this same commit to production? (y/N) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
  pm2 restart abanoteassistant-api || pm2 start artifacts/api-server/ecosystem.config.cjs --only abanoteassistant-api
  echo "   Waiting for production health on port $PROD_PORT..."
  curl --fail --silent --show-error --retry 10 --retry-delay 2 "http://127.0.0.1:$PROD_PORT/api/healthz" >/dev/null
  echo "   ✅ Production API restarted and healthy"
fi

# Step 10: Save PM2 config
echo ""
echo "💾 Saving PM2 configuration..."
pm2 save

# Step 11: Show status
echo ""
echo "📊 PM2 Status:"
pm2 list | grep abanoteassistant || echo "   (No abanoteassistant processes found)"

echo ""
echo "✅ Deployment complete!"
echo ""
echo "Next steps:"
echo "  1. Check logs: pm2 logs abanoteassistant-api"
echo "  2. Test health: curl http://localhost:$PROD_PORT/api/healthz"
echo "  3. Verify port: ss -tlnp | grep $PROD_PORT"
