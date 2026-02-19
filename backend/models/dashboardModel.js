const { pool } = require('../db');

/**
 * Get educator's class IDs (classes where educator_id = educatorId).
 */
async function getEducatorClassIds(educatorId) {
  const result = await pool.query(
    'SELECT id FROM classes WHERE educator_id = $1',
    [educatorId]
  );
  return (result.rows || []).map(function (r) { return r.id; });
}

/**
 * Active students today: distinct students who completed a quiz attempt today OR a challenge today,
 * in educator's classes.
 */
async function getActiveStudentsToday(classIds) {
  if (!Array.isArray(classIds) || classIds.length === 0) {
    return 0;
  }
  const result = await pool.query(
    `SELECT COUNT(DISTINCT student_id)::int AS cnt FROM (
      SELECT student_id FROM student_attempts
       WHERE class_id = ANY($1) AND completed_at::date = CURRENT_DATE
      UNION
      SELECT student_id FROM challenge_attempts
       WHERE class_id = ANY($1) AND completed_at::date = CURRENT_DATE
    ) t`,
    [classIds]
  );
  return parseInt(result.rows[0]?.cnt || '0', 10);
}

/**
 * Challenges completed today in educator's classes.
 */
async function getChallengesCompletedToday(classIds) {
  if (!Array.isArray(classIds) || classIds.length === 0) {
    return 0;
  }
  const result = await pool.query(
    `SELECT COUNT(*)::int AS cnt FROM challenge_attempts
     WHERE class_id = ANY($1) AND completed_at::date = CURRENT_DATE`,
    [classIds]
  );
  return parseInt(result.rows[0]?.cnt || '0', 10);
}

/**
 * Average accuracy (quiz score) today from attempts in educator's classes.
 */
async function getAverageAccuracyToday(classIds) {
  if (!Array.isArray(classIds) || classIds.length === 0) {
    return 0;
  }
  const result = await pool.query(
    `SELECT ROUND(AVG(score))::int AS avg_score
     FROM student_attempts
     WHERE class_id = ANY($1) AND completed_at::date = CURRENT_DATE`,
    [classIds]
  );
  const avg = result.rows[0]?.avg_score;
  return avg != null ? Math.min(100, Math.max(0, parseInt(avg, 10))) : 0;
}

/**
 * Students needing attention: accuracy < 60% OR no activity in last 3 days.
 * Limit 5. Returns { student_id, student_name, class_id, class_name, accuracy }.
 */
async function getStudentsNeedingAttention(classIds) {
  if (!Array.isArray(classIds) || classIds.length === 0) {
    return [];
  }
  const result = await pool.query(
    `WITH cs AS (
       SELECT cs.student_id, cs.class_id, c.name AS class_name
       FROM class_students cs
       JOIN classes c ON c.id = cs.class_id
       WHERE cs.class_id = ANY($1)
     ),
     stats AS (
       SELECT
         cs.student_id,
         cs.class_id,
         cs.class_name,
         (SELECT ROUND(AVG(sa.score))::int FROM student_attempts sa
          WHERE sa.student_id = cs.student_id AND sa.class_id = cs.class_id) AS accuracy,
         (SELECT MAX(ts) FROM (
           SELECT completed_at AS ts FROM student_attempts
            WHERE student_id = cs.student_id AND class_id = cs.class_id
           UNION ALL
           SELECT completed_at FROM challenge_attempts
            WHERE student_id = cs.student_id AND class_id = cs.class_id
         ) x) AS last_activity
       FROM cs
     )
     SELECT s.student_id, st.name AS student_name, s.class_id, s.class_name,
            COALESCE(s.accuracy, 0)::int AS accuracy
     FROM stats s
     JOIN students st ON st.id = s.student_id
     WHERE (s.accuracy IS NULL OR s.accuracy < 60)
        OR (s.last_activity IS NULL OR s.last_activity::date < CURRENT_DATE - INTERVAL '3 days')
     ORDER BY s.accuracy ASC NULLS FIRST, s.last_activity ASC NULLS LAST
     LIMIT 5`,
    [classIds]
  );
  return (result.rows || []).map(function (r) {
    var cid = r.class_id;
    return {
      student_id: r.student_id,
      student_name: r.student_name,
      class_id: cid !== undefined && cid !== null ? parseInt(cid, 10) : null,
      class_name: r.class_name,
      accuracy: parseInt(r.accuracy, 10) || 0,
    };
  });
}

/**
 * Get all "today" stats for an educator.
 */
async function getEducatorTodayStats(educatorId) {
  const classIds = await getEducatorClassIds(educatorId);
  const [active_students_today, challenges_completed_today, average_accuracy_today, students_needing_attention] = await Promise.all([
    getActiveStudentsToday(classIds),
    getChallengesCompletedToday(classIds),
    getAverageAccuracyToday(classIds),
    getStudentsNeedingAttention(classIds),
  ]);
  return {
    active_students_today,
    challenges_completed_today,
    average_accuracy_today,
    students_needing_attention,
  };
}

/**
 * Get counts for educator admin dashboard: totalClasses, totalEducators, totalStudents.
 * adminId = educator admin (institution admin) id.
 * Educators = distinct educators assigned to at least one class created by this admin.
 */
async function getEducatorAdminStats(adminId) {
  const classesResult = await pool.query(
    'SELECT COUNT(*)::int AS cnt FROM classes WHERE created_by = $1',
    [adminId]
  );
  const studentsResult = await pool.query(
    'SELECT COUNT(*)::int AS cnt FROM students WHERE admin_id = $1',
    [adminId]
  );
  const educatorsResult = await pool.query(
    `SELECT COUNT(DISTINCT e.id)::int AS cnt
     FROM educators e
     INNER JOIN classes c ON c.educator_id = e.id
     WHERE c.created_by = $1`,
    [adminId]
  );
  return {
    totalClasses: parseInt(classesResult.rows[0]?.cnt || '0', 10),
    totalEducators: parseInt(educatorsResult.rows[0]?.cnt || '0', 10),
    totalStudents: parseInt(studentsResult.rows[0]?.cnt || '0', 10),
  };
}

module.exports = {
  getEducatorClassIds,
  getActiveStudentsToday,
  getChallengesCompletedToday,
  getAverageAccuracyToday,
  getStudentsNeedingAttention,
  getEducatorTodayStats,
  getEducatorAdminStats,
};
