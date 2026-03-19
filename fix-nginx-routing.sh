#!/bin/bash
# Fix nginx routing for abanoteassistant.com
# Run on droplet: bash fix-nginx-routing.sh

set -e

echo "🔧 Fixing nginx routing for abanoteassistant.com"
echo "================================================"
echo ""

# Check if abanoteassistant config exists
if [ ! -f "/etc/nginx/sites-enabled/abanoteassistant" ]; then
  echo "❌ abanoteassistant nginx config not found!"
  echo "   Running setup-nginx.sh first..."
  cd /var/www/ABANOTEASSISTANT
  bash setup-nginx.sh
  exit 0
fi

# Check for conflicting configs
echo "🔍 Checking for conflicting nginx configs..."
CONFLICTS=$(grep -r "server_name.*abanoteassistant\|server_name.*\*" /etc/nginx/sites-enabled/ 2>/dev/null | grep -v "abanoteassistant:" | wc -l)

if [ "$CONFLICTS" -gt 0 ]; then
  echo "⚠️  Found potential conflicts:"
  grep -r "server_name.*abanoteassistant\|server_name.*\*" /etc/nginx/sites-enabled/ 2>/dev/null | grep -v "abanoteassistant:"
  echo ""
  echo "   You may need to disable or modify these configs"
fi

# Ensure abanoteassistant config has proper priority
echo ""
echo "📝 Ensuring abanoteassistant config is correct..."

# Check if it has the right server_name
if ! grep -q "server_name.*abanoteassistant.com" /etc/nginx/sites-enabled/abanoteassistant; then
  echo "❌ server_name not found in config!"
  exit 1
fi

# Check if it's listening on port 80
if ! grep -q "listen.*80" /etc/nginx/sites-enabled/abanoteassistant; then
  echo "❌ Not listening on port 80!"
  exit 1
fi

# Make sure it's not a default_server (unless we want it to be)
if grep -q "default_server" /etc/nginx/sites-enabled/abanoteassistant; then
  echo "⚠️  Config has default_server - this might conflict with other sites"
fi

echo "✅ Config looks correct"
echo ""

# Test nginx config
echo "🧪 Testing nginx configuration..."
if nginx -t; then
  echo "   ✅ Nginx configuration is valid"
else
  echo "   ❌ Nginx configuration has errors!"
  exit 1
fi

# Reload nginx
echo ""
read -p "🔄 Reload nginx? (Y/n) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Nn]$ ]]; then
  systemctl reload nginx
  echo "   ✅ Nginx reloaded"
fi

echo ""
echo "✅ Done!"
echo ""
echo "Test the site:"
echo "  curl -H 'Host: abanoteassistant.com' http://localhost/api/healthz"
