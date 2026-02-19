const express = require('express');
const router = express.Router();
const cardController = require('../controllers/cardController');

router.get('/', cardController.getCards);
router.post('/buy', cardController.buyCard);

module.exports = router;
