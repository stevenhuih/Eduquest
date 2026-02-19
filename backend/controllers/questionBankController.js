const questionBankModel = require('../models/questionBankModel');
const accessControl = require('../utils/accessControl');

function validateCreateQuestionBody(body) {
  const { class_id, topic_id, topic, difficulty, question_text, options } = body;
  if (class_id == null || isNaN(parseInt(class_id, 10))) {
    return { valid: false, error: 'class_id is required and must be a number' };
  }
  const hasTopicId = topic_id != null && !isNaN(parseInt(topic_id, 10));
  const hasTopicText = topic != null && typeof topic === 'string' && String(topic).trim();
  if (!hasTopicId && !hasTopicText) {
    return { valid: false, error: 'topic_id or topic is required' };
  }
  if (!difficulty || typeof difficulty !== 'string' || !String(difficulty).trim()) {
    return { valid: false, error: 'difficulty is required' };
  }
  if (!question_text || typeof question_text !== 'string' || !String(question_text).trim()) {
    return { valid: false, error: 'question_text is required' };
  }
  if (!options || !Array.isArray(options) || options.length < 2) {
    return { valid: false, error: 'At least 2 options are required' };
  }
  let correctCount = 0;
  for (let i = 0; i < options.length; i++) {
    const o = options[i];
    if (!o.option_text || typeof o.option_text !== 'string' || !String(o.option_text).trim()) {
      return { valid: false, error: `Option ${i + 1} cannot be empty` };
    }
    if (o.is_correct === true) correctCount++;
  }
  if (correctCount !== 1) {
    return { valid: false, error: 'Exactly one option must be marked correct' };
  }
  return { valid: true };
}

async function createQuestion(req, res) {
  try {
    const educatorAdminId = Number(req.headers['x-educatoradmin-id']);
    const educatorId = Number(req.headers['x-educator-id']);
    const validation = validateCreateQuestionBody(req.body);
    if (!validation.valid) {
      return res.status(400).json({ error: validation.error });
    }
    const { class_id, topic_id, topic, difficulty, question_text, created_by, options } = req.body;
    const classId = parseInt(class_id, 10);
    if (isNaN(classId)) {
      return res.status(400).json({ error: 'class_id is required' });
    }
    if (!isNaN(educatorAdminId)) {
      const ok = await accessControl.canEducatorAdminAccessClass(educatorAdminId, classId);
      if (!ok) return res.status(403).json({ error: 'Forbidden' });
    } else if (!isNaN(educatorId)) {
      const ok = await accessControl.canEducatorAccessClass(educatorId, classId);
      if (!ok) return res.status(403).json({ error: 'Forbidden' });
    } else {
      return res.status(403).json({ error: 'Forbidden' });
    }
    const result = await questionBankModel.createQuestion({
      class_id: classId,
      topic_id: topic_id != null ? parseInt(topic_id, 10) : undefined,
      topic: topic != null ? String(topic).trim() : undefined,
      difficulty: String(difficulty).trim(),
      question_text: String(question_text).trim(),
      created_by: created_by != null ? parseInt(created_by, 10) : null,
      options,
    });
    res.status(201).json(result);
  } catch (err) {
    console.error('createQuestion (question bank) error:', err);
    res.status(500).json({ error: err.message || 'Failed to create question' });
  }
}

/** Global list disabled. Use GET /api/question-bank/class/:classId with access headers. */
exports.getAllQuestions = async (req, res) => {
  res.status(403).json({ error: 'Use scoped endpoint GET /api/question-bank/class/:classId with x-educatoradmin-id or x-educator-id header' });
};

function validateUpdateQuestionBody(body) {
  const { topic_id, topic, difficulty, question_text, options } = body;
  const hasTopicId = topic_id != null && !isNaN(parseInt(topic_id, 10));
  const hasTopicText = topic != null && typeof topic === 'string';
  if (!hasTopicId && !hasTopicText) {
    return { valid: false, error: 'topic_id or topic is required' };
  }
  if (!difficulty || typeof difficulty !== 'string' || !String(difficulty).trim()) {
    return { valid: false, error: 'difficulty is required' };
  }
  if (!question_text || typeof question_text !== 'string' || !String(question_text).trim()) {
    return { valid: false, error: 'question_text is required' };
  }
  if (!options || !Array.isArray(options) || options.length < 2) {
    return { valid: false, error: 'At least 2 options are required' };
  }
  let correctCount = 0;
  for (let i = 0; i < options.length; i++) {
    const o = options[i];
    if (!o.option_text || typeof o.option_text !== 'string' || !String(o.option_text).trim()) {
      return { valid: false, error: `Option ${i + 1} cannot be empty` };
    }
    if (o.is_correct === true) correctCount++;
  }
  if (correctCount !== 1) {
    return { valid: false, error: 'Exactly one option must be marked correct' };
  }
  return { valid: true };
}

