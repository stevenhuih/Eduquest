const express = require('express');
const router = express.Router();
const reviewController = require('../controllers/reviewController');

router.post('/', reviewController.create);
router.get('/mine', reviewController.getMine);
router.get('/received', reviewController.getReceived);
router.get('/educator-targets', reviewController.getEducatorTargets);

module.exports = router;
