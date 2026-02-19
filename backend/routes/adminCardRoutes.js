const express = require('express');
const router = express.Router();
const adminCardController = require('../controllers/adminCardController');
const uploadCard = require('../middleware/uploadCard');

router.get('/cards', adminCardController.getAllCardsAdmin);
router.post('/cards', uploadCard.single('card_image'), adminCardController.createCardAdmin);
router.put('/cards/:id', adminCardController.updateCardAdmin);
router.delete('/cards/:id', adminCardController.deleteCardAdmin);

module.exports = router;
