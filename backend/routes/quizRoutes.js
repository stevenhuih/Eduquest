const express = require('express');
const router = express.Router();
const quizController = require('../controllers/quizController');
const attemptController = require('../controllers/attemptController');

router.post('/quizzes', quizController.createQuiz);
router.get('/quizzes', quizController.getAllQuizzes);
router.get('/quizzes/class/:classId', quizController.getQuizzesByClass);
router.get('/quizzes/:id', quizController.getQuizById);
router.put('/quizzes/:id', quizController.updateQuiz);
router.delete('/quizzes/:id', quizController.deleteQuiz);
router.get('/challenge/:studentId', quizController.getChallenge);

router.post('/attempts', attemptController.createAttempt);
router.get('/attempts/class-performance/:classId', attemptController.getWeakestTopicForClass);
router.get('/attempts/performance/class/:classId', attemptController.getClassTopicPerformance);
router.get('/attempts/topic-performance/:studentId/:topic', attemptController.getTopicPerformanceForTopic);
router.get('/attempts/performance/:studentId/:classId', attemptController.getTopicPerformanceForClass);
router.get('/attempts/performance/:studentId', attemptController.getTopicPerformance);

module.exports = router;
