/**
 * PM2 Ecosystem Configuration for ABA Note Assistant
 * 
 * Usage:
 *   pm2 start ecosystem.config.js --only abanoteassistant-api
 *   pm2 start ecosystem.config.js --only abanoteassistant-api-staging
 * 
 * Or start all:
 *   pm2 start ecosystem.config.js
 */

module.exports = {
  apps: [
    {
      name: "abanoteassistant-api",
      script: "artifacts/api-server/dist/index.cjs",
      cwd: "/var/www/ABANOTEASSISTANT", // UPDATE THIS PATH to your deployment directory
      instances: 2,
      exec_mode: "cluster",
      env: {
        NODE_ENV: "production",
        PORT: "5002", // UPDATE THIS PORT - production port for ABA Note Assistant
        DATABASE_URL: "postgresql://...", // UPDATE WITH YOUR PRODUCTION DATABASE URL
        JWT_SECRET: "...", // UPDATE WITH YOUR JWT_SECRET
      },
      error_file: "./logs/abanoteassistant-api-error.log",
      out_file: "./logs/abanoteassistant-api-out.log",
      log_date_format: "YYYY-MM-DD HH:mm:ss Z",
      merge_logs: true,
      autorestart: true,
      max_restarts: 10,
      min_uptime: "10s",
      watch: false,
    },
    {
      name: "abanoteassistant-api-staging",
      script: "artifacts/api-server/dist/index.cjs",
      cwd: "/var/www/ABANOTEASSISTANT", // UPDATE THIS PATH to your deployment directory
      instances: 1,
      exec_mode: "cluster",
      env: {
        NODE_ENV: "staging",
        PORT: "5005", // UPDATE THIS PORT - staging port for ABA Note Assistant
        DATABASE_URL: "postgresql://...", // UPDATE WITH YOUR STAGING DATABASE URL
        JWT_SECRET: "...", // UPDATE WITH YOUR STAGING JWT_SECRET (can be same or different)
      },
      error_file: "./logs/abanoteassistant-api-staging-error.log",
      out_file: "./logs/abanoteassistant-api-staging-out.log",
      log_date_format: "YYYY-MM-DD HH:mm:ss Z",
      merge_logs: true,
      autorestart: true,
      max_restarts: 10,
      min_uptime: "10s",
      watch: false,
    },
  ],
};
