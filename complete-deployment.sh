#!/bin/bash
# Complete the ABA Note Assistant deployment
# Run this on the droplet: bash complete-deployment.sh

set -e

cd /var/www/ABANOTEASSISTANT

echo "🔨 Building API server..."
pnpm --filter @workspace/api-server run build

echo "⚙️  Updating ecosystem.config.js with .env values..."
source artifacts/api-server/.env

# Use Node.js to properly update the config file (handles all special characters)
node << 'NODE_SCRIPT'
const fs = require('fs');
const path = require('path');

// Read .env file
const envPath = path.join(__dirname, 'artifacts/api-server/.env');
const envContent = fs.readFileSync(envPath, 'utf8');
const envVars = {};
envContent.split('\n').forEach(line => {
  const match = line.match(/^([^#=]+)=(.*)$/);
  if (match) {
    envVars[match[1].trim()] = match[2].trim();
  }
});

// Read ecosystem.config.js
const configPath = path.join(__dirname, 'ecosystem.config.js');
let configContent = fs.readFileSync(configPath, 'utf8');

// Replace placeholders
const dbUrl = envVars.DATABASE_URL || '';
const jwtSecret = envVars.JWT_SECRET || '';

configContent = configContent.replace(
  /DATABASE_URL: process\.env\.DATABASE_URL \|\| /g,
  'DATABASE_URL: '
);
configContent = configContent.replace(
  /JWT_SECRET: process\.env\.JWT_SECRET \|\| /g,
  'JWT_SECRET: '
);
configContent = configContent.replace(
  /"postgresql:\/\/user:password@host:5432\/dbname"/g,
  `"${dbUrl}"`
);
configContent = configContent.replace(
  /"change-me-to-a-long-random-string-minimum-32-characters"/g,
  `"${jwtSecret}"`
);

// Also handle staging
configContent = configContent.replace(
  /DATABASE_URL: process\.env\.DATABASE_URL_STAGING \|\| process\.env\.DATABASE_URL \|\| /g,
  'DATABASE_URL: '
);
configContent = configContent.replace(
  /JWT_SECRET: process\.env\.JWT_SECRET_STAGING \|\| process\.env\.JWT_SECRET \|\| /g,
  'JWT_SECRET: '
);

// Write back
fs.writeFileSync(configPath, configContent);
console.log('✅ Updated ecosystem.config.js');
NODE_SCRIPT

echo "📁 Creating logs directory..."
mkdir -p logs

echo "🗄️  Running database migrations..."
# Export DATABASE_URL for drizzle-kit
export DATABASE_URL
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
