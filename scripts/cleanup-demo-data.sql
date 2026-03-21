-- One-time / maintenance: remove demo clinical data and obvious test registrations.
-- Review before running on production. Connect with: psql "$DATABASE_URL" -f scripts/cleanup-demo-data.sql
--
-- 1) All session notes, clients, programs, and links (every company).
TRUNCATE TABLE abanote.notes, abanote.client_programs, abanote.clients, abanote.programs
RESTART IDENTITY CASCADE;

-- 2) Test / disposable accounts (does not match normal customer emails).
DELETE FROM abanote.users
WHERE email ILIKE '%@example.com'
   OR email ILIKE '%@test.com'
   OR email ILIKE 'test-%@%'
   OR email ILIKE '%+test%@%';

-- 3) Orphan companies (no users left).
DELETE FROM abanote.companies AS c
WHERE NOT EXISTS (SELECT 1 FROM abanote.users u WHERE u.company_id = c.id);
