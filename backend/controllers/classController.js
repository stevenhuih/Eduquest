const classModel = require('../models/classModel');
const attemptModel = require('../models/attemptModel');
const adminModel = require('../models/adminModel');
const studentModel = require('../models/studentModel');
const accessControl = require('../utils/accessControl');

/**
 * POST /api/classes
 * Body: { name, description, educator_id }
 * When req.role === 'educatoradmin', created_by is set from req.userId only (body not trusted).
 * Class limit: basic = 5, pro = unlimited. Plan from educator_admins table only.
 */
async function createClass(req, res) {
  try {
    const name = req.body.name && String(req.body.name).trim();
    const description = req.body.description != null ? String(req.body.description).trim() : null;
    let createdBy = null;
    if (req.role === 'educatoradmin' && req.userId != null) {
      createdBy = req.userId;
    } else if (req.body.created_by != null) {
      return res.status(403).json({ error: 'Forbidden: educator admin required to create classes' });
    }
    const educatorId = req.body.educator_id != null ? Number(req.body.educator_id) : null;
    if (!name) {
      return res.status(400).json({ error: 'name is required' });
    }
    if (createdBy != null) {
      const admin = await adminModel.getAdminById(createdBy);
      const plan = (admin && admin.plan) ? String(admin.plan).toLowerCase().trim() : 'basic';
      if (plan !== 'pro') {
        const classCount = await adminModel.getClassCountForAdmin(createdBy);
        if (classCount >= 5) {
          return res.status(403).json({
            error: 'Class limit reached for Basic Plan (5 classes max). Upgrade to Pro.'
          });
        }
      }
    }
    const row = await classModel.createClass(name, createdBy, educatorId, description);
    res.status(201).json(row);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create class' });
  }
}

/**
 * GET /api/classes
 * Global list disabled. Use GET /api/classes/admin/:adminId or GET /api/classes/educator/:educatorId with headers.
 */
async function getAllClasses(req, res) {
  res.status(403).json({ error: 'Use scoped endpoints: /api/classes/admin/:adminId or /api/classes/educator/:educatorId with x-educatoradmin-id or x-educator-id header' });
}

/**
 * GET /api/classes/educatoradmin
 * Returns classes created by the current educator admin (req.userId). Requires role = educatoradmin.
 */
async function getClassesForEducatorAdmin(req, res) {
  try {
    if (req.role !== 'educatoradmin' || req.userId == null) {
      return res.status(403).json({ error: 'Forbidden: educator admin required' });
    }
    const classes = await classModel.getClassesByAdminForDashboard(req.userId);
    console.log('GET /api/classes/educatoradmin req.userId:', req.userId, 'classes returned:', classes.length, classes);
    res.json(classes);
  } catch (err) {
    console.error('Get classes for educator admin error:', err);
    res.status(500).json({ error: 'Failed to fetch classes' });
  }
}

/**
 * GET /api/classes/educatoradmin-with-students
 * Returns classes created by this educator admin (req.userId) with .students on each.
 * Only educatoradmin allowed; uses req.role and req.userId from parseIdentity.
 */
async function getEducatorAdminClassesWithStudents(req, res) {
  try {
    if (req.role !== 'educatoradmin' || req.userId == null) {
      return res.status(403).json({ error: 'Forbidden: educator admin required' });
    }
    const rows = await classModel.getClassesWithStudentsByAdmin(req.userId);
    res.json(rows);
  } catch (err) {
    console.error('Get educator admin classes with students error:', err);
    res.status(500).json({ error: 'Failed to fetch classes' });
  }
}

/**
 * GET /api/classes/admin/:adminId
 * Returns classes created by this admin. Caller must be that admin (x-educatoradmin-id).
 */
async function getClassesByAdmin(req, res) {
  try {
    const educatorAdminId = Number(req.headers['x-educatoradmin-id']);
    const adminId = Number(req.params.adminId);
    if (isNaN(adminId)) {
      return res.status(400).json({ error: 'Invalid admin id' });
    }
    if (isNaN(educatorAdminId) || educatorAdminId !== adminId) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    const classes = await classModel.getClassesByAdmin(adminId);
    res.json(classes);
  } catch (err) {
    console.error('Get classes by admin error:', err);
    res.status(500).json({ error: 'Failed to fetch classes' });
  }
}

/**
 * GET /api/classes/admin/:adminId/with-students
 * Returns admin's classes each with .students array. Caller must be that admin (x-educatoradmin-id).
 */
