const { pool } = require('../db');

/**
 * Create an educator admin. password is the hashed password.
 */
async function createAdmin(centerName, adminName, email, passwordHash, plan) {
  const result = await pool.query(
    'INSERT INTO educator_admins (center_name, admin_name, email, password, plan) VALUES ($1, $2, $3, $4, $5) RETURNING id, center_name, admin_name, email, plan, created_at',
    [centerName, adminName, email, passwordHash, plan]
  );
  return result.rows[0];
}

/**
 * Get admin by id (safe fields only, no password). Includes status, subscription_plan, subscription_expires_at.
 */
async function getAdminById(id) {
  const result = await pool.query(
    `SELECT id, center_name, admin_name, email, plan, created_at,
     COALESCE(status, 'active') AS status,
     COALESCE(subscription_plan, 'free') AS subscription_plan,
     subscription_expires_at
     FROM educator_admins WHERE id = $1`,
    [id]
  );
  return result.rows[0] || null;
}

/**
 * Update admin profile (center_name, admin_name, email).
 */
async function updateAdminProfile(id, centerName, adminName, email) {
  const result = await pool.query(
    `UPDATE educator_admins
     SET center_name = $1, admin_name = $2, email = $3
     WHERE id = $4
     RETURNING id, center_name, admin_name, email, plan`,
    [centerName, adminName, email, id]
  );
  return result.rows[0] || null;
}

/**
 * Update admin password (hashed).
 */
async function updateAdminPassword(id, passwordHash) {
  await pool.query(
    'UPDATE educator_admins SET password = $1 WHERE id = $2',
    [passwordHash, id]
  );
}

/**
 * Find admin by email (full row for login).
 */
async function findAdminByEmail(email) {
  const result = await pool.query(
    'SELECT * FROM educator_admins WHERE email = $1',
    [email]
  );
  return result.rows[0] || null;
}

/**
 * Get all educator admins (id, admin_name, email, center_name, plan, created_at, status, subscription_plan, subscription_expires_at), sorted by created_at DESC.
 */
async function getAllAdmins() {
  const result = await pool.query(
    `SELECT id, admin_name, email, center_name, plan, created_at,
     COALESCE(status, 'active') AS status,
     COALESCE(subscription_plan, 'free') AS subscription_plan,
     subscription_expires_at
     FROM educator_admins ORDER BY created_at DESC`
  );
  return result.rows;
}

/**
 * Get class count for an admin (classes created by this admin).
 * Used later to enforce Basic (max 5) vs Pro (unlimited). Not enforced yet.
 */
async function getClassCountForAdmin(adminId) {
  const result = await pool.query(
    'SELECT COUNT(*)::int AS count FROM classes WHERE created_by = $1',
    [adminId]
  );
  return (result.rows[0] && result.rows[0].count) || 0;
}

const ALLOWED_STATUSES = ['active', 'suspended'];
const ALLOWED_PLANS = ['basic', 'pro'];

/**
 * Update educator admin status. Valid values: active, suspended.
 */
async function updateStatus(educatorAdminId, status) {
  const s = String(status).toLowerCase().trim();
  if (!ALLOWED_STATUSES.includes(s)) {
    throw new Error('Invalid status; allowed: active, suspended');
  }
  const result = await pool.query(
    'UPDATE educator_admins SET status = $1 WHERE id = $2 RETURNING id, center_name, admin_name, email, plan, created_at, COALESCE(status, \'active\') AS status, COALESCE(subscription_plan, \'free\') AS subscription_plan, subscription_expires_at',
    [s, educatorAdminId]
  );
  return result.rows[0] || null;
}

/**
 * Update educator admin subscription (plan and optional expiration).
 */
async function updateSubscription(educatorAdminId, plan, expiresAt) {
  let p = String(plan).toLowerCase().trim();
  if (p === 'free') p = 'basic';
  if (!ALLOWED_PLANS.includes(p)) {
    throw new Error('Invalid subscription_plan; allowed: basic, pro');
  }
  const result = await pool.query(
    `UPDATE educator_admins SET subscription_plan = $1, subscription_expires_at = $2
     WHERE id = $3
     RETURNING id, center_name, admin_name, email, plan, created_at, COALESCE(status, 'active') AS status, COALESCE(subscription_plan, 'free') AS subscription_plan, subscription_expires_at`,
    [p, expiresAt || null, educatorAdminId]
  );
  return result.rows[0] || null;
}

module.exports = {
  createAdmin,
  findAdminByEmail,
  getAdminById,
  getAllAdmins,
  updateAdminProfile,
  updateAdminPassword,
  getClassCountForAdmin,
  updateStatus,
  updateSubscription,
};
