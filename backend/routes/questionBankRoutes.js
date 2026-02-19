const express = require('express');
const router = express.Router();
const questionBankController = require('../controllers/questionBankController');

router.post('/', questionBankController.createQuestion);
router.get('/class/:classId', questionBankController.getByClassId);
router.put('/:id', questionBankController.updateQuestion);
router.delete('/:id', questionBankController.deleteQuestion);

module.exports = router;
