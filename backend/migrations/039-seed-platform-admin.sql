-- Seed default platform admin. Password is bcrypt hash for 'admin123' (10 rounds).
-- Run after 037. Safe to run multiple times (no duplicate email).
-- Change password after first login in production.
INSERT INTO platform_admins (name, email, password)
VALUES ('Admin', 'admin@school.edu', '$2b$10$KphocRMCO7tIhMOf17j/b.fKaW0fT9peng3n2WdS82NMIyurbIm1S')
ON CONFLICT (email) DO NOTHING;
