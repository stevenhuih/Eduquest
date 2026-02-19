const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');

router.post('/signup', adminController.create);
router.post('/login', adminController.login);
router.get('/', adminController.getAllAdmins);
router.get('/:id', adminController.getProfile);
router.put('/:id', adminController.updateProfile);
router.post('/:id/change-password', adminController.changePassword);

module.exports = router;
