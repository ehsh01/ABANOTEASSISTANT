#!/bin/bash
# Check SSL/HTTPS configuration for abanoteassistant.com

echo "🔒 Checking SSL/HTTPS Configuration"
echo "===================================="
echo ""

echo "=== Checking if abanoteassistant has SSL certificate ==="
if [ -d "/etc/letsencrypt/live/abanoteassistant.com" ]; then
  echo "✅ SSL certificate found"
  ls -la /etc/letsencrypt/live/abanoteassistant.com/
else
  echo "❌ No SSL certificate found for abanoteassistant.com"
fi
echo ""

echo "=== Checking nginx config for HTTPS (port 443) ==="
grep -A 5 "server_name.*abanoteassistant" /etc/nginx/sites-enabled/abanoteassistant | grep -E "listen.*443|ssl"
echo ""

echo "=== Testing HTTPS locally ==="
curl -k -H 'Host: abanoteassistant.com' https://localhost/api/healthz 2>&1 | head -5
echo ""

echo "=== All SSL certificates ==="
ls -la /etc/letsencrypt/live/ 2>/dev/null | head -10
