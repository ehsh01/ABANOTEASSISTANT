# ABA Note Assistant - Droplet Deployment Guide

## Quick Start

1. **Update `ecosystem.config.js`** with your configuration:
   - Set `cwd` to your deployment path (e.g., `/var/www/ABANOTEASSISTANT`)
   - Set `PORT` for production (default: 5002) and staging (default: 5005)
   - Add your `DATABASE_URL` for both environments
   - Add your `JWT_SECRET` for both environments

2. **Run the deployment script:**
   ```bash
   ./deploy.sh
   ```

## Manual Deployment Steps

### 1. SSH into Droplet

```bash
ssh root@YOUR_DROPLET_IP
```

### 2. Clone/Update Repository

```bash
cd /var/www  # or your deployment directory
git clone YOUR_REPO_URL ABANOTEASSISTANT
cd ABANOTEASSISTANT
```

### 3. Install Dependencies

```bash
pnpm install
```

### 4. Build

```bash
pnpm run build
```

### 5. Configure Environment

```bash
cd artifacts/api-server
cp .env.example .env
nano .env  # Set DATABASE_URL and JWT_SECRET
```

### 6. Update ecosystem.config.js

Edit `ecosystem.config.js` in the project root:

```js
{
  name: "abanoteassistant-api",
  cwd: "/var/www/ABANOTEASSISTANT", // Your actual path
  env: {
    PORT: "5002", // Your production port
    DATABASE_URL: "postgresql://...", // Your production DB
    JWT_SECRET: "...", // Your JWT secret
  }
}
```

### 7. Run Database Migrations

Tables live in the PostgreSQL schema **`abanote`** (see `lib/db/drizzle.config.ts`: `schemaFilter: ["abanote"]`). If `drizzle-kit push` reports “No changes” while the API errors on missing `abanote.*` relations, the filter was missing or the wrong DB was targeted.

```bash
# From repo root, with DATABASE_URL set (or loaded from artifacts/api-server/.env):
export DATABASE_URL="postgresql://..."

# First time only, if the schema does not exist:
psql "$DATABASE_URL" -c 'CREATE SCHEMA IF NOT EXISTS abanote;'

cd lib/db
pnpm exec drizzle-kit push --config ./drizzle.config.ts --force
```

**DigitalOcean / managed Postgres + Node `pg`:** URLs often use `?sslmode=require`. Older API builds passed that string straight into `pg.Pool`, which can fail TLS verification and surface as a generic “Failed query” on registration. Prefer deploying the current `@workspace/db` pool (parses `DATABASE_URL` like Drizzle Kit), or use `sslmode=no-verify` in the URL until then. After a `.env` change, reload PM2 from `ecosystem.config.cjs` so the app picks up the new URL (`pm2 delete …` + `pm2 start …`, or equivalent).

### 8. Start with PM2

Use **`artifacts/api-server/ecosystem.config.cjs`** (it loads `artifacts/api-server/.env` and passes those variables into the process, including `RESEND_API_KEY`, `EMAIL_FROM`, and `APP_ORIGIN`).

Repo root **`ecosystem.config.js`** re-exports that same file so `pm2 start ecosystem.config.js` also loads **`.env`** (the old root file only read `process.env.*` from the shell, so **`DATABASE_URL_STAGING` in `.env` was ignored** unless exported).

**Staging vs production data:** Set **`DATABASE_URL_STAGING`** (and optionally **`JWT_SECRET_STAGING`**) in **`artifacts/api-server/.env`**. If omitted, staging uses **`DATABASE_URL`** / **`JWT_SECRET`** (same DB as production).

```bash
cd /path/to/repo
pm2 start artifacts/api-server/ecosystem.config.cjs --only abanoteassistant-api
pm2 save
pm2 startup  # Follow instructions
```

