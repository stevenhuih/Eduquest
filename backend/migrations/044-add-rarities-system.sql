-- PART 1: Rarities lookup table and cards refactor
CREATE TABLE IF NOT EXISTS rarities (
  id SERIAL PRIMARY KEY,
  name TEXT UNIQUE NOT NULL,
  display_order INTEGER NOT NULL,
  color_class TEXT NOT NULL
);

INSERT INTO rarities (name, display_order, color_class) VALUES
  ('Common', 1, 'common'),
  ('Uncommon', 2, 'uncommon'),
  ('Rare', 3, 'rare'),
  ('Epic', 4, 'epic'),
  ('Legendary', 5, 'legendary'),
  ('Mythical', 6, 'mythical')
ON CONFLICT (name) DO NOTHING;

-- Add rarity_id to cards and migrate from legacy rarity string
ALTER TABLE cards ADD COLUMN IF NOT EXISTS rarity_id INTEGER REFERENCES rarities(id);

UPDATE cards
SET rarity_id = r.id
FROM rarities r
WHERE cards.rarity_id IS NULL AND LOWER(cards.rarity) = LOWER(r.name);

-- Set default for any rows that didn't match (e.g. typo) to Common
UPDATE cards
SET rarity_id = (SELECT id FROM rarities WHERE name = 'Common' LIMIT 1)
WHERE rarity_id IS NULL;

ALTER TABLE cards ALTER COLUMN rarity_id SET NOT NULL;
ALTER TABLE cards DROP COLUMN IF EXISTS rarity;

-- PART 2: image_path (replace image_url)
ALTER TABLE cards ADD COLUMN IF NOT EXISTS image_path TEXT;

UPDATE cards SET image_path = image_url WHERE image_url IS NOT NULL AND (image_path IS NULL OR image_path = '');

ALTER TABLE cards DROP COLUMN IF EXISTS image_url;
