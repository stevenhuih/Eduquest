const express = require('express');
const router = express.Router();
const studentController = require('../controllers/studentController');

router.get('/', studentController.getAll);
router.get('/admin/:adminId', studentController.getByAdmin);
router.post('/', studentController.create);
router.post('/login', studentController.login);
router.get('/:id/xp/:classId', studentController.getStudentXPByClass);
router.get('/:id/xp', studentController.getStudentXP);
router.get('/:id/coins', studentController.getStudentCoins);
router.get('/:id/cards', studentController.getStudentCards);
router.get('/:id/reports', studentController.getStudentReports);
router.get('/:id', studentController.getById);
router.put('/:id', studentController.update);
router.post('/:id/change-password', studentController.changePassword);
router.delete('/:id', studentController.remove);

module.exports = router;
