const express = require('express');
const router = express.Router();
const shopController = require('../controllers/shopController');

router.get('/rarities', shopController.getRarities);
router.get('/card-image/:filename', shopController.getCardImage);

module.exports = router;
