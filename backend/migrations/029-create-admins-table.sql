-- Educator admins table for subscription onboarding.
-- Run: psql -U postgres -d eduquest -f backend/migrations/029-create-admins-table.sql

CREATE TABLE IF NOT EXISTS educator_admins (
  id SERIAL PRIMARY KEY,
  center_name TEXT NOT NULL,
  admin_name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  password TEXT NOT NULL,
  plan TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);
