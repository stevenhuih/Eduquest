const express = require('express');
const router = express.Router();
const classController = require('../controllers/classController');

router.get('/', classController.getAllClasses);
router.get('/with-students', classController.getClassesWithStudents);
router.get('/educatoradmin', classController.getClassesForEducatorAdmin);
router.get('/educatoradmin-with-students', classController.getEducatorAdminClassesWithStudents);
router.get('/admin/:adminId/with-students', classController.getClassesWithStudentsByAdmin);
router.get('/admin/:adminId', classController.getClassesByAdmin);
router.post('/', classController.createClass);
router.post('/assign-educator', classController.assignEducatorToClasses);
router.post('/assign-student', classController.assignStudentToClasses);
router.get('/educator/assigned', classController.getAssignedClassesForDashboard);
router.get('/educator/:educatorId/assigned-with-weak-topic', classController.getClassesForEducatorWithWeakTopic);
router.get('/educator/:educatorId/assigned', classController.getClassesForEducator);
router.get('/educator/:educatorId', classController.getClassesForEducator);
router.get('/student/:studentId', classController.getClassesForStudent);
router.get('/:classId/student-analytics', classController.getStudentAnalytics);
router.get('/:classId/overview', classController.getClassOverview);
router.put('/:classId', classController.updateClass);
router.delete('/:classId', classController.deleteClass);
router.get('/:classId', classController.getClassById);
router.post('/:classId/students', classController.assignStudent);

module.exports = router;
