const { pool } = require('../db');
const questionBankModel = require('./questionBankModel');

/**
 * Create a new quiz with questions and options (transaction).
 */
async function createQuiz({ title, class_id, created_by, questions, shuffle_questions, pass_grade, allow_retakes, time_limit_minutes, due_date }) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    console.log('Saving quiz:', title, class_id);
    console.log('Questions received:', questions.length);

    const quizResult = await client.query(
      `INSERT INTO quizzes (title, class_id, created_by, shuffle_questions, pass_grade, allow_retakes, time_limit_minutes, due_date)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING id, title, class_id, created_by, created_at`,
      [
        title,
        class_id,
        created_by || 1,
        shuffle_questions === true,
        pass_grade != null ? parseInt(pass_grade, 10) : 0,
        allow_retakes !== false,
        time_limit_minutes != null && time_limit_minutes !== '' ? parseInt(time_limit_minutes, 10) : null,
        due_date || null,
      ]
    );
    const quiz = quizResult.rows[0];
    const quizId = quiz.id;
    if (quizId == null || quizId === undefined) {
      throw new Error('Quiz insert did not return id');
    }

    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      console.log('Inserting question:', q.question_text);
      const topicIdVal = q.topic_id != null && !isNaN(parseInt(q.topic_id, 10)) ? parseInt(q.topic_id, 10) : null;
      const topicTextVal = q.topic != null ? q.topic : null;
      const questionResult = await client.query(
        `INSERT INTO questions (quiz_id, question_text, difficulty_level, topic, topic_id, correct_answer, explanation)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING id, question_text, difficulty_level, correct_answer, explanation`,
        [quizId, q.question_text, q.difficulty_level || 'medium', topicTextVal, topicIdVal, q.correct_answer || null, q.explanation || null]
      );
      const question = questionResult.rows[0];
      const questionId = question.id;

      if (q.options && Array.isArray(q.options)) {
        for (const opt of q.options) {
          await client.query(
            `INSERT INTO options (question_id, option_text, is_correct)
             VALUES ($1, $2, $3)`,
            [questionId, opt.option_text, opt.is_correct === true]
          );
        }
      }
    }

    await client.query('COMMIT');

    const bankIds = (questions || [])
      .map(function (q) { return q.question_bank_id; })
      .filter(function (id) { return id != null && id !== '' && !isNaN(parseInt(id, 10)); });
    if (bankIds.length > 0) {
      await questionBankModel.incrementTimesUsed(bankIds);
    }

    return await getQuizById(quizId);
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}

/**
 * Get all quizzes (list only, with question count and quiz rule fields).
 * When studentId is provided, includes last_score and last_passed from their attempts.
 */
async function getAllQuizzes(studentId) {
  if (studentId != null && studentId !== '') {
    const result = await pool.query(
      `SELECT q.id, q.title, q.class_id, q.created_by, q.created_at,
              COALESCE(q.pass_grade, 0)::int AS pass_grade,
              q.time_limit_minutes::int AS time_limit_minutes,
              COALESCE(q.allow_retakes, true) AS allow_retakes,
              q.due_date,
              q.shuffle_questions,
              COALESCE(q.xp_reward, 100)::int AS xp_reward,
              COALESCE(q.coin_reward, 20)::int AS coin_reward,
              (SELECT COUNT(*)::int FROM questions WHERE quiz_id = q.id) AS question_count,
              latest.score AS last_score,
              CASE
                WHEN latest.score IS NULL THEN NULL
                WHEN latest.score >= COALESCE(q.pass_grade, 0) THEN true
                ELSE false
              END AS last_passed
       FROM quizzes q
       LEFT JOIN LATERAL (
         SELECT sa.score
         FROM student_attempts sa
         WHERE sa.quiz_id = q.id AND sa.student_id = $1
         ORDER BY sa.completed_at DESC NULLS LAST
         LIMIT 1
       ) latest ON true
       ORDER BY q.created_at DESC`,
      [studentId]
    );
    return result.rows;
  }
  const result = await pool.query(
    `SELECT q.id, q.title, q.class_id, q.created_by, q.created_at,
            COALESCE(q.pass_grade, 0)::int AS pass_grade,
            q.time_limit_minutes::int AS time_limit_minutes,
            COALESCE(q.allow_retakes, true) AS allow_retakes,
            q.due_date,
            q.shuffle_questions,
            COALESCE(q.xp_reward, 100)::int AS xp_reward,
            COALESCE(q.coin_reward, 20)::int AS coin_reward,
            COUNT(questions.id)::int AS question_count,
            NULL::INTEGER AS last_score,
            NULL::BOOLEAN AS last_passed
     FROM quizzes q
     LEFT JOIN questions ON questions.quiz_id = q.id
     GROUP BY q.id, q.title, q.class_id, q.created_by, q.created_at, q.pass_grade, q.time_limit_minutes, q.allow_retakes, q.due_date, q.shuffle_questions, q.xp_reward, q.coin_reward
     ORDER BY q.created_at DESC`
  );
  return result.rows;
}

