const { pool } = require('../db');
const attemptModel = require('./attemptModel');

/**
 * Create a new class. Returns inserted row.
 * created_by: admin/creator; educator_id: assigned educator; description: optional.
 */
async function createClass(name, createdBy, educatorId, description) {
  const result = await pool.query(
    'INSERT INTO classes (name, created_by, educator_id, description) VALUES ($1, $2, $3, $4) RETURNING *',
    [name, createdBy, educatorId, description || null]
  );
  return result.rows[0];
}

/**
 * Get all classes (id, name, educator_id).
 */
async function getAllClasses() {
  const result = await pool.query(
    'SELECT id, name, educator_id FROM classes ORDER BY id'
  );
  return result.rows;
}

/**
 * Get classes created by an admin (multi-tenant isolation).
 */
async function getClassesByAdmin(adminId) {
  const result = await pool.query(
    `SELECT id, name, description, educator_id, created_at
     FROM classes
     WHERE created_by = $1
     ORDER BY created_at DESC`,
    [adminId]
  );
  return result.rows;
}

/**
 * Get classes by admin for dashboard: id, name, description, educator_id, created_at, student_count, educator_name.
 */
async function getClassesByAdminForDashboard(adminId) {
  const result = await pool.query(
    `SELECT
       c.id,
       c.name,
       c.description,
       c.educator_id,
       c.created_at,
       e.name AS educator_name,
       COUNT(cs.student_id)::int AS student_count
     FROM classes c
     LEFT JOIN educators e ON c.educator_id = e.id
     LEFT JOIN class_students cs ON c.id = cs.class_id
     WHERE c.created_by = $1
     GROUP BY c.id, e.name
     ORDER BY c.created_at DESC`,
    [adminId]
  );
  return result.rows || [];
}

/**
 * Get classes (created by admin) with .students array for each (multi-tenant).
 */
async function getClassesWithStudentsByAdmin(adminId) {
  const classes = await getClassesByAdmin(adminId);
  if (classes.length === 0) return [];
  const classIds = classes.map(c => c.id);
  const result = await pool.query(
    `SELECT cs.class_id, s.id AS student_id, s.name AS student_name, s.email AS student_email
     FROM class_students cs
     JOIN students s ON s.id = cs.student_id
     WHERE cs.class_id = ANY($1)`,
    [classIds]
  );
  const byClass = {};
  (result.rows || []).forEach(function (r) {
    if (!byClass[r.class_id]) byClass[r.class_id] = [];
    byClass[r.class_id].push({ id: r.student_id, name: r.student_name, email: r.student_email });
  });
  return classes.map(function (c) {
    return { id: c.id, name: c.name, educator_id: c.educator_id, students: byClass[c.id] || [] };
  });
}

/**
 * Get one class by id.
 */
async function getClassById(classId) {
  const result = await pool.query(
    'SELECT id, name, description, educator_id, created_by FROM classes WHERE id = $1',
    [classId]
  );
  return result.rows[0] || null;
}

/**
 * Get one class by id with educator_name and student_count (for header/detail views).
 */
async function getClassByIdWithDetails(classId) {
  const result = await pool.query(
    `SELECT c.id, c.name, c.description, c.educator_id, c.created_by,
            e.name AS educator_name,
            (SELECT COUNT(*)::int FROM class_students cs WHERE cs.class_id = c.id) AS student_count
     FROM classes c
     LEFT JOIN educators e ON c.educator_id = e.id
     WHERE c.id = $1`,
    [classId]
  );
  const row = result.rows[0];
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    educator_id: row.educator_id,
    created_by: row.created_by,
    educator_name: row.educator_name || null,
    student_count: row.student_count != null ? Number(row.student_count) : 0,
  };
}

/**
 * Update class (name, description, educator_id). Only non-undefined fields are updated.
 */
