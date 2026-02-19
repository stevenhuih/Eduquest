-- Run this migration if quizzes table was created before quiz rules were added.

ALTER TABLE quizzes
ADD COLUMN IF NOT EXISTS shuffle_questions BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS pass_grade INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS allow_retakes BOOLEAN DEFAULT TRUE,
ADD COLUMN IF NOT EXISTS time_limit_minutes INTEGER,
ADD COLUMN IF NOT EXISTS due_date TIMESTAMP;