After changing `.env`, reload the app from that config (e.g. `pm2 delete abanoteassistant-api && pm2 start artifacts/api-server/ecosystem.config.cjs --only abanoteassistant-api`) so new keys are picked up.

### 9. Verify

```bash
# Check status
pm2 list

# Check logs
pm2 logs abanoteassistant-api

# Test health endpoint
curl http://localhost:5002/api/healthz
```

## Port Configuration

Based on your droplet setup:
- **abaworkspace**: Port 5001 (different app)
- **abaworkspace-staging**: Port 5004 (different app)
- **ABA Note Assistant API (Production)**: Port 5002 (`API_PORT_PROD` in `.env`)
- **ABA Note Assistant API (Staging)**: Port 5007 by default (`API_PORT_STAGING` in `.env`)

**Important:** Make sure these ports don't conflict with other services!

## Frontend → API (AI session notes)

- **Same domain (recommended):** Serve the SPA and proxy **`/api`** to the Node process (see Nginx snippet below). Do **not** set **`VITE_API_BASE_URL`** on the frontend build.
- **UI and API on different origins:** Set **`VITE_API_BASE_URL`** to the API origin (no path, no trailing slash) when building the SPA—see **`artifacts/abanoteassistant/.env.example`**. Rebuild after any change; the value is embedded at build time.
- **OpenAI:** Keep **`OPENAI_API_KEY`** in **`artifacts/api-server/.env`**. Without it, note generation returns **503**. After deploy: **`curl -sS http://127.0.0.1:5002/api/healthz`** (adjust port) should show **`"status":"ok"`** and OpenAI readiness.

## Nginx Configuration

If you need to route `abanoteassistant.com` to your API:

```nginx
# /etc/nginx/sites-available/abanoteassistant
server {
    listen 80;
    server_name abanoteassistant.com;

    location /api {
        proxy_pass http://localhost:5002;  # Update port if different
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Frontend static files (if serving from same domain)
    location / {
        root /var/www/ABANOTEASSISTANT/artifacts/abanoteassistant/dist/public;
        try_files $uri $uri/ /index.html;
    }
}
```

Enable and reload:
```bash
ln -s /etc/nginx/sites-available/abanoteassistant /etc/nginx/sites-enabled/
nginx -t
systemctl reload nginx
```

## Updating Deployment

When you make code changes:

```bash
cd /var/www/ABANOTEASSISTANT
git pull
pnpm install
pnpm run build
pm2 restart abanoteassistant-api
```

Or use the deployment script:
```bash
./deploy.sh
```

## Troubleshooting

### API Won't Start

1. **Check PM2 logs:**
   ```bash
   pm2 logs abanoteassistant-api --lines 50
   ```

2. **Check environment variables:**
   ```bash
   pm2 env abanoteassistant-api
   ```

3. **Verify port is available:**
   ```bash
   ss -tlnp | grep 5002
   ```

### Database Connection Issues

1. **Test connection:**
   ```bash
   psql "$DATABASE_URL" -c "SELECT 1;"
   ```

2. **Check DATABASE_URL format:**
   ```
   postgresql://user:password@host:5432/dbname
   ```

### 401 Unauthorized

- Verify `JWT_SECRET` matches between environments
- Check token hasn't expired (default: 7 days)
- Ensure `Authorization: Bearer <token>` header format

## Environment Variables

Required in `artifacts/api-server/.env`:
- `DATABASE_URL` - PostgreSQL connection string
- `JWT_SECRET` - Secret for JWT token signing (min 32 chars)

Generate JWT_SECRET:
```bash
openssl rand -base64 32
```

## PM2 Commands

```bash
# Start
pm2 start ecosystem.config.js --only abanoteassistant-api

# Stop
pm2 stop abanoteassistant-api

# Restart
pm2 restart abanoteassistant-api

# View logs
pm2 logs abanoteassistant-api

# Monitor
pm2 monit

# Delete
pm2 delete abanoteassistant-api

# Save current processes
pm2 save
```
