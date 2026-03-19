#!/bin/bash
# Setup nginx configuration for abanoteassistant.com
# Run this on the droplet: bash setup-nginx.sh

set -e

echo "🔧 Setting up nginx for abanoteassistant.com"
echo "============================================="
echo ""

# Check if running as root
if [ "$EUID" -ne 0 ]; then 
  echo "❌ Please run as root (use sudo)"
  exit 1
fi

CONFIG_FILE="/etc/nginx/sites-available/abanoteassistant"
ENABLED_LINK="/etc/nginx/sites-enabled/abanoteassistant"

# Check if config already exists
if [ -f "$CONFIG_FILE" ]; then
  echo "⚠️  Configuration file already exists: $CONFIG_FILE"
  read -p "   Overwrite? (y/N) " -n 1 -r
  echo
  if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "   Skipping nginx config creation"
    exit 0
  fi
fi

# Copy config from repository
if [ -f "/var/www/ABANOTEASSISTANT/nginx-abanoteassistant.conf" ]; then
  echo "📝 Copying nginx configuration..."
  cp /var/www/ABANOTEASSISTANT/nginx-abanoteassistant.conf "$CONFIG_FILE"
  echo "   ✅ Config file created: $CONFIG_FILE"
else
  echo "❌ nginx-abanoteassistant.conf not found in /var/www/ABANOTEASSISTANT/"
  echo "   Please ensure the file exists or create it manually"
  exit 1
fi

# Create symlink if it doesn't exist
if [ ! -L "$ENABLED_LINK" ]; then
  echo "🔗 Creating symlink..."
  ln -s "$CONFIG_FILE" "$ENABLED_LINK"
  echo "   ✅ Symlink created: $ENABLED_LINK"
else
  echo "   ℹ️  Symlink already exists: $ENABLED_LINK"
fi

# Test nginx configuration
echo ""
echo "🧪 Testing nginx configuration..."
if nginx -t; then
  echo "   ✅ Nginx configuration is valid"
else
  echo "   ❌ Nginx configuration has errors!"
  echo "   Please fix the errors before reloading"
  exit 1
fi

# Reload nginx
echo ""
read -p "🔄 Reload nginx? (Y/n) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Nn]$ ]]; then
  systemctl reload nginx
  echo "   ✅ Nginx reloaded"
else
  echo "   ⏭️  Skipping nginx reload"
  echo "   Run 'systemctl reload nginx' when ready"
fi

echo ""
echo "✅ Nginx setup complete!"
echo ""
echo "Next steps:"
echo "  1. Verify domain DNS points to this server"
echo "  2. Test: curl http://localhost/api/healthz"
echo "  3. Check: curl -H 'Host: abanoteassistant.com' http://localhost/api/healthz"
echo ""
