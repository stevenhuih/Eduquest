const csv = require('csv-parser');
const { Readable } = require('stream');
const questionBankModel = require('../models/questionBankModel');
const accessControl = require('../utils/accessControl');

const MAX_FILE_SIZE = 2 * 1024 * 1024; // 2MB
const VALID_ANSWERS = new Set(['A', 'B', 'C', 'D']);
const VALID_DIFFICULTY = new Set(['easy', 'medium', 'hard']);

/**
 * @param {object} row - CSV row (keys: Question, OptionA, OptionB, OptionC, OptionD, Answer, Explanation?, Difficulty?)
 * @param {number} rowNumber - 1-based row number (header = 1)
 * @returns {{ valid: boolean, error?: string }}
 */
function validateRow(row, rowNumber) {
  const q = (row.Question != null ? String(row.Question).trim() : '');
  if (!q) return { valid: false, error: 'Question is missing' };

  const a = (row.OptionA != null ? String(row.OptionA).trim() : '');
  const b = (row.OptionB != null ? String(row.OptionB).trim() : '');
  const c = (row.OptionC != null ? String(row.OptionC).trim() : '');
  const d = (row.OptionD != null ? String(row.OptionD).trim() : '');
  if (!a || !b || !c || !d) return { valid: false, error: 'One or more options (A–D) are missing' };

  const answer = (row.Answer != null ? String(row.Answer).trim().toUpperCase() : '');
  if (!VALID_ANSWERS.has(answer)) return { valid: false, error: 'Answer must be A, B, C, or D' };

  return { valid: true };
}

/**
 * @param {object} row - Valid CSV row
 * @param {number} classId
 * @param {number} topicId
 * @returns {{ class_id, topic_id, question_text, options, correct_index, difficulty }}
 */
function transformRow(row, classId, topicId) {
  const answer = String(row.Answer).trim().toUpperCase();
  const correctIndex = answer === 'A' ? 0 : answer === 'B' ? 1 : answer === 'C' ? 2 : 3;
  const options = [
    String(row.OptionA != null ? row.OptionA : '').trim(),
    String(row.OptionB != null ? row.OptionB : '').trim(),
    String(row.OptionC != null ? row.OptionC : '').trim(),
    String(row.OptionD != null ? row.OptionD : '').trim(),
  ];
  let difficulty = (row.Difficulty != null ? String(row.Difficulty).trim().toLowerCase() : '') || 'medium';
  if (!VALID_DIFFICULTY.has(difficulty)) difficulty = 'medium';

  return {
    class_id: classId,
    topic_id: topicId,
    question_text: String(row.Question).trim(),
    options,
    correct_index: correctIndex,
    difficulty,
  };
}

async function uploadCsv(req, res) {
  try {
    const educatorAdminId = Number(req.headers['x-educatoradmin-id']);
    const educatorId = Number(req.headers['x-educator-id']);
    const classId = req.body && req.body.classId != null ? Number(req.body.classId) : null;
    const topicId = req.body && req.body.topicId != null ? Number(req.body.topicId) : null;

    if (!classId || isNaN(classId)) {
      return res.status(400).json({ error: 'classId is required' });
    }
    if (topicId == null || isNaN(Number(topicId))) {
      return res.status(400).json({ error: 'topicId is required' });
    }

    const allowed =
      (!isNaN(educatorId) && (await accessControl.canEducatorAccessClass(educatorId, classId))) ||
      (!isNaN(educatorAdminId) && (await accessControl.canEducatorAdminAccessClass(educatorAdminId, classId)));
    if (!allowed) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    if (!req.file || !req.file.buffer) {
      return res.status(400).json({ error: 'CSV file is required' });
    }

    const rows = await new Promise((resolve, reject) => {
      const results = [];
      const stream = Readable.from(req.file.buffer);
      stream
        .pipe(csv({ skipLines: 0 }))
        .on('data', (data) => results.push(data))
        .on('end', () => resolve(results))
        .on('error', reject);
    });

    const valid = [];
    const errors = [];
    let rowNumber = 1; // header is first line; first data row is 2
    for (const row of rows) {
      rowNumber++;
      const validation = validateRow(row, rowNumber);
      if (!validation.valid) {
        errors.push({ rowNumber, error: validation.error });
        continue;
      }
      valid.push(transformRow(row, classId, topicId));
    }

    let inserted = 0;
    if (valid.length > 0) {
      const result = await questionBankModel.insertQuestionsBatch(valid);
      inserted = result.inserted;
    }

    return res.json({ inserted, errors });
  } catch (err) {
    console.error('Upload CSV error:', err);
    return res.status(500).json({ error: err.message || 'Failed to process CSV' });
  }
}

module.exports = { uploadCsv };
