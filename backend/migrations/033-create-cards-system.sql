-- Trading Card shop: cards catalog and student ownership
CREATE TABLE IF NOT EXISTS cards (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  rarity TEXT NOT NULL,
  image_url TEXT,
  price INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS student_cards (
  id SERIAL PRIMARY KEY,
  student_id INTEGER NOT NULL,
  card_id INTEGER NOT NULL REFERENCES cards(id),
  created_at TIMESTAMP DEFAULT NOW()
);

-- Seed cards (image_url matches filenames in public/assets/cards/)
INSERT INTO cards (name, rarity, image_url, price) VALUES
  ('Epic Fishing', 'Epic', '/assets/cards/Epic_Fishing.png', 150),
  ('Epic Study Time', 'Epic', '/assets/cards/Epic_Study_Time.png', 150),
  ('Rare Relax', 'Rare', '/assets/cards/Rare_Relax.png', 80),
  ('Uncommon Planting', 'Uncommon', '/assets/cards/Uncommon_Planting.png', 50),
  ('Common Study', 'Common', '/assets/cards/Common_Study.png', 25),
  ('Common Class Study', 'Common', '/assets/cards/Common_Class_Study.png', 25),
  ('Legendary Engineer', 'Legendary', '/assets/cards/Legendary_Engineer.png', 400),
  ('Mythical Chemist', 'Mythical', '/assets/cards/Mythical_Chemist.png', 800)
;
