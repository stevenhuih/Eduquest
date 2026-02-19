const { pool } = require('../db');

/**
 * Create a question bank entry with options (transaction).
 * Accepts topic_id (preferred) or topic text for backward compatibility.
 * @param {{ class_id: number, topic_id?: number, topic?: string, difficulty: string, question_text: string, created_by?: number, options: Array }}
 * @returns {{ id: number }}
 */
async function createQuestion({ class_id, topic_id, topic, difficulty, question_text, created_by, options }) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const topicIdVal = topic_id != null && !isNaN(parseInt(topic_id, 10)) ? parseInt(topic_id, 10) : null;
    const topicTextVal = topic != null ? String(topic).trim() : '';

    const questionResult = await client.query(
      `INSERT INTO question_bank (class_id, topic, difficulty, question_text, created_by, topic_id)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id`,
      [
        class_id,
        topicTextVal,
        difficulty || 'medium',
        question_text || '',
        created_by != null ? parseInt(created_by, 10) : null,
        topicIdVal,
      ]
    );
    const questionId = questionResult.rows[0].id;

    const opts = options && Array.isArray(options) ? options : [];
    for (const opt of opts) {
      await client.query(
        `INSERT INTO question_bank_options (question_id, option_text, is_correct)
         VALUES ($1, $2, $3)`,
        [questionId, opt.option_text || '', opt.is_correct === true]
      );
    }

    await client.query('COMMIT');
    return { id: questionId };
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}

/**
 * Get all question bank questions for a class, with options.
 * JOINs topics to return topic_name; falls back to topic text when topic_id is NULL.
 * Order by created_at DESC.
 */
async function getQuestionsByClassId(classId) {
  const id = Number(classId);
  if (classId == null || isNaN(id)) return [];

  const questionsResult = await pool.query(
    `SELECT qb.id, qb.class_id, qb.topic, qb.difficulty, qb.question_text, qb.created_by, qb.created_at,
            qb.topic_id,
            COALESCE(t.name, qb.topic) AS topic_name
     FROM question_bank qb
     LEFT JOIN topics t ON t.id = qb.topic_id
     WHERE qb.class_id = $1
     ORDER BY qb.created_at DESC`,
    [id]
  );
  const questions = questionsResult.rows;

  for (const q of questions) {
    const optsResult = await pool.query(
      `SELECT id, question_id, option_text, is_correct
       FROM question_bank_options
       WHERE question_id = $1
       ORDER BY id`,
      [q.id]
    );
    q.options = optsResult.rows;
  }

  return questions;
}

exports.getAllQuestions = async () => {
  const result = await pool.query(`
    SELECT qb.id, qb.topic, qb.difficulty, qb.question_text,
           json_agg(
             json_build_object(
               'option_text', qbo.option_text,
               'is_correct', qbo.is_correct
             )
           ) AS options
    FROM question_bank qb
    LEFT JOIN question_bank_options qbo
      ON qb.id = qbo.question_id
    GROUP BY qb.id
    ORDER BY qb.id DESC
  `);

  return result.rows;
};

exports.updateQuestion = async (id, { topic_id, topic, difficulty, question_text, options }) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(
      'DELETE FROM question_bank_options WHERE question_id = $1',
      [id]
    );
    const topicIdVal = topic_id != null && !isNaN(parseInt(topic_id, 10)) ? parseInt(topic_id, 10) : null;
    const topicTextVal = topic != null ? String(topic).trim() : '';
    await client.query(
      'UPDATE question_bank SET topic = $2, difficulty = $3, question_text = $4, topic_id = $5 WHERE id = $1',
      [id, topicTextVal, difficulty || 'medium', question_text || '', topicIdVal]
    );
    const opts = options && Array.isArray(options) ? options : [];
    for (const opt of opts) {
      await client.query(
        `INSERT INTO question_bank_options (question_id, option_text, is_correct)
         VALUES ($1, $2, $3)`,
        [id, opt.option_text || '', opt.is_correct === true]
      );
    }
    await client.query('COMMIT');
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
};

exports.deleteQuestion = async (id) => {
  await pool.query(
    'DELETE FROM question_bank_options WHERE question_id = $1',
    [id]
  );
  await pool.query(
    'DELETE FROM question_bank WHERE id = $1',
    [id]
  );
};

/**
 * Get class_id for a question bank entry (for access control).
 * @returns {Promise<number|null>}
 */
async function getQuestionClassId(questionId) {
  const id = parseInt(questionId, 10);
  if (isNaN(id)) return null;
  const result = await pool.query(
    'SELECT class_id FROM question_bank WHERE id = $1',
    [id]
  );
  const row = result.rows[0];
  return row && row.class_id != null ? Number(row.class_id) : null;
}

/**
 * Get questions for challenge mode: filter by class, topic (topic_id or topic text) and preferred difficulty.
 * topic can be a number (topic_id) or string (topic text for backward compat). classId is required.
 * Returns array of { id, question_text, options } (quiz-like format).
 */
