-- Students belong to one tuition center (educator_admin). Run after 029 (educator_admins exists).
-- Idempotent: add column as nullable FK; backfill only when at least one educator_admin exists.

ALTER TABLE students
ADD COLUMN IF NOT EXISTS admin_id INTEGER REFERENCES educator_admins(id) ON DELETE SET NULL;

-- Backfill only if educator_admins has at least one row (avoid FK violation)
UPDATE students
SET admin_id = (SELECT id FROM educator_admins ORDER BY id LIMIT 1)
WHERE admin_id IS NULL
  AND EXISTS (SELECT 1 FROM educator_admins LIMIT 1);

-- Leave admin_id nullable so production can have students before any admin is created
