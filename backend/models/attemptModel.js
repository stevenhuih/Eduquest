const { pool } = require('../db');

/**
 * Check if student is allowed to attempt the quiz (allow_retakes and attempt count).
 */
async function checkRetakeAllowed(student_id, quiz_id) {
  const quizRow = await pool.query(
    'SELECT COALESCE(allow_retakes, true) AS allow_retakes FROM quizzes WHERE id = $1',
    [quiz_id]
  );
  if (quizRow.rows.length === 0) return { allowed: false };
  if (quizRow.rows[0].allow_retakes) return { allowed: true };
  const countRow = await pool.query(
    'SELECT COUNT(*) AS cnt FROM student_attempts WHERE student_id = $1 AND quiz_id = $2',
    [student_id, quiz_id]
  );
  const count = parseInt(countRow.rows[0].cnt, 10) || 0;
  return { allowed: count === 0 };
}

/**
 * Create a student attempt and insert all answers. Returns { score, passed, results }.
 */
async function createAttempt(student_id, quiz_id, answers) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const attemptResult = await client.query(
      `INSERT INTO student_attempts (student_id, quiz_id, class_id, score, completed_at)
       SELECT $1, $2, q.class_id, 0, NOW()
       FROM quizzes q WHERE q.id = $2
       RETURNING id, student_id, quiz_id, class_id, score, completed_at`,
      [student_id, quiz_id]
    );
    const attempt = attemptResult.rows[0];
    const attemptId = attempt.id;

    let correctCount = 0;
    for (const a of answers) {
      const isCorrectResult = await client.query(
        `SELECT is_correct FROM options WHERE id = $1`,
        [a.selected_option_id]
      );
      const isCorrect = isCorrectResult.rows.length > 0 && isCorrectResult.rows[0].is_correct === true;
      if (isCorrect) correctCount++;

      await client.query(
        `INSERT INTO student_answers (attempt_id, question_id, selected_option_id, is_correct)
         VALUES ($1, $2, $3, $4)`,
        [attemptId, a.question_id, a.selected_option_id, isCorrect]
      );

      if (!isCorrect) {
        await client.query(
          `INSERT INTO student_wrong_questions (student_id, question_id, attempt_id)
           VALUES ($1, $2, $3)
           ON CONFLICT (student_id, question_id) DO UPDATE SET attempt_id = $3, recorded_at = NOW()`,
          [student_id, a.question_id, attemptId]
        );
      }
    }

    const totalQuestions = answers.length;
    const score = totalQuestions > 0 ? Math.round((correctCount / totalQuestions) * 100) : 0;
    await client.query(
      'UPDATE student_attempts SET score = $1 WHERE id = $2',
      [score, attemptId]
    );

    const results = [];
    for (const a of answers) {
      const qRow = await client.query(
        `SELECT question_text, explanation FROM questions WHERE id = $1`,
        [a.question_id]
      );
      const question = qRow.rows[0] || {};
      const optsRow = await client.query(
        `SELECT id, option_text, is_correct FROM options WHERE question_id = $1 ORDER BY id`,
        [a.question_id]
      );
      results.push({
        question_text: question.question_text,
        explanation: question.explanation || null,
        selected_option_id: a.selected_option_id,
        options: optsRow.rows,
      });
    }

    const quizRes = await pool.query(
      'SELECT pass_grade, COALESCE(xp_reward, 100) AS xp_reward, COALESCE(coin_reward, 20) AS coin_reward FROM quizzes WHERE id = $1',
      [quiz_id]
    );
    const passGrade = quizRes.rows[0]?.pass_grade ?? 0;
    const passed = score >= Number(passGrade);
    const xp_reward = quizRes.rows[0]?.xp_reward ?? 100;
    const coin_reward = quizRes.rows[0]?.coin_reward ?? 20;

    await client.query('COMMIT');
    return { score, passed, results, class_id: attempt.class_id, xp_reward, coin_reward };
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}

