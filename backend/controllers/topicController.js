const topicModel = require('../models/topicModel');
const accessControl = require('../utils/accessControl');

/**
 * GET /api/topics/class/:classId
 * Access: EducatorAdmin (class owner) or Educator (assigned to class).
 */
async function getTopicsByClass(req, res) {
  try {
    const educatorAdminId = Number(req.headers['x-educatoradmin-id']);
    const educatorId = Number(req.headers['x-educator-id']);
    const classId = parseInt(req.params.classId, 10);
    if (isNaN(classId)) {
      return res.status(400).json({ error: 'Invalid class id' });
    }
    if (!isNaN(educatorAdminId)) {
      const ok = await accessControl.canEducatorAdminAccessClass(educatorAdminId, classId);
      if (!ok) return res.status(403).json({ error: 'Forbidden' });
    } else if (!isNaN(educatorId)) {
      const ok = await accessControl.canEducatorAccessClass(educatorId, classId);
      if (!ok) return res.status(403).json({ error: 'Forbidden' });
    } else {
      return res.status(403).json({ error: 'Forbidden' });
    }
    const topics = await topicModel.getTopicsByClassId(classId);
    console.log('Topics Fetch:', { classId, resultLength: Array.isArray(topics) ? topics.length : 0 });
    res.json(topics);
  } catch (err) {
    console.error('getTopicsByClass error:', err);
    res.status(500).json({ error: err.message || 'Failed to load topics' });
  }
}

/**
 * POST /api/topics
 * Body: { name, class_id }. Access: EducatorAdmin or Educator for class.
 */
async function createTopic(req, res) {
  try {
    const educatorAdminId = Number(req.headers['x-educatoradmin-id']);
    const educatorId = Number(req.headers['x-educator-id']);
    const { name, class_id } = req.body;
    if (!name || typeof name !== 'string' || !String(name).trim()) {
      return res.status(400).json({ error: 'name is required and cannot be empty' });
    }
    const classId = class_id != null ? parseInt(class_id, 10) : NaN;
    if (isNaN(classId)) {
      return res.status(400).json({ error: 'Valid class_id is required' });
    }
    if (!isNaN(educatorAdminId)) {
      const ok = await accessControl.canEducatorAdminAccessClass(educatorAdminId, classId);
      if (!ok) return res.status(403).json({ error: 'Forbidden' });
    } else if (!isNaN(educatorId)) {
      const ok = await accessControl.canEducatorAccessClass(educatorId, classId);
      if (!ok) return res.status(403).json({ error: 'Forbidden' });
    } else {
      return res.status(403).json({ error: 'Forbidden' });
    }
    const topic = await topicModel.createTopic(String(name).trim(), classId);
    res.status(201).json(topic);
  } catch (err) {
    console.error('createTopic error:', err);
    res.status(500).json({ error: err.message || 'Failed to create topic' });
  }
}

/**
 * DELETE /api/topics/:id
 * Access: EducatorAdmin or Educator for the topic's class.
 */
async function deleteTopic(req, res) {
  try {
    const educatorAdminId = Number(req.headers['x-educatoradmin-id']);
    const educatorId = Number(req.headers['x-educator-id']);
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      return res.status(400).json({ error: 'Invalid topic id' });
    }
    const topic = await topicModel.getTopicById(id);
    if (!topic) {
      return res.status(404).json({ error: 'Topic not found' });
    }
    const classId = topic.class_id;
    if (!isNaN(educatorAdminId)) {
      const ok = await accessControl.canEducatorAdminAccessClass(educatorAdminId, classId);
      if (!ok) return res.status(403).json({ error: 'Forbidden' });
    } else if (!isNaN(educatorId)) {
      const ok = await accessControl.canEducatorAccessClass(educatorId, classId);
      if (!ok) return res.status(403).json({ error: 'Forbidden' });
    } else {
      return res.status(403).json({ error: 'Forbidden' });
    }
    await topicModel.deleteTopic(id);
    res.json({ success: true });
  } catch (err) {
    console.error('deleteTopic error:', err);
    res.status(500).json({ error: err.message || 'Failed to delete topic' });
  }
}

module.exports = {
  getTopicsByClass,
  createTopic,
  deleteTopic,
};
