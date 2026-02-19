const attemptModel = require('../models/attemptModel');
const questionBankModel = require('../models/questionBankModel');
const challengeModel = require('../models/challengeModel');
const studentProgressModel = require('../models/studentProgressModel');
const rewardService = require('../services/rewardService');
const { pool } = require('../db');
const topicProgression = require('../config/topicProgression');
const accessControl = require('../utils/accessControl');

const CHALLENGE_PASS_GRADE = 60;

/** Challenges give XP only (no coins). Easy 20, Medium 35, Hard 60, Boss 120. */
const ADAPTIVE_REWARDS_XP = {
  easy: 20,
  medium: 35,
  hard: 60,
};

const BOSS_REWARDS_XP = {
  easy: 20,
  medium: 35,
  hard: 60,
  boss: 120,
};

function difficultyFromAccuracy(acc) {
  if (acc < 40) return 'easy';
  if (acc < 75) return 'medium';
  return 'hard';
}

function xpFromDifficulty(diff) {
  if (diff === 'easy') return 10;
  if (diff === 'medium') return 20;
  if (diff === 'hard') return 30;
  return 10;
}

function requiredLevelForDifficulty(diff) {
  if (diff === 'easy') return 1;
  if (diff === 'medium') return 3;
  if (diff === 'hard') return 5;
  return 1;
}

function allowedDifficultiesForLevel(level) {
  if (level <= 2) return ['easy'];
  if (level <= 4) return ['easy', 'medium'];
  return ['easy', 'medium', 'hard'];
}

function getRequiredTopicFor(topic) {
  var topicLower = (topic || '').toLowerCase().trim();
  var entry = (topicProgression || []).find(function (e) { return (e.unlocks || '').toLowerCase() === topicLower; });
  return entry ? entry.topic : null;
}

async function getUnlockedTopics(studentId, classId) {
  var unlocked = ['addition'];
  var mastered = await attemptModel.getMasteredTopics(studentId, classId);
  var masteredLower = (mastered || []).map(function (t) { return (t || '').toLowerCase().trim(); });
  (topicProgression || []).forEach(function (entry) {
    var topicLower = (entry.topic || '').toLowerCase();
    var unlocksLower = (entry.unlocks || '').toLowerCase();
    if (masteredLower.indexOf(topicLower) !== -1 && unlocked.indexOf(unlocksLower) === -1) {
      unlocked.push(unlocksLower);
    }
  });
  return unlocked;
}

/**
 * Adaptive challenge plan by level.
 * Level 1: 3 questions, easy. Level 2-3: 4 questions, easy or medium. Level 4+: 4-5 questions, medium or hard.
 * @returns {{ questionCount: number, difficultyOptions: string[] }}
 */
function getAdaptiveChallengePlan(level, weaknesses) {
  const lvl = Math.max(1, parseInt(level, 10) || 1);
  if (lvl === 1) {
    return { questionCount: 3, difficultyOptions: ['easy'] };
  }
  if (lvl <= 3) {
    return { questionCount: 4, difficultyOptions: ['easy', 'medium'] };
  }
  const questionCount = 4 + (Math.random() < 0.5 ? 0 : 1);
  return { questionCount, difficultyOptions: ['medium', 'hard'] };
}

/**
 * Boss challenge config by tier level. Level 1: easy/5q, Level 2: medium/10q, Level 3: hard/15q.
 * Rewards: XP only (Boss tier 3 = 120 XP).
 */
function getBossConfig(bossLevel) {
  const lvl = Math.max(1, Math.min(3, parseInt(bossLevel, 10) || 1));
  const xpByTier = { 1: BOSS_REWARDS_XP.easy, 2: BOSS_REWARDS_XP.medium, 3: BOSS_REWARDS_XP.boss };
  const xp_reward = xpByTier[lvl] != null ? xpByTier[lvl] : BOSS_REWARDS_XP.easy;
  if (lvl === 1) {
    return { level: 1, difficulty: 'easy', questionCount: 5, xp_reward };
  }
  if (lvl === 2) {
    return { level: 2, difficulty: 'medium', questionCount: 10, xp_reward };
  }
  return { level: 3, difficulty: 'hard', questionCount: 15, xp_reward };
}

