const { pool } = require('../db');

/**
 * Get all topics for a class, ordered by name.
 */
async function getTopicsByClassId(classId) {
  const id = parseInt(classId, 10);
  if (isNaN(id)) return [];
  const result = await pool.query(
    `SELECT * FROM topics
     WHERE class_id = $1
     ORDER BY name ASC`,
    [id]
  );
  return result.rows;
}

/**
 * Create a topic for a class.
 */
async function createTopic(name, classId) {
  const n = String(name || '').trim();
  const cid = parseInt(classId, 10);
  if (!n) throw new Error('Topic name is required');
  if (isNaN(cid)) throw new Error('Valid class_id is required');
  const result = await pool.query(
    `INSERT INTO topics (name, class_id)
     VALUES ($1, $2)
     RETURNING *`,
    [n, cid]
  );
  return result.rows[0];
}

/**
 * Get topic by id (for access control: resolve class_id).
 */
async function getTopicById(topicId) {
  const id = parseInt(topicId, 10);
  if (isNaN(id)) return null;
  const result = await pool.query(
    'SELECT id, class_id FROM topics WHERE id = $1',
    [id]
  );
  return result.rows[0] || null;
}

/**
 * Delete a topic by id.
 */
async function deleteTopic(topicId) {
  const id = parseInt(topicId, 10);
  if (isNaN(id)) throw new Error('Invalid topic id');
  await pool.query('DELETE FROM topics WHERE id = $1', [id]);
}

module.exports = {
  getTopicsByClassId,
  getTopicById,
  createTopic,
  deleteTopic,
};
