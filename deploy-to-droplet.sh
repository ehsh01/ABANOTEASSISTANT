#!/bin/bash
# ABA Note Assistant - Complete Deployment Script for DigitalOcean Droplet
# Run this script on the droplet: bash deploy-to-droplet.sh

set -e

echo "🚀 ABA Note Assistant - Complete Deployment"
echo "=========================================="
echo ""

# Configuration
DEPLOY_PATH="/var/www/ABANOTEASSISTANT"
REPO_URL="https://github.com/ehsh01/ABANOTEASSISTANT.git"
PROD_PORT="5002"
STAGING_PORT="5005"

# Step 1: Clone or Update Repository
echo "📥 Step 1: Setting up repository..."
if [ -d "$DEPLOY_PATH" ]; then
  echo "   Directory exists, pulling latest changes..."
  cd "$DEPLOY_PATH"
  git fetch origin
  git reset --hard origin/main || git reset --hard origin/master
else
  echo "   Cloning repository..."
  mkdir -p "$(dirname $DEPLOY_PATH)"
  git clone "$REPO_URL" "$DEPLOY_PATH"
  cd "$DEPLOY_PATH"
fi
echo "   ✅ Repository ready"
echo ""

# Step 2: Install Dependencies
echo "📦 Step 2: Installing dependencies..."
pnpm install
echo "   ✅ Dependencies installed"
echo ""

# Step 3: Build
echo "🔨 Step 3: Building API server..."
pnpm run build
echo "   ✅ Build complete"
echo ""

# Step 4: Setup Environment
echo "⚙️  Step 4: Setting up environment..."
if [ ! -f "artifacts/api-server/.env" ]; then
  echo "   Creating .env from .env.example..."
  cp artifacts/api-server/.env.example artifacts/api-server/.env
  echo ""
  echo "   ⚠️  IMPORTANT: Please edit artifacts/api-server/.env and set:"
  echo "      - DATABASE_URL (your ABA Note Assistant database)"
  echo "      - JWT_SECRET"
  echo ""
  read -p "   Press Enter after updating .env file..."
else
  echo "   .env file already exists"
fi
echo ""

# Step 5: Update ecosystem.config.js
echo "📝 Step 5: Updating ecosystem.config.js..."
if [ -f "ecosystem.config.js" ]; then
  # Check if DATABASE_URL needs updating
  if grep -q "reviewkeeper-db" ecosystem.config.js; then
    echo "   ⚠️  WARNING: ecosystem.config.js contains 'reviewkeeper-db'"
    echo "      Please update DATABASE_URL in ecosystem.config.js if ABA Note Assistant uses a different database"
    read -p "   Press Enter to continue..."
  fi
  
  # Update cwd path if needed
  sed -i "s|/var/www/ABANOTEASSISTANT|$DEPLOY_PATH|g" ecosystem.config.js || true
  echo "   ✅ ecosystem.config.js ready"
else
  echo "   ❌ ecosystem.config.js not found!"
  exit 1
fi
echo ""

# Step 6: Create logs directory
echo "📁 Step 6: Creating logs directory..."
mkdir -p "$DEPLOY_PATH/logs"
echo "   ✅ Logs directory ready"
echo ""

# Step 7: Run Database Migrations
echo "🗄️  Step 7: Database migrations..."
read -p "   Run database migrations? (y/N) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
  echo "   Running migrations..."
  pnpm --filter @workspace/db run push
  echo "   ✅ Migrations complete"
else
  echo "   ⏭️  Skipping migrations"
fi
echo ""

# Step 8: Stop existing PM2 processes (if any)
echo "🛑 Step 8: Stopping existing processes..."
pm2 delete abanoteassistant-api 2>/dev/null || echo "   No existing production process"
pm2 delete abanoteassistant-api-staging 2>/dev/null || echo "   No existing staging process"
echo ""

# Step 9: Start PM2
echo "🚀 Step 9: Starting PM2 processes..."
echo ""
read -p "   Start production API? (Y/n) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Nn]$ ]]; then
  pm2 start ecosystem.config.js --only abanoteassistant-api
  echo "   ✅ Production API started on port $PROD_PORT"
fi

read -p "   Start staging API? (y/N) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
  pm2 start ecosystem.config.js --only abanoteassistant-api-staging
  echo "   ✅ Staging API started on port $STAGING_PORT"
fi
echo ""

# Step 10: Save PM2
echo "💾 Step 10: Saving PM2 configuration..."
pm2 save
echo "   ✅ PM2 config saved"
echo ""

# Step 11: Show Status
echo "📊 Step 11: Deployment Status"
echo "=============================="
pm2 list | grep abanoteassistant || echo "   (No abanoteassistant processes found)"
echo ""

# Step 12: Test Health Endpoint
echo "🏥 Step 12: Testing health endpoint..."
sleep 2
if curl -s http://localhost:$PROD_PORT/api/healthz > /dev/null; then
  echo "   ✅ Production API is responding on port $PROD_PORT"
  curl -s http://localhost:$PROD_PORT/api/healthz | head -1
else
  echo "   ⚠️  Production API health check failed - check logs: pm2 logs abanoteassistant-api"
fi
echo ""

echo "✅ Deployment Complete!"
echo ""
echo "Next steps:"
echo "  1. Check logs: pm2 logs abanoteassistant-api"
echo "  2. Monitor: pm2 monit"
echo "  3. Verify port: ss -tlnp | grep $PROD_PORT"
echo "  4. Update nginx config if needed (see DEPLOYMENT.md)"
echo ""

# Step 5.5: Update ecosystem.config.js with actual values from .env
echo "🔧 Step 5.5: Injecting environment variables into ecosystem.config.js..."
if [ -f "artifacts/api-server/.env" ]; then
  # Read DATABASE_URL and JWT_SECRET from .env
  source artifacts/api-server/.env
  
  # Create a temporary ecosystem config with actual values
  if [ -n "$DATABASE_URL" ] && [ -n "$JWT_SECRET" ]; then
    # Use sed to replace placeholders in ecosystem.config.js
    # This is safer than using process.env in PM2 config
    sed -i.bak \
      -e "s|DATABASE_URL: process.env.DATABASE_URL |||g" \
      -e "s|DATABASE_URL: process.env.DATABASE_URL_STAGING |||g" \
      -e "s|JWT_SECRET: process.env.JWT_SECRET |||g" \
      -e "s|JWT_SECRET: process.env.JWT_SECRET_STAGING |||g" \
      -e "s|\"postgresql://user:password@host:5432/dbname\"|\"$DATABASE_URL\"|g" \
      -e "s|\"change-me-to-a-long-random-string-minimum-32-characters\"|\"$JWT_SECRET\"|g" \
      ecosystem.config.js
    
    # For staging, use same values (or create separate .env.staging if needed)
    sed -i.bak \
      -e "s|DATABASE_URL_STAGING |||g" \
      -e "s|JWT_SECRET_STAGING |||g" \
      ecosystem.config.js || true
    
    echo "   ✅ Environment variables injected from .env"
  else
    echo "   ⚠️  DATABASE_URL or JWT_SECRET not found in .env"
  fi
else
  echo "   ⚠️  .env file not found - using placeholder values"
  echo "      Update ecosystem.config.js manually with actual values"
fi
echo ""
