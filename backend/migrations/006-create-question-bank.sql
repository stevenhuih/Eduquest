-- Question Bank: reusable questions per class
CREATE TABLE IF NOT EXISTS question_bank (
  id SERIAL PRIMARY KEY,
  class_id INT NOT NULL,
  topic TEXT NOT NULL,
  difficulty TEXT NOT NULL,
  question_text TEXT NOT NULL,
  created_by INT,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS question_bank_options (
  id SERIAL PRIMARY KEY,
  question_id INT REFERENCES question_bank(id) ON DELETE CASCADE,
  option_text TEXT NOT NULL,
  is_correct BOOLEAN DEFAULT FALSE
);