async function getStudentTopicPerformance(studentId, classId) {
  const byClass = classId != null;
  const result = await pool.query(
    byClass
      ? `SELECT 
          q.topic_id,
          COALESCE(t.name, q.topic, 'general') AS topic_name,
          COALESCE(q.topic, 'general') AS topic,
          COUNT(sa.id)::int AS total_attempted,
          SUM(CASE WHEN o.is_correct THEN 1 ELSE 0 END)::int AS correct_count
        FROM student_answers sa
        JOIN options o ON sa.selected_option_id = o.id
        JOIN questions q ON sa.question_id = q.id
        LEFT JOIN topics t ON t.id = q.topic_id
        JOIN student_attempts a ON sa.attempt_id = a.id
        JOIN quizzes z ON a.quiz_id = z.id
        WHERE a.student_id = $1 AND z.class_id = $2
        GROUP BY q.topic_id, q.topic, t.name
        ORDER BY total_attempted DESC`
      : `SELECT 
          q.topic_id,
          COALESCE(t.name, q.topic, 'general') AS topic_name,
          COALESCE(q.topic, 'general') AS topic,
          COUNT(sa.id)::int AS total_attempted,
          SUM(CASE WHEN o.is_correct THEN 1 ELSE 0 END)::int AS correct_count
        FROM student_answers sa
        JOIN options o ON sa.selected_option_id = o.id
        JOIN questions q ON sa.question_id = q.id
        LEFT JOIN topics t ON t.id = q.topic_id
        JOIN student_attempts a ON sa.attempt_id = a.id
        WHERE a.student_id = $1
        GROUP BY q.topic_id, q.topic, t.name
        ORDER BY total_attempted DESC`,
    byClass ? [studentId, classId] : [studentId]
  );
  return result.rows.map(function (r) {
    var total = Number(r.total_attempted) || 0;
    var correct = Number(r.correct_count) || 0;
    return {
      topic_id: r.topic_id,
      topic_name: r.topic_name,
      topic: r.topic,
      total: total,
      correct: correct,
      accuracy: total > 0 ? Math.round((correct / total) * 100) : 0
    };
  });
}

/**
 * Get performance for one topic for a student (same query as above, filtered by topic).
 * Returns { topic, accuracy, total }. If no data, returns accuracy: 0, total: 0.
 */
async function getStudentTopicPerformanceForTopic(studentId, topic) {
  const normalizedTopic = topic && String(topic).trim() ? String(topic).trim() : 'general';
  const result = await pool.query(
    `SELECT 
      COALESCE(q.topic, 'general') AS topic,
      COUNT(sa.id)::int AS total_attempted,
      SUM(CASE WHEN o.is_correct THEN 1 ELSE 0 END)::int AS correct_count
    FROM student_answers sa
    JOIN options o ON sa.selected_option_id = o.id
    JOIN questions q ON sa.question_id = q.id
    JOIN student_attempts a ON sa.attempt_id = a.id
    WHERE a.student_id = $1
      AND COALESCE(q.topic, 'general') = $2
    GROUP BY COALESCE(q.topic, 'general')`,
    [studentId, normalizedTopic]
  );
  if (!result.rows.length) {
    return { topic: normalizedTopic, accuracy: 0, total: 0 };
  }
  const r = result.rows[0];
  const total = Number(r.total_attempted) || 0;
  const correct = Number(r.correct_count) || 0;
  return {
    topic: r.topic,
    accuracy: total > 0 ? Math.round((correct / total) * 100) : 0,
    total: total
  };
}

/**
 * Get per-topic performance for a class (all attempts on quizzes in that class).
 * Groups by topic_id (and topic text for legacy rows with null topic_id).
 * Returns rows with topic_id, topic_name, total, correct, accuracy (weakest first).
 */