async function getClassesWithStudentsByAdmin(req, res) {
  try {
    const educatorAdminId = Number(req.headers['x-educatoradmin-id']);
    const adminId = Number(req.params.adminId);
    if (isNaN(adminId)) {
      return res.status(400).json({ error: 'Invalid admin id' });
    }
    if (isNaN(educatorAdminId) || educatorAdminId !== adminId) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    const rows = await classModel.getClassesWithStudentsByAdmin(adminId);
    res.json(rows);
  } catch (err) {
    console.error('Get classes with students by admin error:', err);
    res.status(500).json({ error: 'Failed to fetch classes' });
  }
}

/**
 * GET /api/classes/with-students
 * Global list disabled. Use scoped endpoints with headers.
 */
async function getClassesWithStudents(req, res) {
  res.status(403).json({ error: 'Use scoped endpoints with x-educatoradmin-id or x-educator-id header' });
}

/**
 * GET /api/classes/educator/assigned — dashboard: assigned classes with stats.
 * Identity from x-educator-id header only.
 */
async function getAssignedClassesForDashboard(req, res) {
  try {
    const educatorId = Number(req.headers['x-educator-id']);
    if (educatorId == null || isNaN(educatorId)) {
      return res.status(401).json({ error: 'x-educator-id is required' });
    }
    const classes = await classModel.getAssignedClassesWithStats(educatorId);
    res.json(classes);
  } catch (err) {
    console.error('Get assigned classes for dashboard error:', err);
    res.status(500).json({ error: 'Failed to load classes' });
  }
}

/**
 * GET /api/classes/educator/:educatorId/assigned (classes assigned to this educator). Caller must be that educator (x-educator-id).
 */
async function getClassesForEducator(req, res) {
  try {
    const headerEducatorId = Number(req.headers['x-educator-id']);
    const educatorId = Number(req.params.educatorId);
    if (isNaN(educatorId)) {
      return res.status(400).json({ error: 'Invalid educator id' });
    }
    if (isNaN(headerEducatorId) || headerEducatorId !== educatorId) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    const classes = await classModel.getAssignedClassesWithStats(educatorId);
    res.json(classes);
  } catch (err) {
    console.error('Get classes for educator error:', err);
    res.status(500).json({ error: 'Failed to load classes' });
  }
}

/**
 * GET /api/classes/educator/:educatorId/assigned-with-weak-topic — same as assigned but each class includes weakest_topic and weakest_accuracy.
 */
async function getClassesForEducatorWithWeakTopic(req, res) {
  const educatorId = Number(req.params.educatorId);

  if (isNaN(educatorId)) {
    return res.status(400).json({ error: 'Invalid educator id' });
  }

  const headerId = Number(req.headers['x-educator-id']);
  if (headerId !== educatorId) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  try {
    const classes = await classModel.getAssignedClassesWithStats(educatorId);

    const enriched = [];

    for (const c of classes) {
      const performance = await attemptModel.getClassTopicPerformance(c.id);

      let weakestTopic = null;
      let weakestAccuracy = null;

      if (performance && performance.length > 0) {
        weakestTopic = performance[0].topic_name || performance[0].topic;
        weakestAccuracy = performance[0].accuracy;
      }

      enriched.push({
        ...c,
        weakest_topic: weakestTopic,
        weakest_accuracy: weakestAccuracy
      });
    }

    res.json(enriched);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to load classes with performance' });
  }
}

/**
 * GET /api/classes/educator/:educatorId (legacy: classes created by educator). Caller must match x-educator-id.
 */
async function getClassesByEducator(req, res) {
  try {
    const headerEducatorId = Number(req.headers['x-educator-id']);
    const educatorId = Number(req.params.educatorId);
    if (isNaN(educatorId)) {
      return res.status(400).json({ error: 'Invalid educator id' });
    }
    if (isNaN(headerEducatorId) || headerEducatorId !== educatorId) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    const rows = await classModel.getClassesByEducator(educatorId);
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to load classes' });
  }
}

/**
 * GET /api/classes/student/:studentId
 */
async function getClassesForStudent(req, res) {
  try {
    const studentId = Number(req.params.studentId);
    if (!studentId) {
      return res.status(400).json({ error: 'Invalid student id' });
    }
    const rows = await classModel.getClassesForStudent(studentId);
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to load classes' });
  }
}

/**
 * GET /api/classes/:classId/student-analytics
 */
