const { pool } = require('../db');

const PLAN_LIMITS = { basic: 5, pro: 9999 };

/**
 * Get subscription for an admin. Returns null if none.
 */
async function getSubscriptionByAdmin(adminId) {
  const result = await pool.query(
    'SELECT id, educator_admin_id, plan, class_limit, created_at FROM subscriptions WHERE educator_admin_id = $1',
    [adminId]
  );
  return result.rows[0] || null;
}

/**
 * Update plan for an admin. basic → class_limit 5, pro → 9999.
 * Creates row if missing.
 */
async function updatePlan(adminId, plan) {
  const normalized = String(plan).toLowerCase() === 'pro' ? 'pro' : 'basic';
  const classLimit = PLAN_LIMITS[normalized] ?? 5;

  const result = await pool.query(
    `INSERT INTO subscriptions (educator_admin_id, plan, class_limit)
     VALUES ($1, $2, $3)
     ON CONFLICT (educator_admin_id)
     DO UPDATE SET plan = $2, class_limit = $3
     RETURNING id, educator_admin_id, plan, class_limit, created_at`,
    [adminId, normalized, classLimit]
  );
  return result.rows[0];
}

/**
 * Create a subscription row for a new admin (on signup).
 */
async function createSubscription(adminId, plan) {
  const normalized = String(plan).toLowerCase() === 'pro' ? 'pro' : 'basic';
  const classLimit = PLAN_LIMITS[normalized] ?? 5;
  const result = await pool.query(
    `INSERT INTO subscriptions (educator_admin_id, plan, class_limit)
     VALUES ($1, $2, $3)
     ON CONFLICT (educator_admin_id) DO UPDATE SET plan = $2, class_limit = $3
     RETURNING id, educator_admin_id, plan, class_limit, created_at`,
    [adminId, normalized, classLimit]
  );
  return result.rows[0];
}

module.exports = { getSubscriptionByAdmin, updatePlan, createSubscription, PLAN_LIMITS };
