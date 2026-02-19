-- Student reports (EduQuest Inbox): PDF reports sent by educator to student
CREATE TABLE IF NOT EXISTS student_reports (
  id SERIAL PRIMARY KEY,
  student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  educator_id INTEGER NOT NULL REFERENCES educators(id) ON DELETE CASCADE,
  class_id INTEGER REFERENCES classes(id) ON DELETE SET NULL,
  report_type TEXT NOT NULL,
  file_path TEXT NOT NULL,
  generated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  is_read BOOLEAN DEFAULT FALSE
);

CREATE INDEX IF NOT EXISTS idx_student_reports_student_id ON student_reports(student_id);
CREATE INDEX IF NOT EXISTS idx_student_reports_educator_id ON student_reports(educator_id);
