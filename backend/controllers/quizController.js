const quizModel = require('../models/quizModel');
const attemptModel = require('../models/attemptModel');
const accessControl = require('../utils/accessControl');

function validateCreateQuizBody(body) {
  const { title, questions } = body;
  if (!title || typeof title !== 'string' || !title.trim()) {
    return { valid: false, error: 'Quiz title is required' };
  }
  if (!questions || !Array.isArray(questions) || questions.length === 0) {
    return { valid: false, error: 'At least one question is required' };
  }
  for (let i = 0; i < questions.length; i++) {
    const q = questions[i];
    const { question_text, difficulty_level, topic, options, explanation, question_bank_id } = q;
    if (!topic || typeof topic !== 'string' || topic.trim() === '') {
      return { valid: false, error: 'Question topic is required' };
    }
    if (!q.question_text || typeof q.question_text !== 'string' || !String(q.question_text).trim()) {
      return { valid: false, error: `Question ${i + 1}: question text is required` };
    }
    const opts = q.options;
    if (!opts || !Array.isArray(opts) || opts.length < 2) {
      return { valid: false, error: `Question ${i + 1}: at least 2 options are required` };
    }
    let correctCount = 0;
    for (let j = 0; j < opts.length; j++) {
      const o = opts[j];
      if (!o.option_text || typeof o.option_text !== 'string' || !String(o.option_text).trim()) {
        return { valid: false, error: `Question ${i + 1}: option ${j + 1} cannot be empty` };
      }
      if (o.is_correct === true) correctCount++;
    }
    if (correctCount !== 1) {
      return { valid: false, error: `Question ${i + 1}: exactly one option must be marked correct` };
    }
  }
  return { valid: true };
}

