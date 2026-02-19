const attemptModel = require('../models/attemptModel');
const studentModel = require('../models/studentModel');
const rewardService = require('../services/rewardService');
const { pool } = require('../db');

/** Quiz rewards by difficulty: Easy 40 XP / 10 coins, Medium 80/20, Hard 150/40 */
const QUIZ_REWARDS = {
  easy: { xp: 40, coins: 10 },
  medium: { xp: 80, coins: 20 },
  hard: { xp: 150, coins: 40 },
};

async function createAttempt(req, res) {
  try {
    const studentId = Number(req.headers['x-student-id']);
    if (studentId == null || isNaN(studentId)) {
      return res.status(401).json({ error: 'x-student-id header is required' });
    }
    const { quiz_id, answers } = req.body;
    if (quiz_id == null || !Array.isArray(answers)) {
      return res.status(400).json({
        error: 'quiz_id and answers array are required',
      });
    }
    const retakeCheck = await attemptModel.checkRetakeAllowed(studentId, quiz_id);
    if (!retakeCheck.allowed) {
      return res.status(403).json({ error: 'You have already attempted this quiz.' });
    }
    const attemptResult = await attemptModel.createAttempt(studentId, quiz_id, answers);
    const passed = attemptResult.passed;
    const difficulty = await attemptModel.getQuizDifficulty(quiz_id);
    const rewards = QUIZ_REWARDS[difficulty] || QUIZ_REWARDS.medium;
    const xpEarned = passed ? rewards.xp : Math.floor(rewards.xp / 2);
    const coinsEarned = passed ? rewards.coins : Math.floor(rewards.coins / 2);

    let leveledUp = false;
    let newLevel = null;

    if (attemptResult.class_id) {
      const result = await rewardService.applyRewards(studentId, attemptResult.class_id, xpEarned, coinsEarned, pool);
      leveledUp = result.leveledUp;
      newLevel = result.newLevel;
    } else {
      await studentModel.incrementStudentXP(studentId, xpEarned);
      await studentModel.addCoins(studentId, coinsEarned);
    }

    const totalCoins = await studentModel.getCoins(studentId);
    const totalXp = attemptResult.class_id
      ? await studentModel.getStudentXPForClass(studentId, attemptResult.class_id)
      : await studentModel.getStudentXP(studentId);

    res.status(201).json({
      ...attemptResult,
      passed,
      xpEarned,
      coinsEarned,
      leveledUp,
      newLevel,
      totalXp,
      totalCoins
    });
  } catch (err) {
    console.error('createAttempt error:', err);
    res.status(500).json({ error: err.message || 'Failed to submit attempt' });
  }
}

async function getTopicPerformance(req, res) {
  try {
    const studentId = Number(req.params.studentId);
    if (!studentId) {
      return res.status(400).json({ error: 'Invalid student id' });
    }
    const data = await attemptModel.getStudentTopicPerformance(studentId);
    res.json(data);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to load performance' });
  }
}

async function getTopicPerformanceForClass(req, res) {
  try {
    const studentId = Number(req.params.studentId);
    const classId = Number(req.params.classId);
    if (!studentId || !classId) {
      return res.status(400).json({ error: 'Invalid student id or class id' });
    }
    const data = await attemptModel.getStudentTopicPerformance(studentId, classId);
    res.json(data);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to load performance' });
  }
}

async function getClassTopicPerformance(req, res) {
  try {
    const classId = Number(req.params.classId);
    if (!classId) {
      return res.status(400).json({ error: 'Invalid class id' });
    }
    const data = await attemptModel.getClassTopicPerformance(classId);
    res.json(data);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to load class performance' });
  }
}

async function getTopicPerformanceForTopic(req, res) {
  try {
    const studentId = Number(req.params.studentId);
    const topic = req.params.topic && String(req.params.topic).trim();
    if (!studentId || !topic) {
      return res.status(400).json({ error: 'Invalid student id or topic' });
    }
    const data = await attemptModel.getStudentTopicPerformanceForTopic(studentId, topic);
    res.json(data);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to load topic performance' });
  }
}

async function getWeakestTopicForClass(req, res) {
  try {
    const classId = Number(req.params.classId);
    if (!classId) {
      return res.status(400).json({ error: 'Invalid classId' });
    }

    const rows = await attemptModel.getClassTopicPerformance(classId);

    if (!rows || rows.length === 0) {
      return res.json({ topic: null, accuracy: null });
    }

    // weakest topic is first row (sorted ascending); include topic_id for challenge/question bank
    const first = rows[0];
    res.json({
      topic: first.topic_name != null ? first.topic_name : first.topic,
      topic_id: first.topic_id,
      accuracy: first.accuracy
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to load class performance' });
  }
}

module.exports = {
  createAttempt,
  getTopicPerformance,
  getTopicPerformanceForClass,
  getClassTopicPerformance,
  getTopicPerformanceForTopic,
  getWeakestTopicForClass
};
