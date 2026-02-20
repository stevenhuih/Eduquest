-- Pricing plans for landing page (single source of truth)
CREATE TABLE IF NOT EXISTS pricing_plans (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  price INTEGER NOT NULL,
  features TEXT[] NOT NULL DEFAULT '{}',
  is_pro BOOLEAN NOT NULL DEFAULT FALSE
);

-- Seed default plans
INSERT INTO pricing_plans (name, price, features, is_pro)
VALUES
  (
    'Basic',
    5,
    ARRAY['Up to 5 classes', 'Quizzes & question bank', 'Student progress tracking', 'Email support'],
    FALSE
  ),
  (
    'Pro',
    12,
    ARRAY['Unlimited classes', 'AI Quest Generator', 'Deep analytics & reports', 'Priority support'],
    TRUE
  )
;
