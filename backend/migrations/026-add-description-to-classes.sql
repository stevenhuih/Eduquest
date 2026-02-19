-- Add optional description to classes.
ALTER TABLE classes
ADD COLUMN IF NOT EXISTS description TEXT;
