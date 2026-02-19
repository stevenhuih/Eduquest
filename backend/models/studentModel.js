const { pool } = require('../db');

/**
 * Increment student XP (global, on students table).
 */
async function incrementStudentXP(studentId, xp) {
  await pool.query(
    'UPDATE students SET xp = xp + $1 WHERE id = $2',
    [xp, studentId]
  );
}

/**
 * Get current XP for a student (global).
 */
async function getStudentXP(studentId) {
  const result = await pool.query(
    'SELECT xp FROM students WHERE id = $1',
    [studentId]
  );
  return result.rows[0] ? result.rows[0].xp : 0;
}

/**
 * Increment student XP for a class (student_class_progress).
 * Uses upsert: INSERT ... ON CONFLICT (student_id, class_id) DO UPDATE SET xp = xp + $3.
 */
async function incrementStudentXPForClass(studentId, classId, xp) {
  await pool.query(
    `INSERT INTO student_class_progress (student_id, class_id, xp)
     VALUES ($1, $2, $3)
     ON CONFLICT (student_id, class_id)
     DO UPDATE SET xp = student_class_progress.xp + $3`,
    [studentId, classId, xp]
  );
}

/**
 * Get current XP for a student in a class (from student_class_progress).
 */
async function getStudentXPForClass(studentId, classId) {
  const result = await pool.query(
    'SELECT xp FROM student_class_progress WHERE student_id = $1 AND class_id = $2',
    [studentId, classId]
  );
  return result.rows[0] ? (Number(result.rows[0].xp) || 0) : 0;
}

/**
 * Get student level from XP: level = Math.floor(xp / 100) + 1
 */
async function getStudentLevel(studentId) {
  const xp = await getStudentXP(studentId);
  return Math.floor(xp / 100) + 1;
}

/**
 * Get all students belonging to an admin (tuition center isolation).
 */
async function getAllStudents(adminId) {
  const result = await pool.query(
    `SELECT id, name, email, created_at
     FROM students
     WHERE admin_id = $1
     ORDER BY created_at DESC`,
    [adminId]
  );
  return result.rows;
}

/**
 * Get students in classes owned by this admin (multi-tenant).
 */
async function getStudentsByAdmin(adminId) {
  const result = await pool.query(
    `SELECT DISTINCT s.id, s.name, s.email, s.created_at
     FROM students s
     JOIN class_students cs ON cs.student_id = s.id
     JOIN classes c ON c.id = cs.class_id
     WHERE c.created_by = $1
     ORDER BY s.created_at DESC`,
    [adminId]
  );
  return result.rows;
}

/**
 * Find student by email (for uniqueness check).
 */
async function findByEmail(email) {
  const result = await pool.query(
    'SELECT id FROM students WHERE email = $1',
    [email]
  );
  return result.rows[0] || null;
}

/**
 * Find student by email (full row, for login).
 */
async function findStudentByEmail(email) {
  const result = await pool.query(
    'SELECT * FROM students WHERE email = $1',
    [email]
  );
  return result.rows[0] || null;
}

/**
 * Find student by id (full row, for internal use e.g. change-password).
 */
async function findStudentById(id) {
  const result = await pool.query(
    'SELECT * FROM students WHERE id = $1',
    [Number(id)]
  );
  return result.rows[0] || null;
}

/**
 * Get student by id with center name (safe fields only, for GET /api/students/:id).
 * Returns { id, name, email, created_at, coins, xp, center_name }.
 */
async function getStudentByIdWithCenter(id) {
  const result = await pool.query(
    `SELECT s.id, s.name, s.email, s.created_at, s.coins, s.xp, ea.center_name
     FROM students s
     LEFT JOIN educator_admins ea ON ea.id = s.admin_id
     WHERE s.id = $1`,
    [Number(id)]
  );
  return result.rows[0] || null;
}

/**
 * Update student password (for change-password).
 */
async function updateStudentPassword(id, passwordHash) {
  await pool.query(
    'UPDATE students SET password = $1 WHERE id = $2',
    [passwordHash, Number(id)]
  );
}

/**
 * Get admin_id for a student (for cross-center assignment check).
 */
async function getStudentAdminId(studentId) {
  const result = await pool.query(
    'SELECT admin_id FROM students WHERE id = $1',
    [studentId]
  );
  return result.rows[0] ? result.rows[0].admin_id : null;
}

/**
 * Create a student. passwordHash is the hashed password. adminId is the tuition center (educator_admin id).
 */
async function createStudent(name, email, passwordHash, adminId) {
  const result = await pool.query(
    'INSERT INTO students (name, email, password, admin_id) VALUES ($1, $2, $3, $4) RETURNING id, name, email',
    [name, email, passwordHash, adminId]
  );
  return result.rows[0];
}

/**
 * Update student name and email. Returns updated row or null.
 */
async function updateStudent(id, name, email) {
  const result = await pool.query(
    'UPDATE students SET name = $1, email = $2 WHERE id = $3 RETURNING id, name, email',
    [name, email, id]
  );
  return result.rows[0] || null;
}

/**
 * Delete student. Removes from class_students first, then deletes student. Returns deleted row or null.
 */
async function deleteStudent(id) {
  await pool.query('DELETE FROM class_students WHERE student_id = $1', [id]);
  const result = await pool.query('DELETE FROM students WHERE id = $1 RETURNING id', [id]);
  return result.rows[0] || null;
}

/**
 * Add coins to a student's balance. Returns new total coins.
 */
async function addCoins(studentId, amount) {
  const result = await pool.query(
    'UPDATE students SET coins = coins + $2 WHERE id = $1 RETURNING coins',
    [studentId, amount]
  );
  return result.rows[0] ? parseInt(result.rows[0].coins, 10) : 0;
}

/**
 * Get current coins for a student.
 */
async function getCoins(studentId) {
  const result = await pool.query(
    'SELECT coins FROM students WHERE id = $1',
    [studentId]
  );
  return result.rows[0] ? parseInt(result.rows[0].coins, 10) : 0;
}

/**
 * Deduct coins from a student. Returns new balance if sufficient, null otherwise.
 */
async function deductCoins(studentId, amount) {
  const result = await pool.query(
    'UPDATE students SET coins = coins - $2 WHERE id = $1 AND coins >= $2 RETURNING coins',
    [studentId, amount]
  );
  return result.rows[0] ? parseInt(result.rows[0].coins, 10) : null;
}

module.exports = { incrementStudentXP, getStudentXP, getStudentXPForClass, incrementStudentXPForClass, getStudentLevel, getAllStudents, getStudentsByAdmin, findByEmail, findStudentByEmail, findStudentById, getStudentByIdWithCenter, getStudentAdminId, createStudent, updateStudent, updateStudentPassword, deleteStudent, addCoins, getCoins, deductCoins };