async function createQuiz(req, res) {
  try {
    const educatorAdminId = Number(req.headers['x-educatoradmin-id']);
    const educatorId = Number(req.headers['x-educator-id']);
    const { title, class_id, created_by, questions } = req.body;
    const validation = validateCreateQuizBody(req.body);
    if (!validation.valid) {
      return res.status(400).json({ error: validation.error });
    }
    const classId = class_id != null ? Number(class_id) : null;
    if (classId == null || isNaN(classId)) {
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
    const quiz = await quizModel.createQuiz({
      title,
      class_id: classId,
      created_by: created_by ?? educatorAdminId ?? educatorId ?? null,
      questions,
      shuffle_questions: req.body.shuffle_questions,
      pass_grade: req.body.pass_grade,
      allow_retakes: req.body.allow_retakes,
      time_limit_minutes: req.body.time_limit_minutes,
      due_date: req.body.due_date,
    });
    res.status(201).json(quiz);
  } catch (err) {
    console.error('createQuiz error:', err);
    res.status(500).json({ error: err.message || 'Failed to create quiz' });
  }
}

async function getAllQuizzes(req, res) {
  res.status(403).json({ error: 'Use scoped endpoint GET /api/quizzes/class/:classId with x-educatoradmin-id or x-educator-id header' });
}

async function getQuizById(req, res) {
  try {
    const educatorAdminId = Number(req.headers['x-educatoradmin-id']);
    const educatorId = Number(req.headers['x-educator-id']);
    const studentIdHeader = Number(req.headers['x-student-id']);
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json({ error: 'Invalid quiz id' });
    const quiz = await quizModel.getQuizById(id);
    if (!quiz) return res.status(404).json({ error: 'Quiz not found' });
    const classId = quiz.class_id;
    if (classId != null) {
      if (!isNaN(educatorAdminId)) {
        const ok = await accessControl.canEducatorAdminAccessClass(educatorAdminId, classId);
        if (!ok) return res.status(403).json({ error: 'Forbidden' });
      } else if (!isNaN(educatorId)) {
        const ok = await accessControl.canEducatorAccessClass(educatorId, classId);
        if (!ok) return res.status(403).json({ error: 'Forbidden' });
      } else if (!isNaN(studentIdHeader)) {
        const ok = await accessControl.isStudentInClass(studentIdHeader, classId);
        if (!ok) return res.status(403).json({ error: 'Forbidden' });
      } else {
        return res.status(403).json({ error: 'Forbidden' });
      }
    }
    if (quiz.due_date && new Date() > new Date(quiz.due_date)) {
      return res.status(403).json({ error: 'Quiz is no longer available.' });
    }
    const studentId = !isNaN(studentIdHeader) ? studentIdHeader : req.query.student_id;
    if (studentId) {
      const retakeCheck = await attemptModel.checkRetakeAllowed(studentId, id);
      if (!retakeCheck.allowed) {
        return res.status(403).json({ error: 'You have already attempted this quiz.' });
      }
    }
    res.json(quiz);
  } catch (err) {
    console.error('getQuizById error:', err);
    res.status(500).json({ error: err.message || 'Failed to fetch quiz' });
  }
}

async function getQuizzesByClass(req, res) {
  try {
    const educatorAdminId = Number(req.headers['x-educatoradmin-id']);
    const educatorId = Number(req.headers['x-educator-id']);
    const studentIdHeader = Number(req.headers['x-student-id']);
    const classId = Number(req.params.classId);
    if (classId == null || isNaN(classId)) {
      return res.status(400).json({ error: 'Invalid classId' });
    }
    if (!isNaN(educatorAdminId)) {
      const ok = await accessControl.canEducatorAdminAccessClass(educatorAdminId, classId);
      if (!ok) return res.status(403).json({ error: 'Forbidden' });
    } else if (!isNaN(educatorId)) {
      const ok = await accessControl.canEducatorAccessClass(educatorId, classId);
      if (!ok) return res.status(403).json({ error: 'Forbidden' });
    } else if (!isNaN(studentIdHeader)) {
      const ok = await accessControl.isStudentInClass(studentIdHeader, classId);
      if (!ok) return res.status(403).json({ error: 'Forbidden' });
    } else {
      return res.status(403).json({ error: 'Forbidden' });
    }
    const quizzes = !isNaN(studentIdHeader)
      ? await quizModel.getQuizzesByClass(classId, studentIdHeader)
      : await quizModel.getQuizzesByClass(classId);
    res.json(quizzes);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to load quizzes' });
  }
}

async function updateQuiz(req, res) {
  try {
    const educatorAdminId = Number(req.headers['x-educatoradmin-id']);
    const educatorId = Number(req.headers['x-educator-id']);
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json({ error: 'Invalid quiz id' });
    const existing = await quizModel.getQuizById(id);
    if (!existing) return res.status(404).json({ error: 'Quiz not found' });
    const classId = existing.class_id;
    if (classId != null) {
      if (!isNaN(educatorAdminId)) {
        const ok = await accessControl.canEducatorAdminAccessClass(educatorAdminId, classId);
        if (!ok) return res.status(403).json({ error: 'Forbidden' });
      } else if (!isNaN(educatorId)) {
        const ok = await accessControl.canEducatorAccessClass(educatorId, classId);
        if (!ok) return res.status(403).json({ error: 'Forbidden' });
      } else {
        return res.status(403).json({ error: 'Forbidden' });
      }
    }
    if (req.body.questions !== undefined) {
      const validation = validateCreateQuizBody({
        title: req.body.title != null ? req.body.title : 'Quiz',
        questions: req.body.questions,
      });
      if (!validation.valid) {
        return res.status(400).json({ error: validation.error });
      }
    }
    const { title, class_id, created_by, questions, shuffle_questions, pass_grade, allow_retakes, time_limit_minutes, due_date } = req.body;
    const quiz = await quizModel.updateQuiz(id, {
      title,
      class_id: class_id != null ? class_id : existing.class_id,
      created_by: created_by != null ? created_by : existing.created_by,
      questions,
      shuffle_questions,
      pass_grade,
      allow_retakes,
      time_limit_minutes,
      due_date,
    });
    res.json(quiz);
  } catch (err) {
    console.error('updateQuiz error:', err);
    res.status(500).json({ error: err.message || 'Failed to update quiz' });
  }
}

async function deleteQuiz(req, res) {
  try {
    const educatorAdminId = Number(req.headers['x-educatoradmin-id']);
    const educatorId = Number(req.headers['x-educator-id']);
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json({ error: 'Invalid quiz id' });
    const existing = await quizModel.getQuizById(id);
    if (!existing) return res.status(404).json({ error: 'Quiz not found' });
    const classId = existing.class_id;
    if (classId != null) {
      if (!isNaN(educatorAdminId)) {
        const ok = await accessControl.canEducatorAdminAccessClass(educatorAdminId, classId);
        if (!ok) return res.status(403).json({ error: 'Forbidden' });
      } else if (!isNaN(educatorId)) {
        const ok = await accessControl.canEducatorAccessClass(educatorId, classId);
        if (!ok) return res.status(403).json({ error: 'Forbidden' });
      } else {
        return res.status(403).json({ error: 'Forbidden' });
      }
    }
    const result = await quizModel.deleteQuiz(id);
    if (!result) return res.status(404).json({ error: 'Quiz not found' });
    res.json({ success: true });
  } catch (err) {
    console.error('deleteQuiz error:', err);
    res.status(500).json({ error: err.message || 'Failed to delete quiz' });
  }
}

async function getChallenge(req, res) {
  try {
    const studentId = req.params.studentId;
    const challenge = await quizModel.getChallengeByStudentId(studentId);
    if (!challenge) return res.status(400).json({ error: 'Invalid student id' });
    res.json(challenge);
  } catch (err) {
    console.error('getChallenge error:', err);
    res.status(500).json({ error: err.message || 'Failed to fetch challenge' });
  }
}

module.exports = {
  createQuiz,
  getAllQuizzes,
  getQuizById,
  getQuizzesByClass,
  updateQuiz,
  deleteQuiz,
  getChallenge,
};
