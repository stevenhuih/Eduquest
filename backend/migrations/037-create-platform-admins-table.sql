-- Platform admins: separate from educator_admins. Used for platform-wide moderation (e.g. platform reviews).
-- Run: psql -U postgres -d eduquest -f backend/migrations/037-create-platform-admins-table.sql

CREATE TABLE IF NOT EXISTS platform_admins (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  password TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);
