const express = require('express');
const router = express.Router();
const topicController = require('../controllers/topicController');

router.get('/class/:classId', topicController.getTopicsByClass);
router.post('/', topicController.createTopic);
router.delete('/:id', topicController.deleteTopic);

module.exports = router;
