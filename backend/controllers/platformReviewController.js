const platformReviewModel = require('../models/platformReviewModel');
const { getAuthorFromHeaders } = require('../utils/platformReviewAuth');

/**
 * Require platform admin OR educator admin (for read-only list). Used by GET /api/platform-reviews.
 * Uses req.role and req.userId from parseIdentity middleware.
 */
function requirePlatformAdminOrEducatorAdmin(req, res, next) {
  if (!req.role || !req.userId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  if (req.role === 'platformadmin') {
    return next();
  }

  if (req.role === 'educatoradmin') {
    return next();
  }

  return res.status(403).json({ error: 'Access denied' });
}

/**
 * POST /api/platform-reviews
 * Body: { rating, comment? }
 * Author from headers (student | educator | educatoradmin). Insert with is_approved=false, is_featured=false.
 */
async function create(req, res) {
  try {
    const author = getAuthorFromHeaders(req);
    if (!author) {
      return res.status(401).json({
        error: 'Unauthorized: set exactly one of x-student-id, x-educator-id, x-educatoradmin-id',
      });
    }

    const rating = req.body && req.body.rating != null ? Number(req.body.rating) : NaN;
    const comment = req.body && req.body.comment != null ? String(req.body.comment).trim() : '';

    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
      return res.status(400).json({ error: 'Rating must be an integer between 1 and 5' });
    }

    const row = await platformReviewModel.create(author.role, author.id, rating, comment);
    res.status(201).json(row);
  } catch (err) {
    console.error('Platform review create error:', err);
    res.status(500).json({ error: err.message || 'Failed to create review' });
  }
}

/**
 * GET /api/platform-reviews
 * Platform admin only. Query: ?role=student|educator|educatoradmin|all (default: all).
 * Returns all reviews (including unapproved) with author_name.
 */
async function list(req, res) {
  try {
    const roleFilter = (req.query && req.query.role) || 'all';
    const rows = await platformReviewModel.getAllWithAuthorNames(roleFilter);
    res.json(rows);
  } catch (err) {
    console.error('Platform reviews list error:', err);
    res.status(500).json({ error: err.message || 'Failed to load reviews' });
  }
}

/**
 * PATCH /api/platform-reviews/:id/approve
 * Platform admin only. Body: { approved: true | false }
 */
async function approve(req, res) {
  try {
    const id = Number(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ error: 'Invalid review id' });
    }
    const approved = req.body && req.body.approved;
    if (typeof approved !== 'boolean') {
      return res.status(400).json({ error: 'Body must include approved: true or false' });
    }

    const row = await platformReviewModel.updateApproved(id, approved);
    if (!row) {
      return res.status(404).json({ error: 'Review not found' });
    }
    res.json(row);
  } catch (err) {
    console.error('Platform review approve error:', err);
    res.status(500).json({ error: err.message || 'Failed to update approval' });
  }
}

/**
 * PATCH /api/platform-reviews/:id/feature
 * Platform admin only. Body: { featured: true | false }
 * If featured = true: only allow if is_approved = true; if already 3 featured, unfeature oldest then set this one.
 */
async function feature(req, res) {
  try {
    const id = Number(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ error: 'Invalid review id' });
    }
    const featured = req.body && req.body.featured;
    if (typeof featured !== 'boolean') {
      return res.status(400).json({ error: 'Body must include featured: true or false' });
    }

    const review = await platformReviewModel.getById(id);
    if (!review) {
      return res.status(404).json({ error: 'Review not found' });
    }
    if (featured && !review.is_approved) {
      return res.status(400).json({ error: 'Only approved reviews can be featured' });
    }

    const row = await platformReviewModel.setFeatured(id, featured);
    res.json(row);
  } catch (err) {
    console.error('Platform review feature error:', err);
    res.status(500).json({ error: err.message || 'Failed to update featured' });
  }
}

/**
 * GET /api/platform-reviews/featured
 * Public. Returns up to 3 reviews where is_approved AND is_featured, with author name and role.
 */
async function getFeatured(req, res) {
  try {
    const rows = await platformReviewModel.getFeaturedWithAuthorNames();
    res.json(rows);
  } catch (err) {
    console.error('Platform reviews featured error:', err);
    res.status(500).json({ error: err.message || 'Failed to load featured reviews' });
  }
}

module.exports = {
  requirePlatformAdminOrEducatorAdmin,
  create,
  list,
  approve,
  feature,
  getFeatured,
};