/**
 * Get quiz by id with questions and options. If shuffle_questions, order by random.
 */
async function getQuizById(id) {
  const quizResult = await pool.query(
    `SELECT id, title, class_id, created_by, created_at,
            COALESCE(shuffle_questions, false) AS shuffle_questions,
            COALESCE(pass_grade, 0) AS pass_grade,
            COALESCE(allow_retakes, true) AS allow_retakes,
            time_limit_minutes, due_date,
            COALESCE(xp_reward, 100) AS xp_reward,
            COALESCE(coin_reward, 20) AS coin_reward
     FROM quizzes WHERE id = $1`,
    [id]
  );
  if (quizResult.rows.length === 0) return null;
  const quiz = quizResult.rows[0];

  let questionsQuery;
  if (quiz.shuffle_questions === true) {
    questionsQuery = `
    SELECT q.*, COALESCE(t.name, q.topic) AS topic_name
    FROM questions q
    LEFT JOIN topics t ON t.id = q.topic_id
    WHERE q.quiz_id = $1
    ORDER BY RANDOM()
  `;
  } else {
    questionsQuery = `
    SELECT q.*, COALESCE(t.name, q.topic) AS topic_name
    FROM questions q
    LEFT JOIN topics t ON t.id = q.topic_id
    WHERE q.quiz_id = $1
    ORDER BY q.id
  `;
  }
  const questionsResult = await pool.query(questionsQuery, [id]);
  const questions = questionsResult.rows;

  for (const q of questions) {
    const optsResult = await pool.query(
      `SELECT id, question_id, option_text, is_correct
       FROM options WHERE question_id = $1 ORDER BY id`,
      [q.id]
    );
    q.options = optsResult.rows;
  }
  quiz.questions = questions;
  return quiz;
}

/**
 * Update quiz: update title; update question_text and explanation; update option_text and is_correct by option id.
 * Do NOT delete options. Match options by option_id: if present, UPDATE; else INSERT. Never delete.
 */
