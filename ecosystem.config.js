/**
 * PM2 Ecosystem Configuration for ABA Note Assistant
 * 
 * Usage:
 *   pm2 start ecosystem.config.js --only abanoteassistant-api
 *   pm2 start ecosystem.config.js --only abanoteassistant-api-staging
 * 
 * Or start all:
 *   pm2 start ecosystem.config.js
 * 
 * IMPORTANT: Set DATABASE_URL and JWT_SECRET environment variables
 * or update the env section below with your actual values.
 */

module.exports = {
  apps: [
    {
      name: "abanoteassistant-api",
      script: "artifacts/api-server/dist/index.cjs",
      cwd: "/var/www/ABANOTEASSISTANT",
      instances: 2,
      exec_mode: "cluster",
      env: {
        NODE_ENV: "production",
        PORT: "5002",
        // Update these with your actual values or use environment variables
        DATABASE_URL: process.env.DATABASE_URL || "postgresql://user:password@host:5432/dbname",
        JWT_SECRET: process.env.JWT_SECRET || "change-me-to-a-long-random-string-minimum-32-characters",
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
      cwd: "/var/www/ABANOTEASSISTANT",
      instances: 1,
      exec_mode: "cluster",
      env: {
        NODE_ENV: "staging",
        PORT: "5005",
        // Update these with your actual values or use environment variables
        DATABASE_URL: process.env.DATABASE_URL_STAGING || process.env.DATABASE_URL || "postgresql://user:password@host:5432/dbname",
        JWT_SECRET: process.env.JWT_SECRET_STAGING || process.env.JWT_SECRET || "change-me-to-a-long-random-string-minimum-32-characters",
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
