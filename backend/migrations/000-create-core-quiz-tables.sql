-- Core quiz tables. Run first (before 001-045).
-- These tables were originally created manually; this migration captures the minimal
-- schema required so that migrations 001-045 (ALTERs and FKs) succeed.
-- Do not add columns here that are added by later migrations (e.g. explanation, topic, topic_id, class_id on attempts, quiz rules, rewards).

-- Quizzes: title, class_id, created_by, created_at only.
-- Migration 003/004 add shuffle_questions, pass_grade, allow_retakes, time_limit_minutes, due_date.
-- Migration 034 adds xp_reward, coin_reward.
-- No FK on class_id or created_by here (classes and educators tables created in 015/025).
CREATE TABLE IF NOT EXISTS quizzes (
  id          SERIAL PRIMARY KEY,
  title       VARCHAR(500) NOT NULL,
  class_id    INTEGER NOT NULL DEFAULT 1,
  created_by  INTEGER NOT NULL DEFAULT 1,
  created_at  TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Questions: quiz_id, question_text, difficulty_level, correct_answer only.
-- Migration 001/002 add explanation; 008 adds topic; 022 adds topic_id (REFERENCES topics).
CREATE TABLE IF NOT EXISTS questions (
  id               SERIAL PRIMARY KEY,
  quiz_id          INTEGER NOT NULL REFERENCES quizzes(id) ON DELETE CASCADE,
  question_text    TEXT NOT NULL,
  difficulty_level VARCHAR(50) DEFAULT 'medium',
  correct_answer   TEXT
);

-- Options: one row per multiple-choice option; is_correct marks the right answer.
CREATE TABLE IF NOT EXISTS options (
  id          SERIAL PRIMARY KEY,
  question_id INTEGER NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  option_text TEXT NOT NULL,
  is_correct  BOOLEAN NOT NULL DEFAULT FALSE
);

-- Student attempts: one row per quiz attempt by a student.
-- Migration 019 adds class_id INTEGER REFERENCES classes(id) ON DELETE SET NULL.
CREATE TABLE IF NOT EXISTS student_attempts (
  id           SERIAL PRIMARY KEY,
  student_id   INTEGER NOT NULL,
  quiz_id      INTEGER NOT NULL REFERENCES quizzes(id) ON DELETE CASCADE,
  score        INTEGER NOT NULL DEFAULT 0,
  completed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Student answers: one row per answered question within an attempt.
-- Links to attempt, question, and selected option; stores whether the choice was correct.
CREATE TABLE IF NOT EXISTS student_answers (
  id                  SERIAL PRIMARY KEY,
  attempt_id          INTEGER NOT NULL REFERENCES student_attempts(id) ON DELETE CASCADE,
  question_id         INTEGER NOT NULL REFERENCES questions(id),
  selected_option_id  INTEGER REFERENCES options(id) ON DELETE CASCADE,
  is_correct          BOOLEAN NOT NULL DEFAULT FALSE
);
