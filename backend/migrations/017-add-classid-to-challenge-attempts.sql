-- Scope challenge attempts to class (existing rows may have NULL class_id)
ALTER TABLE challenge_attempts
ADD COLUMN IF NOT EXISTS class_id INTEGER REFERENCES classes(id) ON DELETE CASCADE;
