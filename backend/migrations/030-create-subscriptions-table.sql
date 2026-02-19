-- Subscriptions table for educator admin plan and class limits.
-- Run: psql -U postgres -d eduquest -f backend/migrations/030-create-subscriptions-table.sql

CREATE TABLE IF NOT EXISTS subscriptions (
  id SERIAL PRIMARY KEY,
  educator_admin_id INTEGER NOT NULL REFERENCES educator_admins(id) ON DELETE CASCADE,
  plan TEXT NOT NULL DEFAULT 'basic',
  class_limit INTEGER NOT NULL DEFAULT 5,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(educator_admin_id)
);

-- Default row for existing admins: plan basic, class_limit 5
INSERT INTO subscriptions (educator_admin_id, plan, class_limit)
SELECT id, 'basic', 5 FROM educator_admins
ON CONFLICT (educator_admin_id) DO NOTHING;
