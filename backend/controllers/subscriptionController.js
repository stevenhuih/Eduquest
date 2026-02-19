const subscriptionModel = require('../models/subscriptionModel');
const adminModel = require('../models/adminModel');

/**
 * GET /api/subscription/:adminId
 * Returns subscription (plan, class_limit) and class_count for usage display.
 */
async function getByAdmin(req, res) {
  try {
    const adminId = Number(req.params.adminId);
    if (!adminId) {
      return res.status(400).json({ error: 'Invalid admin id' });
    }
    let sub = await subscriptionModel.getSubscriptionByAdmin(adminId);
    if (!sub) {
      sub = await subscriptionModel.createSubscription(adminId, 'basic');
    }
    const classCount = await adminModel.getClassCountForAdmin(adminId);
    res.json({
      id: sub.id,
      educator_admin_id: sub.educator_admin_id,
      plan: sub.plan,
      class_limit: sub.class_limit,
      created_at: sub.created_at,
      class_count: classCount
    });
  } catch (err) {
    console.error('Get subscription error:', err);
    res.status(500).json({ error: 'Failed to load subscription' });
  }
}

/**
 * POST /api/subscription/upgrade
 * Body: { adminId, plan }. Returns updated subscription.
 */
async function upgrade(req, res) {
  try {
    const adminId = req.body.adminId != null ? Number(req.body.adminId) : null;
    const plan = req.body.plan != null ? String(req.body.plan).trim().toLowerCase() : 'basic';
    if (!adminId) {
      return res.status(400).json({ error: 'adminId is required' });
    }
    const updated = await subscriptionModel.updatePlan(adminId, plan);
    const classCount = await adminModel.getClassCountForAdmin(adminId);
    res.json({
      id: updated.id,
      educator_admin_id: updated.educator_admin_id,
      plan: updated.plan,
      class_limit: updated.class_limit,
      created_at: updated.created_at,
      class_count: classCount
    });
  } catch (err) {
    console.error('Upgrade subscription error:', err);
    res.status(500).json({ error: 'Failed to update plan' });
  }
}

module.exports = { getByAdmin, upgrade };
