const bcrypt = require('bcrypt');
const platformAdminModel = require('../models/platformAdminModel');

/**
 * POST /api/platform-admin/login
 * Body: { email, password }
 * Uses bcrypt for password comparison. Returns { id, name, email } or 401.
 */
async function login(req, res) {
  try {
    const email = req.body && req.body.email != null ? String(req.body.email).trim() : '';
    const password = req.body && req.body.password != null ? String(req.body.password) : '';

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const admin = await platformAdminModel.findByEmail(email);
    if (!admin) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const valid = await bcrypt.compare(password, admin.password);
    if (!valid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    res.json({
      id: admin.id,
      name: admin.name,
      email: admin.email,
    });
  } catch (err) {
    console.error('Platform admin login error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

/**
 * GET /api/platform-admin/me
 * Requires x-platformadmin-id (middleware verifies and sets req.platformAdmin).
 */
async function me(req, res) {
  try {
    const admin = req.platformAdmin;
    if (!admin) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    res.json(admin);
  } catch (err) {
    console.error('Platform admin me error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

module.exports = { login, me };
