const bcrypt = require('bcrypt');
const educatorModel = require('../models/educatorModel');

/**
 * GET /api/educators
 * Role-safe: educatoradmin → created_by = req.userId; platformadmin → all; educator → own record only. Identity from parseIdentity only.
 */
async function getAll(req, res) {
  try {
    if (req.role === 'educatoradmin' && req.userId != null) {
      const educators = await educatorModel.getEducatorsByAdmin(req.userId);
      return res.json(educators);
    }
    if (req.role === 'platformadmin') {
      const rows = await educatorModel.getAllEducators();
      return res.json(rows);
    }
    if (req.role === 'educator' && req.userId != null) {
      const educator = await educatorModel.getEducatorById(req.userId);
      return res.json(educator ? [educator] : []);
    }
    return res.status(403).json({ error: 'Forbidden' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to load educators' });
  }
}

/**
 * GET /api/educators/admin/:adminId
 * Return educators for this admin (multi-tenant). Caller must be educatoradmin and req.userId === adminId.
 */
async function getByAdmin(req, res) {
  try {
    const adminId = Number(req.params.adminId);
    if (isNaN(adminId)) {
      return res.status(400).json({ error: 'Invalid admin id' });
    }
    if (req.role !== 'educatoradmin' || req.userId == null) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    if (Number(req.userId) !== adminId) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    const educators = await educatorModel.getEducatorsByAdmin(adminId);
    res.json(educators);
  } catch (err) {
    console.error('Get educators by admin error:', err);
    res.status(500).json({ error: 'Failed to fetch educators' });
  }
}

/**
 * POST /api/educators
 * Body: { name, email, password }. Password is hashed before saving.
 */
async function create(req, res) {
  try {
    const name = req.body.name != null ? String(req.body.name).trim() : '';
    const email = req.body.email != null ? String(req.body.email).trim() : '';
    const password = req.body.password != null ? String(req.body.password) : '';
    if (!name || !email || !password) {
      return res.status(400).json({ error: 'name, email, and password are required' });
    }
    const existing = await educatorModel.findByEmail(email);
    if (existing) {
      return res.status(400).json({ error: 'Email already in use' });
    }
    const passwordHash = await bcrypt.hash(password, 10);
    const createdBy = (req.role === 'educatoradmin' && req.userId != null) ? req.userId : null;
    const row = await educatorModel.createEducator(name, email, passwordHash, createdBy);
    res.status(201).json(row);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message || 'Failed to create educator' });
  }
}

/**
 * GET /api/educators/:id
 * Educator: requires x-educator-id === :id. EducatorAdmin: allowed if educator.created_by === req.userId (or legacy: educator in getEducatorsByAdmin).
 */
async function getById(req, res) {
  try {
    const id = Number(req.params.id);
    if (!id || isNaN(id)) {
      return res.status(400).json({ error: 'Invalid id' });
    }
    const educator = await educatorModel.getEducatorById(id);
    if (!educator) {
      return res.status(404).json({ error: 'Educator not found' });
    }
    if (req.role === 'educatoradmin' && req.userId != null) {
      const createdBy = educator.created_by != null ? Number(educator.created_by) : null;
      if (createdBy !== null && createdBy !== Number(req.userId)) {
        return res.status(403).json({ error: 'Forbidden' });
      }
      if (createdBy === null) {
        const adminEducators = await educatorModel.getEducatorsByAdmin(req.userId);
        const allowed = (adminEducators || []).some(function (e) { return Number(e.id) === id; });
        if (!allowed) return res.status(403).json({ error: 'Forbidden' });
      }
      return res.json(educator);
    }
    const educatorIdHeader = Number(req.headers['x-educator-id']);
    if (isNaN(educatorIdHeader) || educatorIdHeader !== id) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    res.json(educator);
  } catch (err) {
    console.error('Get educator by id error:', err);
    res.status(500).json({ error: 'Failed to load educator' });
  }
}

/**
 * PUT /api/educators/:id
 * Body: { name, email }. Educator: requires x-educator-id === :id. EducatorAdmin: allowed if educator.created_by === req.userId (or legacy).
 */
