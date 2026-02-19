-- Ensure question_bank is class-scoped (column may already exist from 006)
ALTER TABLE question_bank
ADD COLUMN IF NOT EXISTS class_id INTEGER REFERENCES classes(id) ON DELETE CASCADE;
