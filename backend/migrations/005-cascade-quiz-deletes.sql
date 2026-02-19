-- Cascade quiz deletes: make FKs use ON DELETE CASCADE so deleting a quiz
-- automatically removes dependent questions, options, attempts, and answers.
-- Check constraint names with \d table_name in psql if migration fails.

ALTER TABLE questions
DROP CONSTRAINT IF EXISTS questions_quiz_id_fkey,
ADD CONSTRAINT questions_quiz_id_fkey
FOREIGN KEY (quiz_id) REFERENCES quizzes(id) ON DELETE CASCADE;

ALTER TABLE options
DROP CONSTRAINT IF EXISTS options_question_id_fkey,
ADD CONSTRAINT options_question_id_fkey
FOREIGN KEY (question_id) REFERENCES questions(id) ON DELETE CASCADE;

ALTER TABLE student_attempts
DROP CONSTRAINT IF EXISTS student_attempts_quiz_id_fkey,
ADD CONSTRAINT student_attempts_quiz_id_fkey
FOREIGN KEY (quiz_id) REFERENCES quizzes(id) ON DELETE CASCADE;

ALTER TABLE student_answers
DROP CONSTRAINT IF EXISTS student_answers_attempt_id_fkey,
ADD CONSTRAINT student_answers_attempt_id_fkey
FOREIGN KEY (attempt_id) REFERENCES student_attempts(id) ON DELETE CASCADE;

ALTER TABLE student_answers
DROP CONSTRAINT IF EXISTS student_answers_selected_option_id_fkey,
ADD CONSTRAINT student_answers_selected_option_id_fkey
FOREIGN KEY (selected_option_id) REFERENCES options(id) ON DELETE CASCADE;
