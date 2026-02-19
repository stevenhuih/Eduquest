const express = require('express');
const router = express.Router();
const reportController = require('../controllers/reportController');

router.get('/class/:classId', reportController.getClassReport);
router.get('/student/me', reportController.getStudentReportMe);
router.post('/student/:studentId/send', reportController.sendStudentReport);
router.get('/student/:studentId', reportController.getStudentReport);
router.get('/file/:reportId', reportController.getReportFile);
router.delete('/student-report/:reportId', reportController.deleteStudentReport);
router.post('/generate-pdf', reportController.generatePdf);
router.get('/export-csv', reportController.exportCsv);

module.exports = router;