/** Difficulty fallback order: try easier if none found */
const DIFFICULTY_FALLBACK_ORDER = ['hard', 'medium', 'easy'];

function pickRandomTopics(topicList, count) {
  const list = (topicList || []).slice();
  for (let i = list.length - 1; i > 0 && count > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [list[i], list[j]] = [list[j], list[i]];
  }
  return list.slice(0, count);
}

function pickDifficultyFromOptions(difficultyOptions, preferred) {
  const opts = difficultyOptions || [];
  if (opts.length === 0) return 'easy';
  const p = (preferred && String(preferred).toLowerCase()) || 'easy';
  if (opts.includes(p)) return p;
  return opts[0];
}

/**
 * GET /api/challenges/daily/:studentId/:classId
 * Returns 3-4 adaptive normal challenges + 1 boss challenge. Uses weaknesses or question_bank fallback.
 */
async function getDailyChallenges(req, res) {
  try {
    const studentId = Number(req.params.studentId);
    const classId = Number(req.params.classId);
    if (!studentId || !classId) {
      return res.status(400).json({ error: 'Invalid student id or class id' });
    }
    const educatorAdminId = Number(req.headers['x-educatoradmin-id']);
    const educatorId = Number(req.headers['x-educator-id']);
    const studentIdHeader = Number(req.headers['x-student-id']);
    if (!isNaN(educatorAdminId)) {
      const ok = await accessControl.canEducatorAdminAccessStudent(educatorAdminId, studentId);
      if (!ok) return res.status(403).json({ error: 'Forbidden' });
    } else if (!isNaN(educatorId)) {
      const ok = await accessControl.canEducatorAccessStudent(educatorId, studentId);
      if (!ok) return res.status(403).json({ error: 'Forbidden' });
    } else if (accessControl.canStudentAccessSelf(studentIdHeader, studentId)) {
      // student reading own data
    } else {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const progress = await studentProgressModel.getProgress(studentId, classId);
    const xp = progress ? Number(progress.xp) || 0 : 0;
    const level = rewardService.levelFromXP(xp);
    const allowed = allowedDifficultiesForLevel(level);
    const unlockedTopics = await getUnlockedTopics(studentId, classId);
    const plan = getAdaptiveChallengePlan(level, []);

    let topicSources = [];
    const performance = await attemptModel.getStudentTopicPerformance(studentId, classId);
    const sorted = (performance || []).slice().sort((a, b) => a.accuracy - b.accuracy);
    const weaknesses = sorted.map(function (row) {
      return {
        topic: row.topic_name != null ? row.topic_name : row.topic,
        topic_id: row.topic_id,
        recommendedDifficulty: difficultyFromAccuracy(row.accuracy),
      };
    });
    console.log('Weakness topics:', weaknesses.length, weaknesses.length ? weaknesses.map(function (w) { return w.topic; }) : []);

    if (weaknesses.length > 0) {
      topicSources = weaknesses;
    } else {
      const bankTopics = await questionBankModel.getTopicsForClass(classId);
      console.log('Fallback topics:', bankTopics.length, bankTopics.length ? bankTopics.map(function (t) { return t.topic_name || t.topic; }) : []);
      if (bankTopics.length === 0) {
        console.log('Generated normal challenges: 0 (no questions in class)');
        console.log('Generated boss challenges: 0');
        return res.json({
          challenges: [],
          level,
          message: 'No questions available yet. Your educator can add questions to the question bank.',
        });
      }
      const pickCount = Math.min(3, bankTopics.length);
      const picked = pickRandomTopics(bankTopics, pickCount);
      topicSources = picked.map(function (row) {
        const topicName = row.topic_name != null ? row.topic_name : row.topic;
        const diff = level <= 1 ? 'easy' : level <= 3 ? (Math.random() < 0.5 ? 'easy' : 'medium') : (Math.random() < 0.5 ? 'medium' : 'hard');
        return {
          topic: topicName,
          topic_id: row.topic_id,
          recommendedDifficulty: allowed.includes(diff) ? diff : (allowed[0] || 'easy'),
        };
      });
    }

    const normalCount = Math.min(3 + (Math.random() < 0.5 ? 0 : 1), Math.max(3, topicSources.length));
    const normalTopics = topicSources.slice(0, Math.max(normalCount, 1));
    const result = [];

    const unlockedLower = (unlockedTopics || []).map(function (t) { return (t || '').toLowerCase().trim(); });
    for (const row of normalTopics) {
      const topicName = row.topic;
      const topicNameLower = (topicName || '').toLowerCase().trim();
      const recommendedDifficulty = pickDifficultyFromOptions(plan.difficultyOptions, row.recommendedDifficulty);
      const topicLocked = unlockedLower.indexOf(topicNameLower) === -1;
      const requiredTopic = topicLocked ? getRequiredTopicFor(topicName) : null;
      const difficultyLocked = !allowed.includes(recommendedDifficulty);
      const requiredLevel = requiredLevelForDifficulty(recommendedDifficulty);
      const locked = topicLocked || difficultyLocked;
      const xp_reward = ADAPTIVE_REWARDS_XP[recommendedDifficulty] != null ? ADAPTIVE_REWARDS_XP[recommendedDifficulty] : ADAPTIVE_REWARDS_XP.easy;
      const item = {
        type: 'normal',
        topic: topicName,
        topic_id: row.topic_id,
        difficulty: recommendedDifficulty,
        recommendedDifficulty: recommendedDifficulty,
        question_count: plan.questionCount,
        estimated_time: Math.max(3, plan.questionCount),
        locked,
        requiredLevel: requiredLevel,
        requiredTopic: requiredTopic || undefined,
        xp_reward,
      };
      result.push(item);
    }

    const currentLevel = Math.max(1, level);
    const bossTiers = [1, 2, 3];
    const bosses = bossTiers.map(function (tier) {
      const config = getBossConfig(tier);
      const locked = tier > currentLevel;
      return {
        type: 'boss',
        level: tier,
        difficulty: config.difficulty,
        question_count: config.questionCount,
        xp_reward: config.xp_reward,
        locked,
        requiredLevel: tier,
        estimated_time: Math.min(10, Math.ceil(config.questionCount / 2)),
      };
    });
    result.push.apply(result, bosses);

    let normalChallenges = result.filter(function (c) { return c.type === 'normal'; });
    let bossChallenges = result.filter(function (c) { return c.type === 'boss'; });

    normalChallenges = normalChallenges.filter(function (c) { return !c.locked; });
    bossChallenges = bossChallenges.filter(function (c) { return !c.locked; });

    const completedToday = await challengeModel.getCompletedTopicsToday(studentId, classId);
    normalChallenges = normalChallenges.filter(function (c) {
      return !completedToday.some(function (t) {
        return t == c.topic_id || (c.topic && String(t).toLowerCase() === String(c.topic).toLowerCase());
      });
    });

    const bossFiltered = [];
    for (let i = 0; i < bossChallenges.length; i++) {
      const b = bossChallenges[i];
      const done = await challengeModel.hasCompletedBoss(studentId, classId, b.level);
      if (!done) bossFiltered.push(b);
    }
    bossChallenges = bossFiltered;

    normalChallenges = normalChallenges.slice(0, 2);
    bossChallenges = bossChallenges.slice(0, 1);

    const dailyChallenges = [...normalChallenges, ...bossChallenges];

    res.json({ challenges: dailyChallenges, level });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to load daily challenges' });
  }
}

async function getChallengeQuestions(req, res) {
  try {
    const studentId = Number(req.headers['x-student-id']);
    if (studentId == null || isNaN(studentId)) {
      return res.status(401).json({ error: 'x-student-id header is required' });
    }
    const type = (req.query.type && String(req.query.type).trim().toLowerCase()) || 'normal';
    const classId = req.query.classId != null ? Number(req.query.classId) : null;
    if (classId == null) {
      return res.status(400).json({ error: 'classId is required' });
    }
    const inClass = await accessControl.isStudentInClass(studentId, classId);
    if (!inClass) {
      return res.status(403).json({ error: 'Forbidden: student not in class' });
    }

    if (type === 'boss') {
      const difficulty = (req.query.difficulty && String(req.query.difficulty).trim()) || 'medium';
      const count = Math.min(Math.max(parseInt(req.query.count, 10) || 10, 1), 50);
      const questions = await questionBankModel.getQuestionsForBossChallenge(classId, difficulty, count);
      console.log('Challenge generated:', type, difficulty, questions.length);
      return res.json({ questions });
    }

    const topic = (req.query.topic && String(req.query.topic).trim()) || '';
    const topicId = req.query.topicId != null ? Number(req.query.topicId) : null;
    if (topicId == null && !topic) {
      return res.status(400).json({ error: 'Topic or topicId is required for normal challenges' });
    }
    let difficulty = (req.query.difficulty && String(req.query.difficulty).trim()) || 'medium';
    const requestedCount = Math.min(Math.max(parseInt(req.query.count, 10) || 5, 1), 50);
    let count = requestedCount;
    const topicOrId = topicId != null && !isNaN(topicId) ? topicId : topic;
    let questions = await questionBankModel.getQuestionsForChallenge(topicOrId, difficulty, count, classId);

    if (questions.length === 0) {
      for (const d of DIFFICULTY_FALLBACK_ORDER) {
        if (d === difficulty) continue;
        questions = await questionBankModel.getQuestionsForChallenge(topicOrId, d, count, classId);
        if (questions.length > 0) {
          difficulty = d;
          break;
        }
      }
    }
    if (questions.length === 0 && count > 3) {
      for (let c = count - 1; c >= 3 && questions.length === 0; c--) {
        questions = await questionBankModel.getQuestionsForChallenge(topicOrId, difficulty, c, classId);
        if (questions.length > 0) count = c;
      }
    }
    if (questions.length === 0) {
      questions = await questionBankModel.getRandomQuestionsFromClass(classId, Math.max(3, count));
    }

    console.log('Challenge questions - topicId:', topicId, 'topic:', topic, 'difficulty:', difficulty, 'requested:', requestedCount, 'returned:', questions.length);
    res.json({ questions });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to load challenge questions' });
  }
}

async function getChallengeHistory(req, res) {
  try {
    const studentId = Number(req.params.studentId);
    const classId = req.query.classId != null ? Number(req.query.classId) : null;
    if (!studentId) {
      return res.status(400).json({ error: 'Invalid student id' });
    }
    const educatorAdminId = Number(req.headers['x-educatoradmin-id']);
    const educatorId = Number(req.headers['x-educator-id']);
    const studentIdHeader = Number(req.headers['x-student-id']);
    if (!isNaN(educatorAdminId)) {
      const ok = await accessControl.canEducatorAdminAccessStudent(educatorAdminId, studentId);
      if (!ok) return res.status(403).json({ error: 'Forbidden' });
    } else if (!isNaN(educatorId)) {
      const ok = await accessControl.canEducatorAccessStudent(educatorId, studentId);
      if (!ok) return res.status(403).json({ error: 'Forbidden' });
    } else if (accessControl.canStudentAccessSelf(studentIdHeader, studentId)) {
      // student reading own data
    } else {
      return res.status(403).json({ error: 'Forbidden' });
    }
    const data = await challengeModel.getChallengeHistory(studentId, classId);
    res.json(data);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to load challenge history' });
  }
}

async function recordComplete(req, res) {
  try {
    const studentId = Number(req.headers['x-student-id']);
    if (studentId == null || isNaN(studentId)) {
      return res.status(401).json({ error: 'x-student-id header is required' });
    }
    const classId = req.body.class_id != null ? Number(req.body.class_id) : null;
    if (!classId) {
      return res.status(400).json({ error: 'class_id is required' });
    }
    const inClass = await accessControl.isStudentInClass(studentId, classId);
    if (!inClass) {
      return res.status(403).json({ error: 'Forbidden: student not in class' });
    }
    const challengeType = (req.body.type && String(req.body.type).trim().toLowerCase()) || 'normal';
    const topic = req.body.topic != null ? String(req.body.topic).trim() : null;
    const topicId = req.body.topic_id != null ? Number(req.body.topic_id) : null;
    if (challengeType !== 'boss' && !topicId && !topic) {
      return res.status(400).json({ error: 'topic or topic_id is required for normal challenges' });
    }
    const difficulty = (req.body.difficulty && String(req.body.difficulty).trim()) || 'easy';
    const score = req.body.score != null ? Number(req.body.score) : null;
    const passGrade = req.body.pass_grade != null ? Number(req.body.pass_grade) : CHALLENGE_PASS_GRADE;

    let xpReward;
    let tier = 1;
    if (challengeType === 'boss') {
      tier = req.body.level != null ? Math.max(1, Math.min(3, parseInt(req.body.level, 10) || 1)) : 1;
      const config = getBossConfig(tier);
      xpReward = config.xp_reward;
    } else {
      xpReward = ADAPTIVE_REWARDS_XP[difficulty] != null ? ADAPTIVE_REWARDS_XP[difficulty] : ADAPTIVE_REWARDS_XP.easy;
    }

    const topicForRecord = challengeType === 'boss' ? 'boss' : topic;
    const topicIdForRecord = challengeType === 'boss' ? tier : topicId;
    await challengeModel.recordChallengeCompletion(studentId, classId, topicForRecord, difficulty, score, topicIdForRecord);
    const passed = score != null && score >= passGrade;
    const xpEarned = passed ? xpReward : Math.floor(xpReward / 2);
    const result = await rewardService.applyRewards(studentId, classId, xpEarned, 0, pool);
    await studentProgressModel.updateStreak(studentId, classId);
    res.status(201).json({
      ok: true,
      passed,
      xpEarned: result.xpAdded,
      leveledUp: result.leveledUp,
      newLevel: result.newLevel,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to record completion' });
  }
}

async function getChallengeStreak(req, res) {
  const studentId = Number(req.params.studentId);
  const classId = Number(req.params.classId);
  if (!studentId || !classId) return res.status(400).json({ error: 'Invalid student id or class id' });
  try {
    const educatorAdminId = Number(req.headers['x-educatoradmin-id']);
    const educatorId = Number(req.headers['x-educator-id']);
    const studentIdHeader = Number(req.headers['x-student-id']);
    if (!isNaN(educatorAdminId)) {
      const ok = await accessControl.canEducatorAdminAccessStudent(educatorAdminId, studentId);
      if (!ok) return res.status(403).json({ error: 'Forbidden' });
    } else if (!isNaN(educatorId)) {
      const ok = await accessControl.canEducatorAccessStudent(educatorId, studentId);
      if (!ok) return res.status(403).json({ error: 'Forbidden' });
    } else if (accessControl.canStudentAccessSelf(studentIdHeader, studentId)) {
      // student reading own data
    } else {
      return res.status(403).json({ error: 'Forbidden' });
    }
    const progress = await studentProgressModel.getProgress(studentId, classId);
    const streak = progress ? (Number(progress.streak) || 0) : 0;
    res.json({ streak });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to load streak' });
  }
}

module.exports = { getDailyChallenges, getChallengeQuestions, getChallengeHistory, recordComplete, getChallengeStreak };
