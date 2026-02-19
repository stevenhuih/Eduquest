-- EduQuest Quiz System - PostgreSQL Schema
-- Run: psql -U postgres -d eduquest -f schema.sql
-- Or create DB first: CREATE DATABASE eduquest; then run this file connected to eduquest.

-- Optional: classes table (for class_id FK)
CREATE TABLE IF NOT EXISTS classes (
  id   SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL
);

INSERT INTO classes (id, name) VALUES (1, 'Maths') ON CONFLICT (id) DO NOTHING;

-- Quizzes
CREATE TABLE IF NOT EXISTS quizzes (
  id          SERIAL PRIMARY KEY,
  title       VARCHAR(500) NOT NULL,
  class_id    INTEGER NOT NULL DEFAULT 1 REFERENCES classes(id),
  created_by  INTEGER NOT NULL DEFAULT 1,
  created_at  TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Questions
CREATE TABLE IF NOT EXISTS questions (
  id               SERIAL PRIMARY KEY,
  quiz_id          INTEGER NOT NULL REFERENCES quizzes(id) ON DELETE CASCADE,
  question_text    TEXT NOT NULL,
  difficulty_level VARCHAR(50) DEFAULT 'medium',
  correct_answer   TEXT,
  explanation      TEXT
);

-- Options (multiple choice)
CREATE TABLE IF NOT EXISTS options (
  id          SERIAL PRIMARY KEY,
  question_id INTEGER NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  option_text TEXT NOT NULL,
  is_correct  BOOLEAN NOT NULL DEFAULT FALSE
);

-- Student attempts (for later use)
CREATE TABLE IF NOT EXISTS student_attempts (
  id          SERIAL PRIMARY KEY,
  student_id  INTEGER NOT NULL,
  quiz_id     INTEGER NOT NULL REFERENCES quizzes(id),
  score       INTEGER NOT NULL DEFAULT 0,
  completed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Student answers per attempt
CREATE TABLE IF NOT EXISTS student_answers (
  id                  SERIAL PRIMARY KEY,
  attempt_id          INTEGER NOT NULL REFERENCES student_attempts(id) ON DELETE CASCADE,
  question_id         INTEGER NOT NULL REFERENCES questions(id),
  selected_option_id  INTEGER REFERENCES options(id),
  is_correct          BOOLEAN NOT NULL DEFAULT FALSE
);

-- Prepare for Challenge Mode: store wrong questions for reuse (e.g. random drills)
CREATE TABLE IF NOT EXISTS student_wrong_questions (
  id          SERIAL PRIMARY KEY,
  student_id  INTEGER NOT NULL,
  question_id INTEGER NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  attempt_id  INTEGER REFERENCES student_attempts(id) ON DELETE SET NULL,
  recorded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE (student_id, question_id)
);

-- Indexes for random fetch and lookups
CREATE INDEX IF NOT EXISTS idx_questions_quiz_id ON questions(quiz_id);
CREATE INDEX IF NOT EXISTS idx_options_question_id ON options(question_id);
CREATE INDEX IF NOT EXISTS idx_student_attempts_student_quiz ON student_attempts(student_id, quiz_id);
CREATE INDEX IF NOT EXISTS idx_student_wrong_questions_student ON student_wrong_questions(student_id);
