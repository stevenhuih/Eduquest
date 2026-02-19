-- Add topic to questions for topic-level performance analytics
ALTER TABLE questions
ADD COLUMN IF NOT EXISTS topic TEXT;
