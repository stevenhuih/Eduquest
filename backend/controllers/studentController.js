const bcrypt = require('bcrypt');
const studentModel = require('../models/studentModel');
const studentProgressModel = require('../models/studentProgressModel');
const reportModel = require('../models/reportModel');
const accessControl = require('../utils/accessControl');

/**
 * POST /api/students
 * Body: { name, email, password, admin_id }
 */
async function create(req, res) {
  try {
    console.log('Create student body:', req.body);

    const name = req.body.name != null ? String(req.body.name).trim() : '';
    const email = req.body.email != null ? String(req.body.email).trim() : '';
    const password = req.body.password != null ? String(req.body.password) : '';
    const adminId = req.body.admin_id != null ? Number(req.body.admin_id) : NaN;

    if (!name || !email || !password) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    if (adminId === undefined || adminId === null || isNaN(adminId)) {
      return res.status(400).json({ error: 'admin_id is required and must be numeric' });
    }

    const existing = await studentModel.findByEmail(email);
    if (existing) {
      return res.status(400).json({ error: 'Email already exists' });
    }

    const hashed = await bcrypt.hash(password, 10);
    const student = await studentModel.createStudent(name, email, hashed, adminId);

    res.status(201).json(student);
  } catch (err) {
    console.error('Create student error:', err);
    if (err.code === '23505') {
      return res.status(409).json({ error: 'Duplicate record detected' });
    }
    res.status(500).json({ error: err.message || 'Failed to create student' });
  }
}

/**
 * GET /api/students?adminId=1
 * Return students belonging to this admin. adminId from query or req.userId (educatoradmin). If none, return [].
 */
async function getAll(req, res) {
  try {
    const queryAdminId = req.query.adminId != null ? Number(req.query.adminId) : NaN;
    const authAdminId = (req.role === 'educatoradmin' && req.userId != null) ? Number(req.userId) : NaN;
    const adminId = !isNaN(queryAdminId) ? queryAdminId : authAdminId;
    if (adminId == null || isNaN(adminId)) {
      return res.json([]);
    }
    const students = await studentModel.getAllStudents(adminId);
    res.json(students || []);
  } catch (err) {
    console.error('Get students error:', err);
    res.status(500).json({ error: 'Failed to fetch students' });
  }
}

/**
 * GET /api/students/admin/:adminId
 * Return students in this admin's classes (multi-tenant).
 */
async function getByAdmin(req, res) {
  try {
    const adminId = Number(req.params.adminId);
    if (isNaN(adminId)) {
      return res.status(400).json({ error: 'Invalid admin id' });
    }
    const students = await studentModel.getStudentsByAdmin(adminId);
    res.json(students);
  } catch (err) {
    console.error('Get students by admin error:', err);
    res.status(500).json({ error: 'Failed to fetch students' });
  }
}

/**
 * GET /api/students/:id
 * Access: Student (x-student-id === :id) or EducatorAdmin (can access this student).
 * Returns safe fields: id, name, email, created_at, coins, xp, center_name.
 */
async function getById(req, res) {
  try {
    const educatorAdminId = Number(req.headers['x-educatoradmin-id']);
    const studentIdHeader = Number(req.headers['x-student-id']);
    const id = Number(req.params.id);
    if (!id || isNaN(id)) {
      return res.status(400).json({ error: 'Invalid student id' });
    }
    if (!isNaN(educatorAdminId)) {
      const ok = await accessControl.canEducatorAdminAccessStudent(educatorAdminId, id);
      if (!ok) return res.status(403).json({ error: 'Forbidden' });
    } else if (!accessControl.canStudentAccessSelf(studentIdHeader, id)) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    const student = await studentModel.getStudentByIdWithCenter(id);
    if (!student) {
      return res.status(404).json({ error: 'Student not found' });
    }
    res.json({
      id: student.id,
      name: student.name,
      email: student.email,
      created_at: student.created_at,
      coins: student.coins != null ? parseInt(student.coins, 10) : 0,
      xp: student.xp != null ? parseInt(student.xp, 10) : 0,
      center_name: student.center_name || ''
    });
  } catch (err) {
    console.error('Get student by id error:', err);
    res.status(500).json({ error: 'Failed to fetch student' });
  }
}

/**
 * PUT /api/students/:id
 * Body: { name, email }
 * Access: Student (x-student-id === :id) or EducatorAdmin (can access this student).
 */
