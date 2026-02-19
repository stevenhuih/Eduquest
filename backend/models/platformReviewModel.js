const { pool } = require('../db');

/**
 * Insert a platform review. is_approved and is_featured default to false in DB.
 */
async function create(authorRole, authorId, rating, comment) {
  const result = await pool.query(
    `INSERT INTO platform_reviews (author_role, author_id, rating, comment, is_approved, is_featured)
     VALUES ($1, $2, $3, $4, FALSE, FALSE)
     RETURNING id, author_role, author_id, rating, comment, is_approved, is_featured, created_at`,
    [authorRole, authorId, rating, comment || null]
  );
  return result.rows[0];
}

/**
 * Get all platform reviews, optionally filtered by author_role.
 * @param {string} roleFilter - 'student' | 'educator' | 'educatoradmin' | 'all'
 */
async function getAll(roleFilter) {
  const role = (roleFilter || 'all').toLowerCase();
  let query = `SELECT id, author_role, author_id, rating, comment, is_approved, is_featured, created_at
               FROM platform_reviews`;
  const params = [];
  if (role !== 'all' && ['student', 'educator', 'educatoradmin'].includes(role)) {
    query += ' WHERE author_role = $1';
    params.push(role);
  }
  query += ' ORDER BY created_at DESC';
  const result = await pool.query(query, params);
  return result.rows;
}

/**
 * Get all platform reviews with author_name, optionally filtered by author_role.
 */
async function getAllWithAuthorNames(roleFilter) {
  const role = (roleFilter || 'all').toLowerCase();
  let query = `SELECT pr.id, pr.author_role, pr.author_id, pr.rating, pr.comment, pr.is_approved, pr.is_featured, pr.created_at,
               COALESCE(s.name, e.name, ea.admin_name) AS author_name
               FROM platform_reviews pr
               LEFT JOIN students s ON pr.author_role = 'student' AND pr.author_id = s.id
               LEFT JOIN educators e ON pr.author_role = 'educator' AND pr.author_id = e.id
               LEFT JOIN educator_admins ea ON pr.author_role = 'educatoradmin' AND pr.author_id = ea.id`;
  const params = [];
  if (role !== 'all' && ['student', 'educator', 'educatoradmin'].includes(role)) {
    query += ' WHERE pr.author_role = $1';
    params.push(role);
  }
  query += ' ORDER BY pr.created_at DESC';
  const result = await pool.query(query, params);
  return result.rows;
}

/**
 * Get a single platform review by id.
 */
async function getById(id) {
  const result = await pool.query(
    `SELECT id, author_role, author_id, rating, comment, is_approved, is_featured, created_at
     FROM platform_reviews WHERE id = $1`,
    [Number(id)]
  );
  return result.rows[0] || null;
}

/**
 * Update is_approved for a review.
 */
async function updateApproved(id, approved) {
  const result = await pool.query(
    `UPDATE platform_reviews SET is_approved = $1 WHERE id = $2
     RETURNING id, author_role, author_id, rating, comment, is_approved, is_featured, created_at`,
    [!!approved, Number(id)]
  );
  return result.rows[0] || null;
}

/**
 * Count how many reviews currently have is_featured = true.
 */
async function countFeatured() {
  const result = await pool.query(
    'SELECT COUNT(*)::int AS count FROM platform_reviews WHERE is_featured = TRUE'
  );
  return (result.rows[0] && result.rows[0].count) || 0;
}

/**
 * Get the id of the oldest featured review (by created_at). Used to unfeature when adding a new one.
 */
async function getOldestFeaturedId() {
  const result = await pool.query(
    `SELECT id FROM platform_reviews WHERE is_featured = TRUE ORDER BY created_at ASC LIMIT 1`
  );
  return result.rows[0] ? result.rows[0].id : null;
}

/**
 * Set is_featured for a review. If setting to true and already 3 featured, unfeature oldest first.
 */
async function setFeatured(id, featured) {
  const numId = Number(id);
  if (featured) {
    const count = await countFeatured();
    if (count >= 3) {
      const oldestId = await getOldestFeaturedId();
      if (oldestId != null) {
        await pool.query('UPDATE platform_reviews SET is_featured = FALSE WHERE id = $1', [oldestId]);
      }
    }
  }
  const result = await pool.query(
    `UPDATE platform_reviews SET is_featured = $1 WHERE id = $2
     RETURNING id, author_role, author_id, rating, comment, is_approved, is_featured, created_at`,
    [!!featured, numId]
  );
  return result.rows[0] || null;
}

/**
 * Get featured reviews (is_approved = true AND is_featured = true) with author name.
 * Joins students, educators, educator_admins for author name. Limit 3, order by created_at DESC.
 */
async function getFeaturedWithAuthorNames() {
  const result = await pool.query(
    `SELECT pr.id, pr.rating, pr.comment, pr.author_role, pr.created_at,
            COALESCE(s.name, e.name, ea.admin_name) AS author_name
     FROM platform_reviews pr
     LEFT JOIN students s ON pr.author_role = 'student' AND pr.author_id = s.id
     LEFT JOIN educators e ON pr.author_role = 'educator' AND pr.author_id = e.id
     LEFT JOIN educator_admins ea ON pr.author_role = 'educatoradmin' AND pr.author_id = ea.id
     WHERE pr.is_approved = TRUE AND pr.is_featured = TRUE
     ORDER BY pr.created_at DESC
     LIMIT 3`
  );
  return result.rows;
}

module.exports = {
  create,
  getAll,
  getAllWithAuthorNames,
  getById,
  updateApproved,
  countFeatured,
  getOldestFeaturedId,
  setFeatured,
  getFeaturedWithAuthorNames,
};