async function updateClass(classId, data) {
  const updates = [];
  const values = [];
  let i = 1;
  if (data.name !== undefined) {
    updates.push(`name = $${i++}`);
    values.push(data.name);
  }
  if (data.description !== undefined) {
    updates.push(`description = $${i++}`);
    values.push(data.description);
  }
  if (data.educator_id !== undefined) {
    updates.push(`educator_id = $${i++}`);
    values.push(data.educator_id);
  }
  if (updates.length === 0) {
    return (await pool.query('SELECT * FROM classes WHERE id = $1', [classId])).rows[0] || null;
  }
  values.push(classId);
  const result = await pool.query(
    `UPDATE classes SET ${updates.join(', ')} WHERE id = $${i} RETURNING *`,
    values
  );
  return result.rows[0] || null;
}

/**
 * Permanently delete a class by id.
 */
async function deleteClass(classId) {
  await pool.query('DELETE FROM classes WHERE id = $1', [classId]);
}

/**
 * Get classes assigned to an educator (where educator_id = educatorId).
 */
async function getClassesByEducatorId(educatorId) {
  const result = await pool.query(
    `SELECT id, name, description, created_at
     FROM classes
     WHERE educator_id = $1
     ORDER BY created_at DESC`,
    [educatorId]
  );
  return result.rows;
}

/**
 * Get classes assigned to educator with student_count and progress_percent for dashboard.
 * progress_percent: 0 for now (can later use avg xp normalized to level thresholds).
 */
async function getAssignedClassesWithStats(educatorId) {
  const result = await pool.query(
    `SELECT c.id, c.name, c.description,
            COUNT(DISTINCT cs.student_id)::int AS student_count,
            COALESCE(ROUND(AVG(scp.xp)::numeric, 0), 0)::int AS avg_xp
     FROM classes c
     LEFT JOIN class_students cs ON cs.class_id = c.id
     LEFT JOIN student_class_progress scp ON scp.class_id = c.id AND scp.student_id = cs.student_id
     WHERE c.educator_id = $1
     GROUP BY c.id, c.name, c.description
     ORDER BY c.id DESC`,
    [educatorId]
  );
  return (result.rows || []).map(function (r) {
    var avgXp = parseInt(r.avg_xp, 10) || 0;
    var progressPercent = 0;
    if (r.student_count > 0 && avgXp > 0) {
      progressPercent = Math.min(100, Math.round(avgXp / 10));
    }
    return {
      id: r.id,
      name: r.name || '',
      description: r.description || null,
      student_count: parseInt(r.student_count, 10) || 0,
      progress_percent: progressPercent,
    };
  });
}

/**
 * Set this educator's assigned classes to exactly classIds.
 * First clears educator_id from all classes assigned to this educator, then sets educator_id on classIds.
 */
async function assignEducatorToClasses(educatorId, classIds) {
  await pool.query('UPDATE classes SET educator_id = NULL WHERE educator_id = $1', [educatorId]);
  if (Array.isArray(classIds) && classIds.length > 0) {
    await pool.query(
      'UPDATE classes SET educator_id = $1 WHERE id = ANY($2)',
      [educatorId, classIds]
    );
  }
}

/**
 * Get all classes created by an educator, newest first.
 */
async function getClassesByEducator(educatorId) {
  const result = await pool.query(
    'SELECT * FROM classes WHERE created_by = $1 ORDER BY created_at DESC',
    [educatorId]
  );
  return result.rows || [];
}

/**
 * Assign a student to a class (insert into class_students).
 */
async function assignStudentToClass(classId, studentId) {
  await pool.query(
    'INSERT INTO class_students (class_id, student_id) VALUES ($1, $2)',
    [classId, studentId]
  );
}

/**
 * Set student's classes to exactly classIds. Removes from all, then adds to classIds.
 */
async function assignStudentToClasses(studentId, classIds) {
  await pool.query('DELETE FROM class_students WHERE student_id = $1', [studentId]);
  if (Array.isArray(classIds) && classIds.length > 0) {
    for (let i = 0; i < classIds.length; i++) {
      await assignStudentToClass(classIds[i], studentId);
    }
  }
}

