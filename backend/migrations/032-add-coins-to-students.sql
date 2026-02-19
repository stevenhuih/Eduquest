-- Add coins column to students for Phase 1 coins system
ALTER TABLE students
ADD COLUMN IF NOT EXISTS coins INTEGER DEFAULT 0;