async function getQuestionsForChallenge(topic, difficulty, count, classId) {
  const limit = Math.min(Math.max(parseInt(count, 10) || 5, 1), 100);
  const preferredDifficulty = difficulty || 'medium';
  if (classId == null) return [];

  const byTopicId = typeof topic === 'number' && !isNaN(topic);
  const topicCondition = byTopicId ? 'topic_id = $2' : 'topic = $2';
  const params1 = [classId, topic, preferredDifficulty, limit];

  let questionsResult = await pool.query(
    `SELECT id, question_text
     FROM question_bank
     WHERE class_id = $1 AND ${topicCondition} AND difficulty = $3
     ORDER BY COALESCE(times_used, 0) ASC
     LIMIT $4`,
    params1
  );
  let questions = questionsResult.rows;

  if (questions.length < limit) {
    const haveIds = questions.map(function (q) { return q.id; });
    const need = limit - questions.length;
    const fallbackResult = haveIds.length > 0
      ? await pool.query(
          `SELECT id, question_text
           FROM question_bank
           WHERE class_id = $1 AND ${topicCondition} AND NOT (id = ANY($3))
           ORDER BY COALESCE(times_used, 0) ASC
           LIMIT $4`,
          [classId, topic, haveIds, need]
        )
      : await pool.query(
          `SELECT id, question_text
           FROM question_bank
           WHERE class_id = $1 AND ${topicCondition}
           ORDER BY COALESCE(times_used, 0) ASC
           LIMIT $3`,
          [classId, topic, need]
        );
    questions = questions.concat(fallbackResult.rows);
  }

  for (const q of questions) {
    const optsResult = await pool.query(
      `SELECT id, option_text, is_correct
       FROM question_bank_options
       WHERE question_id = $1
       ORDER BY id`,
      [q.id]
    );
    q.options = optsResult.rows;
  }
  return questions;
}

/**
 * Get distinct topics available in question_bank for a class (for challenge fallback when no weaknesses).
 * Returns array of { topic_id, topic, topic_name }.
 */
async function getTopicsForClass(classId) {
  const id = parseInt(classId, 10);
  if (isNaN(id)) return [];
  const result = await pool.query(
    `SELECT DISTINCT qb.topic_id, qb.topic, COALESCE(t.name, qb.topic) AS topic_name
     FROM question_bank qb
     LEFT JOIN topics t ON t.id = qb.topic_id
     WHERE qb.class_id = $1
     ORDER BY qb.topic_id NULLS LAST, qb.topic`,
    [id]
  );
  return result.rows || [];
}

/**
 * Get questions for boss challenge: multiple topics, one difficulty, from question_bank only.
 * Picks questions from across available topics for the class and shuffles.
 */
async function getQuestionsForBossChallenge(classId, difficulty, count) {
  const limit = Math.min(Math.max(parseInt(count, 10) || 5, 1), 50);
  const preferredDifficulty = (difficulty && String(difficulty).trim()) || 'medium';
  if (classId == null) return [];

  const questionsResult = await pool.query(
    `SELECT id, question_text
     FROM question_bank
     WHERE class_id = $1 AND difficulty = $2
     ORDER BY COALESCE(times_used, 0) ASC, RANDOM()
     LIMIT $3`,
    [classId, preferredDifficulty, limit]
  );
  let questions = questionsResult.rows || [];

  if (questions.length < limit) {
    const haveIds = questions.map(function (q) { return q.id; });
    const need = limit - questions.length;
    const fallbackResult = haveIds.length > 0
      ? await pool.query(
          `SELECT id, question_text
           FROM question_bank
           WHERE class_id = $1 AND difficulty = $2 AND NOT (id = ANY($3))
           ORDER BY COALESCE(times_used, 0) ASC, RANDOM()
           LIMIT $4`,
          [classId, preferredDifficulty, haveIds, need]
        )
      : await pool.query(
          `SELECT id, question_text
           FROM question_bank
           WHERE class_id = $1 AND difficulty = $2
           ORDER BY COALESCE(times_used, 0) ASC, RANDOM()
           LIMIT $3`,
          [classId, preferredDifficulty, need]
        );
    questions = questions.concat(fallbackResult.rows || []);
  }

  for (const q of questions) {
    const optsResult = await pool.query(
      `SELECT id, option_text, is_correct
       FROM question_bank_options
       WHERE question_id = $1
       ORDER BY id`,
      [q.id]
    );
    q.options = optsResult.rows || [];
  }
  return questions;
}

/**
 * Get up to `count` questions from the class (any topic, any difficulty). Last-resort fallback for challenges.
 */
async function getRandomQuestionsFromClass(classId, count) {
  const limit = Math.min(Math.max(parseInt(count, 10) || 3, 1), 50);
  if (classId == null) return [];
  const questionsResult = await pool.query(
    `SELECT id, question_text
     FROM question_bank
     WHERE class_id = $1
     ORDER BY RANDOM()
     LIMIT $2`,
    [classId, limit]
  );
  const questions = questionsResult.rows || [];
  for (const q of questions) {
    const optsResult = await pool.query(
      `SELECT id, option_text, is_correct
       FROM question_bank_options
       WHERE question_id = $1
       ORDER BY id`,
      [q.id]
    );
    q.options = optsResult.rows || [];
  }
  return questions;
}

/**
 * Increment times_used for question bank entries that were used in a quiz.
 * @param {number[]} questionIds - Array of question_bank id values
 */
function incrementTimesUsed(questionIds) {
  if (!questionIds || !Array.isArray(questionIds) || questionIds.length === 0) {
    return Promise.resolve();
  }
  const ids = questionIds.filter(function (id) {
    var n = parseInt(id, 10);
    return !isNaN(n) && n > 0;
  });
  if (ids.length === 0) return Promise.resolve();
  return pool.query(
    'UPDATE question_bank SET times_used = times_used + 1 WHERE id = ANY($1)',
    [ids]
  );
}

module.exports = {
  createQuestion,
  getQuestionsByClassId,
  getQuestionClassId,
  getAllQuestions: exports.getAllQuestions,
  getQuestionsForChallenge,
  getTopicsForClass,
  getQuestionsForBossChallenge,
  getRandomQuestionsFromClass,
  updateQuestion: exports.updateQuestion,
  deleteQuestion: exports.deleteQuestion,
  incrementTimesUsed,
};
