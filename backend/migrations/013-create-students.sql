-- Run this migration before using XP features:
-- psql -U postgres -d eduquest -f backend/migrations/013-create-students.sql
-- psql -U postgres -d eduquest -f backend/migrations/014-seed-default-student.sql

CREATE TABLE IF NOT EXISTS students (
  id SERIAL PRIMARY KEY,
  name TEXT,
  xp INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW()
);
