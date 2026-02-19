const { pool } = require('../db');
const challengeModel = require('./challengeModel');

/**
 * Build optional date filter for WHERE clause.
 * Returns { clause: ' AND completed_at::date BETWEEN $n AND $n+1', params: [start, end], nextIndex: n+2 }
 * If no dates, returns { clause: '', params: [], nextIndex: base }.
 */
function dateFilter(base, startDate, endDate) {
  if (!startDate || !endDate) return { clause: '', params: [], nextIndex: base };
  return {
    clause: ` AND a.completed_at::date BETWEEN $${base} AND $${base + 1}`,
    params: [startDate, endDate],
    nextIndex: base + 2
  };
}

/**
 * Class report: aggregated metrics for a class in a date range.
 * Uses student_attempts (quiz), student_class_progress (xp), challenge_attempts, questions (topic).
 */
async function getClassReportData(classId, startDate, endDate) {
  const df = dateFilter(2, startDate, endDate);
  const params = [classId, ...df.params];
  const dateClause = df.clause.replace(/a\./g, 'sa.');

  const avgScoreResult = await pool.query(
    `SELECT ROUND(AVG(sa.score))::int AS avg_score
     FROM student_attempts sa
     WHERE sa.class_id = $1${dateClause}`,
    params
  );
  const avg_score = avgScoreResult.rows[0]?.avg_score != null ? Number(avgScoreResult.rows[0].avg_score) : 0;

  const totalInClass = await pool.query(
    'SELECT COUNT(*) AS cnt FROM class_students WHERE class_id = $1',
    [classId]
  );
  const totalStudents = parseInt(totalInClass.rows[0]?.cnt || '0', 10);
  const participatedResult = await pool.query(
    `SELECT COUNT(DISTINCT sa.student_id) AS cnt
     FROM student_attempts sa
     WHERE sa.class_id = $1${dateClause}`,
    params
  );
  const participated = parseInt(participatedResult.rows[0]?.cnt || '0', 10);
  const participation_rate = totalStudents > 0 ? Math.round((participated / totalStudents) * 100) : 0;

  const xpResult = await pool.query(
    'SELECT COALESCE(SUM(xp), 0)::int AS total_xp FROM student_class_progress WHERE class_id = $1',
    [classId]
  );
  const total_xp = parseInt(xpResult.rows[0]?.total_xp || '0', 10);

  const challengeDateClause = (sd, ed) => {
    if (!sd || !ed) return '';
    return ` AND ca.completed_at::date BETWEEN '${sd}' AND '${ed}'`;
  };
  const challengesResult = await pool.query(
    `SELECT COUNT(*)::int AS cnt
     FROM challenge_attempts ca
     WHERE (ca.class_id = $1 OR ca.class_id IS NULL)${challengeDateClause(startDate, endDate)}`,
    [classId]
  );
  const total_challenges_completed = parseInt(challengesResult.rows[0]?.cnt || '0', 10);

  const engagementResult = await pool.query(
    `SELECT DATE(sa.completed_at) AS day, COUNT(*)::int AS cnt
     FROM student_attempts sa
     WHERE sa.class_id = $1 AND sa.completed_at >= CURRENT_DATE - INTERVAL '6 days'
     GROUP BY DATE(sa.completed_at)
     ORDER BY day ASC`,
    [classId]
  );
  const dayMap = {};
  (engagementResult.rows || []).forEach(function (r) {
    dayMap[r.day ? String(r.day).slice(0, 10) : ''] = r.cnt || 0;
  });
  const engagement_by_day = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    engagement_by_day.push(dayMap[key] || 0);
  }

  const topResult = await pool.query(
    `SELECT s.id, s.name, ROUND(AVG(sa.score))::int AS avg_score
     FROM student_attempts sa
     JOIN students s ON s.id = sa.student_id
     WHERE sa.class_id = $1${dateClause}
     GROUP BY s.id, s.name
     ORDER BY AVG(sa.score) DESC
     LIMIT 5`,
    params
  );
  const top_performers = (topResult.rows || []).map(function (r) {
    return { name: r.name, avg_score: Number(r.avg_score) || 0 };
  });

  const weakestResult = await pool.query(
    `SELECT
       COALESCE(t.name, q.topic, 'general') AS topic,
       ROUND((1 - (SUM(CASE WHEN sa.is_correct THEN 1 ELSE 0 END)::decimal / NULLIF(COUNT(*), 0))) * 100)::int AS failure_rate
     FROM student_answers sa
     JOIN options o ON sa.selected_option_id = o.id
     JOIN questions q ON o.question_id = q.id
     LEFT JOIN topics t ON t.id = q.topic_id
     JOIN student_attempts a ON sa.attempt_id = a.id
     JOIN quizzes z ON a.quiz_id = z.id
     WHERE z.class_id = $1${df.clause}
     GROUP BY q.topic_id, q.topic, t.name
     ORDER BY failure_rate DESC
     LIMIT 10`,
    params
  );
  const weakest_topics = (weakestResult.rows || []).map(function (r) {
    return { topic: r.topic, failure_rate: Number(r.failure_rate) || 0 };
  });

  const studentsInClass = await pool.query(
    `SELECT s.id AS student_id, s.name AS student_name
     FROM class_students cs
     JOIN students s ON s.id = cs.student_id
     WHERE cs.class_id = $1
     ORDER BY s.name`,
    [classId]
  );
  const studentIds = (studentsInClass.rows || []).map(function (r) { return r.student_id; });
  const student_summary = [];
  if (studentIds.length > 0) {
    const summaryDateClause = dateFilter(2, startDate, endDate);
    const summaryParams = [classId, ...summaryDateClause.params];
    const avgByStudent = await pool.query(
      `SELECT a.student_id, ROUND(AVG(a.score))::int AS avg_score, MAX(a.completed_at) AS last_activity
       FROM student_attempts a
       WHERE a.class_id = $1${summaryDateClause.clause}
       GROUP BY a.student_id`,
      summaryParams
    );
    const avgMap = {};
    (avgByStudent.rows || []).forEach(function (r) {
      avgMap[r.student_id] = { avg_score: r.avg_score, last_activity: r.last_activity };
    });
    const weakestByStudent = await pool.query(
      `SELECT * FROM (
         SELECT a.student_id, COALESCE(t.name, q.topic, 'general') AS topic_name,
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
    const weakestMap = {};
    (weakestByStudent.rows || []).forEach(function (r) {
      if (!weakestMap[r.student_id]) weakestMap[r.student_id] = r.topic_name;
    });
    (studentsInClass.rows || []).forEach(function (s) {
      const st = avgMap[s.student_id] || {};
      student_summary.push({
        student_id: s.student_id,
        student_name: s.student_name,
        avg_score: st.avg_score != null ? Number(st.avg_score) : null,
        weakest_topic: weakestMap[s.student_id] || null,
        last_activity: st.last_activity || null
      });
    });
  }

  return {
    avg_score,
    participation_rate,
    total_xp,
    total_challenges_completed,
    engagement_by_day,
    top_performers,
    weakest_topics,
    student_summary
  };
}

/**
 * Student report: aggregated metrics for a student in a date range.
 */
async function getStudentReportData(studentId, startDate, endDate) {
  const df = dateFilter(2, startDate, endDate);
  const params = [studentId, ...df.params];
  const dateClause = df.clause.replace(/a\./g, 'sa.');
  const dateClauseA = df.clause;

  const xpResult = await pool.query(
    'SELECT COALESCE(SUM(xp), 0)::int AS total_xp FROM student_class_progress WHERE student_id = $1',
    [studentId]
  );
  const total_xp = parseInt(xpResult.rows[0]?.total_xp || '0', 10);

  const current_streak = await challengeModel.getChallengeStreak(studentId);

  const quizzesResult = await pool.query(
    `SELECT COUNT(*)::int AS cnt FROM student_attempts sa WHERE sa.student_id = $1${dateClause}`,
    params
  );
  const quizzes_completed = parseInt(quizzesResult.rows[0]?.cnt || '0', 10);

  const scoresResult = await pool.query(
    `SELECT z.title, sa.score
     FROM student_attempts sa
     JOIN quizzes z ON z.id = sa.quiz_id
     WHERE sa.student_id = $1${dateClause}
     ORDER BY sa.completed_at DESC
     LIMIT 20`,
    params
  );
  const recent_scores = (scoresResult.rows || []).map(function (r) {
    return { quiz_title: r.title, score: Number(r.score) || 0 };
  });

  const topicResult = await pool.query(
    `SELECT
       COALESCE(t.name, q.topic, 'general') AS topic_name,
       COUNT(*) AS total,
       SUM(CASE WHEN sa.is_correct THEN 1 ELSE 0 END) AS correct
     FROM student_answers sa
     JOIN options o ON sa.selected_option_id = o.id
     JOIN questions q ON sa.question_id = q.id
     LEFT JOIN topics t ON t.id = q.topic_id
     JOIN student_attempts a ON sa.attempt_id = a.id
     WHERE a.student_id = $1${dateClauseA}
     GROUP BY q.topic_id, q.topic, t.name`,
    params
  );
  const strengths = [];
  const weaknesses = [];
  (topicResult.rows || []).forEach(function (r) {
    const total = Number(r.total) || 0;
    const correct = Number(r.correct) || 0;
    const pct = total > 0 ? Math.round((correct / total) * 100) : 0;
    if (pct > 85) strengths.push(r.topic_name);
    if (pct < 60 && total >= 1) weaknesses.push(r.topic_name);
  });

  const growthResult = await pool.query(
    `SELECT
       AVG(CASE WHEN sa.completed_at::date >= $2::date THEN sa.score ELSE NULL END) AS recent_avg,
       AVG(CASE WHEN sa.completed_at::date < $2::date THEN sa.score ELSE NULL END) AS older_avg
     FROM student_attempts sa
     WHERE sa.student_id = $1 AND sa.completed_at::date BETWEEN $2::date AND $3::date`,
    [studentId, startDate || '1900-01-01', endDate || '2100-12-31']
  );
  const row = growthResult.rows[0];
  let growth_rate = 0;
  if (row && row.older_avg != null && Number(row.older_avg) !== 0) {
    const recent = Number(row.recent_avg) || 0;
    const older = Number(row.older_avg) || 0;
    growth_rate = Math.round(((recent - older) / older) * 100);
  }

  const historyResult = await pool.query(
    `SELECT DATE(sa.completed_at) AS day, COUNT(*)::int AS cnt
     FROM student_attempts sa
     WHERE sa.student_id = $1 AND sa.completed_at >= CURRENT_DATE - INTERVAL '6 days'
     GROUP BY DATE(sa.completed_at)
     ORDER BY day ASC`,
    [studentId]
  );
  const dayMap = {};
  (historyResult.rows || []).forEach(function (r) {
    dayMap[r.day ? String(r.day).slice(0, 10) : ''] = r.cnt || 0;
  });
  const engagement_history = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    engagement_history.push(dayMap[d.toISOString().slice(0, 10)] || 0);
  }

  // Topic fail counts: per-topic, number of quiz attempts where student scored < 60% on that topic
  const topicFailParams = [studentId];
  const topicFailDateClause = startDate && endDate
    ? ' AND a.completed_at::date BETWEEN $2::date AND $3::date'
    : '';
  if (startDate && endDate) topicFailParams.push(startDate, endDate);
  const topicFailResult = await pool.query(
    `WITH attempt_topic AS (
       SELECT a.id AS attempt_id, COALESCE(t.name, q.topic, 'general') AS topic_name,
              SUM(CASE WHEN o.is_correct THEN 1 ELSE 0 END)::float / NULLIF(COUNT(*), 0) AS accuracy
       FROM student_attempts a
       JOIN student_answers sa ON sa.attempt_id = a.id
       JOIN options o ON sa.selected_option_id = o.id
       JOIN questions q ON sa.question_id = q.id
       LEFT JOIN topics t ON t.id = q.topic_id
       WHERE a.student_id = $1${topicFailDateClause}
       GROUP BY a.id, q.topic_id, q.topic, t.name
     )
     SELECT topic_name, COUNT(*)::int AS fail_count
     FROM attempt_topic
     WHERE accuracy < 0.6
     GROUP BY topic_name`,
    topicFailParams
  );
  const topic_fail_counts = (topicFailResult.rows || []).map(function (r) {
    return { topic_name: r.topic_name, fail_count: parseInt(r.fail_count || '0', 10) };
  });

  // Engagement trend: compare first half vs second half of last 7 days
  const mid = Math.floor(engagement_history.length / 2);
  const firstSum = engagement_history.slice(0, mid).reduce(function (a, b) { return a + b; }, 0);
  const secondSum = engagement_history.slice(mid).reduce(function (a, b) { return a + b; }, 0);
  let engagement_trend = 'stable';
  if (secondSum < firstSum && firstSum > 0) engagement_trend = 'declining';
  else if (secondSum > firstSum) engagement_trend = 'improving';

  // Streak dropped: current streak is 0 but had recent activity (quiz attempts in last 7 days)
  const recentActivity = engagement_history.reduce(function (a, b) { return a + b; }, 0);
  const streak_dropped = (current_streak === 0 && recentActivity > 0);

  return {
    total_xp,
    current_streak: current_streak,
    quizzes_completed,
    growth_rate,
    recent_scores,
    strengths,
    weaknesses,
    engagement_history,
    topic_fail_counts,
    engagement_trend,
    streak_dropped
  };
}

/**
 * Insert a student report record (PDF sent to inbox).
 */
async function createStudentReport(studentId, educatorId, classId, reportType, filePath) {
  const result = await pool.query(
    `INSERT INTO student_reports (student_id, educator_id, class_id, report_type, file_path)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id, student_id, educator_id, class_id, report_type, generated_at, is_read`,
    [studentId, educatorId, classId || null, reportType, filePath]
  );
  return result.rows[0];
}

/**
 * Get report by id (for file download auth check).
 */
async function getReportById(reportId) {
  const result = await pool.query(
    'SELECT id, student_id, educator_id, file_path FROM student_reports WHERE id = $1',
    [reportId]
  );
  return result.rows[0] || null;
}

/**
 * Get all reports for a student (for profile inbox list).
 */
async function getReportsByStudentId(studentId) {
  const result = await pool.query(
    `SELECT id, report_type, class_id, generated_at, is_read
     FROM student_reports
     WHERE student_id = $1
     ORDER BY generated_at DESC`,
    [studentId]
  );
  return result.rows || [];
}

/**
 * Delete a student report by id. Caller must verify report belongs to student.
 */
async function deleteReportById(reportId) {
  const result = await pool.query(
    'DELETE FROM student_reports WHERE id = $1 RETURNING id',
    [reportId]
  );
  return result.rows[0] || null;
}

module.exports = { getClassReportData, getStudentReportData, createStudentReport, getReportById, getReportsByStudentId, deleteReportById };
