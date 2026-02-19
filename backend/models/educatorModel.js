const { pool } = require('../db');

/**
 * Get all educators (for platform admin). Returns id, name, email, created_at, created_by.
 */
async function getAllEducators() {
  const result = await pool.query(
    'SELECT id, name, email, created_at, created_by FROM educators ORDER BY created_at DESC'
  );
  return result.rows || [];
}

/**
 * Get educator by id. Returns id, name, email, created_at, created_by (no password).
 */
async function getEducatorById(id) {
  const result = await pool.query(
    'SELECT id, name, email, created_at, created_by FROM educators WHERE id = $1',
    [id]
  );
  return result.rows[0] || null;
}

/**
 * Create an educator. password is the hashed password. createdBy optional (educator admin id).
 */
async function createEducator(name, email, passwordHash, createdBy) {
  if (createdBy != null && !isNaN(Number(createdBy))) {
    const result = await pool.query(
      'INSERT INTO educators (name, email, password, created_by) VALUES ($1, $2, $3, $4) RETURNING id, name, email, created_at, created_by',
      [name, email, passwordHash, Number(createdBy)]
    );
    return result.rows[0];
  }
  const result = await pool.query(
    'INSERT INTO educators (name, email, password) VALUES ($1, $2, $3) RETURNING id, name, email',
    [name, email, passwordHash]
  );
  return result.rows[0];
}

/**
 * Find educator by email (for uniqueness check and login; returns full row including password).
 */
async function findByEmail(email) {
  const result = await pool.query(
    'SELECT * FROM educators WHERE email = $1',
    [email]
  );
  return result.rows[0] || null;
}

/**
 * Find educator by id (full row including password, for password change verification).
 */
async function findById(id) {
  const result = await pool.query(
    'SELECT * FROM educators WHERE id = $1',
    [id]
  );
  return result.rows[0] || null;
}

/**
 * Update educator name and email. Returns updated row or null.
 */
async function updateEducator(id, name, email) {
  const result = await pool.query(
    'UPDATE educators SET name = $1, email = $2 WHERE id = $3 RETURNING id, name, email',
    [name, email, id]
  );
  return result.rows[0] || null;
}

/**
 * Update educator password by id. Returns true if updated.
 */
async function updatePassword(id, passwordHash) {
  const result = await pool.query(
    'UPDATE educators SET password = $1 WHERE id = $2',
    [passwordHash, id]
  );
  return (result.rowCount || 0) > 0;
}

/**
 * Delete educator by id. Unassigns classes first, then deletes. Returns deleted row or null.
 */
async function deleteEducator(id) {
  await pool.query(
    'UPDATE classes SET educator_id = NULL WHERE educator_id = $1',
    [id]
  );

  const result = await pool.query(
    'DELETE FROM educators WHERE id = $1 RETURNING id',
    [id]
  );

  return result.rows[0] || null;
}

/**
 * Get educators created by this admin (created_by = adminId). Identity-only; no URL param.
 */
async function getEducatorsByAdmin(adminId) {
  const result = await pool.query(
    `SELECT id, name, email, created_at, created_by
     FROM educators
     WHERE created_by = $1
     ORDER BY created_at DESC`,
    [adminId]
  );
  return result.rows || [];
}

module.exports = { getAllEducators, getEducatorById, getEducatorsByAdmin, createEducator, findByEmail, findById, updateEducator, updatePassword, deleteEducator };