async function updateQuiz(id, { title, class_id, created_by, questions, shuffle_questions, pass_grade, allow_retakes, time_limit_minutes, due_date }) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    await client.query(
      `UPDATE quizzes SET title = $1, class_id = COALESCE($2, class_id), created_by = COALESCE($3, created_by),
        shuffle_questions = COALESCE($5, shuffle_questions),
        pass_grade = COALESCE($6, pass_grade),
        allow_retakes = COALESCE($7, allow_retakes),
        time_limit_minutes = $8,
        due_date = $9
       WHERE id = $4`,
      [
        title,
        class_id,
        created_by,
        id,
        shuffle_questions !== undefined ? !!shuffle_questions : null,
        pass_grade !== undefined ? (pass_grade != null && pass_grade !== '' ? parseInt(pass_grade, 10) : null) : null,
        allow_retakes !== undefined ? !!allow_retakes : null,
        time_limit_minutes !== undefined ? (time_limit_minutes != null && time_limit_minutes !== '' ? parseInt(time_limit_minutes, 10) : null) : null,
        due_date !== undefined ? due_date : null,
      ]
    );

    if (questions !== undefined && Array.isArray(questions)) {
      const quizId = id;
      await client.query(
        `DELETE FROM student_answers
         WHERE attempt_id IN (
           SELECT id FROM student_attempts WHERE quiz_id = $1
         )`,
        [quizId]
      );
      await client.query('DELETE FROM student_attempts WHERE quiz_id = $1', [quizId]);
      await client.query(
        `DELETE FROM options
         WHERE question_id IN (
           SELECT id FROM questions WHERE quiz_id = $1
         )`,
        [quizId]
      );
      await client.query('DELETE FROM questions WHERE quiz_id = $1', [quizId]);
      const verify = await client.query(
        'SELECT COUNT(*) FROM questions WHERE quiz_id = $1',
        [quizId]
      );

      const remainingCount = parseInt(verify.rows[0].count, 10) || 0;
      if (remainingCount !== 0) {
        throw new Error('Questions delete verify failed: expected 0 questions for quiz, got ' + remainingCount);
      }

      for (let i = 0; i < questions.length; i++) {
        const q = questions[i];
        const questionText = q.question_text || '';
        const explanation = q.explanation != null ? q.explanation : null;
        const options = q.options && Array.isArray(q.options) ? q.options : [];
        const topic = q.topic != null ? q.topic : null;
        const topicIdVal = q.topic_id != null && !isNaN(parseInt(q.topic_id, 10)) ? parseInt(q.topic_id, 10) : null;

        const qResult = await client.query(
          `INSERT INTO questions (quiz_id, question_text, difficulty_level, topic, topic_id, correct_answer, explanation)
           VALUES ($1, $2, $3, $4, $5, $6, $7)
           RETURNING id`,
          [id, questionText, q.difficulty_level || 'medium', topic, topicIdVal, q.correct_answer || null, explanation]
        );
        const questionId = qResult.rows[0].id;
        for (const opt of options) {
          await client.query(
            `INSERT INTO options (question_id, option_text, is_correct) VALUES ($1, $2, $3)`,
            [questionId, opt.option_text || '', opt.is_correct === true]
          );
        }
      }
    }

    await client.query('COMMIT');
    return await getQuizById(id);
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}

/**
 * Delete quiz and all related data in a transaction.
 * Order: student_answers → student_attempts → options → questions → quiz.
 * All queries use the same client connection; no pool.query() inside the transaction.
 */
async function deleteQuiz(id) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const quizCheck = await client.query('SELECT id FROM quizzes WHERE id = $1', [id]);
    if (quizCheck.rows.length === 0) {
      await client.query('ROLLBACK');
      return null;
    }

    await client.query(
      `DELETE FROM student_answers
       WHERE attempt_id IN (
         SELECT id FROM student_attempts WHERE quiz_id = $1
       )`,
      [id]
    );
    await client.query('DELETE FROM student_attempts WHERE quiz_id = $1', [id]);
    await client.query(
      `DELETE FROM options
       WHERE question_id IN (
         SELECT id FROM questions WHERE quiz_id = $1
       )`,
      [id]
    );
    await client.query('DELETE FROM questions WHERE quiz_id = $1', [id]);
    await client.query('DELETE FROM quizzes WHERE id = $1', [id]);

    await client.query('COMMIT');
    return { success: true };
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Delete quiz failed:', err);
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Get questions for a quiz (for challenge mode: can later add ORDER BY RANDOM()).
 */
async function getQuizQuestions(quizId, random = false) {
  let order = 'ORDER BY id';
  if (random) order = 'ORDER BY RANDOM()';
  const result = await pool.query(
    `SELECT id, quiz_id, question_text, difficulty_level, correct_answer
     FROM questions WHERE quiz_id = $1 ${order}`,
    [quizId]
  );
  const questions = result.rows;
  for (const q of questions) {
    const opts = await pool.query(
      'SELECT id, question_id, option_text, is_correct FROM options WHERE question_id = $1 ORDER BY id',
      [q.id]
    );
    q.options = opts.rows;
  }
  return questions;
}

/**
 * Get challenge quiz: 5 random questions from student_wrong_questions for a student.
 * Returns quiz-like shape: { title, questions } with each question having options.
 */
async function getChallengeByStudentId(studentId) {
  const id = parseInt(studentId, 10);
  if (isNaN(id)) return null;
  const wrongResult = await pool.query(
    `SELECT question_id FROM public.student_wrong_questions
     WHERE student_id = $1
     ORDER BY RANDOM()
     LIMIT 5`,
    [id]
  );
  if (wrongResult.rows.length === 0) return { title: 'Challenge', questions: [] };
  const questionIds = wrongResult.rows.map((r) => r.question_id);
  const questions = [];
  for (const qid of questionIds) {
    const qRow = await pool.query(
      `SELECT id, question_text, difficulty_level, correct_answer, explanation
       FROM questions WHERE id = $1`,
      [qid]
    );
    if (qRow.rows.length === 0) continue;
    const q = qRow.rows[0];
    const optsResult = await pool.query(
      `SELECT id, question_id, option_text, is_correct
       FROM options WHERE question_id = $1 ORDER BY id`,
      [qid]
    );
    q.options = optsResult.rows;
    questions.push(q);
  }
  return { title: 'Challenge', questions };
}

