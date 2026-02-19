-- This migration adds the explanation column required by quizModel.getQuizById() and quiz editing features.
ALTER TABLE questions
ADD COLUMN IF NOT EXISTS explanation TEXT;
