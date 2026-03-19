import { defineConfig } from "drizzle-kit";
import path from "path";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL, ensure the database is provisioned");
}

// Parse DATABASE_URL to remove sslmode if present (we'll use ssl config instead)
const dbUrl = process.env.DATABASE_URL.replace(/[?&]sslmode=[^&]*/g, '');

export default defineConfig({
  schema: path.join(__dirname, "./src/schema/index.ts"),
  dialect: "postgresql",
  dbCredentials: {
    url: dbUrl,
    ssl: { rejectUnauthorized: false },
  },
});
