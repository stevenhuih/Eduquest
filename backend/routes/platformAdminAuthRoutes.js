const express = require('express');
const router = express.Router();
const platformAdminAuthController = require('../controllers/platformAdminAuthController');
const platformAdminEducatorAdminsController = require('../controllers/platformAdminEducatorAdminsController');
const { requirePlatformAdmin } = require('../middleware/requirePlatformAdmin');

router.post('/login', platformAdminAuthController.login);
router.get('/me', requirePlatformAdmin, platformAdminAuthController.me);

router.get('/educator-admins', requirePlatformAdmin, platformAdminEducatorAdminsController.list);
router.patch('/educator-admins/:id/status', requirePlatformAdmin, platformAdminEducatorAdminsController.updateStatus);
router.patch('/educator-admins/:id/subscription', requirePlatformAdmin, platformAdminEducatorAdminsController.updateSubscription);

module.exports = router;
