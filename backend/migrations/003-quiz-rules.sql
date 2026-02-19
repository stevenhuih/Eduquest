-- Quiz rules and timing: shuffle, pass grade, retakes, time limit, due date.
ALTER TABLE quizzes
ADD COLUMN IF NOT EXISTS shuffle_questions BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS pass_grade INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS allow_retakes BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS time_limit_minutes INTEGER,
ADD COLUMN IF NOT EXISTS due_date TIMESTAMP;