async function getStudentAnalytics(req, res) {
  try {
    const educatorAdminId = Number(req.headers['x-educatoradmin-id']);
    const educatorId = Number(req.headers['x-educator-id']);
    const classId = Number(req.params.classId);
    if (isNaN(classId)) {
      return res.status(400).json({ error: 'Invalid class id' });
    }
    if (!isNaN(educatorAdminId)) {
      const ok = await accessControl.canEducatorAdminAccessClass(educatorAdminId, classId);
      if (!ok) return res.status(403).json({ error: 'Forbidden' });
    } else if (!isNaN(educatorId)) {
      const ok = await accessControl.canEducatorAccessClass(educatorId, classId);
      if (!ok) return res.status(403).json({ error: 'Forbidden' });
    } else {
      return res.status(403).json({ error: 'Forbidden' });
    }
    const rows = await classModel.getStudentAnalyticsByClass(classId);
    res.json(rows);
  } catch (err) {
    console.error('Get student analytics error:', err);
    res.status(500).json({ error: 'Failed to load student analytics' });
  }
}

/**
 * GET /api/classes/:classId/overview
 * Access: EducatorAdmin (class owner) or Educator (assigned to class). Identity from headers only.
 */
async function getClassOverview(req, res) {
  try {
    const educatorAdminId = Number(req.headers['x-educatoradmin-id']);
    const educatorId = Number(req.headers['x-educator-id']);
    const classId = Number(req.params.classId);
    if (isNaN(classId)) {
      return res.status(400).json({ error: 'Invalid class id' });
    }
    if (!isNaN(educatorAdminId)) {
      const ok = await accessControl.canEducatorAdminAccessClass(educatorAdminId, classId);
      if (!ok) return res.status(403).json({ error: 'Forbidden' });
    } else if (!isNaN(educatorId)) {
      const ok = await accessControl.canEducatorAccessClass(educatorId, classId);
      if (!ok) return res.status(403).json({ error: 'Forbidden' });
    } else {
      return res.status(403).json({ error: 'Forbidden' });
    }
    const data = await classModel.getClassOverview(classId);
    res.json(data);
  } catch (err) {
    console.error('Get class overview error:', err);
    res.status(500).json({ error: 'Failed to load class overview' });
  }
}

/**
 * GET /api/classes/:classId
 * Access: EducatorAdmin (class owner), Educator (assigned to class), or Student (enrolled in class). Identity from headers.
 * Returns class with educator_name and student_count.
 */
async function getClassById(req, res) {
  try {
    const educatorAdminId = Number(req.headers['x-educatoradmin-id']);
    const educatorId = Number(req.headers['x-educator-id']);
    const studentId = req.role === 'student' && req.userId != null ? Number(req.userId) : null;
    const classId = Number(req.params.classId);
    if (isNaN(classId)) {
      return res.status(400).json({ error: 'Invalid class id' });
    }
    if (!isNaN(educatorAdminId)) {
      const ok = await accessControl.canEducatorAdminAccessClass(educatorAdminId, classId);
      if (!ok) return res.status(403).json({ error: 'Forbidden' });
    } else if (!isNaN(educatorId)) {
      const ok = await accessControl.canEducatorAccessClass(educatorId, classId);
      if (!ok) return res.status(403).json({ error: 'Forbidden' });
    } else if (studentId != null) {
      const inClass = await accessControl.isStudentInClass(studentId, classId);
      if (!inClass) return res.status(403).json({ error: 'Forbidden' });
    } else {
      return res.status(403).json({ error: 'Forbidden' });
    }
    const cls = await classModel.getClassByIdWithDetails(classId);
    if (!cls) {
      return res.status(404).json({ error: 'Class not found' });
    }
    res.json(cls);
  } catch (err) {
    console.error('Get class by id error:', err);
    res.status(500).json({ error: 'Failed to load class' });
  }
}

/**
 * POST /api/classes/:classId/students
 * Body: { student_id }
 * Prevents cross-center: student must belong to same admin as class.
 */
async function assignStudent(req, res) {
  try {
    const classId = Number(req.params.classId);
    const studentId = req.body.student_id != null ? Number(req.body.student_id) : null;
    if (!classId) {
      return res.status(400).json({ error: 'Invalid class id' });
    }
    if (!studentId) {
      return res.status(400).json({ error: 'student_id is required' });
    }
    const cls = await classModel.getClassById(classId);
    const studentAdminId = await studentModel.getStudentAdminId(studentId);
    if (!cls || studentAdminId == null) {
      return res.status(404).json({ error: 'Class or student not found' });
    }
    const classAdminId = cls.created_by != null ? Number(cls.created_by) : null;
    if (classAdminId !== studentAdminId) {
      return res.status(400).json({ error: 'Student belongs to a different tuition center' });
    }
    await classModel.assignStudentToClass(classId, studentId);
    res.status(201).json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to assign student to class' });
  }
}

