import { defineConfig } from "drizzle-kit";
import path from "path";
import { parse } from "pg-connection-string";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL, ensure the database is provisioned");
}

/**
 * drizzle-kit only passes `connectionString` to `pg.Pool` when `url` is set, so TLS
 * options in config are ignored. Parse the URL and pass `ssl` explicitly (needed for
 * managed Postgres such as DigitalOcean).
 */
const parsed = parse(process.env.DATABASE_URL);

if (!parsed.host || !parsed.database || !parsed.user) {
  throw new Error(
    "DATABASE_URL must include host, database name, and user",
  );
}

const port =
  parsed.port !== undefined && parsed.port !== null
    ? Number(parsed.port)
    : 5432;

if (Number.isNaN(port)) {
  throw new Error("DATABASE_URL has invalid port");
}

export default defineConfig({
  schema: path.join(__dirname, "./src/schema/index.ts"),
  dialect: "postgresql",
  // drizzle-kit push/pull default to `public` only; our app lives in `abanote` (pgSchema).
  schemaFilter: ["abanote"],
  dbCredentials: {
    host: parsed.host,
    port,
    user: parsed.user,
    password: parsed.password,
    database: parsed.database,
    ssl: { rejectUnauthorized: false },
  },
});
