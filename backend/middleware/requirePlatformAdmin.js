const platformAdminModel = require('../models/platformAdminModel');

/**
 * Require platform admin: req.role must be 'platformadmin' (set by parseIdentity) and userId must exist in platform_admins table.
 * Sets req.platformAdminId and req.platformAdmin (id, name, email) on success.
 * 401 if not platform admin or id not found in DB.
 */
async function requirePlatformAdmin(req, res, next) {
  try {
    if (req.role !== 'platformadmin') {
      return res.status(401).json({ error: 'Platform admin required' });
    }
    const userId = req.userId;
    if (userId == null || (typeof userId === 'number' && (isNaN(userId) || userId === 0))) {
      return res.status(401).json({ error: 'Platform admin required' });
    }
    const admin = await platformAdminModel.findById(userId);
    if (!admin) {
      return res.status(401).json({ error: 'Invalid platform admin' });
    }
    req.platformAdminId = userId;
    req.platformAdmin = admin;
    next();
  } catch (err) {
    console.error('requirePlatformAdmin error:', err);
    res.status(500).json({ error: 'Server error' });
  }
}

module.exports = { requirePlatformAdmin };
