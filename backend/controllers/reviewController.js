const reviewModel = require('../models/reviewModel');
const studentModel = require('../models/studentModel');
const accessControl = require('../utils/accessControl');

/**
 * POST /api/reviews
 * Body: { target_role, target_id?, rating, comment? }
 * Author from parseIdentity: req.role and req.userId. Exactly one identity required; platformadmin cannot submit.
 */
async function create(req, res) {
  try {
    if (!req.role) {
      return res.status(401).json({ error: 'Unauthorized: set exactly one of x-student-id, x-educator-id, x-educatoradmin-id' });
    }
    if (req.role === 'platformadmin') {
      return res.status(403).json({ error: 'Platform admins cannot submit reviews' });
    }
    const author = { role: req.role, id: req.userId };

    const targetRole = req.body && req.body.target_role != null ? String(req.body.target_role).trim().toLowerCase() : '';
    const targetId = req.body && req.body.target_id != null ? Number(req.body.target_id) : null;
    const rating = req.body && req.body.rating != null ? Number(req.body.rating) : NaN;
    const comment = req.body && req.body.comment != null ? String(req.body.comment).trim() : '';

    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
      return res.status(400).json({ error: 'Rating must be an integer between 1 and 5' });
    }

    if (author.role === 'student') {
      if (targetRole !== 'educatoradmin') {
        return res.status(400).json({ error: 'Students can only review their educator admin (target_role: educatoradmin)' });
      }
      const studentAdminId = await studentModel.getStudentAdminId(author.id);
      if (studentAdminId == null) {
        return res.status(403).json({ error: 'Student has no tuition center' });
      }
      if (Number(targetId) !== Number(studentAdminId)) {
        return res.status(403).json({ error: 'You can only review your own tuition center' });
      }
      await reviewModel.createReview('student', author.id, 'educatoradmin', targetId, rating, comment);
      return res.json({ success: true });
    }

    if (author.role === 'educator') {
      if (targetRole !== 'educatoradmin') {
        return res.status(400).json({ error: 'Educators can only review an educator admin (target_role: educatoradmin)' });
      }
      if (targetId == null || isNaN(Number(targetId))) {
        return res.status(400).json({ error: 'target_id is required for educator admin review' });
      }
      const canReview = await accessControl.canEducatorReviewEducatorAdmin(author.id, targetId);
      if (!canReview) {
        return res.status(403).json({ error: 'You can only review a center you are linked to' });
      }
      await reviewModel.createReview('educator', author.id, 'educatoradmin', targetId, rating, comment);
      return res.json({ success: true });
    }

    if (author.role === 'educatoradmin') {
      if (targetRole !== 'platform') {
        return res.status(400).json({ error: 'Educator admins can only review the platform (target_role: platform)' });
      }
      if (targetId != null) {
        return res.status(400).json({ error: 'target_id must be null for platform review' });
      }
      await reviewModel.createReview('educatoradmin', author.id, 'platform', null, rating, comment);
      return res.json({ success: true });
    }

    return res.status(400).json({ error: 'Invalid author role' });
  } catch (err) {
    console.error('Create review error:', err);
    res.status(500).json({ error: err.message || 'Failed to create review' });
  }
}

/**
 * GET /api/reviews/mine
 * Returns reviews written by the current user (req.role and req.userId from parseIdentity).
 */
async function getMine(req, res) {
  try {
    if (!req.role) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    const rows = await reviewModel.getReviewsByAuthor(req.role, req.userId);
    res.json(rows);
  } catch (err) {
    console.error('Get my reviews error:', err);
    res.status(500).json({ error: 'Failed to load reviews' });
  }
}

/**
 * GET /api/reviews/received
 * Requires x-educatoradmin-id.
 * Center reviews only: target_role = educatoradmin, author_role IN (student, educator).
 * Does NOT include platform reviews (educatoradmin → platform); those are platform-admin only.
 */
async function getReceived(req, res) {
  try {
    const educatorAdminId = Number(req.headers['x-educatoradmin-id']);
    if (isNaN(educatorAdminId) || educatorAdminId === 0) {
      return res.status(401).json({ error: 'x-educatoradmin-id is required' });
    }
    const forCenter = await reviewModel.getCenterReviewsForEducatorAdmin(educatorAdminId);
    res.json({ forCenter });
  } catch (err) {
    console.error('Get received reviews error:', err);
    res.status(500).json({ error: 'Failed to load reviews' });
  }
}

/**
 * GET /api/reviews/educator-targets
 * Returns list of educator admins this educator can review (linked via classes). Requires x-educator-id.
 */
async function getEducatorTargets(req, res) {
  try {
    const educatorId = Number(req.headers['x-educator-id']);
    if (isNaN(educatorId) || educatorId === 0) {
      return res.status(401).json({ error: 'x-educator-id is required' });
    }
    const rows = await reviewModel.getLinkedAdminsForEducator(educatorId);
    res.json(rows);
  } catch (err) {
    console.error('Get educator targets error:', err);
    res.status(500).json({ error: 'Failed to load targets' });
  }
}

module.exports = {
  create,
  getMine,
  getReceived,
  getEducatorTargets,
};