async function update(req, res) {
  try {
    const id = Number(req.params.id);
    if (!id || isNaN(id)) {
      return res.status(400).json({ error: 'Invalid id' });
    }
    const educator = await educatorModel.getEducatorById(id);
    if (!educator) {
      return res.status(404).json({ error: 'Educator not found' });
    }
    if (req.role === 'educatoradmin' && req.userId != null) {
      const createdBy = educator.created_by != null ? Number(educator.created_by) : null;
      if (createdBy !== null && createdBy !== Number(req.userId)) {
        return res.status(403).json({ error: 'Forbidden' });
      }
      if (createdBy === null) {
        const adminEducators = await educatorModel.getEducatorsByAdmin(req.userId);
        const allowed = (adminEducators || []).some(function (e) { return Number(e.id) === id; });
        if (!allowed) return res.status(403).json({ error: 'Forbidden' });
      }
    } else {
      const educatorIdHeader = Number(req.headers['x-educator-id']);
      if (isNaN(educatorIdHeader) || educatorIdHeader !== id) {
        return res.status(403).json({ error: 'Forbidden' });
      }
    }

    const name = req.body.name != null ? String(req.body.name).trim() : '';
    const email = req.body.email != null ? String(req.body.email).trim() : '';

    if (!name || !email) {
      return res.status(400).json({ error: 'Invalid data' });
    }

    const existingEmail = await educatorModel.findByEmail(email);
    if (existingEmail && Number(existingEmail.id) !== id) {
      return res.status(400).json({ error: 'Email already in use' });
    }

    const updated = await educatorModel.updateEducator(id, name, email);

    if (!updated) {
      return res.status(404).json({ error: 'Educator not found' });
    }

    res.json(updated);
  } catch (err) {
    console.error('Update educator error:', err);
    res.status(500).json({ error: 'Failed to update educator' });
  }
}

/**
 * POST /api/educators/:id/change-password
 * Body: { currentPassword, newPassword }. Requires x-educator-id === :id.
 */
async function changePassword(req, res) {
  try {
    const id = Number(req.params.id);
    const educatorIdHeader = Number(req.headers['x-educator-id']);
    if (!id || isNaN(id)) {
      return res.status(400).json({ error: 'Invalid id' });
    }
    if (isNaN(educatorIdHeader) || educatorIdHeader !== id) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const currentPassword = req.body.currentPassword != null ? String(req.body.currentPassword) : '';
    const newPassword = req.body.newPassword != null ? String(req.body.newPassword) : '';
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'currentPassword and newPassword are required' });
    }
    if (newPassword.length < 6) {
      return res.status(400).json({ error: 'New password must be at least 6 characters' });
    }

    const educator = await educatorModel.findById(id);
    if (!educator) {
      return res.status(404).json({ error: 'Educator not found' });
    }
    const valid = await bcrypt.compare(currentPassword, educator.password);
    if (!valid) {
      return res.status(401).json({ error: 'Current password is incorrect' });
    }
    const passwordHash = await bcrypt.hash(newPassword, 10);
    await educatorModel.updatePassword(id, passwordHash);
    res.json({ success: true });
  } catch (err) {
    console.error('Change password error:', err);
    res.status(500).json({ error: 'Failed to change password' });
  }
}

/**
 * DELETE /api/educators/:id
 * Returns { ok: true }.
 */
async function remove(req, res) {
  try {
    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ error: 'Invalid id' });

    await educatorModel.deleteEducator(id);

    res.json({ ok: true });
  } catch (err) {
    console.error('Delete educator error:', err);
    res.status(500).json({ error: 'Failed to delete educator' });
  }
}

/**
 * POST /api/educators/login
 * Body: { email, password }. Returns { id, name, email } or 401.
 */
async function login(req, res) {
  try {
    const email = req.body.email != null ? String(req.body.email).trim() : '';
    const password = req.body.password != null ? String(req.body.password) : '';

    if (!email || !password) {
      return res.status(400).json({ error: 'Missing credentials' });
    }

    const educator = await educatorModel.findByEmail(email);
    if (!educator) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const valid = await bcrypt.compare(password, educator.password);
    if (!valid) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    res.json({
      id: educator.id,
      name: educator.name,
      email: educator.email
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Login failed' });
  }
}

module.exports = { getAll, getById, getByAdmin, create, update, remove, login, changePassword };
