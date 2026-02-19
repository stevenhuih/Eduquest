-- Add email and password to students for login and uniqueness.
-- Run: psql -U postgres -d eduquest -f backend/migrations/028-add-email-password-to-students.sql
-- Ensure existing rows have email/password set before adding NOT NULL.

ALTER TABLE students
ADD COLUMN IF NOT EXISTS email TEXT,
ADD COLUMN IF NOT EXISTS password TEXT;

ALTER TABLE students
ALTER COLUMN email SET NOT NULL,
ALTER COLUMN password SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS students_email_key ON students(email);
