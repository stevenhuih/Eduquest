-- Educators table for assignable educators (used in class creation).
CREATE TABLE IF NOT EXISTS educators (
  id SERIAL PRIMARY KEY,
  name TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Seed one educator so admin can assign by default (idempotent: only if empty).
INSERT INTO educators (id, name)
SELECT 1, 'Ms. Valerie Frizzle'
WHERE NOT EXISTS (SELECT 1 FROM educators LIMIT 1);
