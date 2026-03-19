# Quick Deployment Guide

Since direct SSH access is timing out, here are the steps to deploy manually on your droplet:

## Option 1: Use the Deployment Script (Recommended)

1. **SSH into your droplet:**
   ```bash
   ssh root@159.223.130.69
   ```

2. **Copy the deployment script to the droplet:**
   - Option A: Clone the repo first, then run the script:
     ```bash
     cd /var/www
     git clone https://github.com/ehsh01/ABANOTEASSISTANT.git
     cd ABANOTEASSISTANT
     bash deploy-to-droplet.sh
     ```
   
   - Option B: Copy the script manually:
     ```bash
     # On your local machine, copy deploy-to-droplet.sh to the droplet
     scp deploy-to-droplet.sh root@159.223.130.69:/root/
     # Then on droplet:
     bash /root/deploy-to-droplet.sh
     ```

## Option 2: Manual Step-by-Step

1. **SSH into droplet:**
   ```bash
   ssh root@159.223.130.69
   ```

2. **Clone repository:**
   ```bash
   cd /var/www
   git clone https://github.com/ehsh01/ABANOTEASSISTANT.git
   cd ABANOTEASSISTANT
   ```

3. **Install dependencies:**
   ```bash
   pnpm install
   ```

4. **Build:**
   ```bash
   pnpm run build
   ```

5. **Setup environment:**
   ```bash
   cd artifacts/api-server
   cp .env.example .env
   nano .env  # Set DATABASE_URL and JWT_SECRET
   ```

6. **Update ecosystem.config.js:**
   - Verify the `cwd` path is `/var/www/ABANOTEASSISTANT`
   - Update `DATABASE_URL` if ABA Note Assistant uses a different database
   - Verify ports (5002 for prod, 5005 for staging)

7. **Run migrations:**
   ```bash
   cd /var/www/ABANOTEASSISTANT
   pnpm --filter @workspace/db run push
   ```

8. **Start with PM2:**
   ```bash
   pm2 start ecosystem.config.js --only abanoteassistant-api
   pm2 save
   ```

9. **Verify:**
   ```bash
   pm2 list
   pm2 logs abanoteassistant-api
   curl http://localhost:5002/api/healthz
   ```

## Important Notes

- **Database URL**: The current `ecosystem.config.js` uses a database URL that points to "reviewkeeper-db". If ABA Note Assistant has its own database, update the `DATABASE_URL` in `ecosystem.config.js` before starting PM2.

- **Ports**: 
  - Production: 5002
  - Staging: 5005
  - Make sure these don't conflict with other services

- **Nginx**: If you need to route `abanoteassistant.com` to the API, update nginx configuration (see `DEPLOYMENT.md`)

## Troubleshooting

If deployment fails:
1. Check PM2 logs: `pm2 logs abanoteassistant-api`
2. Verify environment variables: `pm2 env abanoteassistant-api`
3. Check port availability: `ss -tlnp | grep 5002`
4. Verify database connection: Test `DATABASE_URL` with `psql`
