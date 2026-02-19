-- Add reward columns for quizzes (max reward for passing).
-- If a challenges table exists, add reward columns there too.

ALTER TABLE quizzes
ADD COLUMN IF NOT EXISTS xp_reward INTEGER DEFAULT 100,
ADD COLUMN IF NOT EXISTS coin_reward INTEGER DEFAULT 20;

-- Part 2: Add rewards to challenges table only if it exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'challenges'
  ) THEN
    ALTER TABLE challenges
    ADD COLUMN IF NOT EXISTS xp_reward INTEGER DEFAULT 50,
    ADD COLUMN IF NOT EXISTS coin_reward INTEGER DEFAULT 15;
  END IF;
END $$;
