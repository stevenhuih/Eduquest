const { pool } = require('../db');

/**
 * Record a challenge completion. Stores topic_id and class_id; keeps topic text for backward compat.
 * Does not insert if same student + class + (topic_id or topic) already completed today.
 */
async function recordChallengeCompletion(studentId, classId, topic, difficulty, score, topicId) {
  const tid = topicId != null && !isNaN(parseInt(topicId, 10)) ? parseInt(topicId, 10) : null;
  const topicText = topic != null ? String(topic).trim() : null;
  const existing = tid != null
    ? await pool.query(
        `SELECT 1 FROM challenge_attempts
         WHERE student_id = $1 AND (class_id IS NOT DISTINCT FROM $2) AND topic_id = $3 AND completed_at::date = CURRENT_DATE
         LIMIT 1`,
        [studentId, classId, tid]
      )
    : await pool.query(
        `SELECT 1 FROM challenge_attempts
         WHERE student_id = $1 AND (class_id IS NOT DISTINCT FROM $2) AND (topic IS NOT DISTINCT FROM $3) AND completed_at::date = CURRENT_DATE
         LIMIT 1`,
        [studentId, classId, topicText]
      );
  if (existing.rows.length > 0) return;
  if (topicText === 'boss' && tid != null) {
    const bossDone = await pool.query(
      `SELECT 1 FROM challenge_attempts
       WHERE student_id = $1 AND (class_id IS NOT DISTINCT FROM $2) AND topic = 'boss' AND topic_id = $3
       LIMIT 1`,
      [studentId, classId, tid]
    );
    if ((bossDone.rows || []).length > 0) return;
  }
  await pool.query(
    `INSERT INTO challenge_attempts (student_id, class_id, topic, topic_id, difficulty, score)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [studentId, classId, topicText, tid, difficulty || null, score != null ? parseInt(score, 10) : null]
  );
}

/**
 * Whether the student has ever completed this boss level in this class (one-time per level).
 * Boss completions are stored with topic = 'boss' and topic_id = level.
 */
async function hasCompletedBoss(studentId, classId, level) {
  const result = await pool.query(
    `SELECT 1 FROM challenge_attempts
     WHERE student_id = $1 AND (class_id IS NOT DISTINCT FROM $2) AND topic = 'boss' AND topic_id = $3
     LIMIT 1`,
    [studentId, classId, level]
  );
  return (result.rows || []).length > 0;
}

/**
 * Get topic identifiers (topic_id when set, else topic text) completed today for the given class.
 */
async function getCompletedTopicsToday(studentId, classId) {
  const result = await pool.query(
    `SELECT topic_id, topic
     FROM challenge_attempts
     WHERE student_id = $1 AND (class_id IS NOT DISTINCT FROM $2)
       AND completed_at::date = CURRENT_DATE`,
    [studentId, classId]
  );
  return (result.rows || []).map(function (r) {
    return r.topic_id != null ? r.topic_id : r.topic;
  });
}

/**
 * Get recent challenge completions for a student (topic_id, topic_name, difficulty, score, completed_at).
 * JOINs topics to return topic_name. If classId provided, filter by class_id.
 */
async function getChallengeHistory(studentId, classId) {
  const byClass = classId != null;
  const result = await pool.query(
    byClass
      ? `SELECT ca.topic_id, COALESCE(t.name, ca.topic) AS topic_name, ca.topic, ca.difficulty, ca.score, ca.completed_at
         FROM challenge_attempts ca
         LEFT JOIN topics t ON t.id = ca.topic_id
         WHERE ca.student_id = $1 AND (ca.class_id IS NOT DISTINCT FROM $2)
         ORDER BY ca.completed_at DESC
         LIMIT 5`
      : `SELECT ca.topic_id, COALESCE(t.name, ca.topic) AS topic_name, ca.topic, ca.difficulty, ca.score, ca.completed_at
         FROM challenge_attempts ca
         LEFT JOIN topics t ON t.id = ca.topic_id
         WHERE ca.student_id = $1
         ORDER BY ca.completed_at DESC
         LIMIT 5`,
    byClass ? [studentId, classId] : [studentId]
  );
  return result.rows || [];
}

/**
 * Get consecutive-day challenge streak for a student.
 * Counts days with at least one completion, starting from today.
 */
async function getChallengeStreak(studentId) {
  const result = await pool.query(
    `SELECT DISTINCT DATE(completed_at) AS day
     FROM challenge_attempts
     WHERE student_id = $1
     ORDER BY day DESC`,
    [studentId]
  );
  const rows = result.rows || [];
  if (rows.length === 0) return 0;

  function toDateStr(d) {
    if (typeof d === 'string') return d.slice(0, 10);
    if (d instanceof Date) return d.toISOString().slice(0, 10);
    return String(d).slice(0, 10);
  }

  function addDays(dateStr, delta) {
    const d = new Date(dateStr + 'T12:00:00Z');
    d.setUTCDate(d.getUTCDate() + delta);
    return d.toISOString().slice(0, 10);
  }

  const todayStr = new Date().toISOString().slice(0, 10);
  const firstDay = toDateStr(rows[0].day);
  if (firstDay !== todayStr) return 0;

  let streak = 1;
  let prev = todayStr;
  for (let i = 1; i < rows.length; i++) {
    const expectedPrev = addDays(prev, -1);
    const rowDay = toDateStr(rows[i].day);
    if (rowDay === expectedPrev) {
      streak++;
      prev = expectedPrev;
    } else {
      break;
    }
  }
  return streak;
}

module.exports = { recordChallengeCompletion, getCompletedTopicsToday, getChallengeHistory, getChallengeStreak, hasCompletedBoss };
