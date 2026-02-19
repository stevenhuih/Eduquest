/**
 * Auth helpers for platform reviews. Uses req.role and req.userId (set by parseIdentity middleware).
 * - getAuthorFromHeaders(req): returns { role, id } for student/educator/educatoradmin only, or null.
 */

/**
 * Determine author from req.role and req.userId (set by parseIdentity).
 * Returns { role, id } or null if no identity or role is not allowed to submit platform reviews.
 * Allowed roles: student, educator, educatoradmin. platformadmin cannot submit.
 */
function getAuthorFromHeaders(req) {
  if (!req.role || !req.userId) return null;
  if (!['student', 'educator', 'educatoradmin'].includes(req.role)) return null;
  return { role: req.role, id: req.userId };
}

module.exports = { getAuthorFromHeaders };
