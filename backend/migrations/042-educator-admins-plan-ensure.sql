-- Ensure educator_admins has plan column for subscription-based class limits (basic / pro).
ALTER TABLE educator_admins
ADD COLUMN IF NOT EXISTS plan TEXT DEFAULT 'basic';