async function update(req, res) {
  try {
    const educatorAdminId = Number(req.headers['x-educatoradmin-id']);
    const studentIdHeader = Number(req.headers['x-student-id']);
    const id = Number(req.params.id);
    const name = req.body.name != null ? String(req.body.name).trim() : '';
    const email = req.body.email != null ? String(req.body.email).trim() : '';

    if (!id || isNaN(id)) {
      return res.status(400).json({ error: 'Invalid student id' });
    }
    if (!isNaN(educatorAdminId)) {
      const ok = await accessControl.canEducatorAdminAccessStudent(educatorAdminId, id);
      if (!ok) return res.status(403).json({ error: 'Forbidden' });
    } else if (!accessControl.canStudentAccessSelf(studentIdHeader, id)) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    if (!name || !email) {
      return res.status(400).json({ error: 'Invalid data' });
    }

    const existing = await studentModel.findByEmail(email);
    if (existing && Number(existing.id) !== id) {
      return res.status(400).json({ error: 'Email already in use' });
    }

    const student = await studentModel.updateStudent(id, name, email);

    if (!student) {
      return res.status(404).json({ error: 'Student not found' });
    }

    res.json(student);
  } catch (err) {
    console.error('Update student error:', err);
    res.status(500).json({ error: 'Failed to update student' });
  }
}

/**
 * POST /api/students/:id/change-password
 * Body: { currentPassword, newPassword }
 * Requires x-student-id header; only the logged-in student can change their own password.
 */
async function changePassword(req, res) {
  try {
    const studentIdHeader = req.headers['x-student-id'];
    const id = Number(req.params.id);
    const currentPassword = req.body.currentPassword != null ? String(req.body.currentPassword) : '';
    const newPassword = req.body.newPassword != null ? String(req.body.newPassword) : '';

    if (!id || isNaN(id)) {
      return res.status(400).json({ error: 'Invalid student id' });
    }
    if (!accessControl.canStudentAccessSelf(Number(studentIdHeader), id)) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'currentPassword and newPassword are required' });
    }
    if (newPassword.length < 6) {
      return res.status(400).json({ error: 'New password must be at least 6 characters' });
    }

    const student = await studentModel.findStudentById(id);
    if (!student) {
      return res.status(404).json({ error: 'Student not found' });
    }

    const match = await bcrypt.compare(currentPassword, student.password);
    if (!match) {
      return res.status(400).json({ error: 'Current password is incorrect' });
    }

    const hashed = await bcrypt.hash(newPassword, 10);
    await studentModel.updateStudentPassword(id, hashed);

    res.json({ success: true });
  } catch (err) {
    console.error('Student change password error:', err);
    res.status(500).json({ error: 'Failed to change password' });
  }
}

/**
 * DELETE /api/students/:id
 */
async function remove(req, res) {
  try {
    const id = Number(req.params.id);
    const result = await studentModel.deleteStudent(id);

    if (!result) {
      return res.status(404).json({ error: 'Student not found' });
    }

    res.json({ ok: true });
  } catch (err) {
    console.error('Delete student error:', err);
    res.status(500).json({ error: 'Failed to delete student' });
  }
}

/**
 * POST /api/students/login
 * Body: { email, password }
 */
async function login(req, res) {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Missing credentials' });
    }

    const student = await studentModel.findStudentByEmail(email);

    if (!student) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const match = await bcrypt.compare(password, student.password);

    if (!match) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    res.json({
      id: student.id,
      name: student.name,
      email: student.email,
      admin_id: student.admin_id
    });
  } catch (err) {
    console.error('Student login error:', err);
    res.status(500).json({ error: 'Login failed' });
  }
}

/**
 * GET /api/students/:id/xp
 * Access: EducatorAdmin, Educator, or Student (x-student-id === params.id).
 */
async function getStudentXP(req, res) {
  try {
    const educatorAdminId = Number(req.headers['x-educatoradmin-id']);
    const educatorId = Number(req.headers['x-educator-id']);
    const studentIdHeader = Number(req.headers['x-student-id']);
    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ error: 'Invalid student id' });
    if (!isNaN(educatorAdminId)) {
      const ok = await accessControl.canEducatorAdminAccessStudent(educatorAdminId, id);
      if (!ok) return res.status(403).json({ error: 'Forbidden' });
    } else if (!isNaN(educatorId)) {
      const ok = await accessControl.canEducatorAccessStudent(educatorId, id);
      if (!ok) return res.status(403).json({ error: 'Forbidden' });
    } else if (accessControl.canStudentAccessSelf(studentIdHeader, id)) {
      // student reading own data
    } else {
      return res.status(403).json({ error: 'Forbidden' });
    }
    const xp = await studentModel.getStudentXP(id);
    res.json({ xp });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to load XP' });
  }
}

/**
 * GET /api/students/:id/xp/:classId
 * Access: EducatorAdmin, Educator, or Student (x-student-id === params.id).
 */
