-- Students belong to one tuition center (educator_admin). Run after 029 and 028.
-- psql -U postgres -d eduquest -f backend/migrations/031-add-adminid-to-students.sql

ALTER TABLE students
ADD COLUMN IF NOT EXISTS admin_id INTEGER REFERENCES educator_admins(id) ON DELETE CASCADE;

UPDATE students
SET admin_id = 1
WHERE admin_id IS NULL;

ALTER TABLE students
ALTER COLUMN admin_id SET NOT NULL;
