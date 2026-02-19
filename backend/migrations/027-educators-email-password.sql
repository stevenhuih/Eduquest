-- Add email and password to educators for login support. Do not remove existing columns.
ALTER TABLE educators ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE educators ADD COLUMN IF NOT EXISTS password TEXT;

-- Ensure unique email (allow existing NULLs to be updated first)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'educators_email_key'
  ) THEN
    ALTER TABLE educators ADD CONSTRAINT educators_email_key UNIQUE (email);
  END IF;
END $$;

-- Backfill existing rows so NOT NULL can be set
UPDATE educators SET email = 'valerie@school.edu' WHERE email IS NULL AND id = 1;
UPDATE educators SET email = 'educator' || id || '@eduquest.local' WHERE email IS NULL AND id > 1;
UPDATE educators SET password = '' WHERE password IS NULL;

ALTER TABLE educators ALTER COLUMN email SET NOT NULL;
ALTER TABLE educators ALTER COLUMN password SET NOT NULL;
