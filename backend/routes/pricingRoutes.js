const express = require('express');
const pricingController = require('../controllers/pricingController');

const router = express.Router();

router.get('/', pricingController.getPricing);
router.put('/:id', pricingController.putPricing);

module.exports = router;
