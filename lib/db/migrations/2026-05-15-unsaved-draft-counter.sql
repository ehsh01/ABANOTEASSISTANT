-- Adds the per-user "unsaved draft generations" counter (2026-05-15).
--
-- Each successful POST /notes/generate increments this counter for the calling user; POST
-- /notes/:noteId/save and POST /notes/drafts/discard reset it to 0. The server refuses to
-- generate once the counter reaches the configured cap (default 3), so users cannot rack up
-- unlimited OpenAI generations without ever saving. Counter is per-user (auth.users.id), not
-- per-company, so two RBTs sharing a company each get their own slot pool.
--
-- Idempotent: ADD COLUMN IF NOT EXISTS is a no-op on re-run. No data backfill needed — every
-- existing user defaults to 0 which means "no drafts in flight, full cap available".
BEGIN;

ALTER TABLE abanote.users
  ADD COLUMN IF NOT EXISTS unsaved_draft_count integer NOT NULL DEFAULT 0;

COMMIT;
