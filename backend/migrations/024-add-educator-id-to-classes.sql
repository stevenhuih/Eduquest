-- Add educator_id to classes for assigning an educator to a class.
-- created_by remains (e.g. educator admin who created the class).
ALTER TABLE classes
ADD COLUMN IF NOT EXISTS educator_id INTEGER;
