const express = require('express');
const router = express.Router();
const challengeController = require('../controllers/challengeController');

router.get('/daily/:studentId/:classId', challengeController.getDailyChallenges);
router.get('/history/:studentId', challengeController.getChallengeHistory);
router.get('/streak/:studentId/:classId', challengeController.getChallengeStreak);
router.get('/questions', challengeController.getChallengeQuestions);
router.post('/complete', challengeController.recordComplete);

module.exports = router;