/**
 * POST /api/classes/assign-student
 * Body: { studentId, classIds (array) }
 * Only assigns to classes whose created_by matches student's admin_id.
 */
async function assignStudentToClasses(req, res) {
  try {
    const studentId = req.body.studentId != null ? Number(req.body.studentId) : null;
    const classIds = Array.isArray(req.body.classIds) ? req.body.classIds.map(Number).filter(function (n) { return !isNaN(n); }) : [];
    if (!studentId) {
      return res.status(400).json({ error: 'studentId is required' });
    }
    const studentAdminId = await studentModel.getStudentAdminId(studentId);
    if (studentAdminId == null) {
      return res.status(404).json({ error: 'Student not found' });
    }
    for (let i = 0; i < classIds.length; i++) {
      const cls = await classModel.getClassById(classIds[i]);
      if (!cls) continue;
      const classAdminId = cls.created_by != null ? Number(cls.created_by) : null;
      if (classAdminId !== studentAdminId) {
        return res.status(400).json({ error: 'Student belongs to a different tuition center' });
      }
    }
    await classModel.assignStudentToClasses(studentId, classIds);
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to assign student to classes' });
  }
}

/**
 * POST /api/classes/assign-educator
 * Body: { educatorId, classIds (array) }
 */
async function assignEducatorToClasses(req, res) {
  try {
    const educatorId = req.body.educatorId != null ? Number(req.body.educatorId) : null;
    const classIds = Array.isArray(req.body.classIds) ? req.body.classIds.map(Number).filter(function (n) { return !isNaN(n); }) : [];
    if (!educatorId) {
      return res.status(400).json({ error: 'educatorId is required' });
    }
    await classModel.assignEducatorToClasses(educatorId, classIds);
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to assign educator to classes' });
  }
}

/**
 * PUT /api/classes/:classId
 * Body: { name?, description?, educator_id? }
 * Only the class owner (created_by === req.userId) can update. Educator admin only.
 */
async function updateClass(req, res) {
  try {
    if (req.role !== 'educatoradmin' || req.userId == null) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    const classId = Number(req.params.classId);
    if (isNaN(classId)) {
      return res.status(400).json({ error: 'Invalid class id' });
    }
    const cls = await classModel.getClassById(classId);
    if (!cls) {
      return res.status(404).json({ error: 'Class not found' });
    }
    const ownerId = cls.created_by != null ? Number(cls.created_by) : null;
    if (ownerId !== req.userId) {
      return res.status(403).json({ error: 'Forbidden: you do not own this class' });
    }
    const name = req.body.name != null ? String(req.body.name).trim() : undefined;
    const description = req.body.description !== undefined ? (req.body.description == null ? null : String(req.body.description).trim()) : undefined;
    const educatorId = req.body.educator_id !== undefined ? (req.body.educator_id == null ? null : Number(req.body.educator_id)) : undefined;
    const updated = await classModel.updateClass(classId, { name, description, educator_id: educatorId });
    res.json(updated);
  } catch (err) {
    console.error('Update class error:', err);
    res.status(500).json({ error: 'Failed to update class' });
  }
}

/**
 * DELETE /api/classes/:classId
 * Permanently delete class. Only owner (created_by === req.userId) can delete.
 */
async function deleteClass(req, res) {
  try {
    if (req.role !== 'educatoradmin' || req.userId == null) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    const classId = Number(req.params.classId);
    if (isNaN(classId)) {
      return res.status(400).json({ error: 'Invalid class id' });
    }
    const cls = await classModel.getClassById(classId);
    if (!cls) {
      return res.status(404).json({ error: 'Class not found' });
    }
    const ownerId = cls.created_by != null ? Number(cls.created_by) : null;
    if (ownerId !== req.userId) {
      return res.status(403).json({ error: 'Forbidden: you do not own this class' });
    }
    await classModel.deleteClass(classId);
    res.json({ ok: true });
  } catch (err) {
    console.error('Delete class error:', err);
    res.status(500).json({ error: 'Failed to delete class' });
  }
}

module.exports = { createClass, getAllClasses, getClassesWithStudents, getClassesByAdmin, getClassesWithStudentsByAdmin, getEducatorAdminClassesWithStudents, getClassById, getStudentAnalytics, getClassOverview, getClassesByEducator, getClassesForEducator, getClassesForEducatorWithWeakTopic, getAssignedClassesForDashboard, getClassesForStudent, assignStudent, assignStudentToClasses, assignEducatorToClasses, getClassesForEducatorAdmin, updateClass, deleteClass };
