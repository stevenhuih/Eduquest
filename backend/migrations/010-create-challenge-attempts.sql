-- One-time daily challenges: record completed challenge topics per student per day
CREATE TABLE IF NOT EXISTS challenge_attempts (
  id SERIAL PRIMARY KEY,
  student_id INTEGER NOT NULL,
  topic TEXT NOT NULL,
  difficulty TEXT,
  completed_at TIMESTAMP DEFAULT NOW()
);
