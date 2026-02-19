const express = require('express');
const router = express.Router();
const contentController = require('../controllers/contentController');

router.get('/landing', contentController.getLanding);
router.put('/landing', contentController.putLanding);

module.exports = router;
