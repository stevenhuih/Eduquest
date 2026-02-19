-- Run if you already created the database before explanation was added:
-- psql -U postgres -d eduquest -f migrations/001-add-explanation.sql
ALTER TABLE questions ADD COLUMN IF NOT EXISTS explanation TEXT;
