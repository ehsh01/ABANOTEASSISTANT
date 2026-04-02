#!/bin/bash
# ABA Note Assistant - Deployment Script for DigitalOcean Droplet

set -e

echo "🚀 ABA Note Assistant Deployment Script"
echo "========================================"

# Configuration (update these if needed)
DEPLOY_PATH="${DEPLOY_PATH:-/var/www/ABANOTEASSISTANT}"
PROD_PORT="${PROD_PORT:-5002}"
STAGING_PORT="${STAGING_PORT:-5005}"

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
git pull origin main || git pull origin master || echo "⚠️  Could not pull (maybe not a git repo?)"

# Step 3: Install dependencies
echo ""
echo "📦 Installing dependencies..."
pnpm install

# Step 4: Build
echo ""
echo "🔨 Building API server..."
pnpm run build:api-server

# Step 5: Check environment variables
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

# Step 6: Update ecosystem.config.js if needed
echo ""
echo "⚙️  Checking ecosystem.config.js..."
if [ -f "ecosystem.config.js" ]; then
  # Check if cwd needs updating
  if grep -q "/var/www/ABANOTEASSISTANT" ecosystem.config.js; then
    echo "   ⚠️  Please update ecosystem.config.js:"
    echo "      - Set correct 'cwd' path"
    echo "      - Set DATABASE_URL for production and staging"
    echo "      - Set JWT_SECRET for production and staging"
    echo "      - Verify PORT values ($PROD_PORT for prod, $STAGING_PORT for staging)"
    read -p "   Press Enter after updating ecosystem.config.js..."
  fi
else
  echo "   ❌ ecosystem.config.js not found. Please create it first."
  exit 1
fi

# Step 7: Run database migrations (optional)
echo ""
read -p "🗄️  Run database migrations? (y/N) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
  echo "   Running migrations..."
  pnpm --filter @workspace/db run push
fi

# Step 8: Restart PM2
echo ""
echo "🔄 Restarting PM2 processes..."
read -p "   Restart production API? (Y/n) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Nn]$ ]]; then
  pm2 restart abanoteassistant-api || pm2 start ecosystem.config.js --only abanoteassistant-api
  echo "   ✅ Production API restarted"
fi

read -p "   Restart staging API? (y/N) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
  pm2 restart abanoteassistant-api-staging || pm2 start ecosystem.config.js --only abanoteassistant-api-staging
  echo "   ✅ Staging API restarted"
fi

# Step 9: Save PM2 config
echo ""
echo "💾 Saving PM2 configuration..."
pm2 save

# Step 10: Show status
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
