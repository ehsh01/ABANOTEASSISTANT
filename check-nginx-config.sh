#!/bin/bash
# Check and fix nginx configuration for abanoteassistant.com
# Run on droplet: bash check-nginx-config.sh

echo "🔍 Checking nginx configuration..."
echo ""

# Check all nginx configs for abanoteassistant.com
echo "=== Configs mentioning abanoteassistant.com ==="
grep -r "abanoteassistant.com" /etc/nginx/sites-enabled/ 2>/dev/null || echo "None found"
echo ""

# Check all server_name directives
echo "=== All server_name directives ==="
grep -r "server_name" /etc/nginx/sites-enabled/ 2>/dev/null | grep -v "^#"
echo ""

# Check for default server or catch-all
echo "=== Default server blocks ==="
grep -r "default_server" /etc/nginx/sites-enabled/ 2>/dev/null || echo "None found"
echo ""

# Check which config would handle abanoteassistant.com
echo "=== Testing nginx config ==="
nginx -t 2>&1
echo ""

# Show the abanoteassistant config if it exists
if [ -f "/etc/nginx/sites-enabled/abanoteassistant" ]; then
  echo "=== Current abanoteassistant config ==="
  cat /etc/nginx/sites-enabled/abanoteassistant
else
  echo "⚠️  /etc/nginx/sites-enabled/abanoteassistant not found!"
fi
