const express = require('express');
const router = express.Router();
const subscriptionController = require('../controllers/subscriptionController');

router.post('/upgrade', subscriptionController.upgrade);
router.get('/:adminId', subscriptionController.getByAdmin);

module.exports = router;
