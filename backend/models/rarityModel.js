const { pool } = require('../db');

/**
 * Get all rarities sorted by display_order.
 * Returns [{ id, name, display_order, color_class }]
 */
async function getRarities() {
  const result = await pool.query(
    'SELECT id, name, display_order, color_class FROM rarities ORDER BY display_order ASC'
  );
  return result.rows || [];
}

/**
 * Get rarity by id. Returns null if not found.
 */
async function getRarityById(rarityId) {
  const result = await pool.query(
    'SELECT id, name, display_order, color_class FROM rarities WHERE id = $1',
    [rarityId]
  );
  return result.rows[0] || null;
}

module.exports = { getRarities, getRarityById };
