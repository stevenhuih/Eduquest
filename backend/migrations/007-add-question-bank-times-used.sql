-- Track how many times a question bank entry is used in quizzes
ALTER TABLE question_bank
ADD COLUMN IF NOT EXISTS times_used INTEGER DEFAULT 0;
