/**
 * PM2 entrypoint — delegates to the real config that loads `artifacts/api-server/.env`.
 *
 * Do not duplicate env here: the legacy file used `process.env.DATABASE_URL_STAGING`, which
 * only works if those variables are exported in the shell. Values in `.env` were ignored.
 *
 * Usage (from repo root):
 *   pm2 start ecosystem.config.js --only abanoteassistant-api
 *   pm2 start ecosystem.config.js --only abanoteassistant-api-staging
 */
module.exports = require("./artifacts/api-server/ecosystem.config.cjs");
