-- Educator admin status (active/suspended) and subscription fields.
-- Run: psql -U postgres -d eduquest -f backend/migrations/045-add-educatoradmin-status-subscription.sql

ALTER TABLE educator_admins
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active';

ALTER TABLE educator_admins
ADD COLUMN IF NOT EXISTS subscription_plan TEXT DEFAULT 'free';

ALTER TABLE educator_admins
ADD COLUMN IF NOT EXISTS subscription_expires_at TIMESTAMP;
