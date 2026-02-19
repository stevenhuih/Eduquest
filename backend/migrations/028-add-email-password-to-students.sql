-- Add email and password to students for login and uniqueness.
-- Idempotent: add as nullable, backfill existing rows, then enforce NOT NULL.

-- Step 1: Add columns nullable
ALTER TABLE students
ADD COLUMN IF NOT EXISTS email TEXT,
ADD COLUMN IF NOT EXISTS password TEXT;

-- Step 2: Backfill so no row has NULL email or password (required before SET NOT NULL)
-- Placeholder email: unique per row. Placeholder password: bcrypt hash (change on first login).
UPDATE students
SET email = COALESCE(NULLIF(TRIM(email), ''), 'student-' || id || '@placeholder.local')
WHERE email IS NULL;

UPDATE students
SET password = COALESCE(NULLIF(TRIM(password), ''), '$2b$10$KphocRMCO7tIhMOf17j/b.fKaW0fT9peng3n2WdS82NMIyurbIm1S')
WHERE password IS NULL;

-- Step 3: Enforce NOT NULL (safe after backfill)
ALTER TABLE students
ALTER COLUMN email SET NOT NULL,
ALTER COLUMN password SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS students_email_key ON students(email);
