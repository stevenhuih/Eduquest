const { pool } = require('../db');

/**
 * Insert a review. Returns the created row.
 */
async function createReview(authorRole, authorId, targetRole, targetId, rating, comment) {
  const result = await pool.query(
    `INSERT INTO reviews (author_role, author_id, target_role, target_id, rating, comment)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING id, author_role, author_id, target_role, target_id, rating, comment, created_at`,
    [authorRole, authorId, targetRole, targetId ?? null, rating, comment || null]
  );
  return result.rows[0];
}

/**
 * Get reviews written by this author (author_role + author_id).
 */
async function getReviewsByAuthor(authorRole, authorId) {
  const result = await pool.query(
    `SELECT id, author_role, author_id, target_role, target_id, rating, comment, created_at
     FROM reviews
     WHERE author_role = $1 AND author_id = $2
     ORDER BY created_at DESC`,
    [authorRole, authorId]
  );
  return result.rows;
}

/**
 * Get reviews where target is this educator admin (target_role = 'educatoradmin', target_id = adminId).
 */
async function getReviewsForEducatorAdmin(adminId) {
  const result = await pool.query(
    `SELECT id, author_role, author_id, target_role, target_id, rating, comment, created_at
     FROM reviews
     WHERE target_role = 'educatoradmin' AND target_id = $1
     ORDER BY created_at DESC`,
    [adminId]
  );
  return result.rows;
}

/**
 * Center reviews only: students and educators reviewing this center.
 * Explicitly excludes author_role = 'educatoradmin' (those are platform reviews, not center).
 */
async function getCenterReviewsForEducatorAdmin(adminId) {
  const result = await pool.query(
    `SELECT id, author_role, author_id, target_role, target_id, rating, comment, created_at
     FROM reviews
     WHERE target_role = 'educatoradmin' AND target_id = $1
       AND author_role IN ('student', 'educator')
     ORDER BY created_at DESC`,
    [adminId]
  );
  return result.rows;
}

/**
 * Get reviews where target is platform (target_role = 'platform').
 */
async function getPlatformReviews() {
  const result = await pool.query(
    `SELECT id, author_role, author_id, target_role, target_id, rating, comment, created_at
     FROM reviews
     WHERE target_role = 'platform'
     ORDER BY created_at DESC`
  );
  return result.rows;
}

/**
 * Get educator admins this educator can review (linked via classes).
 */
async function getLinkedAdminsForEducator(educatorId) {
  const result = await pool.query(
    `SELECT DISTINCT ea.id, ea.center_name
     FROM classes c
     JOIN educator_admins ea ON ea.id = c.created_by
     WHERE c.educator_id = $1
     ORDER BY ea.center_name`,
    [educatorId]
  );
  return result.rows;
}

module.exports = {
  createReview,
  getReviewsByAuthor,
  getReviewsForEducatorAdmin,
  getCenterReviewsForEducatorAdmin,
  getPlatformReviews,
  getLinkedAdminsForEducator,
};
