const adminModel = require('../models/adminModel');

/**
 * Centralized identity parsing. Reads role headers and ensures at most one identity per request.
 * Sets req.role and req.userId for downstream middleware/controllers.
 * For educatoradmin identity, fetches the row and returns 403 if status === 'suspended'.
 */
function parseIdentity(req, res, next) {
  const studentId = req.headers['x-student-id'];
  const educatorId = req.headers['x-educator-id'];
  const educatorAdminId = req.headers['x-educatoradmin-id'];
  const platformAdminId = req.headers['x-platformadmin-id'];

  const identities = [
    studentId && { role: 'student', id: studentId },
    educatorId && { role: 'educator', id: educatorId },
    educatorAdminId && { role: 'educatoradmin', id: educatorAdminId },
    platformAdminId && { role: 'platformadmin', id: platformAdminId }
  ].filter(Boolean);

  if (identities.length > 1) {
    return res.status(401).json({ error: 'Multiple identities detected' });
  }

  if (identities.length === 1) {
    req.role = identities[0].role;
    req.userId = Number(identities[0].id);
  } else {
    req.role = null;
    req.userId = null;
  }

  if (req.role === 'educatoradmin' && req.userId != null) {
    return adminModel.getAdminById(req.userId).then(function (admin) {
      if (!admin) return next();
      const status = (admin.status || 'active').toLowerCase();
      if (status === 'suspended') {
        return res.status(403).json({ error: 'Account suspended by platform admin' });
      }
      next();
    }).catch(function (err) {
      console.error('parseIdentity educator admin check error:', err);
      res.status(500).json({ error: 'Server error' });
    });
  }

  next();
}

module.exports = parseIdentity;
