#!/bin/bash
# Fix database connection SSL issue
# Run on droplet: bash fix-db-connection.sh

cd /var/www/ABANOTEASSISTANT

echo "Checking DATABASE_URL..."
source artifacts/api-server/.env
echo "Current DATABASE_URL: ${DATABASE_URL:0:50}..."

# Check if DATABASE_URL has sslmode parameter
if [[ "$DATABASE_URL" != *"sslmode"* ]]; then
  echo "Adding sslmode=require to DATABASE_URL..."
  # Remove any existing query params and add sslmode
  if [[ "$DATABASE_URL" == *"?"* ]]; then
    DATABASE_URL="${DATABASE_URL}&sslmode=require"
  else
    DATABASE_URL="${DATABASE_URL}?sslmode=require"
  fi
  
  # Update .env file
  sed -i "s|^DATABASE_URL=.*|DATABASE_URL=$DATABASE_URL|" artifacts/api-server/.env
  echo "✅ Updated .env file"
else
  echo "DATABASE_URL already has sslmode parameter"
fi

echo ""
echo "Testing database connection..."
export DATABASE_URL
pnpm --filter @workspace/db run push
