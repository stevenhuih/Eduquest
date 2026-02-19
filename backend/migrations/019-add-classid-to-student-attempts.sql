-- Store class_id on each quiz attempt (derived from quiz.class_id)
ALTER TABLE student_attempts
ADD COLUMN IF NOT EXISTS class_id INTEGER REFERENCES classes(id) ON DELETE SET NULL;