exports.updateQuestion = async (req, res) => {
  try {
    const educatorAdminId = Number(req.headers['x-educatoradmin-id']);
    const educatorId = Number(req.headers['x-educator-id']);
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      return res.status(400).json({ error: 'Invalid question id' });
    }
    const classId = await questionBankModel.getQuestionClassId(id);
    if (classId == null) {
      return res.status(404).json({ error: 'Question not found' });
    }
    if (!isNaN(educatorAdminId)) {
      const ok = await accessControl.canEducatorAdminAccessClass(educatorAdminId, classId);
      if (!ok) return res.status(403).json({ error: 'Forbidden' });
    } else if (!isNaN(educatorId)) {
      const ok = await accessControl.canEducatorAccessClass(educatorId, classId);
      if (!ok) return res.status(403).json({ error: 'Forbidden' });
    } else {
      return res.status(403).json({ error: 'Forbidden' });
    }
    const validation = validateUpdateQuestionBody(req.body);
    if (!validation.valid) {
      return res.status(400).json({ error: validation.error });
    }
    const { topic_id, topic, difficulty, question_text, options } = req.body;
    await questionBankModel.updateQuestion(id, {
      topic_id: topic_id != null ? parseInt(topic_id, 10) : undefined,
      topic: topic != null ? String(topic).trim() : undefined,
      difficulty: String(difficulty).trim(),
      question_text: String(question_text).trim(),
      options,
    });
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update question' });
  }
};

exports.deleteQuestion = async (req, res) => {
  try {
    const educatorAdminId = Number(req.headers['x-educatoradmin-id']);
    const educatorId = Number(req.headers['x-educator-id']);
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      return res.status(400).json({ error: 'Invalid question id' });
    }
    const classId = await questionBankModel.getQuestionClassId(id);
    if (classId == null) {
      return res.status(404).json({ error: 'Question not found' });
    }
    if (!isNaN(educatorAdminId)) {
      const ok = await accessControl.canEducatorAdminAccessClass(educatorAdminId, classId);
      if (!ok) return res.status(403).json({ error: 'Forbidden' });
    } else if (!isNaN(educatorId)) {
      const ok = await accessControl.canEducatorAccessClass(educatorId, classId);
      if (!ok) return res.status(403).json({ error: 'Forbidden' });
    } else {
      return res.status(403).json({ error: 'Forbidden' });
    }
    await questionBankModel.deleteQuestion(id);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to delete question' });
  }
};

async function getByClassId(req, res) {
  try {
    const educatorId = Number(req.headers['x-educator-id']);
    const adminId = Number(req.headers['x-educatoradmin-id']);
    const classId = Number(req.params.classId);
    if (isNaN(classId)) {
      return res.status(400).json({ error: 'Invalid class id' });
    }
    const allowed =
      (!isNaN(educatorId) && (await accessControl.canEducatorAccessClass(educatorId, classId))) ||
      (!isNaN(adminId) && (await accessControl.canEducatorAdminAccessClass(adminId, classId)));
    if (!allowed) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    const questions = await questionBankModel.getQuestionsByClassId(classId);
    console.log('QB Fetch:', { classId, resultLength: Array.isArray(questions) ? questions.length : 0 });
    res.json(questions);
  } catch (err) {
    console.error('getByClassId (question bank) error:', err);
    res.status(500).json({ error: err.message || 'Failed to fetch questions' });
  }
}

module.exports = {
  createQuestion,
  getAllQuestions: exports.getAllQuestions,
  getByClassId,
  updateQuestion: exports.updateQuestion,
  deleteQuestion: exports.deleteQuestion,
};
