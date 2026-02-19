const express = require('express');
const router = express.Router();
const platformReviewController = require('../controllers/platformReviewController');
const { requirePlatformAdmin } = require('../middleware/requirePlatformAdmin');

// Public: submit platform review (student, educator, educatoradmin via headers)
router.post('/', platformReviewController.create);

// Public: featured reviews for landing page
router.get('/featured', platformReviewController.getFeatured);

// List: platform admin or educator admin (read-only for educator admin)
router.get('/', platformReviewController.requirePlatformAdminOrEducatorAdmin, platformReviewController.list);
router.patch('/:id/approve', requirePlatformAdmin, platformReviewController.approve);
router.patch('/:id/feature', requirePlatformAdmin, platformReviewController.feature);

module.exports = router;
