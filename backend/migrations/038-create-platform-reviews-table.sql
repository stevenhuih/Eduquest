-- Platform-wide reviews: students, educators, educator admins submit; platform admins approve/feature.
-- Do NOT add foreign keys (additive only, no FKs per spec).
-- Run: psql -U postgres -d eduquest -f backend/migrations/038-create-platform-reviews-table.sql

CREATE TABLE IF NOT EXISTS platform_reviews (
  id SERIAL PRIMARY KEY,
  author_role TEXT NOT NULL CHECK (author_role IN ('student', 'educator', 'educatoradmin')),
  author_id INTEGER NOT NULL,
  rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment TEXT,
  is_approved BOOLEAN DEFAULT FALSE,
  is_featured BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW()
);
