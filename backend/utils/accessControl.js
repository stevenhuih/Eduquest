const { pool } = require('../db');

/**
 * Check if an EducatorAdmin (tuition center owner) can access a class.
 * @param {number} educatorAdminId - From header x-educatoradmin-id
 * @param {number} classId - Class id
 * @returns {Promise<boolean>}
 */
async function canEducatorAdminAccessClass(educatorAdminId, classId) {
  if (educatorAdminId == null || isNaN(Number(educatorAdminId)) || classId == null || isNaN(Number(classId))) {
    return false;
  }
  const result = await pool.query(
    'SELECT created_by FROM classes WHERE id = $1',
    [Number(classId)]
  );
  const row = result.rows[0];
  return row != null && Number(row.created_by) === Number(educatorAdminId);
}

/**
 * Check if an Educator (assigned to the class) can access the class.
 * @param {number} educatorId - From header x-educator-id
 * @param {number} classId - Class id
 * @returns {Promise<boolean>}
 */
async function canEducatorAccessClass(educatorId, classId) {
  if (educatorId == null || isNaN(Number(educatorId)) || classId == null || isNaN(Number(classId))) {
    return false;
  }
  const result = await pool.query(
    'SELECT educator_id FROM classes WHERE id = $1',
    [Number(classId)]
  );
  const row = result.rows[0];
  return row != null && Number(row.educator_id) === Number(educatorId);
}

/**
 * Check if an EducatorAdmin can access a student (student belongs to their center).
 * @param {number} educatorAdminId - From header x-educatoradmin-id
 * @param {number} studentId - Student id
 * @returns {Promise<boolean>}
 */
async function canEducatorAdminAccessStudent(educatorAdminId, studentId) {
  if (educatorAdminId == null || isNaN(Number(educatorAdminId)) || studentId == null || isNaN(Number(studentId))) {
    return false;
  }
  const result = await pool.query(
    'SELECT admin_id FROM students WHERE id = $1',
    [Number(studentId)]
  );
  const row = result.rows[0];
  return row != null && Number(row.admin_id) === Number(educatorAdminId);
}

/**
 * Check if an Educator can access a student (student is in at least one class assigned to this educator).
 * @param {number} educatorId - From header x-educator-id
 * @param {number} studentId - Student id
 * @returns {Promise<boolean>}
 */
async function canEducatorAccessStudent(educatorId, studentId) {
  if (educatorId == null || isNaN(Number(educatorId)) || studentId == null || isNaN(Number(studentId))) {
    return false;
  }
  const result = await pool.query(
    `SELECT 1 FROM class_students cs
     JOIN classes c ON c.id = cs.class_id
     WHERE cs.student_id = $1 AND c.educator_id = $2
     LIMIT 1`,
    [Number(studentId), Number(educatorId)]
  );
  return result.rows.length > 0;
}

/**
 * Check that the student from the header is requesting their own resource (path param id matches).
 * @param {number} studentIdFromHeader - From header x-student-id
 * @param {number} studentIdFromPath - From URL params (e.g. req.params.id)
 * @returns {boolean}
 */
function canStudentAccessSelf(studentIdFromHeader, studentIdFromPath) {
  if (studentIdFromHeader == null || studentIdFromPath == null) return false;
  const h = Number(studentIdFromHeader);
  const p = Number(studentIdFromPath);
  return !isNaN(h) && !isNaN(p) && h === p;
}

/**
 * Check if a student is enrolled in a class (class_students).
 * @param {number} studentId - Student id
 * @param {number} classId - Class id
 * @returns {Promise<boolean>}
 */
async function isStudentInClass(studentId, classId) {
  if (studentId == null || isNaN(Number(studentId)) || classId == null || isNaN(Number(classId))) {
    return false;
  }
  const result = await pool.query(
    'SELECT 1 FROM class_students WHERE student_id = $1 AND class_id = $2 LIMIT 1',
    [Number(studentId), Number(classId)]
  );
  return result.rows.length > 0;
}

/**
 * Check if an educator can review an educator admin (educator is linked via at least one class).
 * @param {number} educatorId - Educator id
 * @param {number} adminId - Educator admin id (classes.created_by)
 * @returns {Promise<boolean>}
 */
async function canEducatorReviewEducatorAdmin(educatorId, adminId) {
  if (educatorId == null || isNaN(Number(educatorId)) || adminId == null || isNaN(Number(adminId))) {
    return false;
  }
  const result = await pool.query(
    'SELECT 1 FROM classes WHERE educator_id = $1 AND created_by = $2 LIMIT 1',
    [Number(educatorId), Number(adminId)]
  );
  return result.rows.length > 0;
}

module.exports = {
  canEducatorAdminAccessClass,
  canEducatorAccessClass,
  canEducatorAdminAccessStudent,
  canEducatorAccessStudent,
  canStudentAccessSelf,
  isStudentInClass,
  canEducatorReviewEducatorAdmin,
};
