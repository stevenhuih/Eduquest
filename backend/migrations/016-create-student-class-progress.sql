-- Student progress per class: XP, streak, last_activity
CREATE TABLE IF NOT EXISTS student_class_progress (
  id SERIAL PRIMARY KEY,
  student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  class_id INTEGER NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  xp INTEGER DEFAULT 0,
  streak INTEGER DEFAULT 0,
  last_activity DATE,
  UNIQUE(student_id, class_id)
);
