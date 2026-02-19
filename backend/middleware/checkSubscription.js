const adminModel = require('../models/adminModel');

/**
 * Use on premium educator-admin routes only.
 * Requires req.role === 'educatoradmin' and req.userId.
 * If subscription_expires_at is set and in the past, returns 403.
 * Call after parseIdentity (and after any requireEducatorAdmin if you add one).
 */
async function checkSubscription(req, res, next) {
  if (req.role !== 'educatoradmin' || req.userId == null) {
    return next();
  }
  try {
    const admin = await adminModel.getAdminById(req.userId);
    if (!admin || !admin.subscription_expires_at) return next();
    const expires = new Date(admin.subscription_expires_at);
    if (expires.getTime() < Date.now()) {
      return res.status(403).json({ error: 'Subscription expired. Renew your plan to access this feature.' });
    }
    next();
  } catch (err) {
    console.error('checkSubscription error:', err);
    res.status(500).json({ error: 'Server error' });
  }
}

module.exports = { checkSubscription };
