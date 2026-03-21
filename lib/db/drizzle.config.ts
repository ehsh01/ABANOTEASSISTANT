import { defineConfig } from "drizzle-kit";
import path from "path";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL, ensure the database is provisioned");
}

/**
 * drizzle-kit builds `pg.Pool({ connectionString })` only when `url` is set — it does
 * not merge `ssl` into that pool. Keep TLS via the connection string (DigitalOcean, etc.).
 */
function ensureSslModeInUrl(url: string): string {
  if (/[?&]sslmode=/.test(url)) {
    return url;
  }
  return url.includes("?") ? `${url}&sslmode=require` : `${url}?sslmode=require`;
}

export default defineConfig({
  schema: path.join(__dirname, "./src/schema/index.ts"),
  dialect: "postgresql",
  dbCredentials: {
    url: ensureSslModeInUrl(process.env.DATABASE_URL),
  },
});
