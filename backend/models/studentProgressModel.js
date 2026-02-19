const { pool } = require('../db');
const rewardService = require('../services/rewardService');

/**
 * Get progress row for (studentId, classId). If none exists, INSERT with xp=0, streak=0 and return it.
 */
async function getProgress(studentId, classId) {
  let result = await pool.query(
    'SELECT id, student_id, class_id, xp, streak, last_activity FROM student_class_progress WHERE student_id = $1 AND class_id = $2',
    [studentId, classId]
  );
  if (result.rows.length > 0) return result.rows[0];

  await pool.query(
    'INSERT INTO student_class_progress (student_id, class_id, xp, streak, last_activity) VALUES ($1, $2, 0, 0, NULL) ON CONFLICT (student_id, class_id) DO NOTHING',
    [studentId, classId]
  );
  result = await pool.query(
    'SELECT id, student_id, class_id, xp, streak, last_activity FROM student_class_progress WHERE student_id = $1 AND class_id = $2',
    [studentId, classId]
  );
  return result.rows[0] || null;
}

/**
 * Ensure row exists, then UPDATE xp = xp + $1.
 */
async function incrementXP(studentId, classId, xp) {
  await getProgress(studentId, classId);
  await pool.query(
    'UPDATE student_class_progress SET xp = xp + $1 WHERE student_id = $2 AND class_id = $3',
    [xp, studentId, classId]
  );
}

/**
 * Compare last_activity with CURRENT_DATE:
 * - If yesterday → streak++
 * - If today → no change
 * - Else → reset streak to 1
 * Then set last_activity = CURRENT_DATE.
 */
async function updateStreak(studentId, classId) {
  const row = await getProgress(studentId, classId);
  if (!row) return;

  const today = new Date().toISOString().slice(0, 10);
  const last = row.last_activity ? String(row.last_activity).slice(0, 10) : null;

  let newStreak = 1;
  if (last === today) {
    newStreak = Math.max(1, Number(row.streak) || 0);
  } else if (last) {
    const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
    if (last === yesterday) {
      newStreak = (Number(row.streak) || 0) + 1;
    }
  }

  await pool.query(
    'UPDATE student_class_progress SET streak = $1, last_activity = CURRENT_DATE WHERE student_id = $2 AND class_id = $3',
    [newStreak, studentId, classId]
  );
}

/**
 * Get student level for a class from class XP using non-linear curve (rewardService.xpRequiredForLevel).
 * Level increases while currentXP >= xpRequiredForLevel(currentLevel).
 */
async function getLevel(studentId, classId) {
  const row = await getProgress(studentId, classId);
  const xp = row ? (Number(row.xp) || 0) : 0;
  return rewardService.levelFromXP(xp);
}

module.exports = { getProgress, incrementXP, updateStreak, getLevel };