async function getClassTopicPerformance(classId) {
  const query = `
    SELECT 
      q.topic_id,
      COALESCE(t.name, q.topic, 'general') AS topic_name,
      COALESCE(q.topic, 'general') AS topic,
      COUNT(*) AS total,
      SUM(CASE WHEN sa.is_correct THEN 1 ELSE 0 END) AS correct,
      ROUND(
        (SUM(CASE WHEN sa.is_correct THEN 1 ELSE 0 END)::decimal / NULLIF(COUNT(*), 0)) * 100
      )::int AS accuracy
    FROM student_answers sa
    JOIN options o ON sa.selected_option_id = o.id
    JOIN questions q ON o.question_id = q.id
    LEFT JOIN topics t ON t.id = q.topic_id
    JOIN student_attempts a ON sa.attempt_id = a.id
    JOIN quizzes quiz ON a.quiz_id = quiz.id
    WHERE quiz.class_id = $1
    GROUP BY q.topic_id, q.topic, t.name
    ORDER BY accuracy ASC;
  `;

  const result = await pool.query(query, [classId]);
  return result.rows;
}

/**
 * Get topics the student has mastered: accuracy >= 80 and total >= 5.
 * If classId provided, only quizzes in that class count.
 * Returns array of topic strings.
 */
async function getMasteredTopics(studentId, classId) {
  const byClass = classId != null;
  const result = await pool.query(
    byClass
      ? `SELECT
          COALESCE(t.name, q.topic, 'general') AS topic_name,
          COALESCE(q.topic, 'general') AS topic,
          COUNT(sa.id)::int AS total_attempted,
          SUM(CASE WHEN o.is_correct THEN 1 ELSE 0 END)::int AS correct_count
        FROM student_answers sa
        JOIN options o ON sa.selected_option_id = o.id
        JOIN questions q ON sa.question_id = q.id
        LEFT JOIN topics t ON t.id = q.topic_id
        JOIN student_attempts a ON sa.attempt_id = a.id
        JOIN quizzes z ON a.quiz_id = z.id
        WHERE a.student_id = $1 AND z.class_id = $2
        GROUP BY q.topic_id, q.topic, t.name`
      : `SELECT
          COALESCE(t.name, q.topic, 'general') AS topic_name,
          COALESCE(q.topic, 'general') AS topic,
          COUNT(sa.id)::int AS total_attempted,
          SUM(CASE WHEN o.is_correct THEN 1 ELSE 0 END)::int AS correct_count
        FROM student_answers sa
        JOIN options o ON sa.selected_option_id = o.id
        JOIN questions q ON sa.question_id = q.id
        LEFT JOIN topics t ON t.id = q.topic_id
        JOIN student_attempts a ON sa.attempt_id = a.id
        WHERE a.student_id = $1
        GROUP BY q.topic_id, q.topic, t.name`,
    byClass ? [studentId, classId] : [studentId]
  );
  return (result.rows || []).filter(function (r) {
    var total = Number(r.total_attempted) || 0;
    var correct = Number(r.correct_count) || 0;
    var accuracy = total > 0 ? Math.round((correct / total) * 100) : 0;
    return accuracy >= 80 && total >= 5;
  }).map(function (r) { return r.topic_name != null ? r.topic_name : r.topic; });
}

/**
 * Get quiz difficulty for coin/XP: 'easy' | 'medium' | 'hard' from question difficulty_levels (use hardest present).
 */
async function getQuizDifficulty(quiz_id) {
  const result = await pool.query(
    `SELECT LOWER(TRIM(difficulty_level)) AS d FROM questions WHERE quiz_id = $1`,
    [quiz_id]
  );
  const levels = (result.rows || []).map(function (r) { return (r.d || 'medium'); });
  if (levels.length === 0) return 'medium';
  if (levels.some(function (d) { return d === 'hard'; })) return 'hard';
  if (levels.some(function (d) { return d === 'medium'; })) return 'medium';
  return 'easy';
}

module.exports = { checkRetakeAllowed, createAttempt, getQuizDifficulty, getStudentTopicPerformance, getStudentTopicPerformanceForTopic, getClassTopicPerformance, getMasteredTopics };
