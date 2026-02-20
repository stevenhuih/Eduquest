const adminModel = require('../models/adminModel');

/**
 * GET /api/platform-admin/educator-admins
 * List all educator admins (platform admin only). Returns same shape as GET /api/admins including status, subscription_plan, subscription_expires_at.
 */
async function list(req, res) {
  try {
    const admins = await adminModel.getAllAdmins();
    res.json(admins);
  } catch (err) {
    console.error('Platform admin list educator admins error:', err);
    res.status(500).json({ error: err.message || 'Failed to load educator admins' });
  }
}

/**
 * PATCH /api/platform-admin/educator-admins/:id/status
 * Body: { status: "suspended" | "active" }
 * Requires requirePlatformAdmin. Returns updated educator admin row.
 */
async function updateStatus(req, res) {
  try {
    const id = Number(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: 'Invalid educator admin id' });
    const status = req.body && req.body.status != null ? String(req.body.status).trim() : '';
    if (!status) return res.status(400).json({ error: 'status is required' });

    const updated = await adminModel.updateStatus(id, status);
    if (!updated) return res.status(404).json({ error: 'Educator admin not found' });
    res.json(updated);
  } catch (err) {
    if (err.message && err.message.startsWith('Invalid status')) {
      return res.status(400).json({ error: err.message });
    }
    console.error('Platform admin update status error:', err);
    res.status(500).json({ error: err.message || 'Failed to update status' });
  }
}

/**
 * PATCH /api/platform-admin/educator-admins/:id/subscription
 * Body: { subscription_plan: "basic"|"pro", subscription_expires_at?: "2026-12-31" }
 * Requires requirePlatformAdmin. Returns updated educator admin row.
 */
async function updateSubscription(req, res) {
  try {
    const id = Number(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: 'Invalid educator admin id' });
    const plan = req.body && req.body.subscription_plan != null ? String(req.body.subscription_plan).trim() : '';
    if (!plan) return res.status(400).json({ error: 'subscription_plan is required' });

    const rawExpires = req.body && req.body.subscription_expires_at;
    const expiresAt = rawExpires === '' || rawExpires == null ? null : (new Date(rawExpires)).toISOString();

    const updated = await adminModel.updateSubscription(id, plan, expiresAt);
    if (!updated) return res.status(404).json({ error: 'Educator admin not found' });
    res.json(updated);
  } catch (err) {
    if (err.message && err.message.startsWith('Invalid subscription_plan')) {
      return res.status(400).json({ error: err.message });
    }
    console.error('Platform admin update subscription error:', err);
    res.status(500).json({ error: err.message || 'Failed to update subscription' });
  }
}

module.exports = { list, updateStatus, updateSubscription };
