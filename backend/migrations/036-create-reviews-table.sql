-- Platform review system: students â†’ educator admin, educators â†’ educator admin, educator admins â†’ platform.
-- Run: psql -U postgres -d eduquest -f backend/migrations/036-create-reviews-table.sql

CREATE TABLE IF NOT EXISTS reviews (
  id SERIAL PRIMARY KEY,
  author_role TEXT NOT NULL,
  author_id INTEGER NOT NULL,
  target_role TEXT NOT NULL,
  target_id INTEGER NULL,
  rating INTEGER NOT NULL,
  comment TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  CONSTRAINT reviews_rating_range CHECK (rating >= 1 AND rating <= 5)
);
