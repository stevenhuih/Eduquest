const { pool } = require('../db');

/**
 * Get all rarities sorted by display_order.
 * @returns {Promise<Array<{id, name, color_class}>>}
 */
async function getRarities() {
  const result = await pool.query(
    'SELECT id, name, color_class FROM rarities ORDER BY display_order ASC'
  );
  return result.rows || [];
}

/**
 * Get all cards with rarity info (join rarities).
 */
async function getAllCards() {
  const result = await pool.query(
    `SELECT c.id, c.name, c.price, c.image_path,
        r.id AS rarity_id,
        r.name AS rarity_name,
        r.color_class
     FROM cards c
     JOIN rarities r ON c.rarity_id = r.id
     ORDER BY r.display_order ASC, c.price ASC, c.name ASC`
  );
  return result.rows || [];
}

/**
 * Get card by id with rarity. Returns null if not found.
 */
async function getCardById(cardId) {
  const result = await pool.query(
    `SELECT c.id, c.name, c.price, c.image_path,
        r.id AS rarity_id,
        r.name AS rarity_name,
        r.color_class
     FROM cards c
     JOIN rarities r ON c.rarity_id = r.id
     WHERE c.id = $1`,
    [cardId]
  );
  return result.rows[0] || null;
}

/**
 * Record a purchase: insert into student_cards.
 */
async function addStudentCard(studentId, cardId) {
  const result = await pool.query(
    'INSERT INTO student_cards (student_id, card_id) VALUES ($1, $2) RETURNING id',
    [studentId, cardId]
  );
  return result.rows[0];
}

/**
 * Get all cards owned by a student (with rarity).
 */
async function getStudentCards(studentId) {
  const result = await pool.query(
    `SELECT c.id, c.name, c.price, c.image_path,
        r.id AS rarity_id,
        r.name AS rarity_name,
        r.color_class
     FROM student_cards sc
     JOIN cards c ON sc.card_id = c.id
     JOIN rarities r ON c.rarity_id = r.id
     WHERE sc.student_id = $1
     ORDER BY r.display_order ASC, c.name ASC`,
    [studentId]
  );
  return result.rows || [];
}

/**
 * Validate rarity_id exists.
 */
async function rarityExists(rarityId) {
  const result = await pool.query(
    'SELECT id FROM rarities WHERE id = $1',
    [Number(rarityId)]
  );
  return result.rows.length > 0;
}

/**
 * Create a new card. name required; rarity_id must exist; price >= 0.
 */
async function createCard(name, rarityId, imagePath, price) {
  const exists = await rarityExists(rarityId);
  if (!exists) {
    return null;
  }
  const result = await pool.query(
    `INSERT INTO cards (name, rarity_id, image_path, price)
     VALUES ($1, $2, $3, $4)
     RETURNING id, name, rarity_id, image_path, price`,
    [name, Number(rarityId), imagePath || null, Math.max(0, Number(price) || 0)]
  );
  const row = result.rows[0];
  if (!row) return null;
  const withRarity = await getCardById(row.id);
  return withRarity;
}

/**
 * Update card name and price only (rarity and image unchanged). price >= 0.
 */
async function updateCard(cardId, name, price) {
  const result = await pool.query(
    'UPDATE cards SET name = $1, price = $2 WHERE id = $3 RETURNING id',
    [name, Math.max(0, Number(price) || 0), cardId]
  );
  if (!result.rows[0]) return null;
  return getCardById(cardId);
}

/**
 * Delete a card. Removes student_cards rows first.
 */
async function deleteCard(cardId) {
  await pool.query('DELETE FROM student_cards WHERE card_id = $1', [cardId]);
  const result = await pool.query('DELETE FROM cards WHERE id = $1 RETURNING id', [cardId]);
  return result.rows[0] || null;
}

/**
 * Find a card by image_path or filename (for secure image serving).
 */
async function getCardByImageFilename(filename) {
  if (!filename || typeof filename !== 'string') return null;
  const result = await pool.query(
    `SELECT c.id, c.image_path
     FROM cards c
     WHERE c.image_path = $1 OR c.image_path LIKE $2`,
    [filename, '%' + filename]
  );
  return result.rows[0] || null;
}

module.exports = {
  getRarities,
  getAllCards,
  getCardById,
  addStudentCard,
  getStudentCards,
  rarityExists,
  createCard,
  updateCard,
  deleteCard,
  getCardByImageFilename
};
