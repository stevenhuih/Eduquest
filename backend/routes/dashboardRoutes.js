const express = require('express');
const router = express.Router();
const dashboardController = require('../controllers/dashboardController');

router.get('/dashboard/educator/today', dashboardController.getEducatorTodayStats);
router.get('/dashboard/educatoradmin/stats', dashboardController.getEducatorAdminStats);

module.exports = router;
