const dashboardModel = require('../models/dashboardModel');

/**
 * GET /api/dashboard/educator/today
 * Identity: x-educator-id. Returns 401 if missing.
 * Response: active_students_today, challenges_completed_today, average_accuracy_today, students_needing_attention.
 */
async function getEducatorTodayStats(req, res) {
  try {
    const educatorId = Number(req.headers['x-educator-id']);
    if (educatorId == null || isNaN(educatorId)) {
      return res.status(401).json({ error: 'x-educator-id is required' });
    }
    const result = await dashboardModel.getEducatorTodayStats(educatorId);
    res.json(result);
  } catch (err) {
    console.error('getEducatorTodayStats error:', err);
    res.status(500).json({ error: err.message || 'Failed to load dashboard stats' });
  }
}

/**
 * GET /api/dashboard/educatoradmin/stats
 * Requires req.role === 'educatoradmin', uses req.userId.
 * Returns { totalClasses, totalEducators, totalStudents } for this educator admin.
 */
async function getEducatorAdminStats(req, res) {
  try {
    if (req.role !== 'educatoradmin' || req.userId == null) {
      return res.status(403).json({ error: 'Forbidden: educator admin required' });
    }
    const stats = await dashboardModel.getEducatorAdminStats(req.userId);
    res.json(stats);
  } catch (err) {
    console.error('getEducatorAdminStats error:', err);
    res.status(500).json({ error: err.message || 'Failed to load dashboard stats' });
  }
}

module.exports = {
  getEducatorTodayStats,
  getEducatorAdminStats,
};
