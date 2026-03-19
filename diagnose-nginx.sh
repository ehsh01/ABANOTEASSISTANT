#!/bin/bash
# Comprehensive nginx diagnosis
# Run on droplet: bash diagnose-nginx.sh

echo "🔍 Comprehensive Nginx Diagnosis"
echo "================================="
echo ""

echo "=== All nginx config files (in load order) ==="
ls -la /etc/nginx/sites-enabled/ | grep -v "^total"
echo ""

echo "=== All server_name directives ==="
grep -h "server_name" /etc/nginx/sites-enabled/* 2>/dev/null | grep -v "^#" | sort
echo ""

echo "=== All listen directives ==="
grep -h "listen" /etc/nginx/sites-enabled/* 2>/dev/null | grep -v "^#" | sort
echo ""

echo "=== abanoteassistant config (full) ==="
if [ -f "/etc/nginx/sites-enabled/abanoteassistant" ]; then
  cat /etc/nginx/sites-enabled/abanoteassistant
else
  echo "❌ Config not found!"
fi
echo ""

echo "=== Testing which server block nginx would use ==="
echo "Testing with abanoteassistant.com..."
nginx -T 2>/dev/null | grep -A 20 "server_name.*abanoteassistant" || echo "No match found in nginx -T output"
echo ""

echo "=== Checking for wildcard or catch-all ==="
grep -r "server_name.*\*\|server_name.*_" /etc/nginx/sites-enabled/ 2>/dev/null || echo "None found"
echo ""

echo "=== Testing actual routing ==="
curl -s -H 'Host: abanoteassistant.com' http://localhost/api/healthz && echo ""
