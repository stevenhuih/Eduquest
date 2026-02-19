-- Allow educator admin ownership: who created/invited this educator.
ALTER TABLE educators ADD COLUMN IF NOT EXISTS created_by INTEGER;

