#!/bin/bash
# Setup SSL certificate for abanoteassistant.com using Certbot
# Run on droplet: bash setup-ssl.sh

set -e

echo "🔒 Setting up SSL for abanoteassistant.com"
echo "=========================================="
echo ""

# Check if certbot is installed
if ! command -v certbot &> /dev/null; then
  echo "Installing certbot..."
  apt-get update
  apt-get install -y certbot python3-certbot-nginx
fi

echo "📝 Updating nginx config to include SSL..."
# Create a temporary config with SSL
cat > /tmp/abanoteassistant-ssl.conf << 'NGINX_SSL'
server {
    listen 80;
    listen [::]:80;
    server_name abanoteassistant.com www.abanoteassistant.com;

    # Let Certbot handle this
    location /.well-known/acme-challenge/ {
        root /var/www/html;
    }

    location / {
        return 301 https://$host$request_uri;
    }
}

server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name abanoteassistant.com www.abanoteassistant.com;

    # SSL will be added by Certbot
    # ssl_certificate /etc/letsencrypt/live/abanoteassistant.com/fullchain.pem;
    # ssl_certificate_key /etc/letsencrypt/live/abanoteassistant.com/privkey.pem;

    # API endpoints - proxy to ABA Note Assistant API (port 5002)
    location /api {
        proxy_pass http://localhost:5002;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }

    # Frontend static files
    location / {
        root /var/www/ABANOTEASSISTANT/artifacts/abanoteassistant/dist/public;
        try_files $uri $uri/ /index.html;
        
        location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
            expires 1y;
            add_header Cache-Control "public, immutable";
        }
    }

    location /healthz {
        proxy_pass http://localhost:5002/api/healthz;
        access_log off;
    }
}
NGINX_SSL

# Backup current config
cp /etc/nginx/sites-available/abanoteassistant /etc/nginx/sites-available/abanoteassistant.backup

# Update config
cp /tmp/abanoteassistant-ssl.conf /etc/nginx/sites-available/abanoteassistant

# Test nginx
echo "🧪 Testing nginx configuration..."
nginx -t

# Reload nginx
systemctl reload nginx

echo ""
echo "📜 Obtaining SSL certificate..."
certbot --nginx -d abanoteassistant.com -d www.abanoteassistant.com --non-interactive --agree-tos --email admin@abanoteassistant.com || {
  echo "⚠️  Certbot failed. You may need to run manually:"
  echo "   certbot --nginx -d abanoteassistant.com -d www.abanoteassistant.com"
}

echo ""
echo "✅ SSL setup complete!"
