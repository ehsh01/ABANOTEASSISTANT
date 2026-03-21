-- Run once per database (production + staging if separate).
-- Or use: cd lib/db && DATABASE_URL=... npx drizzle-kit push
ALTER TABLE abanote.clients
  ADD COLUMN IF NOT EXISTS profile jsonb;