/**
 * Get quizzes for a class. When studentId is provided, includes attempt_count, last_score, last_passed.
 * Non-breaking: educator/admin call with classId only; student call with classId + studentId.
 */
async function getQuizzesByClass(classId, studentId = null) {
  const hasStudent = studentId != null && studentId !== '';
  if (hasStudent) {
    const result = await pool.query(
      `SELECT
         q.id,
         q.title,
         q.class_id,
         q.created_at,
         q.due_date,
         COALESCE(q.pass_grade, 0)::int AS pass_grade,
         COALESCE(q.xp_reward, 100)::int AS xp_reward,
         COALESCE(q.coin_reward, 20)::int AS coin_reward,
         COUNT(ques.id) AS question_count,
         CASE
           WHEN EXISTS (SELECT 1 FROM questions WHERE quiz_id = q.id AND LOWER(TRIM(difficulty_level)) = 'hard') THEN 'hard'
           WHEN EXISTS (SELECT 1 FROM questions WHERE quiz_id = q.id AND LOWER(TRIM(difficulty_level)) = 'medium') THEN 'medium'
           ELSE 'easy'
         END AS difficulty,
         (SELECT COUNT(*)::int FROM student_attempts sa WHERE sa.student_id = $2 AND sa.quiz_id = q.id) AS attempt_count,
         (SELECT sa2.score FROM student_attempts sa2 WHERE sa2.student_id = $2 AND sa2.quiz_id = q.id ORDER BY sa2.completed_at DESC NULLS LAST LIMIT 1) AS last_score,
         CASE
           WHEN (SELECT sa2.score FROM student_attempts sa2 WHERE sa2.student_id = $2 AND sa2.quiz_id = q.id ORDER BY sa2.completed_at DESC NULLS LAST LIMIT 1) IS NULL THEN NULL
           WHEN (SELECT sa2.score FROM student_attempts sa2 WHERE sa2.student_id = $2 AND sa2.quiz_id = q.id ORDER BY sa2.completed_at DESC NULLS LAST LIMIT 1) >= COALESCE(q.pass_grade, 0) THEN true
           ELSE false
         END AS last_passed
       FROM quizzes q
       LEFT JOIN questions ques ON ques.quiz_id = q.id
       WHERE q.class_id = $1
       GROUP BY q.id, q.title, q.class_id, q.created_at, q.due_date, q.pass_grade, q.xp_reward, q.coin_reward
       ORDER BY q.created_at DESC`,
      [classId, studentId]
    );
    return result.rows;
  }
  const result = await pool.query(
    `SELECT
       q.id,
       q.title,
       q.class_id,
       q.created_at,
       q.due_date,
       COALESCE(q.xp_reward, 100)::int AS xp_reward,
       COALESCE(q.coin_reward, 20)::int AS coin_reward,
       COUNT(ques.id) AS question_count,
       CASE
         WHEN EXISTS (SELECT 1 FROM questions WHERE quiz_id = q.id AND LOWER(TRIM(difficulty_level)) = 'hard') THEN 'hard'
         WHEN EXISTS (SELECT 1 FROM questions WHERE quiz_id = q.id AND LOWER(TRIM(difficulty_level)) = 'medium') THEN 'medium'
         ELSE 'easy'
       END AS difficulty
     FROM quizzes q
     LEFT JOIN questions ques ON ques.quiz_id = q.id
     WHERE q.class_id = $1
     GROUP BY q.id, q.title, q.class_id, q.created_at, q.due_date, q.xp_reward, q.coin_reward
     ORDER BY q.created_at DESC`,
    [classId]
  );
  return result.rows;
}

module.exports = {
  createQuiz,
  getAllQuizzes,
  getQuizById,
  getQuizzesByClass,
  updateQuiz,
  deleteQuiz,
  getQuizQuestions,
  getChallengeByStudentId,
};