/**
 * Get all classes a student is in with educator name, progress (xp), and weakest_topic.
 */
async function getClassesForStudent(studentId) {
  const result = await pool.query(
    `SELECT c.id, c.name, c.description, c.educator_id, c.created_at,
            e.name AS educator_name,
            COALESCE(scp.xp, 0)::int AS xp
     FROM classes c
     JOIN class_students cs ON cs.class_id = c.id
     LEFT JOIN educators e ON e.id = c.educator_id
     LEFT JOIN student_class_progress scp ON scp.class_id = c.id AND scp.student_id = $1
     WHERE cs.student_id = $1
     ORDER BY c.created_at DESC`,
    [studentId]
  );
  const rows = result.rows || [];
  const classes = [];
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    let weakest_topic = null;
    try {
      const topicPerf = await attemptModel.getStudentTopicPerformance(studentId, r.id);
      const withAttempts = topicPerf.filter(function (t) { return t.total >= 1; });
      if (withAttempts.length > 0) {
        const minAcc = Math.min.apply(null, withAttempts.map(function (t) { return t.accuracy; }));
        const worst = withAttempts.find(function (t) { return t.accuracy === minAcc; });
        if (worst) weakest_topic = worst.topic_name;
      }
    } catch (err) {
      // leave weakest_topic null
    }
    const xp = parseInt(r.xp, 10) || 0;
    const progress_percent = Math.min(100, Math.round(xp / 10));
    classes.push({
      id: r.id,
      name: r.name || '',
      description: r.description || null,
      educator_id: r.educator_id != null ? parseInt(r.educator_id, 10) : null,
      educator_name: r.educator_name || null,
      xp: xp,
      progress_percent: progress_percent,
      weakest_topic: weakest_topic
    });
  }
  return classes;
}

/**
 * Get student analytics for a class: id, name, email, avg_score, weakest_topic, last_activity, xp.
 * Uses student_attempts (score, completed_at), student_class_progress (xp), and per-topic accuracy for weakest.
 */
async function getStudentAnalyticsByClass(classId) {
  const studentsResult = await pool.query(
    `SELECT s.id, s.name, s.email
     FROM class_students cs
     JOIN students s ON s.id = cs.student_id
     WHERE cs.class_id = $1
     ORDER BY s.name`,
    [classId]
  );
  const students = studentsResult.rows || [];
  if (students.length === 0) return [];

  const studentIds = students.map(function (r) { return r.id; });

  const statsResult = await pool.query(
    `SELECT a.student_id,
            ROUND(AVG(a.score))::int AS avg_score,
            MAX(a.completed_at) AS last_activity
     FROM student_attempts a
     WHERE a.class_id = $1 AND a.student_id = ANY($2)
     GROUP BY a.student_id`,
    [classId, studentIds]
  );
  const statsByStudent = {};
  (statsResult.rows || []).forEach(function (r) {
    statsByStudent[r.student_id] = { avg_score: r.avg_score, last_activity: r.last_activity };
  });

  const xpResult = await pool.query(
    `SELECT student_id, xp FROM student_class_progress WHERE class_id = $1 AND student_id = ANY($2)`,
    [classId, studentIds]
  );
  const xpByStudent = {};
  (xpResult.rows || []).forEach(function (r) {
    xpByStudent[r.student_id] = Number(r.xp) || 0;
  });

  const weakestResult = await pool.query(
    `SELECT * FROM (
       SELECT a.student_id,
              COALESCE(t.name, q.topic, 'general') AS topic_name,
              ROUND((SUM(CASE WHEN sa.is_correct THEN 1 ELSE 0 END)::decimal / NULLIF(COUNT(*), 0)) * 100)::int AS accuracy
       FROM student_attempts a
       JOIN student_answers sa ON sa.attempt_id = a.id
       JOIN options o ON sa.selected_option_id = o.id
       JOIN questions q ON o.question_id = q.id
       LEFT JOIN topics t ON t.id = q.topic_id
       JOIN quizzes z ON a.quiz_id = z.id
       WHERE z.class_id = $1 AND a.student_id = ANY($2)
       GROUP BY a.student_id, q.topic_id, q.topic, t.name
     ) sub
     ORDER BY student_id, accuracy ASC`,
    [classId, studentIds]
  );
  const weakestByStudent = {};
  const seen = {};
  (weakestResult.rows || []).forEach(function (r) {
    if (!seen[r.student_id]) {
      seen[r.student_id] = true;
      weakestByStudent[r.student_id] = r.topic_name;
    }
  });

  return students.map(function (s) {
    const st = statsByStudent[s.id] || {};
    return {
      id: s.id,
      name: s.name,
      email: s.email,
      avg_score: st.avg_score != null ? Number(st.avg_score) : null,
      weakest_topic: weakestByStudent[s.id] || null,
      last_activity: st.last_activity || null,
      xp: xpByStudent[s.id] != null ? xpByStudent[s.id] : 0
    };
  });
}

