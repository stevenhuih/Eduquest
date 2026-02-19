const bcrypt = require('bcrypt');
const adminModel = require('../models/adminModel');
const subscriptionModel = require('../models/subscriptionModel');

/**
 * POST /api/admins/signup
 * Body: { center_name, admin_name, email, password, plan }
 */
async function create(req, res) {
  try {
    const center_name = req.body.center_name != null ? String(req.body.center_name).trim() : '';
    const admin_name = req.body.admin_name != null ? String(req.body.admin_name).trim() : '';
    const email = req.body.email != null ? String(req.body.email).trim() : '';
    const password = req.body.password != null ? String(req.body.password) : '';
    const plan = req.body.plan != null ? String(req.body.plan).trim().toLowerCase() : 'basic';

    if (!center_name || !admin_name || !email || !password) {
      return res.status(400).json({ error: 'center_name, admin_name, email, and password are required' });
    }

    const existing = await adminModel.findAdminByEmail(email);
    if (existing) {
      return res.status(400).json({ error: 'Email already in use' });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const row = await adminModel.createAdmin(center_name, admin_name, email, passwordHash, plan);
    await subscriptionModel.createSubscription(row.id, plan);

    res.status(201).json({
      id: row.id,
      center_name: row.center_name,
      email: row.email,
      plan: row.plan
    });
  } catch (err) {
    console.error('Admin signup error:', err);
    res.status(500).json({ error: err.message || 'Signup failed' });
  }
}

/**
 * POST /api/admins/login
 * Body: { email, password }
 */
async function login(req, res) {
  try {
    const email = req.body.email != null ? String(req.body.email).trim() : '';
    const password = req.body.password != null ? String(req.body.password) : '';

    if (!email || !password) {
      return res.status(400).json({ error: 'Missing credentials' });
    }

    const admin = await adminModel.findAdminByEmail(email);
    if (!admin) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const match = await bcrypt.compare(password, admin.password);
    if (!match) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const status = (admin.status || 'active').toLowerCase();
    if (status === 'suspended') {
      return res.status(403).json({ error: 'Account suspended by platform admin' });
    }

    res.json({
      id: admin.id,
      center_name: admin.center_name,
      email: admin.email,
      plan: admin.plan
    });
  } catch (err) {
    console.error('Admin login error:', err);
    res.status(500).json({ error: 'Login failed' });
  }
}

/**
 * GET /api/admins
 * Return all educator admins (id, admin_name, email, center_name, plan, created_at), sorted by created_at DESC.
 */
async function getAllAdmins(req, res) {
  try {
    const admins = await adminModel.getAllAdmins();
    res.json(admins);
  } catch (err) {
    console.error('Get all admins error:', err);
    res.status(500).json({ error: err.message || 'Failed to load admins' });
  }
}

/**
 * GET /api/admins/:id
 * Get admin profile (no password).
 */
async function getProfile(req, res) {
  try {
    const id = Number(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: 'Invalid admin id' });
    const admin = await adminModel.getAdminById(id);
    if (!admin) return res.status(404).json({ error: 'Admin not found' });
    res.json(admin);
  } catch (err) {
    console.error('Get profile error:', err);
    res.status(500).json({ error: 'Failed to load profile' });
  }
}

/**
 * PUT /api/admins/:id
 * Update profile: center_name, admin_name, email.
 */
async function updateProfile(req, res) {
  try {
    const id = Number(req.params.id);
    const center_name = req.body.center_name != null ? String(req.body.center_name).trim() : '';
    const admin_name = req.body.admin_name != null ? String(req.body.admin_name).trim() : '';
    const email = req.body.email != null ? String(req.body.email).trim() : '';
    if (!center_name || !admin_name || !email) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    const updated = await adminModel.updateAdminProfile(id, center_name, admin_name, email);
    if (!updated) return res.status(404).json({ error: 'Admin not found' });
    res.json(updated);
  } catch (err) {
    console.error('Update profile error:', err);
    res.status(500).json({ error: 'Failed to update profile' });
  }
}

/**
 * POST /api/admins/:id/change-password
 * Body: { email, currentPassword, newPassword }.
 */
async function changePassword(req, res) {
  try {
    const id = Number(req.params.id);
    const currentPassword = req.body.currentPassword;
    const newPassword = req.body.newPassword;
    const email = req.body.email != null ? String(req.body.email).trim() : '';
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'Missing password fields' });
    }
    const admin = await adminModel.findAdminByEmail(email);
    if (!admin) return res.status(404).json({ error: 'Admin not found' });
    if (Number(admin.id) !== Number(id)) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    const ok = await bcrypt.compare(currentPassword, admin.password);
    if (!ok) return res.status(401).json({ error: 'Incorrect current password' });
    const hash = await bcrypt.hash(newPassword, 10);
    await adminModel.updateAdminPassword(id, hash);
    res.json({ ok: true });
  } catch (err) {
    console.error('Change password error:', err);
    res.status(500).json({ error: 'Password change failed' });
  }
}

module.exports = { create, login, getAllAdmins, getProfile, updateProfile, changePassword };
