const { pool } = require('../db');

/**
 * Find platform admin by email. Returns full row (including password) for login.
 */
async function findByEmail(email) {
  const result = await pool.query(
    'SELECT id, name, email, password, created_at FROM platform_admins WHERE email = $1',
    [String(email).trim()]
  );
  return result.rows[0] || null;
}

/**
 * Find platform admin by id. Returns safe fields only (no password). For middleware and GET /me.
 */
async function findById(id) {
  const result = await pool.query(
    'SELECT id, name, email, created_at FROM platform_admins WHERE id = $1',
    [Number(id)]
  );
  return result.rows[0] || null;
}

module.exports = { findByEmail, findById };