/**
 * Get class overview stats: avg_score, completion_rate, total_xp, active_students, total_students.
 */
async function getClassOverview(classId) {
  const totalStudentsResult = await pool.query(
    'SELECT COUNT(*) AS cnt FROM class_students WHERE class_id = $1',
    [classId]
  );
  const total_students = parseInt(totalStudentsResult.rows[0]?.cnt || '0', 10);

  const attemptStats = await pool.query(
    `SELECT
       COUNT(*) AS total_attempts,
       COUNT(*) FILTER (WHERE completed_at IS NOT NULL) AS completed_attempts,
       ROUND(AVG(score))::int AS avg_score
     FROM student_attempts
     WHERE class_id = $1`,
    [classId]
  );
  const row = attemptStats.rows[0] || {};
  const total_attempts = parseInt(row.total_attempts || '0', 10);
  const completed_attempts = parseInt(row.completed_attempts || '0', 10);
  const avg_score = row.avg_score != null ? Number(row.avg_score) : 0;
  const completion_rate = total_attempts > 0 ? Math.round((completed_attempts / total_attempts) * 100) : 0;

  const xpResult = await pool.query(
    'SELECT COALESCE(SUM(xp), 0)::int AS total_xp FROM student_class_progress WHERE class_id = $1',
    [classId]
  );
  const total_xp = parseInt(xpResult.rows[0]?.total_xp || '0', 10);

  const activeResult = await pool.query(
    `SELECT COUNT(DISTINCT student_id) AS cnt
     FROM student_attempts
     WHERE class_id = $1 AND completed_at >= NOW() - INTERVAL '24 hours'`,
    [classId]
  );
  const active_students = parseInt(activeResult.rows[0]?.cnt || '0', 10);

  return {
    avg_score,
    completion_rate,
    total_xp,
    active_students,
    total_students
  };
}

/**
 * Get all classes with a .students array (id, name, email) for each class.
 */
async function getClassesWithStudents() {
  const classes = await getAllClasses();
  const result = await pool.query(
    `SELECT cs.class_id, s.id AS student_id, s.name AS student_name, s.email AS student_email
     FROM class_students cs
     JOIN students s ON s.id = cs.student_id`
  );
  const byClass = {};
  (result.rows || []).forEach(function (r) {
    if (!byClass[r.class_id]) byClass[r.class_id] = [];
    byClass[r.class_id].push({ id: r.student_id, name: r.student_name, email: r.student_email });
  });
  return classes.map(function (c) {
    return { id: c.id, name: c.name, educator_id: c.educator_id, students: byClass[c.id] || [] };
  });
}

module.exports = { createClass, getAllClasses, getClassById, getClassByIdWithDetails, getClassesByAdmin, getClassesByAdminForDashboard, getClassesWithStudentsByAdmin, getClassesByEducator, getClassesByEducatorId, getAssignedClassesWithStats, getStudentAnalyticsByClass, getClassOverview, assignStudentToClass, assignStudentToClasses, getClassesForStudent, getClassesWithStudents, assignEducatorToClasses, updateClass, deleteClass };