async function getStudentXPByClass(req, res) {
  try {
    const educatorAdminId = Number(req.headers['x-educatoradmin-id']);
    const educatorId = Number(req.headers['x-educator-id']);
    const studentIdHeader = Number(req.headers['x-student-id']);
    const id = Number(req.params.id);
    const classId = Number(req.params.classId);
    if (!id || !classId) return res.status(400).json({ error: 'Invalid student id or class id' });
    if (!isNaN(educatorAdminId)) {
      const ok = await accessControl.canEducatorAdminAccessStudent(educatorAdminId, id);
      if (!ok) return res.status(403).json({ error: 'Forbidden' });
    } else if (!isNaN(educatorId)) {
      const ok = await accessControl.canEducatorAccessStudent(educatorId, id);
      if (!ok) return res.status(403).json({ error: 'Forbidden' });
    } else if (accessControl.canStudentAccessSelf(studentIdHeader, id)) {
      // student reading own data
    } else {
      return res.status(403).json({ error: 'Forbidden' });
    }
    const xp = await studentModel.getStudentXPForClass(id, classId);
    const level = await studentProgressModel.getLevel(id, classId);
    res.json({ xp, level });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to load XP' });
  }
}

/**
 * GET /api/students/:id/coins
 * Access: EducatorAdmin, Educator, or Student (x-student-id === params.id).
 */
async function getStudentCoins(req, res) {
  try {
    const educatorAdminId = Number(req.headers['x-educatoradmin-id']);
    const educatorId = Number(req.headers['x-educator-id']);
    const studentIdHeader = Number(req.headers['x-student-id']);
    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ error: 'Invalid student id' });
    if (!isNaN(educatorAdminId)) {
      const ok = await accessControl.canEducatorAdminAccessStudent(educatorAdminId, id);
      if (!ok) return res.status(403).json({ error: 'Forbidden' });
    } else if (!isNaN(educatorId)) {
      const ok = await accessControl.canEducatorAccessStudent(educatorId, id);
      if (!ok) return res.status(403).json({ error: 'Forbidden' });
    } else if (accessControl.canStudentAccessSelf(studentIdHeader, id)) {
      // student reading own data
    } else {
      return res.status(403).json({ error: 'Forbidden' });
    }
    const coins = await studentModel.getCoins(id);
    res.json({ coins });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to load coins' });
  }
}

/**
 * GET /api/students/:id/cards
 * Access: EducatorAdmin, Educator, or Student (x-student-id === params.id).
 */
async function getStudentCards(req, res) {
  try {
    const educatorAdminId = Number(req.headers['x-educatoradmin-id']);
    const educatorId = Number(req.headers['x-educator-id']);
    const studentIdHeader = Number(req.headers['x-student-id']);
    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ error: 'Invalid student id' });
    if (!isNaN(educatorAdminId)) {
      const ok = await accessControl.canEducatorAdminAccessStudent(educatorAdminId, id);
      if (!ok) return res.status(403).json({ error: 'Forbidden' });
    } else if (!isNaN(educatorId)) {
      const ok = await accessControl.canEducatorAccessStudent(educatorId, id);
      if (!ok) return res.status(403).json({ error: 'Forbidden' });
    } else if (accessControl.canStudentAccessSelf(studentIdHeader, id)) {
      // student reading own data
    } else {
      return res.status(403).json({ error: 'Forbidden' });
    }
    const cardModel = require('../models/cardModel');
    const cards = await cardModel.getStudentCards(id);
    res.json(cards);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to load cards' });
  }
}

/**
 * GET /api/students/:studentId/reports
 * Returns report list for student inbox. Access: student (own) or educator/educator admin (if can access student).
 */
async function getStudentReports(req, res) {
  try {
    const educatorAdminId = Number(req.headers['x-educatoradmin-id']);
    const educatorId = Number(req.headers['x-educator-id']);
    const studentIdHeader = Number(req.headers['x-student-id']);
    const studentId = Number(req.params.id);
    if (!studentId || isNaN(studentId)) {
      return res.status(400).json({ error: 'Invalid student id' });
    }
    if (!isNaN(educatorAdminId)) {
      const ok = await accessControl.canEducatorAdminAccessStudent(educatorAdminId, studentId);
      if (!ok) return res.status(403).json({ error: 'Forbidden' });
    } else if (!isNaN(educatorId)) {
      const ok = await accessControl.canEducatorAccessStudent(educatorId, studentId);
      if (!ok) return res.status(403).json({ error: 'Forbidden' });
    } else if (!accessControl.canStudentAccessSelf(studentIdHeader, studentId)) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    const reports = await reportModel.getReportsByStudentId(studentId);
    res.json(reports);
  } catch (err) {
    console.error('Get student reports error:', err);
    res.status(500).json({ error: 'Failed to load reports' });
  }
}

module.exports = { create, getAll, getByAdmin, getById, update, changePassword, remove, login, getStudentXP, getStudentXPByClass, getStudentCoins, getStudentCards, getStudentReports };
