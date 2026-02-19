const express = require('express');
const router = express.Router();
const educatorController = require('../controllers/educatorController');

router.get('/', educatorController.getAll);
router.get('/admin/:adminId', educatorController.getByAdmin);
router.get('/:id', educatorController.getById);
router.post('/', educatorController.create);
router.post('/login', educatorController.login);
router.post('/:id/change-password', educatorController.changePassword);
router.put('/:id', educatorController.update);
router.delete('/:id', educatorController.remove);

module.exports = router;
