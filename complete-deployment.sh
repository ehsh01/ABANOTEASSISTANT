#!/bin/bash
# Complete the ABA Note Assistant deployment
# Run this on the droplet: bash complete-deployment.sh

set -e

cd /var/www/ABANOTEASSISTANT

echo "🔨 Building API server..."
pnpm --filter @workspace/api-server run build

echo "⚙️  Updating ecosystem.config.js with .env values..."
source artifacts/api-server/.env

# Escape special characters in DATABASE_URL for sed
DB_URL_ESCAPED=$(echo "$DATABASE_URL" | sed 's/[[\.*^$()+?{|]/\\&/g')
JWT_ESCAPED=$(echo "$JWT_SECRET" | sed 's/[[\.*^$()+?{|]/\\&/g')

# Use a different delimiter (:) instead of | to avoid conflicts
sed -i.bak \
  -e "s|DATABASE_URL: process.env.DATABASE_URL |||g" \
  -e "s|JWT_SECRET: process.env.JWT_SECRET |||g" \
  -e "s:\"postgresql://user:password@host:5432/dbname\":\"$DATABASE_URL\":g" \
  -e "s:\"change-me-to-a-long-random-string-minimum-32-characters\":\"$JWT_SECRET\":g" \
  ecosystem.config.js

echo "📁 Creating logs directory..."
mkdir -p logs

echo "🗄️  Running database migrations..."
pnpm --filter @workspace/db run push

echo "🛑 Stopping existing processes..."
pm2 delete abanoteassistant-api 2>/dev/null || true
pm2 delete abanoteassistant-api-staging 2>/dev/null || true

echo "🚀 Starting PM2..."
pm2 start ecosystem.config.js --only abanoteassistant-api
pm2 save

echo "✅ Deployment complete!"
echo ""
echo "Status:"
pm2 list | grep abanoteassistant
echo ""
echo "Testing health endpoint..."
sleep 2
curl -s http://localhost:5002/api/healthz && echo ""
